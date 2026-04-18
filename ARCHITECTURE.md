# CRM — Modular Architecture

## Overview

This CRM has been refactored from a monolithic structure into a **modular, team-friendly architecture**
where each feature is isolated, easy to understand, and independently maintainable.

## Directory Structure

```
crm/
├── apps/                          # Application entry points
│   ├── api/src/server.ts          # Express API (imports from modules)
│   ├── web/src/App.tsx            # Frontend React app
│   └── admin/src/App.tsx          # Admin panel React app
│
├── modules/                       # Feature modules (isolated)
│   ├── whatsapp/                  # WhatsApp messaging
│   ├── sms/                       # SMS + enterprise features
│   ├── email/                     # Email messaging
│   ├── telegram/                  # Telegram bots
│   ├── messenger/                 # Facebook Messenger
│   ├── instagram/                 # Instagram automation
│   ├── leads/                     # Lead management
│   ├── analytics/                 # Reporting & analytics
│   ├── campaigns/                 # Campaign builder & templates
│   ├── automation/                # Automation rules engine
│   ├── users/                     # Auth, admin, tenants
│   ├── billing/                   # Stripe billing
│   ├── inbox/                     # Unified multi-channel inbox
│   ├── products/                  # Product suite (funnels, bots, etc.)
│   ├── growth/                    # Growth platform
│   ├── wa-saas/                   # WhatsApp SaaS modules
│   ├── wa-chat/                   # WhatsApp live chat
│   ├── qr-payment/               # QR payment system
│   ├── ecommerce/                 # Shopify & e-commerce
│   └── registry.ts               # Module manifest
│
├── packages/                      # Shared code (used by all modules)
│   ├── db/                        # PostgreSQL pool + Redis connections
│   ├── config/                    # Environment configuration
│   ├── utils/                     # Logger, failover, auth middleware
│   └── types/                     # Shared TypeScript types
│
├── docker-compose.yml             # Production deployment
├── start-dev.ps1                  # Development startup script
└── tsconfig.server.json           # Backend TypeScript config
```

## Module Structure

Every module follows the same standard layout:

```
modules/<name>/
├── index.ts                       # Module exports (routes, metadata)
├── backend/
│   ├── <name>.controller.ts       # HTTP request handlers
│   ├── <name>.service.ts          # Business logic
│   ├── <name>.routes.ts           # Express route definitions
│   ├── <name>.model.ts            # Zod schemas + TypeScript interfaces
│   ├── <name>.worker.ts           # BullMQ background worker (optional)
│   └── <name>-migrate.ts          # Database migration (optional)
├── frontend/
│   ├── pages/                     # React page components
│   ├── components/                # Reusable UI components
│   └── <name>.api.ts              # API client functions
├── admin/
│   └── pages/                     # Admin panel pages
├── types/                         # Module-specific types
└── utils/                         # Module-specific helpers
```

## Import Conventions

```typescript
// Shared packages — use relative paths from packages/
import { config } from '../../../packages/config/src/config';
import { query } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

// Same module — use local ./ references
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppBatchSchema } from './WhatsAppMessage';

// Cross-module — explicit path to other module
import { LeadsService } from '../../../modules/leads/backend/leads.service';
```

## Adding a New Module

1. Create the directory: `modules/<name>/`
2. Add `index.ts` with route exports
3. Add backend files following the standard structure
4. Register routes in `apps/api/src/server.ts`
5. Add the module to `modules/registry.ts`
6. Add frontend pages and import them in `apps/web/src/App.tsx`

## Running

### Development

```bash
# Start everything with the dev script
.\start-dev.ps1

# Or manually:
npx tsx apps/api/src/server.ts     # API server
cd apps/web && npm run dev         # Frontend
cd apps/admin && npm run dev       # Admin panel
```

### Production

```bash
docker-compose up -d
```

## API Compatibility

- All existing API paths (`/api/whatsapp`, `/api/sms`, etc.) are unchanged
- The modular architecture is the sole entry point

## Module Registry

See `modules/registry.ts` for the complete list of modules with metadata:
- Module name and API prefix
- Whether the module has a background worker
- Whether the module has database migrations

## Channels

| Channel    | Module       | Worker | Migration |
|------------|-------------|--------|-----------|
| WhatsApp   | `whatsapp`  | ✓      |           |
| SMS        | `sms`       | ✓      | ✓         |
| Email      | `email`     | ✓      |           |
| Telegram   | `telegram`  | ✓      | ✓         |
| Messenger  | `messenger` | ✓      | ✓         |
| Instagram  | `instagram` | ✓      | ✓         |
