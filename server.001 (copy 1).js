// Enhanced Crowley App server implementation with comprehensive delete functionality
// This version includes admin-restricted deletion for projects and sprints,
// plus enhanced issue deletion with proper permission checks.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

// Check if formidable is installed
let formidable;
try {
  formidable = require('formidable');
} catch (err) {
  console.warn('Formidable not installed. File uploads will not work. Run: npm install formidable');
}

/*
 * Crowley App - Modern Project Management System
 * Enhanced backend with comprehensive delete functionality and admin controls
 */

// Configuration
const CONFIG = {
  PORT: process.env.PORT || 3000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SESSION_CLEANUP_INTERVAL: 3600000, // 1 hour
  SESSION_EXPIRY: 86400000 * 7, // 7 days
};

// Location of our JSON data files
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure directories exist
[DATA_DIR, UPLOADS_DIR, PUBLIC_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Helper to read a JSON file and parse its contents
function readJson(fileName) {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, { encoding: 'utf8' });
    return JSON.parse(raw || 'null');
  } catch (err) {
    console.error(`Error reading ${fileName}:`, err);
    return null;
  }
}

// Helper to write a JavaScript object back to disk as JSON
function writeJson(fileName, data) {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${fileName}:`, err);
    throw err;
  }
}

// Initialize data files if they don't exist
function initializeDataFile(fileName, defaultData) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    writeJson(fileName, defaultData);
  }
}

// Generate a unique identifier
function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// Return a SHA256 hash of the supplied password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// List of valid user roles
const VALID_ROLES = ['admin', 'project_manager', 'developer', 'viewer'];

// Read/write functions for all data types
function readUsers() {
  return readJson('users.json') || [];
}

function writeUsers(users) {
  writeJson('users.json', users);
}

function readProjects() {
  return readJson('projects.json') || [];
}

function writeProjects(projects) {
  writeJson('projects.json', projects);
}

function readIssues() {
  return readJson('issues.json') || [];
}

function writeIssues(issues) {
  writeJson('issues.json', issues);
}

function readSprints() {
  return readJson('sprints.json') || [];
}

function writeSprints(sprints) {
  writeJson('sprints.json', sprints);
}

function readWorkflows() {
  return readJson('workflows.json') || [];
}

function writeWorkflows(workflows) {
  writeJson('workflows.json', workflows);
}

function readNotifications() {
  return readJson('notifications.json') || [];
}

function writeNotifications(notifications) {
  writeJson('notifications.json', notifications);
}

function readAttachments() {
  return readJson('attachments.json') || [];
}

function writeAttachments(attachments) {
  writeJson('attachments.json', attachments);
}

function readSessions() {
  return readJson('sessions.json') || {};
}

function writeSessions(sessions) {
  writeJson('sessions.json', sessions);
}

// Clean up expired sessions
function cleanupSessions() {
  const sessions = readSessions();
  const now = Date.now();
  let changed = false;
  
  for (const token in sessions) {
    if (now - sessions[token].createdAt > CONFIG.SESSION_EXPIRY) {
      delete sessions[token];
      changed = true;
    }
  }
  
  if (changed) {
    writeSessions(sessions);
  }
}

// Schedule session cleanup
setInterval(cleanupSessions, CONFIG.SESSION_CLEANUP_INTERVAL);

// Create notifications for multiple users
function sendNotification(userIds, message) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  
  const notifications = readNotifications();
  const uniqueUserIds = [...new Set(userIds)];
  
  for (const userId of uniqueUserIds) {
    notifications.push({
      id: generateId(),
      userId,
      message: String(message),
      read: false,
      createdAt: new Date().toISOString(),
    });
  }
  
  writeNotifications(notifications);
}

// Helper to get or create a workflow for a project
function ensureWorkflow(projectId) {
  let workflows = readWorkflows();
  let wf = workflows.find(w => w.projectId === projectId);
  
  if (!wf) {
    wf = {
      projectId,
      statuses: ['To Do', 'In Progress', 'Done'],
      transitions: {},
    };
    workflows.push(wf);
    writeWorkflows(workflows);
  }
  
  return wf;
}

// Authenticate a request by inspecting the Authorization header
function authenticate(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;
    
  const sessions = readSessions();
  const sess = sessions[token];
  if (!sess) return null;
  
  // Check if session has expired
  if (Date.now() - sess.createdAt > CONFIG.SESSION_EXPIRY) {
    delete sessions[token];
    writeSessions(sessions);
    return null;
  }
  
  const users = readUsers();
  const user = users.find(u => u.id === sess.userId);
  return user || null;
}

// Parse JSON body of a request
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        const json = JSON.parse(body);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Handle file uploads with formidable (if available)
function parseFormData(req) {
  return new Promise((resolve, reject) => {
    if (!formidable) {
      reject(new Error('Formidable not installed'));
      return;
    }
    
    const form = new formidable.IncomingForm({
      uploadDir: UPLOADS_DIR,
      keepExtensions: true,
      maxFileSize: CONFIG.MAX_FILE_SIZE,
      multiples: true
    });
    
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        resolve({ fields, files });
      }
    });
  });
}

// Save file attachment
function saveAttachment(file, issueId, uploadedBy) {
  const fileExtension = path.extname(file.originalFilename || file.name);
  const uniqueFilename = `${generateId()}${fileExtension}`;
  const finalPath = path.join(UPLOADS_DIR, uniqueFilename);
  
  // Move file to final location
  fs.renameSync(file.filepath || file.path, finalPath);
  
  const attachment = {
    id: generateId(),
    issueId,
    originalName: file.originalFilename || file.name,
    filename: uniqueFilename,
    size: file.size,
    mimetype: file.mimetype || file.type,
    uploadedBy,
    uploadedAt: new Date().toISOString()
  };
  
  const attachments = readAttachments();
  attachments.push(attachment);
  writeAttachments(attachments);
  
  return attachment;
}

// Delete attachment file
function deleteAttachment(attachmentId) {
  const attachments = readAttachments();
  const attachment = attachments.find(a => a.id === attachmentId);
  
  if (!attachment) {
    return false;
  }
  
  // Delete physical file
  const filePath = path.join(UPLOADS_DIR, attachment.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  // Remove from database
  const updatedAttachments = attachments.filter(a => a.id !== attachmentId);
  writeAttachments(updatedAttachments);
  
  return true;
}

// Enhanced delete functions with comprehensive cleanup

// Delete all attachments for multiple issues
function deleteAttachmentsForIssues(issueIds) {
  const attachments = readAttachments();
  const toDelete = attachments.filter(a => issueIds.includes(a.issueId));
  
  // Delete physical files
  toDelete.forEach(attachment => {
    const filePath = path.join(UPLOADS_DIR, attachment.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Failed to delete file ${attachment.filename}:`, err);
      }
    }
  });
  
  // Remove from database
  const remaining = attachments.filter(a => !issueIds.includes(a.issueId));
  writeAttachments(remaining);
  
  return toDelete.length;
}

// Delete all notifications related to specific issues
function deleteNotificationsForIssues(issueIds, issuesTitles) {
  const notifications = readNotifications();
  const issueTitleSet = new Set(issuesTitles);
  
  const remaining = notifications.filter(n => {
    // Remove notifications that mention any of the deleted issues
    return !issueTitleSet.some(title => n.message.includes(title));
  });
  
  const deletedCount = notifications.length - remaining.length;
  if (deletedCount > 0) {
    writeNotifications(remaining);
  }
  
  return deletedCount;
}

