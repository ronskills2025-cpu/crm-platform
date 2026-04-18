import { query } from '../../../packages/db/src/connection';

export class RegionRoutingService {
  static async listRoutes(tenantId: string) {
    const result = await query(
      `SELECT * FROM sms_region_routes WHERE tenant_id = $1 ORDER BY region ASC`,
      [tenantId]
    );
    return result.rows;
  }

  static async upsertRoute(tenantId: string, data: {
    region: string;
    provider_chain: string[];
    requires_dlt?: boolean;
    default_sender_id?: string;
  }) {
    const result = await query(
      `INSERT INTO sms_region_routes (tenant_id, region, provider_chain, requires_dlt, default_sender_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, region)
       DO UPDATE SET provider_chain = $3, requires_dlt = $4, default_sender_id = $5, updated_at = NOW()
       RETURNING *`,
      [tenantId, data.region, JSON.stringify(data.provider_chain), data.requires_dlt ?? false, data.default_sender_id || null]
    );
    return result.rows[0];
  }

  static async deleteRoute(tenantId: string, id: string) {
    const result = await query(`DELETE FROM sms_region_routes WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Resolve provider chain + DLT requirement for a given region.
   * Falls back to default chain if no region-specific route found.
   */
  static async resolveForRegion(tenantId: string, region?: string): Promise<{ providerChain: string[]; requiresDlt: boolean; senderId: string | null } | null> {
    if (region) {
      const result = await query(
        `SELECT provider_chain, requires_dlt, default_sender_id FROM sms_region_routes
         WHERE tenant_id = $1 AND region = $2 AND is_active = true LIMIT 1`,
        [tenantId, region]
      );
      if (result.rows[0]) {
        const r = result.rows[0];
        return {
          providerChain: typeof r.provider_chain === 'string' ? JSON.parse(r.provider_chain) : r.provider_chain,
          requiresDlt: r.requires_dlt,
          senderId: r.default_sender_id,
        };
      }
    }
    // fallback: no region-specific route
    return null;
  }
}
