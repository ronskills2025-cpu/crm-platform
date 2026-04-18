/**
 * CRM Demo Server - Instant Start
 * 
 * This provides a working API server with mock data for immediate testing
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

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

const mockLeads = [
  {
    id: '1',
    channel: 'whatsapp',
    contact_value: '+1234567890',
    name: 'John Doe',
    status: 'new',
    segment: 'warm',
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    channel: 'email',
    contact_value: 'jane@example.com',
    name: 'Jane Smith',
    status: 'contacted',
    segment: 'hot',
    created_at: new Date().toISOString()
  }
];

const mockAnalytics = {
  leads: {
    total: 156,
    new: 23,
    contacted: 89,
    converted: 44
  },
  campaigns: {
    total: 12,
    active: 3,
    completed: 9,
    sent_messages: 1234
  },
  channels: {
    whatsapp: { messages: 567, leads: 89 },
    sms: { messages: 234, leads: 34 },
    email: { messages: 433, leads: 33 }
  }
};

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: false,
    wsClients: 0,
    mode: 'demo'
  });
});

// Bot Manager API
app.get('/api/bots/stats', (req, res) => {
  res.json({ success: true, stats: mockStats });
});

app.get('/api/bots', (req, res) => {
  res.json({ success: true, bots: mockBots });
});

app.post('/api/bots', (req, res) => {
  const newBot = {
    id: String(mockBots.length + 1),
    ...req.body,
    created_at: new Date().toISOString()
  };
  mockBots.push(newBot);
  res.status(201).json({ success: true, bot: newBot });
});

app.get('/api/bots/:id', (req, res) => {
  const bot = mockBots.find(b => b.id === req.params.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  res.json({ success: true, bot });
});

// Leads API
app.get('/api/leads', (req, res) => {
  res.json({ success: true, leads: mockLeads, total: mockLeads.length });
});

// Analytics API
app.get('/api/analytics', (req, res) => {
  res.json({ success: true, analytics: mockAnalytics });
});

// Inbox API
app.get('/api/inbox/stats', (req, res) => {
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

// Automation API
app.get('/api/automation', (req, res) => {
  res.json({
    success: true,
    rules: [
      {
        id: '1',
        name: 'Welcome New Leads',
        trigger_type: 'new_lead',
        is_active: true,
        actions_count: 2
      },
      {
        id: '2',
        name: 'Follow-up Reminder',
        trigger_type: 'no_reply',
        is_active: true,
        actions_count: 1
      }
    ]
  });
});

// Campaigns API
app.get('/api/campaigns', (req, res) => {
  res.json({
    success: true,
    campaigns: [
      {
        id: '1',
        name: 'Summer Sale',
        channel: 'whatsapp',
        status: 'completed',
        sent_count: 500,
        delivered_count: 485
      },
      {
        id: '2',
        name: 'Product Launch',
        channel: 'email',
        status: 'running',
        sent_count: 250,
        delivered_count: 240
      }
    ]
  });
});

// Catch all
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /health',
      'GET /api/bots/stats',
      'GET /api/bots',
      'POST /api/bots',
      'GET /api/leads',
      'GET /api/analytics',
      'GET /api/inbox/stats',
      'GET /api/automation',
      'GET /api/campaigns'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 CRM Demo Server Started!');
  console.log('==========================================');
  console.log(`📡 API Server:     http://localhost:${PORT}`);
  console.log(`🔍 Health Check:   http://localhost:${PORT}/health`);
  console.log(`🤖 Bot Stats:      http://localhost:${PORT}/api/bots/stats`);
  console.log(`👥 Leads:          http://localhost:${PORT}/api/leads`);
  console.log(`📊 Analytics:      http://localhost:${PORT}/api/analytics`);
  console.log(`📨 Inbox Stats:    http://localhost:${PORT}/api/inbox/stats`);
  console.log('==========================================');
  console.log('✅ All endpoints working with demo data');
  console.log('🔄 Ready for testing!');
  console.log('\nPress Ctrl+C to stop\n');
});

module.exports = app;
