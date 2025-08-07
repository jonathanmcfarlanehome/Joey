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