// Comprehensive project deletion
function deleteProjectCompletely(projectId) {
  const projects = readProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) {
    throw new Error('Project not found');
  }
  
  console.log(`🗑️ Starting comprehensive deletion of project: ${project.name}`);
  
  // Get all related data
  const issues = readIssues().filter(i => i.projectId === projectId);
  const sprints = readSprints().filter(s => s.projectId === projectId);
  const workflows = readWorkflows().filter(w => w.projectId === projectId);
  
  const issueIds = issues.map(i => i.id);
  const issueTitles = issues.map(i => i.title);
  const sprintIds = sprints.map(s => s.id);
  
  // Delete attachments
  const deletedAttachments = deleteAttachmentsForIssues(issueIds);
  console.log(`🗑️ Deleted ${deletedAttachments} attachments`);
  
  // Delete notifications
  const deletedNotifications = deleteNotificationsForIssues(issueIds, issueTitles);
  console.log(`🗑️ Deleted ${deletedNotifications} notifications`);
  
  // Delete issues
  const allIssues = readIssues();
  const remainingIssues = allIssues.filter(i => i.projectId !== projectId);
  writeIssues(remainingIssues);
  console.log(`🗑️ Deleted ${issues.length} issues`);
  
  // Delete sprints
  const allSprints = readSprints();
  const remainingSprints = allSprints.filter(s => s.projectId !== projectId);
  writeSprints(remainingSprints);
  console.log(`🗑️ Deleted ${sprints.length} sprints`);
  
  // Delete workflows
  const allWorkflows = readWorkflows();
  const remainingWorkflows = allWorkflows.filter(w => w.projectId !== projectId);
  writeWorkflows(remainingWorkflows);
  console.log(`🗑️ Deleted ${workflows.length} workflows`);
  
  // Delete project
  const remainingProjects = projects.filter(p => p.id !== projectId);
  writeProjects(remainingProjects);
  console.log(`🗑️ Deleted project: ${project.name}`);
  
  return {
    project: project.name,
    deletedIssues: issues.length,
    deletedSprints: sprints.length,
    deletedAttachments,
    deletedNotifications,
    deletedWorkflows: workflows.length
  };
}

// Comprehensive sprint deletion
function deleteSprintCompletely(sprintId) {
  const sprints = readSprints();
  const sprint = sprints.find(s => s.id === sprintId);
  if (!sprint) {
    throw new Error('Sprint not found');
  }
  
  console.log(`🗑️ Starting deletion of sprint: ${sprint.name}`);
  
  // Remove sprint assignment from all issues (move to backlog)
  const issues = readIssues();
  let movedIssues = 0;
  
  issues.forEach(issue => {
    if (issue.sprintId === sprintId) {
      issue.sprintId = null;
      issue.updatedAt = new Date().toISOString();
      movedIssues++;
    }
  });
  
  if (movedIssues > 0) {
    writeIssues(issues);
    console.log(`🗑️ Moved ${movedIssues} issues to backlog`);
  }
  
  // Delete sprint notifications
  const notifications = readNotifications();
  const remainingNotifications = notifications.filter(n => 
    !n.message.includes(`"${sprint.name}"`) && 
    !n.message.includes(`Sprint "${sprint.name}"`)
  );
  const deletedNotifications = notifications.length - remainingNotifications.length;
  
  if (deletedNotifications > 0) {
    writeNotifications(remainingNotifications);
    console.log(`🗑️ Deleted ${deletedNotifications} sprint notifications`);
  }
  
  // Delete the sprint
  const remainingSprints = sprints.filter(s => s.id !== sprintId);
  writeSprints(remainingSprints);
  console.log(`🗑️ Deleted sprint: ${sprint.name}`);
  
  return {
    sprint: sprint.name,
    movedIssues,
    deletedNotifications
  };
}

// Initialize data files on startup
initializeDataFile('users.json', []);
initializeDataFile('projects.json', []);
initializeDataFile('issues.json', []);
initializeDataFile('sprints.json', []);
initializeDataFile('workflows.json', []);
initializeDataFile('notifications.json', []);
initializeDataFile('sessions.json', {});
initializeDataFile('attachments.json', []);

// Log application start with the new branding
console.log('🏆 Crowley App - Modern Project Management System (Enhanced Edition)');
console.log('📁 Data directory:', DATA_DIR);
console.log('📎 Uploads directory:', UPLOADS_DIR);
console.log('🌐 Public directory:', PUBLIC_DIR);
console.log('🗑️ Enhanced delete functionality enabled');

