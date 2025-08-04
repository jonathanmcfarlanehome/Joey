const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

/*
 * Simple Jira‑like backend
 *
 * This server implements a very small subset of Jira functionality
 * using only built‑in Node.js modules. It provides endpoints for
 * user registration and login, project management and basic issue
 * tracking. Data is persisted to JSON files in the `data` folder.
 *
 * Authentication is handled via random tokens stored in a sessions
 * file. Each API call requiring authentication must include an
 * `Authorization: Bearer <token>` header. Tokens never expire in
 * this simple implementation, but the sessions structure records the
 * creation timestamp should you wish to add expiry logic later.
 */

// Location of our JSON data files relative to this script.  Each file
// holds an array or object that is deserialized on each request and
// flushed back to disk when modified. Using synchronous file APIs
// simplifies the code considerably at the cost of scalability.
const DATA_DIR = path.join(__dirname, 'data');

// Helper to read a JSON file and parse its contents. Throws if the
// file cannot be read or parsed. Always returns either an array or
// object.
function readJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  const raw = fs.readFileSync(filePath, { encoding: 'utf8' });
  return JSON.parse(raw || 'null') || null;
}

// Helper to write a JavaScript object back to disk as JSON. Uses
// two‑space indentation for readability.
function writeJson(fileName, data) {
  const filePath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Generate a unique identifier. We use 8 bytes of randomness which
// yields a 16‑character hexadecimal string. Should be sufficient for
// demo purposes.
function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// Return a SHA256 hash of the supplied password. Storing raw
// passwords is never acceptable, even in test code. SHA256 is not
// ideal for password hashing (bcrypt/argon2 would be better) but
// avoids pulling in external dependencies.
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// List of valid user roles. Roles control access to certain API
// operations. In this demo there are four: admin, project_manager,
// developer and viewer. Viewer accounts can only read data.
const VALID_ROLES = ['admin', 'project_manager', 'developer', 'viewer'];

// Read sprints from disk. Sprints live in a standalone file because
// they are associated with projects but have their own lifecycle.
function readSprints() {
  try {
    return readJson('sprints.json') || [];
  } catch (err) {
    return [];
  }
}

function writeSprints(sprints) {
  writeJson('sprints.json', sprints);
}

// Workflows define the allowed statuses for each project. Each entry
// takes the shape { projectId, statuses: [String], transitions: Object }.
function readWorkflows() {
  try {
    return readJson('workflows.json') || [];
  } catch (err) {
    return [];
  }
}

function writeWorkflows(workflows) {
  writeJson('workflows.json', workflows);
}

// Notifications are stored globally. Each notification has an id,
// userId, message, read flag and timestamp.
function readNotifications() {
  try {
    return readJson('notifications.json') || [];
  } catch (err) {
    return [];
  }
}

function writeNotifications(notifications) {
  writeJson('notifications.json', notifications);
}

// Create notifications for multiple users. Accepts an array of userIds
// and a message string. Each user will receive an individual
// notification entry. All notifications start unread.
function sendNotification(userIds, message) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  const notifications = readNotifications();
  for (const userId of userIds) {
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

// Helper to get or create a workflow for a project. If a workflow
// doesn't exist for the supplied projectId, a default workflow
// containing the classic "To Do", "In Progress" and "Done" statuses
// is created and persisted. Transitions are left empty for now.
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

// Read the current session map. The sessions object maps tokens to
// objects of the form { userId, createdAt }. If the file does not
// exist or cannot be parsed an empty object is returned.
function readSessions() {
  try {
    return readJson('sessions.json') || {};
  } catch (err) {
    return {};
  }
}

// Persist the session map back to disk.
function writeSessions(sessions) {
  writeJson('sessions.json', sessions);
}

// Authenticate a request by inspecting the Authorization header. If
// valid, returns the user object corresponding to the token; else
// returns null. You can augment this function to implement token
// expiry by checking the createdAt timestamp.
function authenticate(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;
  const sessions = readSessions();
  const sess = sessions[token];
  if (!sess) return null;
  const users = readJson('users.json');
  const user = users.find(u => u.id === sess.userId);
  return user || null;
}

// Parse JSON body of a request. Returns a promise that resolves
// with an object. Empty bodies resolve to an empty object. If
// parsing fails the promise rejects.
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
  });
}

