import { query } from '../../../packages/db/src/connection';

export type ModuleKey =
  | 'leads'
  | 'analytics'
  | 'whatsapp'
  | 'sms'
  | 'email'
  | 'telegram'
  | 'messenger'
  | 'instagram'
  | 'agency'
  | 'ecommerce'
  | 'products'
  | 'growth'
  | 'qrPayments'
  | 'waSaas';

export interface ModuleStats {
  records: number;
  healthy: boolean;
  updatedAt: string;
}

function toSafeNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function tableExists(tableName: string): Promise<boolean> {
  const res = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) as exists`,
    [tableName]
  );
  return Boolean(res.rows[0]?.exists);
}

async function tenantColumnExists(tableName: string): Promise<boolean> {
  const res = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'tenant_id'
     ) as exists`,
    [tableName]
  );
  return Boolean(res.rows[0]?.exists);
}

async function countTableRows(tableName: string, tenantId?: string): Promise<number> {
  if (!(await tableExists(tableName))) return 0;

  let sql = `SELECT COUNT(*)::int as count FROM ${tableName}`;
  const params: unknown[] = [];

  if (tenantId && (await tenantColumnExists(tableName))) {
    params.push(tenantId);
    sql += ` WHERE tenant_id = $1`;
  }

  const res = await query<{ count: number }>(sql, params);
  return toSafeNumber(res.rows[0]?.count);
}

async function safeCount(tableName: string, tenantId?: string): Promise<number> {
  try {
    return await countTableRows(tableName, tenantId);
  } catch {
    return 0;
  }
}

export class DashboardConnectivityService {
  static async getUnifiedDashboard(tenantId?: string): Promise<Record<ModuleKey, ModuleStats>> {
    const now = new Date().toISOString();

    const [
      leads,
      campaigns,
      waMessages,
      smsMessages,
      emailMessages,
      telegramMessages,
      messengerMessages,
      instagramLeads,
      users,
      cartSessions,
      catalogOrders,
      productConfigs,
      productEvents,
      growthSubmissions,
      missedCalls,
      qrPayments,
      waOrders,
      waDripCampaigns,
    ] = await Promise.all([
      safeCount('leads', tenantId),
      safeCount('campaigns', tenantId),
      safeCount('whatsapp_messages', tenantId),
      safeCount('sms_messages', tenantId),
      safeCount('email_messages', tenantId),
      safeCount('telegram_messages', tenantId),
      safeCount('messenger_messages', tenantId),
      safeCount('instagram_leads', tenantId),
      safeCount('users', tenantId),
      safeCount('cart_sessions', tenantId),
      safeCount('catalog_orders', tenantId),
      safeCount('product_configs', tenantId),
      safeCount('product_events', tenantId),
      safeCount('lead_capture_submissions', tenantId),
      safeCount('missed_calls', tenantId),
      safeCount('qr_payments', tenantId),
      safeCount('wa_orders', tenantId),
      safeCount('wa_drip_campaigns', tenantId),
    ]);

    return {
      leads: { records: leads, healthy: leads >= 0, updatedAt: now },
      analytics: { records: campaigns + waMessages + smsMessages + emailMessages + telegramMessages + messengerMessages, healthy: true, updatedAt: now },
      whatsapp: { records: waMessages, healthy: true, updatedAt: now },
      sms: { records: smsMessages, healthy: true, updatedAt: now },
      email: { records: emailMessages, healthy: true, updatedAt: now },
      telegram: { records: telegramMessages, healthy: true, updatedAt: now },
      messenger: { records: messengerMessages, healthy: true, updatedAt: now },
      instagram: { records: instagramLeads, healthy: true, updatedAt: now },
      agency: { records: users, healthy: true, updatedAt: now },
      ecommerce: { records: cartSessions + catalogOrders, healthy: true, updatedAt: now },
      products: { records: productConfigs + productEvents, healthy: true, updatedAt: now },
      growth: { records: growthSubmissions + missedCalls, healthy: true, updatedAt: now },
      qrPayments: { records: qrPayments, healthy: true, updatedAt: now },
      waSaas: { records: waOrders + waDripCampaigns, healthy: true, updatedAt: now },
    };
  }
}