// Basic HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method.toUpperCase();
  const pathname = parsedUrl.pathname;

  // Enhanced CORS handling
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  
  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }
  
  // Set CORS headers for all requests
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });
  
  try {
    // Serve uploaded files
    if (pathname.startsWith('/uploads/') && method === 'GET') {
      const filename = pathname.substring(9);
      const filePath = path.join(UPLOADS_DIR, filename);
      
      // Security check
      if (!filePath.startsWith(UPLOADS_DIR) || filename.includes('..')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }
      
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      // Determine content type
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.zip': 'application/zip',
        '.csv': 'text/csv'
      };
      
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=31536000'
      });
      
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      return;
    }
    
    // Static file serving for non-API GET requests
    if (!pathname.startsWith('/api') && method === 'GET') {
      let filePath = pathname === '/' ? '/index.html' : pathname;
      const resolved = path.join(PUBLIC_DIR, decodeURIComponent(filePath));
      
      // Security check for directory traversal
      if (!resolved.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      
      // If file doesn't exist in public, check root directory (for backward compatibility)
      if (!fs.existsSync(resolved)) {
        const rootPath = path.join(__dirname, decodeURIComponent(filePath));
        if (fs.existsSync(rootPath) && !rootPath.includes('..') && rootPath.startsWith(__dirname)) {
          fs.readFile(rootPath, (err, content) => {
            if (err) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not found');
              return;
            }
            
            const ext = path.extname(rootPath).toLowerCase();
            const mimeTypes = {
              '.html': 'text/html',
              '.css': 'text/css',
              '.js': 'application/javascript',
              '.json': 'application/json',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.svg': 'image/svg+xml',
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
          });
          return;
        }
      }
      
      fs.readFile(resolved, (err, content) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        
        const ext = path.extname(resolved).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
      return;
    }
    
    // Health check endpoint
    if (pathname === '/api/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ok', 
        name: 'Crowley App Enhanced',
        version: '2.1.0',
        features: ['enhanced_delete', 'admin_controls', 'comprehensive_cleanup'],
        uptime: process.uptime() 
      }));
      return;
    }
    
    // Registration endpoint
    if (method === 'POST' && pathname === '/api/register') {
      const body = await parseBody(req);
      const { email, password, role } = body;
      
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      
      if (role && !VALID_ROLES.includes(role)) {
        throw new Error('Invalid role');
      }
      
      const users = readUsers();
      if (users.find(u => u.email === email.toLowerCase())) {
        throw new Error('Email already exists');
      }
      
      const user = {
        id: generateId(),
        email: String(email).toLowerCase(),
        passwordHash: hashPassword(password),
        role: role || 'developer',
        createdAt: new Date().toISOString(),
      };
      
      users.push(user);
      writeUsers(users);
      
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        message: 'User registered', 
        user: { id: user.id, email: user.email, role: user.role } 
      }));
      return;
    }
    
    // Login endpoint
    if (method === 'POST' && pathname === '/api/login') {
      const body = await parseBody(req);
      const { email, password } = body;
      
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      const users = readUsers();
      const user = users.find(u => u.email === String(email).toLowerCase());
      
      if (!user || user.passwordHash !== hashPassword(password)) {
        throw new Error('Invalid credentials');
      }
      
      const sessions = readSessions();
      const token = crypto.randomBytes(16).toString('hex');
      sessions[token] = { userId: user.id, createdAt: Date.now() };
      writeSessions(sessions);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        token, 
        user: { id: user.id, email: user.email, role: user.role } 
      }));
      return;
    }
    
    // Logout endpoint
    if (method === 'POST' && pathname === '/api/logout') {
      const authHeader = req.headers['authorization'];
      if (authHeader) {
        const token = authHeader.startsWith('Bearer ')
          ? authHeader.slice(7)
          : authHeader;
        
        const sessions = readSessions();
        delete sessions[token];
        writeSessions(sessions);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Logged out successfully' }));
      return;
    }
    
    // All routes below require authentication
    const currentUser = authenticate(req);
    if (!currentUser) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    
    // Get current user
    if (method === 'GET' && pathname === '/api/me') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        id: currentUser.id, 
        email: currentUser.email, 
        role: currentUser.role 
      }));
      return;
    }
    
    // List all users (admin only)
    if (method === 'GET' && pathname === '/api/users') {
      if (currentUser.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      
      const users = readUsers().map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(users));
      return;
    }
    
    // List all projects
    if (method === 'GET' && pathname === '/api/projects') {
      const projects = readProjects();
      const users = readUsers();
      
      // Add owner email to projects
      const projectsWithOwner = projects.map(p => {
        const owner = users.find(u => u.id === p.ownerId);
        return {
          ...p,
          ownerEmail: owner ? owner.email : null
        };
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(projectsWithOwner));
      return;
    }
    
    // Get single project
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.split('/').length === 4) {
      const projectId = pathname.split('/')[3];
      const projects = readProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      
      const users = readUsers();
      const owner = users.find(u => u.id === project.ownerId);
      const lead = project.leadId ? users.find(u => u.id === project.leadId) : null;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...project,
        ownerEmail: owner ? owner.email : null,
        leadEmail: lead ? lead.email : null
      }));
      return;
    }
    
    // Create a new project
    if (method === 'POST' && pathname === '/api/projects') {
      if (!['admin', 'project_manager'].includes(currentUser.role)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      
      const body = await parseBody(req);
      const { name, key, description, lead_id } = body;
      
      if (!name || !key) {
        throw new Error('Project name and key are required');
      }
      
      const projects = readProjects();
      
      // Check if key already exists
      if (projects.find(p => p.key === key.toUpperCase())) {
        throw new Error('Project key already exists');
      }
      
      // Validate lead_id if provided
      if (lead_id) {
        const users = readUsers();
        const leadUser = users.find(u => u.id === lead_id);
        if (!leadUser) {
          throw new Error('Lead user not found');
        }
      }
      
      const newProject = {
        id: generateId(),
        name: String(name),
        key: String(key).toUpperCase(),
        description: description || '',
        ownerId: currentUser.id,
        leadId: lead_id || null,
        createdAt: new Date().toISOString(),
      };
      
      projects.push(newProject);
      writeProjects(projects);
      
      // Initialize workflow for new project
      ensureWorkflow(newProject.id);
      
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newProject));
      return;
    }
    
    // Update project
    if (method === 'PUT' && pathname.startsWith('/api/projects/')) {
      const projectId = pathname.split('/')[3];
      const projects = readProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      
      // Check permissions
      if (currentUser.role !== 'admin' && currentUser.id !== project.ownerId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      
      const body = await parseBody(req);
      const { name, description, lead_id } = body;
      
      if (name) project.name = String(name);
      if (description !== undefined) project.description = String(description);
      if (lead_id !== undefined) {
        if (lead_id) {
          const users = readUsers();
          const leadUser = users.find(u => u.id === lead_id);
          if (!leadUser) {
            throw new Error('Lead user not found');
          }
        }
        project.leadId = lead_id;
      }
      
      project.updatedAt = new Date().toISOString();
      writeProjects(projects);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(project));
      return;
    }
    
    // ENHANCED: Delete project (admin only)
    if (method === 'DELETE' && pathname.startsWith('/api/projects/') && pathname.split('/').length === 4) {
      const projectId = pathname.split('/')[3];
      
      // Only admin can delete projects
      if (currentUser.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Only administrators can delete projects' }));
        return;
      }
      
      try {
        const deletionResult = deleteProjectCompletely(projectId);
        
        // Send notification to project stakeholders
        const users = readUsers();
        const stakeholderIds = users.filter(u => 
          ['admin', 'project_manager'].includes(u.role) && u.id !== currentUser.id
        ).map(u => u.id);
        
        sendNotification(
          stakeholderIds, 
          `🗑️ Project "${deletionResult.project}" was deleted by ${currentUser.email}`
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          message: 'Project deleted successfully',
          details: deletionResult
        }));
      } catch (err) {
        console.error('Error deleting project:', err);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
    
    // List issues for a project
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/issues')) {
      const projectId = pathname.split('/')[3];
      
      const projects = readProjects();
      if (!projects.find(p => p.id === projectId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      
      const issues = readIssues();
      const attachments = readAttachments();
      const users = readUsers();
      
      const projectIssues = issues.filter(i => i.projectId === projectId).map(issue => {
        const creator = users.find(u => u.id === issue.creatorId);
        const assignee = issue.assignee ? users.find(u => u.id === issue.assignee) : null;
        
        return {
          ...issue,
          creatorEmail: creator ? creator.email : null,
          assigneeEmail: assignee ? assignee.email : null,
          attachments: attachments.filter(a => a.issueId === issue.id)
        };
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(projectIssues));
      return;
    }
    
    // Get single issue with attachments
    if (method === 'GET' && pathname.startsWith('/api/issues/') && !pathname.includes('/attachments')) {
      const issueId = pathname.split('/')[3];
      
      const issues = readIssues();
      const issue = issues.find(i => i.id === issueId);
      
      if (!issue) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Issue not found' }));
        return;
      }
      
      // Include attachments and user info
      const attachments = readAttachments();
      const users = readUsers();
      const creator = users.find(u => u.id === issue.creatorId);
      const assignee = issue.assignee ? users.find(u => u.id === issue.assignee) : null;
      
      const enrichedIssue = {
        ...issue,
        creatorEmail: creator ? creator.email : null,
        assigneeEmail: assignee ? assignee.email : null,
        attachments: attachments.filter(a => a.issueId === issue.id)
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(enrichedIssue));
      return;
    }
    
    // Create an issue with optional file uploads
    if (method === 'POST' && pathname === '/api/issues') {
      if (currentUser.role === 'viewer') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      
      let body, files = {};
      
      // Check if this is a form data request (with files)
      if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        if (!formidable) {
          throw new Error('File uploads not supported. Please install formidable: npm install formidable');
        }
        const formData = await parseFormData(req);
        body = {};
        
        // Convert form fields to body object
        Object.keys(formData.fields).forEach(key => {
          body[key] = Array.isArray(formData.fields[key]) ? formData.fields[key][0] : formData.fields[key];
        });
        
        files = formData.files;
      } else {
        body = await parseBody(req);
      }
      
      const {
        projectId,
        title,
        description,
        priority,
        status,
        assignee,
        dueDate,
        labels,
        parentId,
        sprintId,
      } = body;
      
      if (!projectId || !title) {
        throw new Error('projectId and title are required');
      }
      
      // Validate project exists
      const projects = readProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      
      // Ensure workflow exists and validate status
      const workflow = ensureWorkflow(projectId);
      let issueStatus;
      if (status) {
        if (!workflow.statuses.includes(status)) {
          throw new Error('Invalid status');
        }
        issueStatus = status;
      } else {
        issueStatus = workflow.statuses[0];
      }
      
      // Validate assignee if provided
      if (assignee) {
        const users = readUsers();
        const assignedUser = users.find(u => u.id === assignee);
        if (!assignedUser) {
          throw new Error('Assignee not found');
        }
      }
      
      // Validate parent issue if provided
      if (parentId) {
        const issues = readIssues();
        const parentIssue = issues.find(i => i.id === parentId && i.projectId === projectId);
        if (!parentIssue) {
          throw new Error('Parent issue not found');
        }
      }
      
      // Validate sprint if provided
      if (sprintId) {
        const sprints = readSprints();
        const sprint = sprints.find(s => s.id === sprintId && s.projectId === projectId);
        if (!sprint) {
          throw new Error('Sprint not found');
        }
      }
      
      const issues = readIssues();
      const newIssue = {
        id: generateId(),
        projectId,
        title: String(title),
        description: description ? String(description) : '',
        priority: priority || 'Medium',
        status: issueStatus,
        assignee: assignee || null,
        dueDate: dueDate || null,
        labels: Array.isArray(labels) ? labels : (labels ? labels.split(',').map(l => l.trim()) : []),
        parentId: parentId || null,
        sprintId: sprintId || null,
        creatorId: currentUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      issues.push(newIssue);
      writeIssues(issues);
      
      // Handle file attachments
      const attachments = [];
      if (formidable && files && Object.keys(files).length > 0) {
        Object.values(files).forEach(fileArray => {
          const fileList = Array.isArray(fileArray) ? fileArray : [fileArray];
          fileList.forEach(file => {
            if (file && file.size > 0) {
              const attachment = saveAttachment(file, newIssue.id, currentUser.id);
              attachments.push(attachment);
            }
          });
        });
      }
      
      // Include attachments in response
      newIssue.attachments = attachments;
      
      // Send notifications
      const notifyIds = [];
      if (assignee && assignee !== currentUser.id) notifyIds.push(assignee);
      if (project.ownerId && project.ownerId !== currentUser.id) {
        notifyIds.push(project.ownerId);
      }
      sendNotification(notifyIds, `New issue "${newIssue.title}" created in project ${project.name}`);
      
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newIssue));
      return;
    }
    
    // Update an issue with optional file uploads
    if (method === 'PUT' && pathname.startsWith('/api/issues/')) {
      const issueId = pathname.split('/')[3];
      
      const issues = readIssues();
      const issue = issues.find(i => i.id === issueId);
      if (!issue) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Issue not found' }));
        return;
      }
      
      // Check permissions
      const projects = readProjects();
      const project = projects.find(p => p.id === issue.projectId);
      const isProjectOwner = project && project.ownerId === currentUser.id;
      const canEdit =
        currentUser.role === 'admin' ||
        currentUser.id === issue.creatorId ||
        currentUser.id === issue.assignee ||
        isProjectOwner;
        
      if (!canEdit) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      
      let body, files = {};
      
      // Check if this is a form data request (with files)
      if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        if (!formidable) {
          throw new Error('File uploads not supported. Please install formidable: npm install formidable');
        }
        const formData = await parseFormData(req);
        body = {};
        
        // Convert form fields to body object
        Object.keys(formData.fields).forEach(key => {
          body[key] = Array.isArray(formData.fields[key]) ? formData.fields[key][0] : formData.fields[key];
        });
        
        files = formData.files;
      } else {
        body = await parseBody(req);
      }
      
      const allowed = ['title', 'description', 'priority', 'status', 'assignee', 'dueDate', 'labels', 'parentId', 'sprintId'];
      
      let notifyChangedStatus = false;
      let notifyChangedAssignee = false;
      const oldStatus = issue.status;
      const oldAssignee = issue.assignee;
      
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          if (key === 'status') {
            const workflow = ensureWorkflow(issue.projectId);
            const newStatus = body[key];
            if (!workflow.statuses.includes(newStatus)) {
              throw new Error('Invalid status');
            }
            if (newStatus !== issue.status) {
              notifyChangedStatus = true;
              issue.status = newStatus;
            }
            continue;
          }
          
          if (key === 'assignee') {
            const newAssignee = body[key] || null;
            if (newAssignee) {
              const users = readUsers();
              const exists = users.find(u => u.id === newAssignee);
              if (!exists) {
                throw new Error('Assignee not found');
              }
            }
            if (newAssignee !== issue.assignee) {
              notifyChangedAssignee = true;
              issue.assignee = newAssignee;
            }
            continue;
          }
          
          if (key === 'parentId') {
            const newParentId = body[key] || null;
            if (newParentId) {
              const parentIssue = issues.find(i => i.id === newParentId && i.projectId === issue.projectId);
              if (!parentIssue) {
                throw new Error('Parent issue not found');
              }
              // Prevent circular references
              if (newParentId === issue.id) {
                throw new Error('Issue cannot be its own parent');
              }
            }
            issue.parentId = newParentId;
            continue;
          }
          
          if (key === 'sprintId') {
            const newSprintId = body[key] || null;
            if (newSprintId) {
              const sprints = readSprints();
              const sprint = sprints.find(s => s.id === newSprintId && s.projectId === issue.projectId);
              if (!sprint) {
                throw new Error('Sprint not found');
              }
            }
            issue.sprintId = newSprintId;
            continue;
          }
          
          if (key === 'labels') {
            issue[key] = Array.isArray(body[key]) ? body[key] : (body[key] ? body[key].split(',').map(l => l.trim()) : []);
            continue;
          }
          
          issue[key] = body[key];
        }
      }
      
      issue.updatedAt = new Date().toISOString();
      writeIssues(issues);
      
      // Handle new file attachments
      const newAttachments = [];
      if (formidable && files && Object.keys(files).length > 0) {
        Object.values(files).forEach(fileArray => {
          const fileList = Array.isArray(fileArray) ? fileArray : [fileArray];
          fileList.forEach(file => {
            if (file && file.size > 0) {
              const attachment = saveAttachment(file, issue.id, currentUser.id);
              newAttachments.push(attachment);
            }
          });
        });
      }
      
      // Get all attachments for this issue
      const attachments = readAttachments();
      issue.attachments = attachments.filter(a => a.issueId === issue.id);
      
      // Send notifications
      if (notifyChangedStatus) {
        const notifyIds = [];
        if (issue.assignee && issue.assignee !== currentUser.id) notifyIds.push(issue.assignee);
        if (project && project.ownerId && project.ownerId !== currentUser.id) notifyIds.push(project.ownerId);
        sendNotification(notifyIds, `Issue "${issue.title}" status changed to ${issue.status}`);
      }
      
      if (notifyChangedAssignee && issue.assignee && issue.assignee !== currentUser.id) {
        sendNotification([issue.assignee], `You have been assigned issue "${issue.title}"`);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(issue));
      return;
    }
    
    // ENHANCED: Delete issue
    if (method === 'DELETE' && pathname.startsWith('/api/issues/') && pathname.split('/').length === 4) {
      const issueId = pathname.split('/')[3];
      
      const issues = readIssues();
      const issue = issues.find(i => i.id === issueId);
      if (!issue) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Issue not found' }));
        return;
      }
      
      // Enhanced permission check
      const projects = readProjects();
      const project = projects.find(p => p.id === issue.projectId);
      const isProjectOwner = project && project.ownerId === currentUser.id;
      const canDelete =
        currentUser.role === 'admin' ||
        currentUser.id === issue.creatorId ||
        currentUser.id === issue.assignee ||
        isProjectOwner;
        
      if (!canDelete) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden: You can only delete issues you created, are assigned to, or own the project' }));
        return;
      }
      
      console.log(`🗑️ Deleting issue: ${issue.title} (by ${currentUser.email})`);
      
      // Delete associated attachments
      const attachments = readAttachments();
      const issueAttachments = attachments.filter(a => a.issueId === issueId);
      let deletedFiles = 0;
      
      issueAttachments.forEach(attachment => {
        const filePath = path.join(UPLOADS_DIR, attachment.filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            deletedFiles++;
          } catch (err) {
            console.error(`Failed to delete file ${attachment.filename}:`, err);
          }
        }
      });
      
      // Remove attachments from database
      const updatedAttachments = attachments.filter(a => a.issueId !== issueId);
      writeAttachments(updatedAttachments);
      
      // Delete related notifications
      const notifications = readNotifications();
      const updatedNotifications = notifications.filter(n => 
        !n.message.includes(`"${issue.title}"`)
      );
      const deletedNotifications = notifications.length - updatedNotifications.length;
      if (deletedNotifications > 0) {
        writeNotifications(updatedNotifications);
      }
      
      // Remove issue
      const updatedIssues = issues.filter(i => i.id !== issueId);
      writeIssues(updatedIssues);
      
      console.log(`🗑️ Issue deletion complete: ${deletedFiles} files, ${issueAttachments.length} attachments, ${deletedNotifications} notifications`);
      
      // Send notification to project stakeholders
      if (project) {
        const notifyIds = [];
        if (project.ownerId && project.ownerId !== currentUser.id) notifyIds.push(project.ownerId);
        if (issue.assignee && issue.assignee !== currentUser.id) notifyIds.push(issue.assignee);
        
        sendNotification(notifyIds, `Issue "${issue.title}" was deleted by ${currentUser.email}`);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        message: 'Issue deleted successfully',
        details: {
          deletedAttachments: issueAttachments.length,
          deletedFiles,
          deletedNotifications
        }
      }));
      return;
    }
    
    // Delete attachment
    if (method === 'DELETE' && pathname.startsWith('/api/issues/') && pathname.includes('/attachments/')) {
      const parts = pathname.split('/');
      const issueId = parts[3];
      const attachmentId = parts[5];
      
      const issues = readIssues();
      const issue = issues.find(i => i.id === issueId);
      if (!issue) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Issue not found' }));
        return;
      }
      
      // Check permissions
      const projects = readProjects();
      const project = projects.find(p => p.id === issue.projectId);
      const isProjectOwner = project && project.ownerId === currentUser.id;
      const canEdit =
        currentUser.role === 'admin' ||
        currentUser.id === issue.creatorId ||
        currentUser.id === issue.assignee ||
        isProjectOwner;
        
      if (!canEdit) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      
      if (deleteAttachment(attachmentId)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Attachment deleted' }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Attachment not found' }));
      }
      return;
    }
    
    // Get workflow for a project
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/workflow')) {
      const projectId = pathname.split('/')[3];
      
      const projects = readProjects();
      if (!projects.find(p => p.id === projectId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      
      const workflow = ensureWorkflow(projectId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(workflow));
      return;
    }
    
    // List sprints for a project
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/sprints')) {
      const projectId = pathname.split('/')[3];
      
      const projects = readProjects();
      if (!projects.find(p => p.id === projectId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      
      const sprints = readSprints().filter(sp => sp.projectId === projectId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sprints));
      return;
    }
    
    // Create a sprint for a project
    if (method === 'POST' && pathname.startsWith('/api/projects/') && pathname.endsWith('/sprints')) {
      const projectId = pathname.split('/')[3];
      
      const projects = readProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      
      const allowedRoles = ['admin', 'project_manager'];
      const isOwner = project.ownerId === currentUser.id;
      if (!allowedRoles.includes(currentUser.role) && !isOwner) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      
      const body = await parseBody(req);
      const { name, startDate, endDate } = body;
      
      if (!name) {
        throw new Error('Sprint name is required');
      }
      
      // Validate dates
      if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
        throw new Error('End date must be after start date');
      }
      
      const sprints = readSprints();
      const newSprint = {
        id: generateId(),
        projectId,
        name: String(name),
        startDate: startDate || null,
        endDate: endDate || null,
        status: 'planning',
        createdAt: new Date().toISOString(),
        closedAt: null,
      };
      
      sprints.push(newSprint);
      writeSprints(sprints);
      
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newSprint));
      return;
    }
    
    // NEW: Delete sprint (admin only)
    if (method === 'DELETE' && pathname.startsWith('/api/sprints/') && pathname.split('/').length === 4) {
      const sprintId = pathname.split('/')[3];
      
      // Only admin can delete sprints
      if (currentUser.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Only administrators can delete sprints' }));
        return;
      }
      
      try {
        const deletionResult = deleteSprintCompletely(sprintId);
        
        // Send notification to project stakeholders
        const sprints = readSprints();
        const sprint = sprints.find(s => s.id === sprintId);
        if (sprint) {
          const projects = readProjects();
          const project = projects.find(p => p.id === sprint.projectId);
          if (project) {
            const notifyIds = [project.ownerId].filter(id => id !== currentUser.id);
            sendNotification(
              notifyIds, 
              `🗑️ Sprint "${deletionResult.sprint}" was deleted by ${currentUser.email}. ${deletionResult.movedIssues} issues moved to backlog.`
            );
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          message: 'Sprint deleted successfully',
          details: deletionResult
        }));
      } catch (err) {
        console.error('Error deleting sprint:', err);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
    
    // Start a sprint
    if (method === 'POST' && pathname.startsWith('/api/sprints/') && pathname.endsWith('/start')) {
      const sprintId = pathname.split('/')[3];
      
      const sprints = readSprints();
      const sprint = sprints.find(sp => sp.id === sprintId);
      if (!sprint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sprint not found' }));
        return;
      }
      
      const projects = readProjects();
      const project = projects.find(p => p.id === sprint.projectId);
      if (!project) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      
      const allowedRoles = ['admin', 'project_manager'];
      const isOwner = project.ownerId === currentUser.id;
      if (!allowedRoles.includes(currentUser.role) && !isOwner) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      
      if (sprint.status === 'active') {
        throw new Error('Sprint already started');
      }
      if (sprint.status === 'closed') {
        throw new Error('Cannot start a closed sprint');
      }
      
      sprint.status = 'active';
      if (!sprint.startDate) {
        sprint.startDate = new Date().toISOString();
      }
      writeSprints(sprints);
      
      // Send notifications
      const issues = readIssues();
      const sprintIssues = issues.filter(i => i.sprintId === sprintId);
      const assigneeIds = [...new Set(sprintIssues.map(i => i.assignee).filter(Boolean))];
      const notifyIds = [...new Set([project.ownerId, ...assigneeIds])].filter(id => id !== currentUser.id);
      sendNotification(notifyIds, `Sprint "${sprint.name}" has started`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sprint));
      return;
    }
    
    // Close a sprint
    if (method === 'POST' && pathname.startsWith('/api/sprints/') && pathname.endsWith('/close')) {
      const sprintId = pathname.split('/')[3];
      
      const sprints = readSprints();
      const sprint = sprints.find(sp => sp.id === sprintId);
      if (!sprint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sprint not found' }));
        return;
      }
      
      const projects = readProjects();
      const project = projects.find(p => p.id === sprint.projectId);
      if (!project) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      
      const allowedRoles = ['admin', 'project_manager'];
      const isOwner = project.ownerId === currentUser.id;
      if (!allowedRoles.includes(currentUser.role) && !isOwner) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      
      if (sprint.status === 'closed') {
        throw new Error('Sprint already closed');
      }
      
      sprint.status = 'closed';
      sprint.closedAt = new Date().toISOString();
      if (!sprint.endDate) sprint.endDate = sprint.closedAt;
      writeSprints(sprints);
      
      // Move incomplete issues to backlog (remove from sprint)
      const issues = readIssues();
      let movedCount = 0;
      for (const issue of issues) {
        if (issue.sprintId === sprintId && issue.status !== 'Done') {
          issue.sprintId = null;
          movedCount++;
        }
      }
      if (movedCount > 0) writeIssues(issues);
      
      // Send notifications
      const sprintIssues = issues.filter(i => i.sprintId === sprintId || (movedCount > 0 && !i.sprintId));
      const assigneeIds = [...new Set(sprintIssues.map(i => i.assignee).filter(Boolean))];
      const notifyIds = [...new Set([project.ownerId, ...assigneeIds])].filter(id => id !== currentUser.id);
      sendNotification(notifyIds, `Sprint "${sprint.name}" has been closed. ${movedCount} incomplete issues moved to backlog.`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sprint));
      return;
    }
    
    // Get board for a project
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/board')) {
      const projectId = pathname.split('/')[3];
      
      const projects = readProjects();
      if (!projects.find(p => p.id === projectId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      
      const workflow = ensureWorkflow(projectId);
      const issues = readIssues();
      const attachments = readAttachments();
      const users = readUsers();
      
      // Filter by sprint if specified
      const sprintId = parsedUrl.query.sprintId;
      const filtered = issues.filter(i => 
        i.projectId === projectId && 
        (sprintId === undefined || i.sprintId === sprintId)
      );
      
      // Add attachments and user info to issues
      const filteredWithExtras = filtered.map(issue => {
        const creator = users.find(u => u.id === issue.creatorId);
        const assignee = issue.assignee ? users.find(u => u.id === issue.assignee) : null;
        
        return {
          ...issue,
          creatorEmail: creator ? creator.email : null,
          assigneeEmail: assignee ? assignee.email : null,
          attachments: attachments.filter(a => a.issueId === issue.id)
        };
      });
      
      const board = {};
      for (const status of workflow.statuses) {
        board[status] = filteredWithExtras.filter(i => i.status === status);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(board));
      return;
    }
    
    // Get backlog for a project
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/backlog')) {
      const projectId = pathname.split('/')[3];
      
      const projects = readProjects();
      if (!projects.find(p => p.id === projectId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      
      const issues = readIssues();
      const attachments = readAttachments();
      const users = readUsers();
      
      const backlog = issues.filter(i => i.projectId === projectId && !i.sprintId).map(issue => {
        const creator = users.find(u => u.id === issue.creatorId);
        const assignee = issue.assignee ? users.find(u => u.id === issue.assignee) : null;
        
        return {
          ...issue,
          creatorEmail: creator ? creator.email : null,
          assigneeEmail: assignee ? assignee.email : null,
          attachments: attachments.filter(a => a.issueId === issue.id)
        };
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(backlog));
      return;
    }
    
    // Get notifications for current user
    if (method === 'GET' && pathname === '/api/notifications') {
      const notifications = readNotifications()
        .filter(n => n.userId === currentUser.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 50); // Limit to last 50 notifications
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(notifications));
      return;
    }
    
    // Mark notification as read
    if (method === 'POST' && pathname.startsWith('/api/notifications/') && pathname.endsWith('/read')) {
      const notifId = pathname.split('/')[3];
      
      let notifications = readNotifications();
      const notif = notifications.find(n => n.id === notifId && n.userId === currentUser.id);
      if (!notif) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Notification not found' }));
        return;
      }
      
      notif.read = true;
      writeNotifications(notifications);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(notif));
      return;
    }
    
    // Mark all notifications as read
    if (method === 'POST' && pathname === '/api/notifications/read-all') {
      let notifications = readNotifications();
      let updated = false;
      
      notifications.forEach(n => {
        if (n.userId === currentUser.id && !n.read) {
          n.read = true;
          updated = true;
        }
      });
      
      if (updated) {
        writeNotifications(notifications);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'All notifications marked as read' }));
      return;
    }
    
    // If no route matched
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    
  } catch (err) {
    console.error('Server error:', err);
    const isClientError = err.message && (
      err.message.includes('required') ||
      err.message.includes('not found') ||
      err.message.includes('already exists') ||
      err.message.includes('Invalid') ||
      err.message.includes('Forbidden') ||
      err.message.includes('Only administrators')
    );
    
    res.writeHead(isClientError ? 400 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
});

