# CRM Module Architecture

## Strict Module Isolation Rules

This document defines the architecture rules for maintaining strict module isolation in the CRM system.

---

## 🔒 Core Principles

### 1. Each Module is Self-Contained
Every module must contain ALL its own:
- Backend (controllers, services, routes, workers)
- Frontend (pages, components, stores, hooks)
- Admin (admin pages, admin components)
- Types (interfaces, DTOs, schemas)
- Utils (module-specific utilities)

### 2. No Cross-Module Imports
```
❌ FORBIDDEN:
modules/whatsapp/backend/service.ts importing from modules/sms/...
modules/email/frontend/pages/... importing from modules/whatsapp/...

✅ ALLOWED:
modules/whatsapp/backend/service.ts importing from packages/utils/...
modules/whatsapp/frontend/pages/... importing from packages/ui/...
```

### 3. Communication Between Modules
Modules can ONLY communicate via:
- **API calls** (HTTP requests to other module endpoints)
- **Event bus** (Redis pub/sub for real-time events)
- **Shared packages** (packages/utils, packages/db, packages/ui)

---

## 📁 Module Structure

Each module MUST follow this structure:

```
modules/{module-name}/
├── backend/
│   ├── {module}.controller.ts    # HTTP request handlers
│   ├── {module}.service.ts       # Business logic
│   ├── {module}.routes.ts        # Express routes
│   ├── {module}.worker.ts        # Background job processor
│   ├── {module}-migrate.ts       # Database migrations
│   └── {module}-providers.ts     # External API integrations
├── frontend/
│   ├── pages/                    # React pages
│   ├── components/               # Module-specific components
│   ├── stores/                   # Zustand stores
│   ├── hooks/                    # Custom hooks
│   └── services/                 # API client
├── admin/
│   ├── pages/                    # Admin panel pages
│   ├── components/               # Admin components
│   └── services/                 # Admin API client
├── types/
│   └── index.ts                  # TypeScript interfaces
├── utils/
│   └── index.ts                  # Module utilities
└── index.ts                      # Module exports
```

---

## 📦 Shared Packages

Shared code lives ONLY in `/packages`:

```
packages/
├── config/       # Environment configuration
├── db/           # Database connection, queries, migrations
├── types/        # Shared TypeScript types
├── ui/           # React components, theme, stores
└── utils/        # Shared utilities (auth, rate-limit, queues)
```

### What Goes in Packages:
- Database connection utilities
- Authentication middleware
- Rate limiting
- Queue definitions
- Shared UI components
- Theme system
- Logging utilities

### What Does NOT Go in Packages:
- Business logic specific to a channel
- Module-specific API calls
- Module-specific state management

---

## 🚫 Forbidden Patterns

### 1. Cross-Module Service Calls
```typescript
// ❌ WRONG - Direct import from another module
import { SmsService } from '../../sms/backend/sms.service';

// ✅ CORRECT - Use API call
const response = await fetch('/api/sms/send', { ... });
```

### 2. Shared Business Logic in Modules
```typescript
// ❌ WRONG - Putting shared logic in a module
// modules/whatsapp/backend/shared-message-formatter.ts

// ✅ CORRECT - Put in packages
// packages/utils/src/message-formatter.ts
```

### 3. Cross-Module State Access
```typescript
// ❌ WRONG - Importing store from another module
import { useSmsStore } from '../../sms/frontend/stores/smsStore';

// ✅ CORRECT - Use shared app store or API
import { useAppStore } from '@packages/ui';
```

---

## ✅ Allowed Patterns

### 1. Importing from Packages
```typescript
// ✅ All modules can import from packages
import { query } from '../../../packages/db/src/connection';
import { authenticate } from '../../../packages/utils/src/auth.middleware';
import { useAppStore } from '../../../packages/ui/src/stores/appStore';
```

### 2. Using Shared Queues
```typescript
// ✅ Queues are defined in packages, used by modules
import { whatsappQueue } from '../../../packages/utils/src/queues';
```

### 3. Publishing Events
```typescript
// ✅ Modules publish events, other modules subscribe
import { publishEvent } from '../../../packages/db/src/redis';
await publishEvent('whatsapp:message:sent', { ... });
```

---

## 🔄 Module Communication Flow

```
┌─────────────┐     HTTP API      ┌─────────────┐
│  WhatsApp   │ ───────────────── │     SMS     │
│   Module    │                   │   Module    │
└─────────────┘                   └─────────────┘
       │                                 │
       │         Redis Events            │
       └────────────┬────────────────────┘
                    │
            ┌───────▼───────┐
            │   packages/   │
            │   (shared)    │
            └───────────────┘
```

---

## 🧪 Testing Module Isolation

Run this check to verify no cross-module imports:

```bash
# Check for forbidden imports
grep -r "from.*modules/" modules/whatsapp --include="*.ts" | grep -v "from.*modules/whatsapp"
grep -r "from.*modules/" modules/sms --include="*.ts" | grep -v "from.*modules/sms"
grep -r "from.*modules/" modules/email --include="*.ts" | grep -v "from.*modules/email"
```

If any results appear, those are violations that need to be fixed.

---

## 📋 Module Checklist

Before adding code to a module, verify:

- [ ] Does this logic belong to THIS module only?
- [ ] Am I importing from another module? (If yes, STOP)
- [ ] Should this be in packages/ instead?
- [ ] Am I using API calls for cross-module communication?
- [ ] Are my types defined in this module's types/ folder?

---

## 🎨 Theme System

The theme system is GLOBAL and lives in packages/ui:

```typescript
// packages/ui/src/stores/appStore.ts
theme: 'dark' | 'light'
setTheme: (theme) => void

// packages/ui/src/tokens.css
:root.dark { /* dark theme variables */ }
:root.light { /* light theme variables */ }
```

All components MUST use CSS variables for colors:
```css
/* ✅ CORRECT */
background-color: var(--bg-surface);
color: var(--text-primary);

/* ❌ WRONG */
background-color: #111827;
color: white;
```

---

## 📊 Data Flow

```
User Action
    │
    ▼
Frontend Page (modules/{x}/frontend/pages)
    │
    ▼
API Service (modules/{x}/frontend/services)
    │
    ▼
Backend Route (modules/{x}/backend/{x}.routes.ts)
    │
    ▼
Controller (modules/{x}/backend/{x}.controller.ts)
    │
    ▼
Service (modules/{x}/backend/{x}.service.ts)
    │
    ▼
Database (packages/db)
```

---

## 🚀 Adding a New Module

1. Create folder structure:
   ```bash
   mkdir -p modules/new-module/{backend,frontend,admin,types,utils}
   ```

2. Create index.ts with module metadata:
   ```typescript
   export const moduleInfo = {
     name: 'new-module',
     hasWorker: true,
     hasMigration: true,
   };
   ```

3. Register in modules/registry.ts

4. Add routes in apps/api/src/server.ts

5. Add frontend routes in apps/web/src/App.tsx

---

## 📝 Summary

| Rule | Description |
|------|-------------|
| **No cross-module imports** | Modules cannot import from other modules |
| **Shared code in packages/** | Common utilities go in packages/ |
| **API for communication** | Use HTTP/events for cross-module data |
| **CSS variables for theme** | Never hardcode colors |
| **Self-contained modules** | Each module has its own backend/frontend/admin |
