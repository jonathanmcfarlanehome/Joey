/*
 * Common helper functions for Crowley App front‑end - ENHANCED VERSION
 *
 * This script provides convenience wrappers around the Fetch API
 * for authenticated API calls and redirects to the login page when
 * authentication is missing or expired. Include this script on all
 * pages except the login/registration page.
 *
 * Enhanced with better error handling, retry logic, and improved UX.
 */

// Application configuration
const CROWLEY_CONFIG = {
  API_TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

// Retrieve the JWT/token from localStorage. Returns null if not set.
function getToken() {
  try {
    return localStorage.getItem('token');
  } catch (err) {
    console.error('Error reading token from localStorage:', err);
    return null;
  }
}

// Retrieve the current user object (id, email, role). Returns an
// empty object if none is stored.
function getCurrentUser() {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : {};
  } catch (err) {
    console.error('Error reading user from localStorage:', err);
    return {};
  }
}

// Enforce authentication. If no token is present this will redirect
// the browser back to the login page. Call this at the top of
// protected pages.
function requireAuth() {
  const token = getToken();
  if (!token) {
    console.log('No token found, redirecting to login');
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

// Sleep function for retry delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Perform an API request with retry logic and better error handling.
// Automatically attaches the Authorization header when a token is available. 
// If the request returns 401 Unauthorized, the user is redirected to the login page. 
// Accepts standard Fetch options and returns the fetch Promise.
async function api(path, options = {}) {
  let lastError;
  
  for (let attempt = 1; attempt <= CROWLEY_CONFIG.RETRY_ATTEMPTS; attempt++) {
    try {
      const opts = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        ...options
      };

      // Merge headers properly
      if (options.headers) {
        opts.headers = { ...opts.headers, ...options.headers };
      }

      // Add authorization header if token exists
      const token = getToken();
      if (token) {
        opts.headers['Authorization'] = `Bearer ${token}`;
      }

      // Don't set Content-Type for FormData or if explicitly set to something else
      if (opts.body instanceof FormData) {
        delete opts.headers['Content-Type'];
      }

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CROWLEY_CONFIG.API_TIMEOUT);
      opts.signal = controller.signal;

      console.log(`API Request (attempt ${attempt}): ${opts.method} ${path}`);
      
      const response = await fetch(path, opts);
      clearTimeout(timeoutId);
      
      // Handle unauthorized responses
      if (response.status === 401) {
        console.log('Received 401, clearing auth and redirecting');
        clearAuthData();
        window.location.href = '/index.html';
        throw new Error('Unauthorized');
      }

      // Log response status for debugging
      if (!response.ok) {
        console.log(`API Response: ${response.status} ${response.statusText}`);
        
        // If it's a client error (4xx), don't retry
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response;
        }
        
        // Server errors (5xx) or rate limiting (429) - retry
        if (attempt < CROWLEY_CONFIG.RETRY_ATTEMPTS) {
          console.log(`Server error ${response.status}, retrying in ${CROWLEY_CONFIG.RETRY_DELAY}ms...`);
          await sleep(CROWLEY_CONFIG.RETRY_DELAY * attempt); // Exponential backoff
          continue;
        }
      }

      return response;
      
    } catch (err) {
      console.error(`API request failed (attempt ${attempt}):`, err);
      lastError = err;
      
      // If it's an abort error (timeout), don't retry immediately
      if (err.name === 'AbortError') {
        console.log('Request timed out');
        if (attempt < CROWLEY_CONFIG.RETRY_ATTEMPTS) {
          await sleep(CROWLEY_CONFIG.RETRY_DELAY * attempt);
          continue;
        }
      }
      
      // If it's a network error and we're not on the login page, handle gracefully
      if (err.name === 'TypeError' && err.message.includes('fetch') && 
          !window.location.pathname.includes('index.html') && 
          !window.location.pathname.includes('register.html')) {
        
        if (attempt < CROWLEY_CONFIG.RETRY_ATTEMPTS) {
          console.log('Network error, retrying...');
          await sleep(CROWLEY_CONFIG.RETRY_DELAY * attempt);
          continue;
        } else {
          console.log('Network error persists, redirecting to login');
          showToast('Network connection lost. Please check your internet connection.', 'error');
          // Don't redirect immediately on network errors, let user try to fix connection
          return Promise.reject(err);
        }
      }
      
      // If this is the last attempt, throw the error
      if (attempt === CROWLEY_CONFIG.RETRY_ATTEMPTS) {
        throw err;
      }
      
      // Wait before retrying
      await sleep(CROWLEY_CONFIG.RETRY_DELAY * attempt);
    }
  }
  
  // If we get here, all attempts failed
  throw lastError;
}