// Enhanced server.js additions for AI-powered comments system
// Add these sections to your existing server.js file

// =====================================================
// AI SERVICE INTEGRATION LAYER
// =====================================================

// Mock AI service - replace with actual AI API (OpenAI, Claude, etc.)
class AIAssistant {
  constructor() {
    this.enabled = process.env.AI_ENABLED !== 'false';
    this.apiKey = process.env.AI_API_KEY; // Set in environment variables
    this.model = process.env.AI_MODEL || 'gpt-3.5-turbo';
  }

  // Analyze issue content and provide insights
  async analyzeIssue(issue) {
    if (!this.enabled) return this.getMockIssueAnalysis(issue);
    
    try {
      // Mock implementation - replace with actual AI API call
      return this.getMockIssueAnalysis(issue);
      
      /* Example OpenAI integration:
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{
            role: 'system',
            content: 'You are an expert project manager. Analyze this issue and provide helpful insights.'
          }, {
            role: 'user',
            content: `Issue: ${issue.title}\nDescription: ${issue.description}\nPriority: ${issue.priority}`
          }],
          max_tokens: 500
        })
      });
      
      const data = await response.json();
      return this.parseAIResponse(data.choices[0].message.content);
      */
    } catch (error) {
      console.error('AI Analysis failed:', error);
      return this.getMockIssueAnalysis(issue);
    }
  }

