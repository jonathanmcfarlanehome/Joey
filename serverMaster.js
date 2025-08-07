// Crowley App server implementation
// This file is an updated version of the Crowley backend server.  It includes
// improved static file handling, JWT‑free session management, file uploads,
// notifications, sprints, workflows and more.  The server uses only built‑in
// Node.js modules (plus optional formidable for multipart handling).  When run,
// the server will listen on the configured port and output status messages
// identifying itself as the Crowley App server.

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
 * Enhanced backend with file uploads, issue editing, and notifications
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
console.log('🏆 Crowley App - Modern Project Management System');
console.log('📁 Data directory:', DATA_DIR);
console.log('📎 Uploads directory:', UPLOADS_DIR);
console.log('🌐 Public directory:', PUBLIC_DIR);

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
      // Advertise the updated application name to clients
      res.end(JSON.stringify({ 
        status: 'ok', 
        name: 'Crowley App',
        version: '2.0.0',
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
    
    // Delete project
    if (method === 'DELETE' && pathname.startsWith('/api/projects/') && pathname.split('/').length === 4) {
      const projectId = pathname.split('/')[3];
      const projects = readProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      
      // Check permissions - only admin or project owner can delete
      if (currentUser.role !== 'admin' && currentUser.id !== project.ownerId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      
      // Remove project and related data
      const updatedProjects = projects.filter(p => p.id !== projectId);
      writeProjects(updatedProjects);
      
      // Clean up related data
      const issues = readIssues();
      const updatedIssues = issues.filter(i => i.projectId !== projectId);
      writeIssues(updatedIssues);
      
      const sprints = readSprints();
      const updatedSprints = sprints.filter(s => s.projectId !== projectId);
      writeSprints(updatedSprints);
      
      const workflows = readWorkflows();
      const updatedWorkflows = workflows.filter(w => w.projectId !== projectId);
      writeWorkflows(updatedWorkflows);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Project deleted successfully' }));
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
    
    // Delete issue
    if (method === 'DELETE' && pathname.startsWith('/api/issues/') && pathname.split('/').length === 4) {
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
      const canDelete =
        currentUser.role === 'admin' ||
        currentUser.id === issue.creatorId ||
        isProjectOwner;
        
      if (!canDelete) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      
      // Delete associated attachments
      const attachments = readAttachments();
      const issueAttachments = attachments.filter(a => a.issueId === issueId);
      issueAttachments.forEach(attachment => {
        const filePath = path.join(UPLOADS_DIR, attachment.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      
      // Remove attachments from database
      const updatedAttachments = attachments.filter(a => a.issueId !== issueId);
      writeAttachments(updatedAttachments);
      
      // Remove issue
      const updatedIssues = issues.filter(i => i.id !== issueId);
      writeIssues(updatedIssues);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Issue deleted successfully' }));
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
      err.message.includes('Forbidden')
    );
    
    res.writeHead(isClientError ? 400 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
  }
});

// Start the server
server.listen(CONFIG.PORT, () => {
  // Use consistent branding in startup messages
  console.log(`🏆 Crowley App server is listening on port ${CONFIG.PORT}`);
  console.log(`📂 Visit http://localhost:${CONFIG.PORT} to access Crowley App`);
  if (!formidable) {
    console.log(`⚠️ File uploads disabled. Run 'npm install formidable' to enable.`);
  } else {
    console.log(`✅ File uploads enabled (max size: ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB)`);
  }
});