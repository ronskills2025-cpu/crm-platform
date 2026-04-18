# CRM System Startup Guide

## Prerequisites

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
# Copy example environment file
copy .env.example .env

# Configure database connection
node setup-database.js  # Interactive setup

# Edit .env with your settings:
# - API keys for messaging providers
# - WhatsApp Business API credentials
# - SMS provider settings
# - Email provider settings
```

### 3. Infrastructure Requirements
- **PostgreSQL 14+** (local installation or cloud service like Supabase/Neon)
- **Redis 6+** (local installation or cloud service like Upstash)

## Startup Options

### Option 1: One-Command Startup (Recommended)

```bash
npm run dev
```

This will:
1. Validate PostgreSQL and Redis are running
2. Start API server on :4000
3. Start frontend on :5173
4. Start admin panel on :5174
5. Start background workers
6. Run database migrations
7. Seed initial data (first run only)

### Option 2: Manual Development Setup

If you prefer to start services individually:

**Terminal 1 - API Server:**
```bash
npm run api:dev
```
API will start on http://localhost:3000

**Terminal 2 - Worker:**
```bash
npm run worker:dev
```
Workers will start processing jobs from all queues including:
- WhatsApp, SMS, Email queues
- Automation queue
- Bot Manager queue (NEW)
- Inbox queue
- Product queues

**Terminal 3 - Web Frontend:**
```bash
npm run web:dev
```
Web app will start on http://localhost:5173

**Terminal 4 - Admin Panel (Optional):**
```bash
npm run admin:dev
```
Admin panel will start on http://localhost:5174

## Verification

Once started, verify the system:

### 1. Health Check
```bash
curl http://localhost:3000/health
```
Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "redis": true,
  "wsClients": 0
}
```

### 2. API Endpoints

**Bot Manager (NEW):**
```bash
# Get bot statistics
curl http://localhost:3000/api/bots/stats

# List all bots
curl http://localhost:3000/api/bots

# Create a bot
curl -X POST http://localhost:3000/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Bot",
    "channel": "whatsapp",
    "bot_type": "auto_reply",
    "welcome_message": "Hello! How can I help you today?"
  }'
```

**Leads:**
```bash
curl http://localhost:3000/api/leads
```

**Analytics:**
```bash
curl http://localhost:3000/api/analytics?channel=whatsapp&from=2024-01-01&to=2024-12-31
```

**Inbox:**
```bash
curl http://localhost:3000/api/inbox/stats
```

### 3. WebSocket Test

Open browser console and connect:
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (e) => console.log('Received:', JSON.parse(e.data));
```

## Default Ports

| Service | Port | URL |
|---------|------|-----|
| API Server | 3000 | http://localhost:3000 |
| Web App | 5173 | http://localhost:5173 |
| Admin Panel | 5174 | http://localhost:5174 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| WebSocket | 3000 | ws://localhost:3000/ws |

## Database Migrations

Migrations run automatically on server startup. To run manually:

```bash
# Using the migration script (runs all module migrations)
npx tsx packages/db/src/migrate.ts

# Or specific module migrations
npx tsx modules/bot-manager/backend/bot-migrate.ts
```

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Redis Connection Failed
- Ensure Redis is running: `redis-server` (local) or cloud service
- Check .env for correct REDIS_URL

### Database Connection Failed
- Ensure PostgreSQL is running
- Check .env for correct DATABASE_URL
- Verify database exists

### Worker Not Starting
- Check that Redis is available
- Check logs: workers require database and Redis

## New Bot Manager Module

The Bot Manager was added during the system audit. To use it:

1. **Create a Bot:**
```bash
curl -X POST http://localhost:3000/api/bots \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "name": "FAQ Bot",
    "channel": "whatsapp",
    "bot_type": "faq",
    "welcome_message": "Hi! Ask me anything about our services.",
    "fallback_message": "I didn't understand. Type 'help' for assistance."
  }'
```

2. **Add Triggers:**
```bash
curl -X POST http://localhost:3000/api/bots/{botId}/triggers \
  -H "Content-Type: application/json" \
  -d '{
    "trigger_type": "keyword_match",
    "trigger_config": {
      "keywords": ["help", "support"],
      "keyword_match_mode": "any"
    }
  }'
```

3. **Add Rules:**
```bash
curl -X POST http://localhost:3000/api/bots/{botId}/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Help Response",
    "conditions": [
      {"field": "message", "operator": "contains", "value": "help"}
    ],
    "match_type": "any"
  }'
```

4. **Add Actions:**
```bash
curl -X POST http://localhost:3000/api/bots/rules/{ruleId}/actions \
  -H "Content-Type: application/json" \
  -d '{
    "action_type": "send_message",
    "action_config": {
      "message": "Here are our support options:..."
    },
    "action_order": 1
  }'
```

## Shutdown

```bash
# Stop all services (if using npm run dev)
Ctrl+C

# Or stop individual processes (Ctrl+C in each terminal if running manually)
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Web App    │  │ Admin Panel  │  │  (Future: Mobile) │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Server (Express)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ WhatsApp │ │   SMS    │ │  Email   │ │Telegram  │        │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤        │
│  │ Messenger│ │Instagram │ │  Leads   │ │Analytics │        │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤        │
│  │Campaigns │ │Automation│ │  Inbox   │ │Bot Manager│       │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤        │
│  │  Users   │ │  Billing │ │ Products │ │  Growth  │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌──────────┐   ┌──────────┐   ┌──────────┐
      │ PostgreSQL│   │  Redis   │   │ WebSocket│
      │  (Data)   │   │(Queue/Cache)│  │(Real-time)│
      └──────────┘   └──────────┘   └──────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  BullMQ Workers  │
                    │ ┌──────────────┐ │
                    │ │ Bot Manager  │ │
                    │ │ WhatsApp     │ │
                    │ │ SMS/Email    │ │
                    │ │ Automation   │ │
                    │ └──────────────┘ │
                    └──────────────────┘
```

---

**Need Help?** Check the full documentation in `/docs/`:
- `SYSTEM_AUDIT_REPORT.md` - Complete system status
- `MODULE_ARCHITECTURE.md` - Architecture guidelines