  // Suggest smart comment responses
  async suggestCommentResponse(issue, comments, currentComment = '') {
    if (!this.enabled) return this.getMockCommentSuggestions(issue, comments);
    
    try {
      return this.getMockCommentSuggestions(issue, comments);
    } catch (error) {
      console.error('AI Comment suggestion failed:', error);
      return this.getMockCommentSuggestions(issue, comments);
    }
  }

  // Find similar issues
  async findSimilarIssues(issue, allIssues) {
    if (!this.enabled) return this.getMockSimilarIssues(issue, allIssues);
    
    // Simple similarity matching for demo
    const similar = allIssues.filter(i => 
      i.id !== issue.id && 
      i.projectId === issue.projectId &&
      (
        i.title.toLowerCase().includes(issue.title.toLowerCase().split(' ')[0]) ||
        i.description.toLowerCase().includes(issue.title.toLowerCase()) ||
        i.priority === issue.priority
      )
    ).slice(0, 3);

    return similar.map(i => ({
      id: i.id,
      title: i.title,
      status: i.status,
      similarity: Math.random() * 40 + 60 // Mock similarity score
    }));
  }

  // Extract action items from comments
  async extractActionItems(comments) {
    const actionItems = [];
    
    for (const comment of comments) {
      // Simple regex patterns for action items
      const patterns = [
        /(?:need to|should|must|todo|action|task):?\s*(.+)/gi,
        /(?:^|\s)(?:✓|□|☐|-|\*)\s*(.+)/gm,
        /(?:assign|delegate|give to|hand over to)\s+(\w+)/gi
      ];
      
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(comment.content)) !== null) {
          actionItems.push({
            text: match[1]?.trim(),
            commentId: comment.id,
            confidence: Math.random() * 30 + 70
          });
        }
      });
    }
    
    return actionItems.slice(0, 5); // Top 5 action items
  }

  // Analyze comment sentiment
  analyzeSentiment(comment) {
    // Simple keyword-based sentiment analysis
    const positive = ['good', 'great', 'excellent', 'perfect', 'love', 'awesome', 'fantastic', 'solved', 'fixed', 'works'];
    const negative = ['bad', 'terrible', 'awful', 'hate', 'broken', 'bug', 'issue', 'problem', 'error', 'fail'];
    const urgent = ['urgent', 'critical', 'asap', 'immediately', 'emergency', 'blocker'];
    
    const text = comment.toLowerCase();
    let score = 0;
    let urgency = false;
    
    positive.forEach(word => text.includes(word) && score++);
    negative.forEach(word => text.includes(word) && score--);
    urgent.forEach(word => text.includes(word) && (urgency = true));
    
    return {
      score: Math.max(-5, Math.min(5, score)),
      sentiment: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
      isUrgent: urgency,
      confidence: Math.random() * 30 + 70
    };
  }

  // Mock responses for development/demo
  getMockIssueAnalysis(issue) {
    const insights = [
      'This issue seems to be a high-priority bug that affects user experience.',
      'Based on the description, this might be related to authentication or permissions.',
      'Consider breaking this down into smaller, more manageable subtasks.',
      'This issue appears to be frontend-related and may require UI/UX expertise.',
      'The scope seems large - consider creating an epic with multiple stories.'
    ];

    const suggestions = [
      'Add more specific acceptance criteria',
      'Include steps to reproduce the issue',
      'Consider security implications',
      'Add relevant labels for better categorization',
      'Assign to a team member with relevant expertise'
    ];

    return {
      summary: insights[Math.floor(Math.random() * insights.length)],
      suggestedPriority: ['High', 'Medium', 'Low'][Math.floor(Math.random() * 3)],
      suggestedLabels: ['bug', 'frontend', 'backend', 'urgent', 'enhancement'].sort(() => 0.5 - Math.random()).slice(0, 2),
      suggestions: suggestions.sort(() => 0.5 - Math.random()).slice(0, 3),
      confidence: Math.random() * 30 + 70,
      timeEstimate: `${Math.floor(Math.random() * 8) + 1}-${Math.floor(Math.random() * 8) + 8} hours`
    };
  }

  getMockCommentSuggestions(issue, comments) {
    const suggestions = [
      'Thanks for the update! Could you provide more details about the error?',
      'I\'ll take a look at this and get back to you shortly.',
      'This might be related to the recent changes. Let me investigate.',
      'Great progress! When do you think this will be ready for testing?',
      'I\'ve seen this before. Try clearing the cache and restarting the service.',
      'Could you share a screenshot or error logs to help debug this?',
      'This looks good to me. Ready to move to the next phase.',
      'I agree with the proposed solution. Let\'s proceed with implementation.'
    ];

    return {
      suggestions: suggestions.sort(() => 0.5 - Math.random()).slice(0, 3),
      contextAware: true,
      confidence: Math.random() * 30 + 70
    };
  }

  getMockSimilarIssues(issue, allIssues) {
    return allIssues
      .filter(i => i.id !== issue.id && i.projectId === issue.projectId)
      .slice(0, 3)
      .map(i => ({
        id: i.id,
        title: i.title,
        status: i.status,
        similarity: Math.random() * 40 + 60
      }));
  }
}

