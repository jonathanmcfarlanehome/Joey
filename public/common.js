/*
 * Common helper functions for Jira‑lite front‑end.
 *
 * This script provides convenience wrappers around the Fetch API
 * for authenticated API calls and redirects to the login page when
 * authentication is missing or expired. Include this script on all
 * pages except the login/registration page.
 */

// Retrieve the JWT/token from localStorage. Returns null if not set.
function getToken() {
  return localStorage.getItem('token');
}

// Retrieve the current user object (id, email, role). Returns an
// empty object if none is stored.
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch (err) {
    return {};
  }
}

// Enforce authentication. If no token is present this will redirect
// the browser back to the login page. Call this at the top of
// protected pages.
function requireAuth() {
  if (!getToken()) {
    window.location.href = '/index.html';
  }
}

// Perform an API request. Automatically attaches the Authorization
// header when a token is available. If the request returns 401
// Unauthorized, the user is redirected to the login page. Accepts
// standard Fetch options and returns the fetch Promise.
async function api(path, options = {}) {
  const opts = Object.assign({ method: 'GET', headers: {} }, options);
  opts.headers = opts.headers || {};
  if (getToken()) {
    opts.headers['Authorization'] = 'Bearer ' + getToken();
  }
  if (!opts.headers['Content-Type'] && (opts.method === 'POST' || opts.method === 'PUT')) {
    opts.headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(path, opts);
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
    return Promise.reject(new Error('Unauthorized'));
  }
  return response;
}