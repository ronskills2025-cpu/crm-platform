/**
 * Complete CRM Server - Full API with Authentication
 * 
 * This provides a complete working API server with all endpoints including auth
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());

// Mock JWT token
const DEMO_TOKEN = 'demo-jwt-token-12345';
const DEMO_USER = {
  id: '1',
  email: 'demo@crm.com',
  name: 'Demo User',
  role: 'admin',
  avatar: null
};

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== DEMO_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = DEMO_USER;
  next();
};

// Mock data
const mockStats = {
  total_bots: 3,
  active_bots: 2,
  total_conversations: 15,
  active_conversations: 8,
  messages_sent_today: 42,
  handoffs_today: 2
};

const mockBots = [
  {
    id: '1',
    name: 'Welcome Bot',
    channel: 'whatsapp',
    bot_type: 'auto_reply',
    is_active: true,
    welcome_message: 'Hello! How can I help you today?',
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    name: 'FAQ Bot',
    channel: 'all',
    bot_type: 'faq',
    is_active: true,
    welcome_message: 'Hi! Ask me anything about our services.',
    created_at: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Payment Bot',
    channel: 'whatsapp',
    bot_type: 'payment',
    is_active: false,
    welcome_message: 'I can help you with payments.',
    created_at: new Date().toISOString()
  }
];

const mockLeads = Array.from({ length: 156 }, (_, i) => ({
  id: String(i + 1),
  channel: ['whatsapp', 'sms', 'email', 'telegram'][i % 4],
  contact_value: i % 2 === 0 ? `+123456${String(i).padStart(4, '0')}` : `user${i}@example.com`,
  name: `Lead ${i + 1}`,
  status: ['new', 'contacted', 'converted'][i % 3],
  segment: ['cold', 'warm', 'hot'][i % 3],
  created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
}));

const mockCampaigns = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  name: `Campaign ${i + 1}`,
  channel: ['whatsapp', 'sms', 'email'][i % 3],
  status: ['completed', 'running', 'paused'][i % 3],
  sent_count: Math.floor(Math.random() * 1000) + 100,
  delivered_count: Math.floor(Math.random() * 900) + 90,
  created_at: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString()
}));

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION ROUTES
// ═══════════════════════════════════════════════════════════════

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Accept any email/password for demo
  if (email && password) {
    res.json({
      success: true,
      user: DEMO_USER,
      token: DEMO_TOKEN
    });
  } else {
    res.status(400).json({ error: 'Email and password required' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  
  if (email && password && name) {
    res.status(201).json({
      success: true,
      user: { ...DEMO_USER, email, name },
      token: DEMO_TOKEN
    });
  } else {
    res.status(400).json({ error: 'Email, password, and name required' });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

// ═══════════════════════════════════════════════════════════════
// HEALTH & SYSTEM
// ═══════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: false,
    wsClients: 0,
    mode: 'demo',
    version: '3.0.0'
  });
});

// ═══════════════════════════════════════════════════════════════
// BOT MANAGER API
// ═══════════════════════════════════════════════════════════════

app.get('/api/bots/stats', authenticate, (req, res) => {
  res.json({ success: true, stats: mockStats });
});

app.get('/api/bots', authenticate, (req, res) => {
  res.json({ success: true, bots: mockBots });
});

app.post('/api/bots', authenticate, (req, res) => {
  const newBot = {
    id: String(mockBots.length + 1),
    ...req.body,
    is_active: req.body.is_active !== false,
    created_at: new Date().toISOString()
  };
  mockBots.push(newBot);
  mockStats.total_bots++;
  if (newBot.is_active) mockStats.active_bots++;
  
  res.status(201).json({ success: true, bot: newBot });
});

app.get('/api/bots/:id', authenticate, (req, res) => {
  const bot = mockBots.find(b => b.id === req.params.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  res.json({ success: true, bot });
});

app.patch('/api/bots/:id', authenticate, (req, res) => {
  const bot = mockBots.find(b => b.id === req.params.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  Object.assign(bot, req.body);
  res.json({ success: true, bot });
});

app.delete('/api/bots/:id', authenticate, (req, res) => {
  const index = mockBots.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  mockBots.splice(index, 1);
  mockStats.total_bots--;
  res.json({ success: true, message: 'Bot deleted' });
});

// ═══════════════════════════════════════════════════════════════
// LEADS API
// ═══════════════════════════════════════════════════════════════

app.get('/api/leads', authenticate, (req, res) => {
  const { page = 1, limit = 50, search, channel, status } = req.query;
  let filteredLeads = [...mockLeads];
  
  if (search) {
    filteredLeads = filteredLeads.filter(lead => 
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.contact_value.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  if (channel) {
    filteredLeads = filteredLeads.filter(lead => lead.channel === channel);
  }
  
  if (status) {
    filteredLeads = filteredLeads.filter(lead => lead.status === status);
  }
  
  const startIndex = (page - 1) * limit;
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + parseInt(limit));
  
  res.json({
    success: true,
    leads: paginatedLeads,
    total: filteredLeads.length,
    page: parseInt(page),
    totalPages: Math.ceil(filteredLeads.length / limit)
  });
});

app.post('/api/leads', authenticate, (req, res) => {
  const newLead = {
    id: String(mockLeads.length + 1),
    ...req.body,
    created_at: new Date().toISOString()
  };
  mockLeads.push(newLead);
  res.status(201).json({ success: true, lead: newLead });
});

// ═══════════════════════════════════════════════════════════════
// ANALYTICS API
// ═══════════════════════════════════════════════════════════════

app.get('/api/analytics', authenticate, (req, res) => {
  const analytics = {
    leads: {
      total: mockLeads.length,
      new: mockLeads.filter(l => l.status === 'new').length,
      contacted: mockLeads.filter(l => l.status === 'contacted').length,
      converted: mockLeads.filter(l => l.status === 'converted').length
    },
    campaigns: {
      total: mockCampaigns.length,
      active: mockCampaigns.filter(c => c.status === 'running').length,
      completed: mockCampaigns.filter(c => c.status === 'completed').length,
      sent_messages: mockCampaigns.reduce((sum, c) => sum + c.sent_count, 0)
    },
    channels: {
      whatsapp: { 
        messages: mockCampaigns.filter(c => c.channel === 'whatsapp').reduce((sum, c) => sum + c.sent_count, 0),
        leads: mockLeads.filter(l => l.channel === 'whatsapp').length
      },
      sms: { 
        messages: mockCampaigns.filter(c => c.channel === 'sms').reduce((sum, c) => sum + c.sent_count, 0),
        leads: mockLeads.filter(l => l.channel === 'sms').length
      },
      email: { 
        messages: mockCampaigns.filter(c => c.channel === 'email').reduce((sum, c) => sum + c.sent_count, 0),
        leads: mockLeads.filter(l => l.channel === 'email').length
      }
    },
    bots: mockStats
  };
  
  res.json({ success: true, analytics });
});

// ═══════════════════════════════════════════════════════════════
// CAMPAIGNS API
// ═══════════════════════════════════════════════════════════════

app.get('/api/campaigns', authenticate, (req, res) => {
  res.json({ success: true, campaigns: mockCampaigns });
});

app.post('/api/campaigns', authenticate, (req, res) => {
  const newCampaign = {
    id: String(mockCampaigns.length + 1),
    ...req.body,
    sent_count: 0,
    delivered_count: 0,
    status: 'draft',
    created_at: new Date().toISOString()
  };
  mockCampaigns.push(newCampaign);
  res.status(201).json({ success: true, campaign: newCampaign });
});

// ═══════════════════════════════════════════════════════════════
// INBOX API
// ═══════════════════════════════════════════════════════════════

app.get('/api/inbox/stats', authenticate, (req, res) => {
  res.json({
    success: true,
    stats: {
      whatsapp: { unread: 5, threads: 12 },
      sms: { unread: 2, threads: 8 },
      email: { unread: 3, threads: 15 },
      telegram: { unread: 0, threads: 2 },
      messenger: { unread: 1, threads: 3 },
      instagram: { unread: 0, threads: 1 }
    }
  });
});

app.get('/api/inbox/:channel', authenticate, (req, res) => {
  const { channel } = req.params;
  const mockThreads = Array.from({ length: 10 }, (_, i) => ({
    id: `thread-${i + 1}`,
    channel,
    contact_value: `+123456789${i}`,
    contact_name: `Contact ${i + 1}`,
    last_message: `Hello from ${channel}`,
    unread_count: Math.floor(Math.random() * 3),
    last_message_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
  }));
  
  res.json({ success: true, threads: mockThreads });
});

// ═══════════════════════════════════════════════════════════════
// AUTOMATION API
// ═══════════════════════════════════════════════════════════════

app.get('/api/automation', authenticate, (req, res) => {
  const mockRules = [
    {
      id: '1',
      name: 'Welcome New Leads',
      trigger_type: 'new_lead',
      is_active: true,
      actions_count: 2,
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Follow-up Reminder',
      trigger_type: 'no_reply',
      is_active: true,
      actions_count: 1,
      created_at: new Date().toISOString()
    }
  ];
  
  res.json({ success: true, rules: mockRules });
});

// ═══════════════════════════════════════════════════════════════
// USER MANAGEMENT (ADMIN)
// ═══════════════════════════════════════════════════════════════

app.get('/api/admin/users', authenticate, (req, res) => {
  const mockUsers = [
    { id: '1', email: 'admin@crm.com', name: 'Admin User', role: 'admin', status: 'active' },
    { id: '2', email: 'user@crm.com', name: 'Regular User', role: 'user', status: 'active' },
    { id: '3', email: 'manager@crm.com', name: 'Manager User', role: 'manager', status: 'active' }
  ];
  
  res.json({ success: true, users: mockUsers });
});

app.get('/api/admin/stats', authenticate, (req, res) => {
  res.json({
    success: true,
    stats: {
      total_users: 3,
      active_users: 3,
      total_campaigns: mockCampaigns.length,
      total_leads: mockLeads.length,
      messages_sent_today: 142,
      system_health: 'excellent'
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// CATCH ALL
// ═══════════════════════════════════════════════════════════════

app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    method: req.method,
    path: req.originalUrl,
    available_endpoints: [
      'POST /api/auth/login',
      'POST /api/auth/register', 
      'GET /api/auth/me',
      'GET /health',
      'GET /api/bots/stats',
      'GET /api/bots',
      'POST /api/bots',
      'GET /api/leads',
      'GET /api/analytics',
      'GET /api/campaigns',
      'GET /api/inbox/stats',
      'GET /api/automation',
      'GET /api/admin/users',
      'GET /api/admin/stats'
    ]
  });
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('\n🚀 Complete CRM Server Started!');
  console.log('==========================================');
  console.log(`📡 API Server:     http://localhost:${PORT}`);
  console.log(`🔍 Health Check:   http://localhost:${PORT}/health`);
  console.log(`🔐 Login:          POST http://localhost:${PORT}/api/auth/login`);
  console.log(`🤖 Bot Stats:      http://localhost:${PORT}/api/bots/stats`);
  console.log(`👥 Leads:          http://localhost:${PORT}/api/leads`);
  console.log(`📊 Analytics:      http://localhost:${PORT}/api/analytics`);
  console.log('==========================================');
  console.log('✅ Authentication enabled (demo@crm.com / any password)');
  console.log('✅ All endpoints working with demo data');
  console.log('✅ CORS enabled for frontend apps');
  console.log('🔄 Ready for full testing!');
  console.log('\nDemo Login Credentials:');
  console.log('  Email: demo@crm.com');
  console.log('  Password: (any password works)');
  console.log('\nPress Ctrl+C to stop\n');
});

module.exports = app;