const aiAssistant = new AIAssistant();

// =====================================================
// COMMENTS DATA FUNCTIONS
// =====================================================

function readComments() {
  return readJson('comments.json') || [];
}

function writeComments(comments) {
  writeJson('comments.json', comments);
}

// Initialize comments file
initializeDataFile('comments.json', []);

// =====================================================
// COMMENTS API ENDPOINTS
// =====================================================

// Add these endpoints to your server.js routing logic:

// Get comments for an issue
if (method === 'GET' && pathname.startsWith('/api/issues/') && pathname.endsWith('/comments')) {
  const issueId = pathname.split('/')[3];
  
  const issues = readIssues();
  const issue = issues.find(i => i.id === issueId);
  if (!issue) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Issue not found' }));
    return;
  }
  
  const comments = readComments();
  const users = readUsers();
  
  const issueComments = comments
    .filter(c => c.issueId === issueId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(comment => {
      const author = users.find(u => u.id === comment.authorId);
      const sentiment = aiAssistant.analyzeSentiment(comment.content);
      
      return {
        ...comment,
        authorEmail: author ? author.email : 'Unknown',
        authorRole: author ? author.role : null,
        sentiment
      };
    });
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(issueComments));
  return;
}

// Create a new comment
if (method === 'POST' && pathname.startsWith('/api/issues/') && pathname.endsWith('/comments')) {
  const issueId = pathname.split('/')[3];
  
  if (currentUser.role === 'viewer') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }
  
  const issues = readIssues();
  const issue = issues.find(i => i.id === issueId);
  if (!issue) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Issue not found' }));
    return;
  }
  
  const body = await parseBody(req);
  const { content, isAiSuggestion } = body;
  
  if (!content || !content.trim()) {
    throw new Error('Comment content is required');
  }
  
  const comments = readComments();
  const newComment = {
    id: generateId(),
    issueId,
    authorId: currentUser.id,
    content: String(content).trim(),
    isAiSuggestion: Boolean(isAiSuggestion),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  comments.push(newComment);
  writeComments(comments);
  
  // Update issue's updatedAt timestamp
  issue.updatedAt = new Date().toISOString();
  writeIssues(issues);
  
  // Send notifications to relevant users
  const projects = readProjects();
  const project = projects.find(p => p.id === issue.projectId);
  const notifyIds = [];
  
  if (issue.assignee && issue.assignee !== currentUser.id) notifyIds.push(issue.assignee);
  if (issue.creatorId && issue.creatorId !== currentUser.id) notifyIds.push(issue.creatorId);
  if (project && project.ownerId && project.ownerId !== currentUser.id) notifyIds.push(project.ownerId);
  
  // Also notify other commenters
  const otherCommenters = comments
    .filter(c => c.issueId === issueId && c.authorId !== currentUser.id)
    .map(c => c.authorId);
  notifyIds.push(...otherCommenters);
  
  const uniqueNotifyIds = [...new Set(notifyIds)];
  sendNotification(uniqueNotifyIds, `New comment on issue "${issue.title}" by ${currentUser.email}`);
  
  // Get AI sentiment analysis
  const sentiment = aiAssistant.analyzeSentiment(content);
  
  // Return comment with author info and sentiment
  const users = readUsers();
  const author = users.find(u => u.id === currentUser.id);
  
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    ...newComment,
    authorEmail: author.email,
    authorRole: author.role,
    sentiment
  }));
  return;
}