// Basic HTTP server. Handles routing based on method and URL path. All
// API endpoints live under the /api prefix. Non‑API requests return
// a simple message.
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method.toUpperCase();
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  // Set CORS header for all other requests
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Only API calls are implemented here. Provide a simple 404 for others.
    if (!pathname.startsWith('/api')) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Jira‑lite server running. Use the /api endpoints.');
      return;
    }

    /**
     * Registration endpoint
     *
     * POST /api/register
     * Body: { email: string, password: string, role?: string }
     * Creates a new user account. The first user created may want to be
     * an admin to seed the system. If no role is provided the default
     * is "developer". Returns 201 on success.
     */
    if (method === 'POST' && pathname === '/api/register') {
      const body = await parseBody(req);
      const { email, password, role } = body;
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      if (role && !VALID_ROLES.includes(role)) {
        throw new Error('Invalid role');
      }
      const users = readJson('users.json') || [];
      if (users.find(u => u.email === email)) {
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
      writeJson('users.json', users);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'User registered', user: { id: user.id, email: user.email, role: user.role } }));
      return;
    }

    /**
     * Login endpoint
     *
     * POST /api/login
     * Body: { email: string, password: string }
     * Validates credentials and returns a session token if correct. The
     * token must be supplied in the Authorization header for future
     * requests.
     */
    if (method === 'POST' && pathname === '/api/login') {
      const body = await parseBody(req);
      const { email, password } = body;
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      const users = readJson('users.json') || [];
      const user = users.find(u => u.email === String(email).toLowerCase());
      if (!user || user.passwordHash !== hashPassword(password)) {
        throw new Error('Invalid credentials');
      }
      const sessions = readSessions();
      const token = crypto.randomBytes(16).toString('hex');
      sessions[token] = { userId: user.id, createdAt: Date.now() };
      writeSessions(sessions);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token, user: { id: user.id, email: user.email, role: user.role } }));
      return;
    }

    // All routes below this point require authentication
    const currentUser = authenticate(req);
    if (!currentUser) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    /**
     * List all projects
     *
     * GET /api/projects
     * Returns an array of all projects. In a real application you may
     * filter this by the current user's permissions or membership.
     */
    if (method === 'GET' && pathname === '/api/projects') {
      const projects = readJson('projects.json') || [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(projects));
      return;
    }

    /**
     * Create a new project
     *
     * POST /api/projects
     * Body: { name: string, key?: string }
     * Only users with the admin or project_manager role may create projects.
     */
    if (method === 'POST' && pathname === '/api/projects') {
      if (!['admin', 'project_manager'].includes(currentUser.role)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      const body = await parseBody(req);
      const { name, key } = body;
      if (!name) {
        throw new Error('Project name is required');
      }
      const projects = readJson('projects.json') || [];
      const newProject = {
        id: generateId(),
        name: String(name),
        key: key || String(name).substring(0, 3).toUpperCase(),
        ownerId: currentUser.id,
        createdAt: new Date().toISOString(),
      };
      projects.push(newProject);
      writeJson('projects.json', projects);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newProject));
      return;
    }

    /**
     * Update a project
     *
     * PUT /api/projects/:id
     * Body: { name?: string, key?: string }
     * Only admins or the project owner may update the project.
     */
    if (method === 'PUT' && pathname.startsWith('/api/projects/')) {
      const parts = pathname.split('/');
      const projectId = parts[parts.length - 1];
      const projects = readJson('projects.json') || [];
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      // Only admins or the owner can modify
      if (currentUser.role !== 'admin' && project.ownerId !== currentUser.id) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      const body = await parseBody(req);
      const { name, key } = body;
      if (name) project.name = String(name);
      if (key) project.key = String(key);
      writeJson('projects.json', projects);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(project));
      return;
    }

    /**
     * Delete a project
     *
     * DELETE /api/projects/:id
     * Only admins can delete projects. Deleting a project also
     * deletes its issues.
     */
    if (method === 'DELETE' && pathname.startsWith('/api/projects/')) {
      const parts = pathname.split('/');
      const projectId = parts[parts.length - 1];
      if (currentUser.role !== 'admin') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      let projects = readJson('projects.json') || [];
      const index = projects.findIndex(p => p.id === projectId);
      if (index < 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      projects.splice(index, 1);
      writeJson('projects.json', projects);
      // Remove project issues
      let issues = readJson('issues.json') || [];
      issues = issues.filter(i => i.projectId !== projectId);
      writeJson('issues.json', issues);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Project deleted' }));
      return;
    }

    /**
     * List issues for a project
     *
     * GET /api/projects/:projectId/issues
     * Returns an array of issues belonging to the given project. Any
     * authenticated user may view issues.
     */
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/issues')) {
      const parts = pathname.split('/');
      // /api/projects/{id}/issues → last index is "issues", second last is project id
      const projectId = parts[parts.length - 2];
      const projects = readJson('projects.json') || [];
      if (!projects.find(p => p.id === projectId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      const issues = readJson('issues.json') || [];
      const projectIssues = issues.filter(i => i.projectId === projectId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(projectIssues));
      return;
    }

    /**
     * Create an issue
     *
     * POST /api/issues
     * Body: { projectId: string, title: string, description?: string,
     *         priority?: string, status?: string, assignee?: string,
     *         dueDate?: string, labels?: string[], parentId?: string }
     * Only users who are not viewers may create issues.
     */
    if (method === 'POST' && pathname === '/api/issues') {
      if (currentUser.role === 'viewer') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      const body = await parseBody(req);
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
      const projects = readJson('projects.json') || [];
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
      let assignedUser = null;
      if (assignee) {
        const users = readJson('users.json') || [];
        assignedUser = users.find(u => u.id === assignee);
        if (!assignedUser) {
          throw new Error('Assignee not found');
        }
      }
      // Validate parent if provided
      if (parentId) {
        const allIssues = readJson('issues.json') || [];
        const parent = allIssues.find(i => i.id === parentId);
        if (!parent) {
          throw new Error('Parent issue not found');
        }
      }
      // Validate sprint if provided
      if (sprintId) {
        const sprints = readSprints();
        const s = sprints.find(sp => sp.id === sprintId);
        if (!s) {
          throw new Error('Sprint not found');
        }
        if (s.projectId !== projectId) {
          throw new Error('Sprint does not belong to this project');
        }
      }
      const issues = readJson('issues.json') || [];
      const newIssue = {
        id: generateId(),
        projectId,
        title: String(title),
        description: description ? String(description) : '',
        priority: priority || 'Medium',
        status: issueStatus,
        assignee: assignee || null,
        dueDate: dueDate || null,
        labels: Array.isArray(labels) ? labels : [],
        parentId: parentId || null,
        sprintId: sprintId || null,
        creatorId: currentUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      issues.push(newIssue);
      writeJson('issues.json', issues);
      // Notify the assignee and project owner (if different) of the new issue
      const notifyIds = [];
      if (assignedUser) notifyIds.push(assignedUser.id);
      if (project.ownerId && project.ownerId !== currentUser.id) notifyIds.push(project.ownerId);
      sendNotification(notifyIds, `New issue "${newIssue.title}" created in project ${project.name}`);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newIssue));
      return;
    }

    /**
     * Update an issue
     *
     * PUT /api/issues/:id
     * Body: may contain any mutable fields. Only the creator, assignee,
     * project owner or admins may update an issue. Viewers cannot update.
     */
    if (method === 'PUT' && pathname.startsWith('/api/issues/')) {
      const parts = pathname.split('/');
      const issueId = parts[parts.length - 1];
      const issues = readJson('issues.json') || [];
      const issue = issues.find(i => i.id === issueId);
      if (!issue) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Issue not found' }));
        return;
      }
      // Only allowed roles can modify
      const projects = readJson('projects.json') || [];
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
      const body = await parseBody(req);
      const allowed = ['title', 'description', 'priority', 'status', 'assignee', 'dueDate', 'labels', 'parentId', 'sprintId'];
      let notifyChangedStatus = false;
      let notifyChangedAssignee = false;
      let oldStatus = issue.status;
      let oldAssignee = issue.assignee;
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          // Validate specific fields
          if (key === 'status') {
            const workflow = ensureWorkflow(issue.projectId);
            const newStatus = body[key];
            if (!workflow.statuses.includes(newStatus)) {
              throw new Error('Invalid status');
            }
            if (newStatus !== issue.status) {
              notifyChangedStatus = true;
              oldStatus = issue.status;
              issue.status = newStatus;
              // Record completion time when moving to Done; clear when moving out of Done
              if (newStatus === 'Done' && oldStatus !== 'Done') {
                issue.doneAt = new Date().toISOString();
              } else if (oldStatus === 'Done' && newStatus !== 'Done') {
                issue.doneAt = null;
              }
            }
            continue;
          }
          if (key === 'assignee') {
            const newAssignee = body[key] || null;
            if (newAssignee) {
              const users = readJson('users.json') || [];
              const exists = users.find(u => u.id === newAssignee);
              if (!exists) {
                throw new Error('Assignee not found');
              }
            }
            if (newAssignee !== issue.assignee) {
              notifyChangedAssignee = true;
              oldAssignee = issue.assignee;
              issue.assignee = newAssignee;
            }
            continue;
          }
          if (key === 'sprintId') {
            const newSprint = body[key] || null;
            if (newSprint) {
              const sprints = readSprints();
              const sp = sprints.find(s => s.id === newSprint);
              if (!sp) {
                throw new Error('Sprint not found');
              }
              if (sp.projectId !== issue.projectId) {
                throw new Error('Sprint does not belong to this project');
              }
            }
            issue.sprintId = newSprint;
            continue;
          }
          if (key === 'labels') {
            issue[key] = Array.isArray(body[key]) ? body[key] : [];
            continue;
          }
          issue[key] = body[key];
        }
      }
      issue.updatedAt = new Date().toISOString();
      writeJson('issues.json', issues);
      // If status changed notify assignee and project owner
      if (notifyChangedStatus) {
          const projects = readJson('projects.json') || [];
          const project = projects.find(p => p.id === issue.projectId);
          const notifyIds = [];
          if (issue.assignee) notifyIds.push(issue.assignee);
          if (project && project.ownerId) notifyIds.push(project.ownerId);
          sendNotification(notifyIds, `Issue "${issue.title}" status changed to ${issue.status}`);
      }
      // If assignee changed notify new assignee
      if (notifyChangedAssignee && issue.assignee) {
          sendNotification([issue.assignee], `You have been assigned issue "${issue.title}"`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(issue));
      return;
    }

    /**
     * Delete an issue
     *
     * DELETE /api/issues/:id
     * Only admins or the creator may delete an issue.
     */
    if (method === 'DELETE' && pathname.startsWith('/api/issues/')) {
      const parts = pathname.split('/');
      const issueId = parts[parts.length - 1];
      let issues = readJson('issues.json') || [];
      const index = issues.findIndex(i => i.id === issueId);
      if (index < 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Issue not found' }));
        return;
      }
      const issue = issues[index];
      if (currentUser.role !== 'admin' && currentUser.id !== issue.creatorId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      // Delete the issue and any subtasks whose parentId matches
      const deleteIds = [issueId];
      issues = issues.filter(i => !deleteIds.includes(i.id) && i.parentId !== issueId);
      writeJson('issues.json', issues);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Issue deleted' }));
      return;
    }

    /**
     * Get workflow for a project
     *
     * GET /api/projects/:projectId/workflow
     * Returns the workflow object containing statuses and transitions.
     */
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/workflow')) {
      const parts = pathname.split('/');
      const projectId = parts[3];
      const projects = readJson('projects.json') || [];
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

    /**
     * Update workflow for a project
     *
     * PUT /api/projects/:projectId/workflow
     * Body: { statuses: string[], transitions?: object }
     * Only admins, project managers or the project owner may update the workflow.
     */
    if (method === 'PUT' && pathname.startsWith('/api/projects/') && pathname.endsWith('/workflow')) {
      const parts = pathname.split('/');
      const projectId = parts[3];
      const projects = readJson('projects.json') || [];
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      // Authorization: admin, project_manager, owner
      const allowedRoles = ['admin', 'project_manager'];
      const isOwner = project.ownerId === currentUser.id;
      if (!allowedRoles.includes(currentUser.role) && !isOwner) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      const body = await parseBody(req);
      const { statuses, transitions } = body;
      if (!Array.isArray(statuses) || statuses.length === 0) {
        throw new Error('statuses array is required');
      }
      // Coerce to strings and trim
      const cleaned = statuses.map(s => String(s));
      let workflows = readWorkflows();
      let wf = workflows.find(w => w.projectId === projectId);
      if (!wf) {
        wf = { projectId, statuses: cleaned, transitions: transitions || {} };
        workflows.push(wf);
      } else {
        wf.statuses = cleaned;
        wf.transitions = transitions || {};
      }
      writeWorkflows(workflows);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(wf));
      return;
    }

    /**
     * List sprints for a project
     *
     * GET /api/projects/:projectId/sprints
     */
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/sprints')) {
      const parts = pathname.split('/');
      const projectId = parts[3];
      const projects = readJson('projects.json') || [];
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

    /**
     * Create a sprint for a project
     *
     * POST /api/projects/:projectId/sprints
     * Body: { name: string, startDate?: string, endDate?: string }
     * Only admins, project managers or project owners can create sprints.
     */
    if (method === 'POST' && pathname.startsWith('/api/projects/') && pathname.endsWith('/sprints')) {
      const parts = pathname.split('/');
      const projectId = parts[3];
      const projects = readJson('projects.json') || [];
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

    /**
     * Start a sprint
     *
     * POST /api/sprints/:sprintId/start
     * Marks a sprint as active and sets the startDate if not already
     * set. Only admins, project managers or project owners may start.
     */
    if (method === 'POST' && pathname.startsWith('/api/sprints/') && pathname.endsWith('/start')) {
      const parts = pathname.split('/');
      const sprintId = parts[3];
      const sprints = readSprints();
      const sprint = sprints.find(sp => sp.id === sprintId);
      if (!sprint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sprint not found' }));
        return;
      }
      const projects = readJson('projects.json') || [];
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
      // notify project owner and all assignees of issues in this sprint
      const issues = readJson('issues.json') || [];
      const sprintIssues = issues.filter(i => i.sprintId === sprintId);
      const assigneeIds = sprintIssues.map(i => i.assignee).filter(Boolean);
      const notifyIds = [...new Set([project.ownerId, ...assigneeIds])].filter(Boolean);
      sendNotification(notifyIds, `Sprint "${sprint.name}" has started`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sprint));
      return;
    }

    /**
     * Close a sprint
     *
     * POST /api/sprints/:sprintId/close
     * Marks a sprint as closed and sets the endDate if not already set.
     * Moves incomplete issues back to the backlog (sprintId = null).
     */
    if (method === 'POST' && pathname.startsWith('/api/sprints/') && pathname.endsWith('/close')) {
      const parts = pathname.split('/');
      const sprintId = parts[3];
      const sprints = readSprints();
      const sprint = sprints.find(sp => sp.id === sprintId);
      if (!sprint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sprint not found' }));
        return;
      }
      const projects = readJson('projects.json') || [];
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
      // Move open issues to backlog (sprintId = null)
      const issues = readJson('issues.json') || [];
      let changed = false;
      for (const issue of issues) {
        if (issue.sprintId === sprintId && issue.status !== 'Done') {
          issue.sprintId = null;
          changed = true;
        }
      }
      if (changed) writeJson('issues.json', issues);
      // notify assignees and project owner
      const sprintIssues = issues.filter(i => i.sprintId === sprintId);
      const assigneeIds = sprintIssues.map(i => i.assignee).filter(Boolean);
      const notifyIds = [...new Set([project.ownerId, ...assigneeIds])].filter(Boolean);
      sendNotification(notifyIds, `Sprint "${sprint.name}" has been closed`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sprint));
      return;
    }

    /**
     * Update a sprint
     *
     * PUT /api/sprints/:sprintId
     * Only admins, project managers or owners may update a sprint. You
     * may update name, startDate and endDate when the sprint is in
     * planning. Active or closed sprints cannot have their dates
     * modified.
     */
    if (method === 'PUT' && pathname.startsWith('/api/sprints/')) {
      const parts = pathname.split('/');
      const sprintId = parts[3];
      if (parts.length !== 4) {
        // ensure we do not match /start or /close or /issues endpoints
        // ignore, will be handled in other conditions
      } else {
        const sprints = readSprints();
        const sprint = sprints.find(sp => sp.id === sprintId);
        if (!sprint) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Sprint not found' }));
          return;
        }
        const projects = readJson('projects.json') || [];
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
        const body = await parseBody(req);
        const { name, startDate, endDate } = body;
        if (name) sprint.name = String(name);
        if (sprint.status === 'planning') {
          if (startDate) sprint.startDate = startDate;
          if (endDate) sprint.endDate = endDate;
        }
        writeSprints(sprints);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sprint));
        return;
      }
    }

    /**
     * Assign issues to a sprint
     *
     * POST /api/sprints/:sprintId/issues
     * Body: { issueId: string }
     * Only non‑viewer users may assign issues. The issue must belong
     * to the same project as the sprint.
     */
    if (method === 'POST' && pathname.startsWith('/api/sprints/') && pathname.endsWith('/issues')) {
      const parts = pathname.split('/');
      const sprintId = parts[3];
      const sprints = readSprints();
      const sprint = sprints.find(sp => sp.id === sprintId);
      if (!sprint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sprint not found' }));
        return;
      }
      const projects = readJson('projects.json') || [];
      const project = projects.find(p => p.id === sprint.projectId);
      if (!project) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      if (currentUser.role === 'viewer') {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      const body = await parseBody(req);
      const { issueId } = body;
      if (!issueId) {
        throw new Error('issueId is required');
      }
      const issues = readJson('issues.json') || [];
      const issue = issues.find(i => i.id === issueId);
      if (!issue) {
        throw new Error('Issue not found');
      }
      if (issue.projectId !== sprint.projectId) {
        throw new Error('Issue does not belong to this project');
      }
      issue.sprintId = sprintId;
      issue.updatedAt = new Date().toISOString();
      writeJson('issues.json', issues);
      // notify assignee
      if (issue.assignee) {
        sendNotification([issue.assignee], `Issue "${issue.title}" has been added to sprint ${sprint.name}`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(issue));
      return;
    }

    /**
     * Get backlog for a project
     *
     * GET /api/projects/:projectId/backlog
     * Returns issues that are not assigned to any sprint.
     */
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/backlog')) {
      const parts = pathname.split('/');
      const projectId = parts[3];
      const projects = readJson('projects.json') || [];
      if (!projects.find(p => p.id === projectId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      const issues = readJson('issues.json') || [];
      const backlog = issues.filter(i => i.projectId === projectId && !i.sprintId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(backlog));
      return;
    }

    /**
     * Get board for a project (Kanban/Scrum)
     *
     * GET /api/projects/:projectId/board
     * Optional query string: ?sprintId=... to filter to a specific sprint.
     * Returns an object keyed by status with arrays of issues.
     */
    if (method === 'GET' && pathname.startsWith('/api/projects/') && pathname.endsWith('/board')) {
      const parts = pathname.split('/');
      const projectId = parts[3];
      const projects = readJson('projects.json') || [];
      if (!projects.find(p => p.id === projectId)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Project not found' }));
        return;
      }
      const workflow = ensureWorkflow(projectId);
      const issues = readJson('issues.json') || [];
      // Determine sprint filter
      const sprintId = parsedUrl.query && parsedUrl.query.sprintId ? parsedUrl.query.sprintId : undefined;
      const filtered = issues.filter(i => i.projectId === projectId && (sprintId === undefined || i.sprintId === sprintId));
      const board = {};
      for (const status of workflow.statuses) {
        board[status] = filtered.filter(i => i.status === status);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(board));
      return;
    }

    /**
     * Get burndown data for a sprint
     *
     * GET /api/sprints/:sprintId/burndown
     * Returns an array of { date: yyyy-mm-dd, remaining: number } for
     * each day from the sprint's start to end (or today if active).
     * Remaining counts how many issues have not yet reached the Done
     * status by that date. This is a simplified burndown that uses
     * issue.doneAt timestamps.
     */
    if (method === 'GET' && pathname.startsWith('/api/sprints/') && pathname.endsWith('/burndown')) {
      const parts = pathname.split('/');
      const sprintId = parts[3];
      const sprints = readSprints();
      const sprint = sprints.find(sp => sp.id === sprintId);
      if (!sprint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sprint not found' }));
        return;
      }
      if (!sprint.startDate) {
        throw new Error('Sprint has not started yet');
      }
      // Determine end date: sprint.endDate if set, else today
      const endDateStr = sprint.endDate || new Date().toISOString();
      const start = new Date(sprint.startDate);
      const end = new Date(endDateStr);
      // Ensure we only work with the date portion (strip time)
      function formatDate(d) {
        return d.toISOString().split('T')[0];
      }
      const issues = readJson('issues.json') || [];
      const sprintIssues = issues.filter(i => i.sprintId === sprintId);
      const dates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
      const data = dates.map(dateObj => {
        const date = formatDate(dateObj);
        // Count issues that are still open on this date
        let remaining = 0;
        for (const issue of sprintIssues) {
          // Issue is open if no doneAt or doneAt is after this date
          const doneAtDate = issue.doneAt ? new Date(issue.doneAt) : null;
          if (!doneAtDate || doneAtDate > dateObj) {
            remaining++;
          }
        }
        return { date, remaining };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    /**
     * Notifications: list and mark as read
     *
     * GET /api/notifications → list current user's notifications
     * POST /api/notifications/:id/read → mark a notification as read
     */
    if (method === 'GET' && pathname === '/api/notifications') {
      const notifications = readNotifications().filter(n => n.userId === currentUser.id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(notifications));
      return;
    }
    if (method === 'POST' && pathname.startsWith('/api/notifications/') && pathname.endsWith('/read')) {
      const parts = pathname.split('/');
      const notifId = parts[3];
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

    /**
     * Static file serving
     *
     * Any GET request that does not target the API will be served from
     * the `public` directory. This allows us to host a simple web
     * front‑end alongside the API without additional tooling. Only
     * common text and image content types are handled.
     */
    if (!pathname.startsWith('/api') && method === 'GET') {
      // map '/' to '/index.html'
      let filePath = pathname === '/' ? '/index.html' : pathname;
      const resolved = path.join(__dirname, 'public', decodeURIComponent(filePath));
      // Prevent directory traversal
      if (!resolved.startsWith(path.join(__dirname, 'public'))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(resolved, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        // determine content type
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
        const type = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(content);
      });
      return;
    }

    // If we reach here no route matched
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    // Generic error handler
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Bad request' }));
  }
});

// Start the server on port 3000. In production you might want to
// read the port from the environment.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Jira‑lite server is listening on port ${PORT}`);
});