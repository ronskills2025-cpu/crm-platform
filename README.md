# Multi-Channel Messaging CRM

Production-ready, multi-channel messaging CRM supporting **WhatsApp**, **SMS**, and **Email** with independent engines, multi-provider failover, real-time dashboards, and massive campaign capabilities.

## 🚀 One-Command Setup

### Prerequisites
- **Node.js 20+** - [Download here](https://nodejs.org/)
- **Git** - For cloning the repository

### Complete Setup & Start
```bash
# Clone the repository
git clone <repository-url>
cd crm

# Install and start everything
npm run start:all
```

**That's it!** The setup script will:
1. ✅ Install all dependencies
2. ✅ Guide you through database setup (Supabase/Neon/Local/SQLite)
3. ✅ Run database migrations
4. ✅ Seed initial data
5. ✅ Start all services (API, Frontend, Admin, Workers)
6. ✅ Open your browser to the application

### Alternative Commands
```bash
npm start              # Same as npm run start:all
npm run dev            # Development mode (requires manual DB setup)
```

### Database Options
The setup script will ask you to choose:
1. **Supabase** (recommended) - Free tier, no local setup needed
2. **Neon PostgreSQL** - Free tier, serverless PostgreSQL
3. **Local PostgreSQL** - Requires local installation
4. **SQLite** - Zero-config, development only

### Manual Services (if needed)
```bash
npm run api:dev         # API server only
npm run web:dev         # Frontend only
npm run admin:dev       # Admin panel only
npm run worker:dev      # Workers only
npm run db:migrate      # Run migrations only
npm run db:seed         # Seed data only
```

### Testing
```bash
# Backend
cd backend
npm test
npm run typecheck

# Frontend
cd ../frontend
npm test
npm run build
npm run test:e2e
```

## Architecture

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   WhatsApp   │   │     SMS      │   │    Email     │
│   Engine     │   │   Engine     │   │   Engine     │
│              │   │              │   │              │
│ API1→API2→   │   │ Fast2SMS→    │   │ Resend→      │
│ API3         │   │ MSG91→       │   │ SendGrid→    │
│              │   │ Textlocal    │   │ SMTP         │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                   │                   │
       └───────────┬───────┘───────────────────┘
                   │
           ┌───────┴───────┐
           │  BullMQ +     │
           │  Upstash Redis│
           └───────┬───────┘
                   │
           ┌───────┴───────┐
           │ Neon PostgreSQL│
           └───────────────┘
```

## API Endpoints

### Campaigns
- `POST /api/campaigns` — Create campaign
- `GET /api/campaigns` — List campaigns (filter by channel, status)
- `GET /api/campaigns/:id` — Get campaign details
- `PATCH /api/campaigns/:id/status` — Update status
- `POST /api/campaigns/:id/pause` — Pause campaign
- `POST /api/campaigns/:id/resume` — Resume campaign
- `GET /api/campaigns/stats` — Global stats
- `GET /api/campaigns/failed` — Failed messages

### WhatsApp
- `POST /api/whatsapp/send-batch` — Queue batch messages
- `GET /api/whatsapp/campaign/:id/stats` — Campaign stats
- `GET /api/whatsapp/stats/daily` — Daily analytics
- `GET /api/whatsapp/stats/providers` — Provider performance
- `POST /api/whatsapp/campaign/:id/retry` — Retry failed

### SMS
- `POST /api/sms/send-batch` — Queue batch messages
- `GET /api/sms/campaign/:id/stats` — Campaign stats
- `GET /api/sms/stats/daily` — Daily analytics
- `GET /api/sms/stats/providers` — Provider performance
- `POST /api/sms/campaign/:id/retry` — Retry failed

### Email
- `POST /api/email/send-batch` — Queue batch messages
- `GET /api/email/campaign/:id/stats` — Campaign stats
- `GET /api/email/stats/daily` — Daily analytics
- `GET /api/email/stats/providers` — Provider performance
- `POST /api/email/campaign/:id/retry` — Retry failed
- `GET /api/email/track/open/:id` — Open tracking pixel
- `GET /api/email/track/click/:id` — Click tracking redirect

### Real-time Events
- `WS /ws` — WebSocket stream for live notifications and campaign activity

## Deployment

### Render (Backend + Workers)
1. Create 4 web services: API, WhatsApp Worker, SMS Worker, Email Worker
2. Set environment variables from `.env.example`
3. API start command: `npm start`
4. Worker commands: `node dist/workers/whatsapp.worker.js`, etc.

### Vercel (Frontend)
1. Connect frontend directory
2. Build command: `npm run build`
3. Output directory: `dist`

## Free Tier Limits
| Service | Free Tier |
|---------|-----------|
| Neon PostgreSQL | 0.5 GB storage, 190 compute hours/month |
| Upstash Redis | 10K commands/day, 256 MB |
| Render | 750 hours/month (spins down after inactivity) |
| Vercel | 100 GB bandwidth, unlimited deployments |
| Resend | 100 emails/day |
| SendGrid | 100 emails/day |
