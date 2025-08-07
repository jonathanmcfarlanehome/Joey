<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Crowley App – Issue Details</title>
  <style>
    :root {
      --primary-color: #ffd700;
      --primary-hover: #ffed4e;
      --secondary-color: #1a1a1a;
      --accent-color: #333333;
      --success-color: #00cc00;
      --warning-color: #ff8800;
      --danger-color: #cc0000;
      --ai-color: #9d4edd;
      --ai-hover: #b464f0;
      --text-primary: #ffffff;
      --text-secondary: #cccccc;
      --text-muted: #888888;
      --background-primary: #000000;
      --background-secondary: #111111;
      --border-color: #333333;
      --shadow: 0 4px 12px rgba(0,0,0,0.5);
      --shadow-hover: 0 8px 25px rgba(255,215,0,0.3);
      --ai-glow: 0 0 20px rgba(157,78,221,0.3);
      --glow: 0 0 20px rgba(255,215,0,0.3);
      --radius: 8px;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, var(--background-primary), var(--background-secondary));
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }

    .navbar {
      background: var(--background-secondary);
      border-bottom: 2px solid var(--primary-color);
      color: var(--text-primary);
      padding: 0 20px;
      height: 70px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: var(--shadow);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .navbar h1 {
      font-size: 28px;
      font-weight: 700;
      color: var(--primary-color);
      text-shadow: var(--glow);
    }

    .navbar h1::before {
      content: '🏆';
      margin-right: 10px;
    }

    .main-container {
      display: flex;
      gap: 25px;
      padding: 25px;
      max-width: 1600px;
      margin: 0 auto;
    }

    .content {
      flex: 1;
      min-width: 0;
    }

    .ai-sidebar {
      width: 350px;
      background: var(--background-secondary);
      border: 2px solid var(--ai-color);
      border-radius: var(--radius);
      padding: 20px;
      box-shadow: var(--ai-glow);
      height: fit-content;
      position: sticky;
      top: 95px;
    }

    .ai-sidebar h3 {
      color: var(--ai-color);
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
    }

    .ai-sidebar h3::before {
      content: '🤖';
    }

    .card {
      background: var(--background-secondary);
      border: 2px solid var(--border-color);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 25px;
      margin-bottom: 25px;
      transition: all 0.3s ease;
    }

    .card:hover {
      border-color: var(--primary-color);
      box-shadow: var(--shadow-hover);
      transform: translateY(-2px);
    }

    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .issue-title {
      color: var(--primary-color);
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 10px;
      text-shadow: var(--glow);
    }

    .issue-meta {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }

    .meta-item {
      background: var(--accent-color);
      padding: 8px 12px;
      border-radius: var(--radius);
      border: 1px solid var(--border-color);
      font-size: 14px;
      color: var(--text-secondary);
    }

    .meta-item strong {
      color: var(--primary-color);
    }

    .priority-badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      border: 2px solid;
    }

    .priority-high {
      background: rgba(204, 0, 0, 0.15);
      color: #ff6666;
      border-color: var(--danger-color);
    }

    .priority-medium {
      background: rgba(255, 136, 0, 0.15);
      color: #ffaa44;
      border-color: var(--warning-color);
    }

    .priority-low {
      background: rgba(0, 204, 0, 0.15);
      color: #66ff66;
      border-color: var(--success-color);
    }

    .status-badge {
      background: var(--primary-color);
      color: var(--background-primary);
      padding: 6px 12px;
      border-radius: 16px;
      font-weight: 600;
      font-size: 12px;
    }

    .issue-description {
      background: var(--background-primary);
      padding: 20px;
      border-radius: var(--radius);
      border: 1px solid var(--border-color);
      margin-bottom: 20px;
      line-height: 1.6;
    }

    .comments-section {
      margin-top: 30px;
    }

    .comments-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .comments-title {
      color: var(--primary-color);
      font-size: 24px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .comments-title::before {
      content: '💬';
    }

    .comment-form {
      background: var(--background-primary);
      border: 2px solid var(--border-color);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 25px;
      transition: all 0.3s ease;
    }

    .comment-form:focus-within {
      border-color: var(--primary-color);
      box-shadow: var(--glow);
    }

    .comment-textarea {
      width: 100%;
      min-height: 120px;
      background: var(--background-secondary);
      border: 2px solid var(--border-color);
      border-radius: var(--radius);
      padding: 15px;
      color: var(--text-primary);
      font-size: 16px;
      resize: vertical;
      transition: all 0.3s ease;
    }

    .comment-textarea:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: var(--glow);
    }

    .comment-textarea::placeholder {
      color: var(--text-muted);
    }

    .comment-form-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 15px;
      gap: 15px;
    }

    .ai-suggestions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      flex: 1;
    }

    .ai-suggestion-btn {
      background: var(--ai-color);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      opacity: 0.8;
    }

    .ai-suggestion-btn:hover {
      background: var(--ai-hover);
      opacity: 1;
      transform: translateY(-1px);
    }

    .comment-actions {
      display: flex;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      padding: 12px 24px;
      border: none;
      border-radius: var(--radius);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.3s ease;
      gap: 8px;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--primary-color), #e6c200);
      color: var(--background-primary);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, var(--primary-hover), var(--primary-color));
      box-shadow: var(--shadow-hover);
      transform: translateY(-2px);
    }

    .btn-ai {
      background: linear-gradient(135deg, var(--ai-color), var(--ai-hover));
      color: white;
    }

    .btn-ai:hover {
      box-shadow: var(--ai-glow);
      transform: translateY(-2px);
    }

    .btn-secondary {
      background: var(--accent-color);
      color: var(--text-primary);
      border: 2px solid var(--border-color);
    }

    .btn-secondary:hover {
      border-color: var(--primary-color);
      box-shadow: var(--glow);
    }

    .comment {
      background: var(--background-primary);
      border: 2px solid var(--border-color);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 20px;
      transition: all 0.3s ease;
      position: relative;
    }

    .comment:hover {
      border-color: var(--primary-color);
      box-shadow: var(--shadow-hover);
    }

    .comment.ai-suggested {
      border-color: var(--ai-color);
      background: rgba(157, 78, 221, 0.05);
    }

    .comment.ai-suggested::before {
      content: '🤖 AI Suggested';
      position: absolute;
      top: -10px;
      right: 15px;
      background: var(--ai-color);
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }

    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
    }

    .comment-author {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .comment-author-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .comment-author-name {
      color: var(--primary-color);
      font-weight: 600;
      font-size: 16px;
    }

    .comment-meta {
      display: flex;
      gap: 15px;
      align-items: center;
      font-size: 12px;
      color: var(--text-muted);
    }

    .comment-timestamp {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .sentiment-indicator {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }

    .sentiment-positive {
      background: rgba(0, 204, 0, 0.1);
      color: var(--success-color);
    }

    .sentiment-negative {
      background: rgba(204, 0, 0, 0.1);
      color: var(--danger-color);
    }

    .sentiment-neutral {
      background: rgba(136, 136, 136, 0.1);
      color: var(--text-muted);
    }

    .sentiment-urgent {
      background: rgba(255, 136, 0, 0.1);
      color: var(--warning-color);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .comment-content {
      color: var(--text-primary);
      line-height: 1.6;
      margin-bottom: 15px;
    }

    .comment-actions {
      display: flex;
      gap: 10px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .comment:hover .comment-actions {
      opacity: 1;
    }

    .comment-action-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .comment-action-btn:hover {
      border-color: var(--primary-color);
      color: var(--primary-color);
    }

    .ai-insights {
      background: linear-gradient(135deg, var(--ai-color), var(--ai-hover));
      color: white;
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 20px;
    }

    .ai-insights h4 {
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ai-insights h4::before {
      content: '🔍';
    }

    .ai-insight-item {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
      border-left: 4px solid rgba(255, 255, 255, 0.3);
    }

    .ai-insight-item:last-child {
      margin-bottom: 0;
    }

    .confidence-bar {
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      margin-top: 8px;
      overflow: hidden;
    }

    .confidence-fill {
      height: 100%;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    .similar-issues {
      margin-top: 20px;
    }

    .similar-issues h4 {
      color: var(--ai-color);
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .similar-issues h4::before {
      content: '🔗';
    }

    .similar-issue {
      background: var(--background-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .similar-issue:hover {
      border-color: var(--ai-color);
      background: rgba(157, 78, 221, 0.05);
    }

    .similar-issue-title {
      color: var(--text-primary);
      font-weight: 600;
      margin-bottom: 5px;
    }

    .similar-issue-meta {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }

    .action-items {
      margin-top: 20px;
    }

    .action-items h4 {
      color: var(--warning-color);
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .action-items h4::before {
      content: '✅';
    }

    .action-item {
      background: var(--background-primary);
      border: 1px solid var(--warning-color);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
      position: relative;
    }

    .action-item::before {
      content: '•';
      color: var(--warning-color);
      font-weight: bold;
      margin-right: 8px;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: var(--text-secondary);
    }

    .spinner {
      border: 3px solid var(--accent-color);
      border-top: 3px solid var(--ai-color);
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 1s linear infinite;
      margin-right: 15px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
      font-style: italic;
    }

    @media (max-width: 1200px) {
      .main-container {
        flex-direction: column;
      }
      
      .ai-sidebar {
        width: 100%;
        position: static;
      }
    }

    @media (max-width: 768px) {
      .main-container {
        padding: 15px;
        gap: 20px;
      }
      
      .issue-header {
        flex-direction: column;
        gap: 15px;
      }
      
      .issue-meta {
        flex-direction: column;
        gap: 10px;
      }
      
      .comment-form-actions {
        flex-direction: column;
        gap: 15px;
      }
      
      .ai-suggestions {
        order: 2;
      }
      
      .comment-actions {
        order: 1;
      }
    }
  </style>
</head>
<body>
  <div class="navbar">
    <h1>Crowley App</h1>
    <div class="navbar-right">
      <span id="userInfo">Loading...</span>
      <a href="javascript:history.back()" class="btn btn-secondary">← Back</a>
    </div>
  </div>

  <div class="main-container">
    <div class="content">
      <div class="card">
        <div class="issue-header">
          <div>
            <h1 class="issue-title" id="issueTitle">Loading...</h1>
            <div class="issue-meta" id="issueMeta">
              <!-- Meta information will be populated here -->
            </div>
          </div>
          <div>
            <button class="btn btn-ai" id="refreshAiBtn">🤖 Refresh AI Analysis</button>
          </div>
        </div>
        
        <div class="issue-description" id="issueDescription">
          Loading issue description...
        </div>
      </div>

      <div class="card comments-section">
        <div class="comments-header">
          <h2 class="comments-title">Discussion</h2>
          <span id="commentsCount">0 comments</span>
        </div>

        <div class="comment-form">
          <textarea 
            id="commentTextarea" 
            class="comment-textarea" 
            placeholder="Add your thoughts, updates, or questions about this issue..."
          ></textarea>
          
          <div class="comment-form-actions">
            <div class="ai-suggestions" id="aiSuggestions">
              <!-- AI suggestions will be populated here -->
            </div>
            
            <div class="comment-actions">
              <button class="btn btn-ai" id="getAiSuggestionsBtn">🤖 Get AI Help</button>
              <button class="btn btn-primary" id="submitCommentBtn">💬 Post Comment</button>
            </div>
          </div>
        </div>

        <div id="commentsContainer">
          <div class="loading">
            <div class="spinner"></div>
            <span>Loading comments...</span>
          </div>
        </div>
      </div>
    </div>

    <div class="ai-sidebar">
      <h3>AI Assistant</h3>
      
      <div class="ai-insights" id="aiInsights">
        <div class="loading">
          <div class="spinner"></div>
          <span>Analyzing issue...</span>
        </div>
      </div>

      <div class="similar-issues" id="similarIssues">
        <!-- Similar issues will be populated here -->
      </div>

      <div class="action-items" id="actionItems">
        <!-- Action items will be populated here -->
      </div>
    </div>
  </div>

  <script>
    // Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const issueId = params.get('issueId');
    const projectId = params.get('projectId');

    if (!issueId) {
      window.location.href = '/projects.html';
    }

    // Authentication helpers
    function getToken() {
      return localStorage.getItem('token');
    }

    function getCurrentUser() {
      try {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : {};
      } catch (err) {
        return {};
      }
    }

    async function api(path, options = {}) {
      const opts = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        ...options
      };

      const token = getToken();
      if (token) {
        opts.headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(path, opts);
      
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
        return;
      }

      return response;
    }

    // Initialize user info
    const currentUser = getCurrentUser();
    document.getElementById('userInfo').textContent = currentUser.email || 'Loading...';

    // Global state
    let currentIssue = null;
    let comments = [];
    let aiAnalysis = null;

    // Utility functions
    function formatDate(dateString) {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    function getPriorityClass(priority) {
      switch (priority?.toLowerCase()) {
        case 'high': return 'priority-high';
        case 'low': return 'priority-low';
        default: return 'priority-medium';
      }
    }

    function getSentimentClass(sentiment) {
      if (sentiment.isUrgent) return 'sentiment-urgent';
      switch (sentiment.sentiment) {
        case 'positive': return 'sentiment-positive';
        case 'negative': return 'sentiment-negative';
        default: return 'sentiment-neutral';
      }
    }

    function getSentimentEmoji(sentiment) {
      if (sentiment.isUrgent) return '🚨';
      switch (sentiment.sentiment) {
        case 'positive': return '😊';
        case 'negative': return '😟';
        default: return '😐';
      }
    }

    // Load issue details
    async function loadIssue() {
      try {
        const response = await api(`/api/issues/${issueId}`);
        if (!response.ok) throw new Error('Failed to load issue');
        
        currentIssue = await response.json();
        
        // Update UI
        document.getElementById('issueTitle').textContent = currentIssue.title;
        document.getElementById('issueDescription').textContent = currentIssue.description || 'No description provided.';
        
        // Update meta information
        const metaHtml = `
          <div class="meta-item"><strong>Status:</strong> <span class="status-badge">${currentIssue.status}</span></div>
          <div class="meta-item priority-badge ${getPriorityClass(currentIssue.priority)}">${currentIssue.priority}</div>
          <div class="meta-item"><strong>Created:</strong> ${formatDate(currentIssue.createdAt)}</div>
          ${currentIssue.assigneeEmail ? `<div class="meta-item"><strong>Assignee:</strong> ${currentIssue.assigneeEmail}</div>` : ''}
          ${currentIssue.dueDate ? `<div class="meta-item"><strong>Due:</strong> ${formatDate(currentIssue.dueDate)}</div>` : ''}
        `;
        document.getElementById('issueMeta').innerHTML = metaHtml;
        
      } catch (error) {
        console.error('Error loading issue:', error);
        document.getElementById('issueTitle').textContent = 'Error loading issue';
      }
    }

    // Load comments
    async function loadComments() {
      try {
        const response = await api(`/api/issues/${issueId}/comments`);
        if (!response.ok) throw new Error('Failed to load comments');
        
        comments = await response.json();
        renderComments();
        
      } catch (error) {
        console.error('Error loading comments:', error);
        document.getElementById('commentsContainer').innerHTML = 
          '<div class="empty-state">Error loading comments</div>';
      }
    }

    // Render comments
    function renderComments() {
      const container = document.getElementById('commentsContainer');
      const countElement = document.getElementById('commentsCount');
      
      countElement.textContent = `${comments.length} comment${comments.length !== 1 ? 's' : ''}`;
      
      if (comments.length === 0) {
        container.innerHTML = '<div class="empty-state">No comments yet. Be the first to start the discussion!</div>';
        return;
      }
      
      const commentsHtml = comments.map(comment => `
        <div class="comment ${comment.isAiSuggestion ? 'ai-suggested' : ''}" data-comment-id="${comment.id}">
          <div class="comment-header">
            <div class="comment-author">
              <div class="comment-author-info">
                <div class="comment-author-name">${comment.authorEmail}</div>
                <div class="comment-meta">
                  <span class="comment-timestamp">
                    📅 ${formatDate(comment.createdAt)}
                    ${comment.isEdited ? '(edited)' : ''}
                  </span>
                  ${comment.sentiment ? `
                    <span class="sentiment-indicator ${getSentimentClass(comment.sentiment)}">
                      ${getSentimentEmoji(comment.sentiment)} ${comment.sentiment.sentiment}
                      ${comment.sentiment.isUrgent ? ' • URGENT' : ''}
                    </span>
                  ` : ''}
                </div>
              </div>
            </div>
            ${comment.authorId === currentUser.id || currentUser.role === 'admin' ? `
              <div class="comment-actions">
                <button class="comment-action-btn" onclick="editComment('${comment.id}')">✏️ Edit</button>
                <button class="comment-action-btn" onclick="deleteComment('${comment.id}')">🗑️ Delete</button>
              </div>
            ` : ''}
          </div>
          <div class="comment-content">${comment.content}</div>
        </div>
      `).join('');
      
      container.innerHTML = commentsHtml;
    }

    // Load AI analysis
    async function loadAiAnalysis() {
      try {
        const [analysisResponse, suggestionsResponse] = await Promise.all([
          api(`/api/issues/${issueId}/ai-analysis`),
          api(`/api/issues/${issueId}/ai-suggestions`, {
            method: 'POST',
            body: JSON.stringify({ currentComment: '' })
          })
        ]);
        
        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          renderAiInsights(analysisData);
        }
        
        if (suggestionsResponse.ok) {
          const suggestionsData = await suggestionsResponse.json();
          renderActionItems(suggestionsData.actionItems);
        }
        
      } catch (error) {
        console.error('Error loading AI analysis:', error);
        document.getElementById('aiInsights').innerHTML = 
          '<div style="text-align: center; color: #888;">AI analysis unavailable</div>';
      }
    }

    // Render AI insights
    function renderAiInsights(data) {
      const { analysis, similarIssues } = data;
      
      const insightsHtml = `
        <h4>Issue Analysis</h4>
        <div class="ai-insight-item">
          <strong>Summary:</strong> ${analysis.summary}
          <div class="confidence-bar">
            <div class="confidence-fill" style="width: ${analysis.confidence}%"></div>
          </div>
        </div>
        <div class="ai-insight-item">
          <strong>Suggested Priority:</strong> ${analysis.suggestedPriority}
        </div>
        <div class="ai-insight-item">
          <strong>Estimated Time:</strong> ${analysis.timeEstimate}
        </div>
        <div class="ai-insight-item">
          <strong>Suggested Labels:</strong> ${analysis.suggestedLabels.join(', ')}
        </div>
        ${analysis.suggestions.map(suggestion => `
          <div class="ai-insight-item">💡 ${suggestion}</div>
        `).join('')}
      `;
      
      document.getElementById('aiInsights').innerHTML = insightsHtml;
      
      // Render similar issues
      if (similarIssues && similarIssues.length > 0) {
        const similarHtml = `
          <h4>Similar Issues</h4>
          ${similarIssues.map(issue => `
            <div class="similar-issue" onclick="window.open('/issue-detail.html?issueId=${issue.id}', '_blank')">
              <div class="similar-issue-title">${issue.title}</div>
              <div class="similar-issue-meta">
                <span>${issue.status}</span>
                <span>${Math.round(issue.similarity)}% similar</span>
              </div>
            </div>
          `).join('')}
        `;
        document.getElementById('similarIssues').innerHTML = similarHtml;
      }
    }

    // Render action items
    function renderActionItems(actionItems) {
      if (!actionItems || actionItems.length === 0) {
        document.getElementById('actionItems').style.display = 'none';
        return;
      }
      
      const actionItemsHtml = `
        <h4>Action Items Detected</h4>
        ${actionItems.map(item => `
          <div class="action-item">
            ${item.text}
            <div style="font-size: 11px; color: #888; margin-top: 5px;">
              Confidence: ${Math.round(item.confidence)}%
            </div>
          </div>
        `).join('')}
      `;
      
      document.getElementById('actionItems').innerHTML = actionItemsHtml;
    }

    // Get AI suggestions for comments
    async function getAiSuggestions() {
      const currentComment = document.getElementById('commentTextarea').value;
      const btn = document.getElementById('getAiSuggestionsBtn');
      const suggestionsContainer = document.getElementById('aiSuggestions');
      
      btn.disabled = true;
      btn.textContent = '🤖 Getting suggestions...';
      
      try {
        const response = await api(`/api/issues/${issueId}/ai-suggestions`, {
          method: 'POST',
          body: JSON.stringify({ currentComment })
        });
        
        if (response.ok) {
          const data = await response.json();
          renderAiSuggestions(data.suggestions.suggestions);
        }
        
      } catch (error) {
        console.error('Error getting AI suggestions:', error);
      } finally {
        btn.disabled = false;
        btn.textContent = '🤖 Get AI Help';
      }
    }

    // Render AI comment suggestions
    function renderAiSuggestions(suggestions) {
      const container = document.getElementById('aiSuggestions');
      
      if (!suggestions || suggestions.length === 0) {
        container.innerHTML = '';
        return;
      }
      
      const suggestionsHtml = suggestions.map((suggestion, index) => `
        <button class="ai-suggestion-btn" onclick="useSuggestion('${suggestion.replace(/'/g, "\\'")}')">
          ${suggestion.substring(0, 50)}${suggestion.length > 50 ? '...' : ''}
        </button>
      `).join('');
      
      container.innerHTML = suggestionsHtml;
    }

    // Use AI suggestion
    function useSuggestion(suggestion) {
      document.getElementById('commentTextarea').value = suggestion;
      document.getElementById('commentTextarea').focus();
    }

    // Submit comment
    async function submitComment() {
      const content = document.getElementById('commentTextarea').value.trim();
      if (!content) return;
      
      const btn = document.getElementById('submitCommentBtn');
      btn.disabled = true;
      btn.textContent = '💬 Posting...';
      
      try {
        const response = await api(`/api/issues/${issueId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ content })
        });
        
        if (response.ok) {
          document.getElementById('commentTextarea').value = '';
          document.getElementById('aiSuggestions').innerHTML = '';
          await loadComments();
          await loadAiAnalysis(); // Refresh AI analysis after new comment
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to post comment');
        }
        
      } catch (error) {
        console.error('Error posting comment:', error);
        alert('Failed to post comment');
      } finally {
        btn.disabled = false;
        btn.textContent = '💬 Post Comment';
      }
    }

    // Edit comment (placeholder)
    window.editComment = function(commentId) {
      alert('Edit functionality coming soon!');
    };

    // Delete comment
    window.deleteComment = async function(commentId) {
      if (!confirm('Are you sure you want to delete this comment?')) return;
      
      try {
        const response = await api(`/api/issues/${issueId}/comments/${commentId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          await loadComments();
          await loadAiAnalysis();
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to delete comment');
        }
        
      } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment');
      }
    };

    // Event listeners
    document.getElementById('submitCommentBtn').addEventListener('click', submitComment);
    document.getElementById('getAiSuggestionsBtn').addEventListener('click', getAiSuggestions);
    document.getElementById('refreshAiBtn').addEventListener('click', loadAiAnalysis);

    // Auto-get AI suggestions when user types
    let suggestionTimeout;
    document.getElementById('commentTextarea').addEventListener('input', (e) => {
      clearTimeout(suggestionTimeout);
      if (e.target.value.length > 20) {
        suggestionTimeout = setTimeout(getAiSuggestions, 2000);
      }
    });

    // Initialize page
    async function init() {
      await Promise.all([
        loadIssue(),
        loadComments(),
        loadAiAnalysis()
      ]);
    }

    init();
  </script>
</body>
</html>