// Update a comment
if (method === 'PUT' && pathname.startsWith('/api/issues/') && pathname.includes('/comments/')) {
  const parts = pathname.split('/');
  const issueId = parts[3];
  const commentId = parts[5];
  
  const comments = readComments();
  const comment = comments.find(c => c.id === commentId && c.issueId === issueId);
  
  if (!comment) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Comment not found' }));
    return;
  }
  
  // Only author or admin can edit
  if (comment.authorId !== currentUser.id && currentUser.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }
  
  const body = await parseBody(req);
  const { content } = body;
  
  if (!content || !content.trim()) {
    throw new Error('Comment content is required');
  }
  
  comment.content = String(content).trim();
  comment.updatedAt = new Date().toISOString();
  comment.isEdited = true;
  
  writeComments(comments);
  
  // Get updated sentiment analysis
  const sentiment = aiAssistant.analyzeSentiment(content);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    ...comment,
    sentiment
  }));
  return;
}

// Delete a comment
if (method === 'DELETE' && pathname.startsWith('/api/issues/') && pathname.includes('/comments/')) {
  const parts = pathname.split('/');
  const issueId = parts[3];
  const commentId = parts[5];
  
  const comments = readComments();
  const comment = comments.find(c => c.id === commentId && c.issueId === issueId);
  
  if (!comment) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Comment not found' }));
    return;
  }
  
  // Only author or admin can delete
  if (comment.authorId !== currentUser.id && currentUser.role !== 'admin') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }
  
  const updatedComments = comments.filter(c => c.id !== commentId);
  writeComments(updatedComments);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Comment deleted' }));
  return;
}