// Helper function to safely set localStorage items
function setAuthData(token, user) {
  try {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  } catch (err) {
    console.error('Error setting auth data:', err);
    throw new Error('Failed to save authentication data');
  }
}

// Helper function to safely clear auth data
function clearAuthData() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch (err) {
    console.error('Error clearing auth data:', err);
  }
}

// Helper function to check if user has permission
function hasPermission(requiredRoles = []) {
  const user = getCurrentUser();
  if (!user.role) return false;
  
  if (user.role === 'admin') return true; // Admin has all permissions
  
  return requiredRoles.includes(user.role);
}

// Helper function to format dates consistently
function formatDate(dateString) {
  if (!dateString) return 'Not set';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString();
  } catch (err) {
    return 'Invalid date';
  }
}

// Helper function to format date and time
function formatDateTime(dateString) {
  if (!dateString) return 'Not set';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString();
  } catch (err) {
    return 'Invalid date';
  }
}

// Helper function to format relative time (e.g., "2 hours ago")
function formatRelativeTime(dateString) {
  if (!dateString) return 'Unknown';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return formatDate(dateString);
  } catch (err) {
    return 'Invalid date';
  }
}

// Helper function to show toast notifications with black & gold theme
function showToast(message, type = 'info') {
  // Remove existing toasts of the same type to prevent spam
  const existingToasts = document.querySelectorAll(`.toast-${type}`);
  existingToasts.forEach(toast => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  });

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Black & Gold color scheme
  const colors = {
    error: { bg: '#1a0000', border: '#cc0000', text: '#ffcccc' },
    success: { bg: '#0a1a00', border: '#00cc00', text: '#ccffcc' },
    warning: { bg: '#1a1a00', border: '#cccc00', text: '#ffffcc' },
    info: { bg: '#000000', border: '#ffd700', text: '#ffffff' }
  };
  
  const color = colors[type] || colors.info;
  
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 20px;
    background: ${color.bg};
    border: 2px solid ${color.border};
    color: ${color.text};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3), 0 0 20px ${color.border}40;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    max-width: 400px;
    word-wrap: break-word;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    backdrop-filter: blur(10px);
  `;
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 100);
  
  // Remove after 5 seconds
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 5000);
}

// Helper function to show loading indicator
function showLoading(element, text = 'Loading...') {
  if (!element) return;
  
  const spinner = document.createElement('div');
  spinner.className = 'crowley-loading';
  spinner.innerHTML = `
    <div class="crowley-spinner"></div>
    <span>${text}</span>
  `;
  
  spinner.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 20px;
    color: #ffd700;
    font-weight: 500;
  `;
  
  // Add spinner styles if not already present
  if (!document.querySelector('#crowley-spinner-styles')) {
    const style = document.createElement('style');
    style.id = 'crowley-spinner-styles';
    style.textContent = `
      .crowley-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #333;
        border-top: 2px solid #ffd700;
        border-radius: 50%;
        animation: crowley-spin 1s linear infinite;
      }
      @keyframes crowley-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  element.innerHTML = '';
  element.appendChild(spinner);
}

// Helper function to hide loading indicator
function hideLoading(element, content = '') {
  if (!element) return;
  
  const loadingEl = element.querySelector('.crowley-loading');
  if (loadingEl) {
    element.innerHTML = content;
  }
}

// Helper function to validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to validate password strength
function validatePassword(password) {
  const errors = [];
  
  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

// Helper function to sanitize HTML to prevent XSS
function sanitizeHtml(str) {
  if (!str) return '';
  
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Helper function to truncate text
function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Helper function to get priority color (black & gold theme)
function getPriorityColor(priority) {
  const colors = {
    'high': '#cc0000',
    'medium': '#ffd700',
    'low': '#00cc00'
  };
  return colors[priority?.toLowerCase()] || colors.medium;
}

// Helper function to get status color (black & gold theme)
function getStatusColor(status) {
  const colors = {
    'to do': '#666666',
    'in progress': '#ffd700',
    'done': '#00cc00',
    'blocked': '#cc0000',
    'review': '#ff8800'
  };
  return colors[status?.toLowerCase()] || colors['to do'];
}

// Enhanced API helper for handling common CRUD operations
const CrowleyAPI = {
  // Get all projects
  async getProjects() {
    const response = await api('/api/projects');
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    return response.json();
  },

  // Get single project
  async getProject(projectId) {
    const response = await api(`/api/projects/${projectId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch project');
    }
    return response.json();
  },

  // Create project
  async createProject(projectData) {
    const response = await api('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
    if (!response.ok) {
      throw new Error('Failed to create project');
    }
    return response.json();
  },

  // Get issues for a project
  async getProjectIssues(projectId) {
    const response = await api(`/api/projects/${projectId}/issues`);
    if (!response.ok) {
      throw new Error('Failed to fetch issues');
    }
    return response.json();
  },

  // Create issue
  async createIssue(issueData, files = null) {
    let body, headers = {};
    
    if (files && files.length > 0) {
      // Use FormData for file uploads
      body = new FormData();
      Object.keys(issueData).forEach(key => {
        body.append(key, issueData[key]);
      });
      files.forEach(file => {
        body.append('files', file);
      });
    } else {
      // Use JSON for text-only issues
      body = JSON.stringify(issueData);
      headers['Content-Type'] = 'application/json';
    }

    const response = await api('/api/issues', {
      method: 'POST',
      headers,
      body
    });
    
    if (!response.ok) {
      throw new Error('Failed to create issue');
    }
    return response.json();
  },

  // Update issue
  async updateIssue(issueId, issueData, files = null) {
    let body, headers = {};
    
    if (files && files.length > 0) {
      // Use FormData for file uploads
      body = new FormData();
      Object.keys(issueData).forEach(key => {
        body.append(key, issueData[key]);
      });
      files.forEach(file => {
        body.append('files', file);
      });
    } else {
      // Use JSON for text-only updates
      body = JSON.stringify(issueData);
      headers['Content-Type'] = 'application/json';
    }

    const response = await api(`/api/issues/${issueId}`, {
      method: 'PUT',
      headers,
      body
    });
    
    if (!response.ok) {
      throw new Error('Failed to update issue');
    }
    return response.json();
  },

  // Get project board
  async getProjectBoard(projectId, sprintId = null) {
    const url = sprintId 
      ? `/api/projects/${projectId}/board?sprintId=${sprintId}`
      : `/api/projects/${projectId}/board`;
    
    const response = await api(url);
    if (!response.ok) {
      throw new Error('Failed to fetch board');
    }
    return response.json();
  },

  // Get sprints for a project
  async getProjectSprints(projectId) {
    const response = await api(`/api/projects/${projectId}/sprints`);
    if (!response.ok) {
      throw new Error('Failed to fetch sprints');
    }
    return response.json();
  },

  // Create sprint
  async createSprint(projectId, sprintData) {
    const response = await api(`/api/projects/${projectId}/sprints`, {
      method: 'POST',
      body: JSON.stringify(sprintData)
    });
    if (!response.ok) {
      throw new Error('Failed to create sprint');
    }
    return response.json();
  },

  // Start sprint
  async startSprint(sprintId) {
    const response = await api(`/api/sprints/${sprintId}/start`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error('Failed to start sprint');
    }
    return response.json();
  },

  // Close sprint
  async closeSprint(sprintId) {
    const response = await api(`/api/sprints/${sprintId}/close`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error('Failed to close sprint');
    }
    return response.json();
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on a protected page
  const protectedPages = ['projects.html', 'board.html', 'sprints.html', 'backlog.html', 'create-issue.html'];
  const currentPage = window.location.pathname.split('/').pop();
  
  if (protectedPages.includes(currentPage)) {
    if (!requireAuth()) {
      return; // Will redirect
    }
  }
  
  // Add global error handler for uncaught errors
  window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showToast('An unexpected error occurred. Please refresh the page.', 'error');
  });
  
  // Add global handler for unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('A network error occurred. Please try again.', 'error');
  });
  
  console.log('🏆 Crowley App common.js loaded - Black & Gold Edition');
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getToken,
    getCurrentUser,
    requireAuth,
    api,
    setAuthData,
    clearAuthData,
    hasPermission,
    formatDate,
    formatDateTime,
    formatRelativeTime,
    showToast,
    showLoading,
    hideLoading,
    isValidEmail,
    validatePassword,
    sanitizeHtml,
    truncateText,
    getPriorityColor,
    getStatusColor,
    CrowleyAPI
  };
}
