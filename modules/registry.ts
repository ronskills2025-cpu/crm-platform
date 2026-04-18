/**
 * Module Registry — Central manifest of all CRM modules
 *
 * Add or remove modules here. Each module is self-contained with:
 *   /backend   — controller, service, routes, worker, model, migration
 *   /frontend  — pages, components, API client
 *   /admin     — admin panel pages
 *   /types     — module-specific types
 *   /utils     — module-specific helpers
 *
 * Usage in apps/api/server.ts:
 *   import { modules } from '../../modules/registry';
 *   modules.forEach(m => app.use(m.apiPrefix, m.routes));
 */

export interface ModuleDefinition {
  name: string;
  apiPrefix: string;
  description: string;
  hasWorker: boolean;
  hasMigration: boolean;
}

export const moduleRegistry: ModuleDefinition[] = [
  // ── Messaging Channels ──
  { name: 'whatsapp',   apiPrefix: '/api/whatsapp',   description: 'WhatsApp messaging channel',              hasWorker: true,  hasMigration: false },
  { name: 'sms',        apiPrefix: '/api/sms',        description: 'SMS messaging + enterprise features',     hasWorker: true,  hasMigration: true },
  { name: 'email',      apiPrefix: '/api/email',      description: 'Email messaging channel',                 hasWorker: true,  hasMigration: false },
  { name: 'telegram',   apiPrefix: '/api/telegram',   description: 'Telegram bot messaging',                  hasWorker: true,  hasMigration: true },
  { name: 'messenger',  apiPrefix: '/api/messenger',  description: 'Facebook Messenger channel',              hasWorker: true,  hasMigration: true },
  { name: 'instagram',  apiPrefix: '/api/instagram',  description: 'Instagram automation suite',              hasWorker: true,  hasMigration: true },

  // ── Core ──
  { name: 'leads',       apiPrefix: '/api/leads',      description: 'Lead management',                        hasWorker: false, hasMigration: true },
  { name: 'analytics',   apiPrefix: '/api/analytics',  description: 'Analytics & reporting',                   hasWorker: false, hasMigration: false },
  { name: 'campaigns',   apiPrefix: '/api/campaigns',  description: 'Campaign management & templates',        hasWorker: false, hasMigration: false },
  { name: 'automation',  apiPrefix: '/api/automation', description: 'Automation rules engine',                 hasWorker: true,  hasMigration: false },
  { name: 'inbox',       apiPrefix: '/api/inbox',      description: 'Unified multi-channel inbox',            hasWorker: true,  hasMigration: false },
  { name: 'bot-manager', apiPrefix: '/api/bots',       description: 'Centralized bot management system',      hasWorker: true,  hasMigration: true },

  // ── Users & Billing ──
  { name: 'users',      apiPrefix: '/api/auth',       description: 'Auth, users, admin, tenants',            hasWorker: false, hasMigration: true },
  { name: 'billing',    apiPrefix: '/api/billing',    description: 'Stripe billing & subscriptions',         hasWorker: false, hasMigration: false },

  // ── Products Suite ──
  { name: 'products',   apiPrefix: '/api/products',   description: 'Funnel, appointments, bots, etc.',       hasWorker: true,  hasMigration: true },

  // ── Growth & SaaS ──
  { name: 'growth',     apiPrefix: '/api/growth',     description: 'Growth platform suite',                  hasWorker: true,  hasMigration: true },
  { name: 'wa-saas',    apiPrefix: '/api/wa-saas',    description: 'WhatsApp SaaS modules',                  hasWorker: true,  hasMigration: true },
  { name: 'wa-chat',    apiPrefix: '/api/wa-chat',    description: 'WhatsApp live chat',                     hasWorker: true,  hasMigration: true },

  // ── Payments & E-commerce ──
  { name: 'qr-payment', apiPrefix: '/api/qr-payment', description: 'QR payment system',                     hasWorker: false, hasMigration: true },
  { name: 'ecommerce',  apiPrefix: '/api/shopify',    description: 'Shopify & e-commerce integrations',     hasWorker: false, hasMigration: false },
];