// =====================================================
// AI ASSISTANT ENDPOINTS
// =====================================================

// Get AI analysis for an issue
if (method === 'GET' && pathname.startsWith('/api/issues/') && pathname.endsWith('/ai-analysis')) {
  const issueId = pathname.split('/')[3];
  
  const issues = readIssues();
  const issue = issues.find(i => i.id === issueId);
  if (!issue) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Issue not found' }));
    return;
  }
  
  try {
    const [analysis, similarIssues] = await Promise.all([
      aiAssistant.analyzeIssue(issue),
      aiAssistant.findSimilarIssues(issue, issues)
    ]);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      analysis,
      similarIssues,
      generatedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('AI analysis error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'AI analysis failed' }));
  }
  return;
}

// Get AI comment suggestions
if (method === 'POST' && pathname.startsWith('/api/issues/') && pathname.endsWith('/ai-suggestions')) {
  const issueId = pathname.split('/')[3];
  
  const issues = readIssues();
  const issue = issues.find(i => i.id === issueId);
  if (!issue) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Issue not found' }));
    return;
  }
  
  const comments = readComments().filter(c => c.issueId === issueId);
  const body = await parseBody(req);
  const { currentComment } = body;
  
  try {
    const suggestions = await aiAssistant.suggestCommentResponse(issue, comments, currentComment);
    const actionItems = await aiAssistant.extractActionItems(comments);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      suggestions,
      actionItems,
      generatedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('AI suggestions error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'AI suggestions failed' }));
  }
  return;
}

// Get AI insights for project
if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/ai-insights')) {
  const projectId = pathname.split('/')[3];
  
  const projects = readProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Project not found' }));
    return;
  }
  
  const issues = readIssues().filter(i => i.projectId === projectId);
  const comments = readComments().filter(c => 
    issues.some(issue => issue.id === c.issueId)
  );
  
  try {
    // Analyze project health
    const totalIssues = issues.length;
    const openIssues = issues.filter(i => i.status !== 'Done').length;
    const highPriorityIssues = issues.filter(i => i.priority === 'High').length;
    const overdue = issues.filter(i => i.dueDate && new Date(i.dueDate) < new Date()).length;
    
    // Sentiment analysis of recent comments
    const recentComments = comments
      .filter(c => new Date(c.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .map(c => aiAssistant.analyzeSentiment(c.content));
    
    const avgSentiment = recentComments.length > 0 
      ? recentComments.reduce((sum, s) => sum + s.score, 0) / recentComments.length
      : 0;
    
    const insights = {
      projectHealth: {
        score: Math.max(0, Math.min(100, 100 - (openIssues / totalIssues * 50) - (highPriorityIssues * 10) - (overdue * 15))),
        status: openIssues < totalIssues * 0.3 ? 'healthy' : openIssues < totalIssues * 0.7 ? 'warning' : 'critical'
      },
      teamMorale: {
        score: Math.max(0, Math.min(100, 50 + avgSentiment * 10)),
        sentiment: avgSentiment > 0.5 ? 'positive' : avgSentiment < -0.5 ? 'negative' : 'neutral'
      },
      recommendations: [
        highPriorityIssues > 3 ? 'Consider addressing high-priority issues first' : null,
        overdue > 0 ? `${overdue} issues are overdue - review deadlines` : null,
        avgSentiment < -1 ? 'Team sentiment seems low - consider team meeting' : null,
        openIssues / totalIssues > 0.8 ? 'High number of open issues - focus on closing tasks' : null
      ].filter(Boolean),
      stats: {
        totalIssues,
        openIssues,
        closedIssues: totalIssues - openIssues,
        highPriorityIssues,
        overdueIssues: overdue,
        recentActivity: recentComments.length
      }
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(insights));
  } catch (error) {
    console.error('AI insights error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'AI insights failed' }));
  }
  return;
}

// Start the server
server.listen(CONFIG.PORT, () => {
  console.log(`🏆 Crowley App Enhanced server is listening on port ${CONFIG.PORT}`);
  console.log(`📂 Visit http://localhost:${CONFIG.PORT} to access Crowley App`);
  console.log(`🗑️ Enhanced delete functionality:`);
  console.log(`   • Projects: Admin only - comprehensive cleanup`);
  console.log(`   • Sprints: Admin only - issues moved to backlog`);
  console.log(`   • Issues: Creator/Assignee/Project Owner/Admin`);
  if (!formidable) {
    console.log(`⚠️ File uploads disabled. Run 'npm install formidable' to enable.`);
  } else {
    console.log(`✅ File uploads enabled (max size: ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }
});
