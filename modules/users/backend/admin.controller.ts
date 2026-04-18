import { Request, Response } from 'express';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  reorderProviders,
  validateAndSaveStatus,
  testWhatsAppMessage,
  testSmsProvider,
  testEmailProvider,
  registerWhatsAppWebhook,
} from './admin.service';
import {
  getProviderById,
  setProviderStatus,
  getProviderHealthOverview,
  getDynamicProviders,
} from '../../../packages/utils/src/providerConfig.service';
import {
  CreateProviderConfigSchema,
  UpdateProviderConfigSchema,
  TestProviderSchema,
} from '../../../packages/types/src/ProviderConfig';
import { query } from '../../../packages/db/src/connection';
import { WhatsAppService } from '../../../modules/whatsapp/backend/whatsapp.service';
import { SMSService } from '../../../modules/sms/backend/sms.service';
import { EmailService } from '../../../modules/email/backend/email.service';
import { DashboardConnectivityService } from '../../../modules/wa-saas/backend/dashboard-connectivity.service';
import { publishEvent } from '../../../packages/db/src/redis';

const log = createLogger('ctrl:admin');

export class AdminController {
  // ── List providers ────────────────────────────────────────────

  static async listProviders(req: Request, res: Response) {
    try {
      const { channel } = req.query;
      const providers = await listProviders(channel as string | undefined);
      const safeProviders = providers.map((provider) => ({
        ...provider,
        credentials: maskCredentials(provider.credentials),
      }));
      res.json({ success: true, providers: safeProviders });
    } catch (err) {
      log.error('listProviders', err);
      res.status(500).json({ error: 'Failed to list providers' });
    }
  }

  static async providerHealth(req: Request, res: Response) {
    try {
      const { channel } = req.query;
      const providers = await getProviderHealthOverview(channel as string | undefined);
      const safeProviders = providers.map((provider) => ({
        ...provider,
        credentials: maskCredentials(provider.credentials),
      }));
      res.json({ success: true, providers: safeProviders });
    } catch (err) {
      log.error('providerHealth', err);
      res.status(500).json({ error: 'Failed to load provider health' });
    }
  }

  // ── Get single provider ───────────────────────────────────────

  static async getProvider(req: Request, res: Response) {
    try {
      const provider = await getProviderById(req.params.id);
      if (!provider) { res.status(404).json({ error: 'Provider not found' }); return; }
      // Mask sensitive credential fields
      const masked = {
        ...provider,
        credentials: maskCredentials(provider.credentials),
      };
      res.json({ success: true, provider: masked });
    } catch (err) {
      log.error('getProvider', err);
      res.status(500).json({ error: 'Failed to get provider' });
    }
  }

  // ── Create provider ───────────────────────────────────────────

  static async createProvider(req: Request, res: Response) {
    try {
      const data = CreateProviderConfigSchema.parse(req.body);
      const provider = await createProvider(data as Parameters<typeof createProvider>[0]);
      res.status(201).json({ success: true, provider });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('createProvider', err);
      res.status(500).json({ error: (err as Error).message ?? 'Failed to create provider' });
    }
  }

  // ── Update provider ───────────────────────────────────────────

  static async updateProvider(req: Request, res: Response) {
    try {
      const data = UpdateProviderConfigSchema.parse(req.body);
      const provider = await updateProvider(req.params.id, data as Parameters<typeof updateProvider>[1]);
      res.json({ success: true, provider });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('updateProvider', err);
      res.status(500).json({ error: (err as Error).message ?? 'Failed to update provider' });
    }
  }

  // ── Delete provider ───────────────────────────────────────────

  static async deleteProvider(req: Request, res: Response) {
    try {
      await deleteProvider(req.params.id);
      res.json({ success: true });
    } catch (err) {
      log.error('deleteProvider', err);
      res.status(500).json({ error: (err as Error).message ?? 'Failed to delete provider' });
    }
  }

  // ── Reorder priorities ────────────────────────────────────────

  static async reorderProviders(req: Request, res: Response) {
    try {
      const { channel, order } = z.object({
        channel: z.enum(['whatsapp', 'sms', 'email']),
        order: z.array(z.object({ id: z.string().uuid(), priority: z.number().int() })).min(1),
      }).parse(req.body);
      await reorderProviders(channel, order);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('reorderProviders', err);
      res.status(500).json({ error: 'Failed to reorder providers' });
    }
  }

  // ── Validate credentials ──────────────────────────────────────

  static async validateProvider(req: Request, res: Response) {
    try {
      const result = await validateAndSaveStatus(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('validateProvider', err);
      res.status(500).json({ error: (err as Error).message ?? 'Validation failed' });
    }
  }

  // ── Pause / unpause provider ──────────────────────────────────

  static async pauseProvider(req: Request, res: Response) {
    try {
      await setProviderStatus(req.params.id, 'paused', 'Paused by admin');
      res.json({ success: true });
    } catch (err) {
      log.error('pauseProvider', err);
      res.status(500).json({ error: 'Failed to pause provider' });
    }
  }

  static async resumeProvider(req: Request, res: Response) {
    try {
      const result = await validateAndSaveStatus(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('resumeProvider', err);
      res.status(500).json({ error: 'Failed to resume provider' });
    }
  }

  // ── Test send ─────────────────────────────────────────────────

  static async testProvider(req: Request, res: Response) {
    try {
      const { to, message, subject } = TestProviderSchema.parse(req.body);
      const provider = await getProviderById(req.params.id);
      if (!provider) { res.status(404).json({ error: 'Provider not found' }); return; }

      let result: { success: boolean; error?: string; messageId?: string };

      if (provider.channel === 'whatsapp') {
        const creds = provider.credentials as Record<string, string>;
        result = await testWhatsAppMessage(creds.phoneNumberId, creds.accessToken, to, creds.apiVersion);
      } else if (provider.channel === 'sms') {
        result = await testSmsProvider(provider.credentials, to);
      } else {
        result = await testEmailProvider(provider.credentials, to);
      }

      if (result.success) {
        await setProviderStatus(provider.id, 'connected', 'Test send succeeded');
        log.info(`Test send succeeded for ${provider.name} (${provider.channel}) → ${to}`);
      } else {
        await setProviderStatus(provider.id, 'failed', result.error ?? 'Test failed');
        log.warn(`Test send failed for ${provider.name}: ${result.error}`);
      }

      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('testProvider', err);
      res.status(500).json({ error: (err as Error).message ?? 'Test failed' });
    }
  }

  // ── WhatsApp: register webhook ────────────────────────────────

  static async registerWebhook(req: Request, res: Response) {
    try {
      const { webhookUrl, verifyToken } = z.object({
        webhookUrl: z.string().url(),
        verifyToken: z.string().min(8),
      }).parse(req.body);

      const provider = await getProviderById(req.params.id);
      if (!provider || provider.channel !== 'whatsapp') {
        res.status(404).json({ error: 'WhatsApp provider not found' }); return;
      }

      const creds = provider.credentials as Record<string, string>;
      const result = await registerWhatsAppWebhook(
        creds.phoneNumberId, creds.accessToken, webhookUrl, verifyToken, creds.apiVersion
      );

      if (result.success) {
        // Persist webhook info
        await query(
          `INSERT INTO whatsapp_webhooks (provider_config_id, phone_number_id, webhook_url, verify_token, is_registered, registered_at)
           VALUES ($1, $2, $3, $4, true, NOW())
           ON CONFLICT (phone_number_id) DO UPDATE SET webhook_url=$3, verify_token=$4, is_registered=true, registered_at=NOW()`,
          [provider.id, creds.phoneNumberId, webhookUrl, verifyToken]
        );
        // Update credentials with the new webhook info
        const updatedCreds = { ...provider.credentials, webhookUrl, verifyToken };
        await query(
          `UPDATE provider_configs SET credentials = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedCreds), provider.id]
        );
        log.info(`Webhook registered for ${provider.name}`);
      }

      res.json({ success: result.success, error: result.error });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
      log.error('registerWebhook', err);
      res.status(500).json({ error: (err as Error).message ?? 'Webhook registration failed' });
    }
  }

  // ── WhatsApp webhook verification (Hub challenge) ─────────────

  static async verifyWebhookChallenge(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token) {
      // Look up which provider this verify_token belongs to
      const result = await query<{ verify_token: string }>(
        `SELECT verify_token FROM whatsapp_webhooks WHERE verify_token = $1
         UNION
         SELECT credentials ->> 'verifyToken' AS verify_token
         FROM provider_configs
         WHERE channel = 'whatsapp' AND credentials ->> 'verifyToken' = $1
         LIMIT 1`,
        [token]
      );
      if (result.rows.length > 0) {
        res.status(200).send(challenge);
        return;
      }
    }
    res.status(403).json({ error: 'Verification failed' });
  }

  // ── Campaign errors & retry ───────────────────────────────────

  static async getCampaignErrors(req: Request, res: Response) {
    try {
      const { campaign_id, resolved, limit, offset } = req.query;
      const params: unknown[] = [];
      const conditions: string[] = [];
      if (campaign_id) { params.push(campaign_id); conditions.push(`campaign_id = $${params.length}`); }
      if (resolved !== undefined) { params.push(resolved === 'true'); conditions.push(`resolved = $${params.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(parseInt(limit as string) || 50);
      params.push(parseInt(offset as string) || 0);
      const result = await query(
        `SELECT * FROM campaign_errors ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      res.json({ success: true, errors: result.rows });
    } catch (err) {
      log.error('getCampaignErrors', err);
      res.status(500).json({ error: 'Failed to fetch campaign errors' });
    }
  }

  static async retryFailedMessages(req: Request, res: Response) {
    try {
      const { campaignId } = req.params;
      const channelRes = await query<{ channel: 'whatsapp' | 'sms' | 'email' }>(
        `SELECT channel FROM campaigns WHERE id = $1`,
        [campaignId]
      );
      if (!channelRes.rows.length) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
      }

      const { channel } = channelRes.rows[0];
      const providers = await getDynamicProviders(channel);
      if (providers.length === 0) {
        res.status(400).json({ error: `No active ${channel} providers available for retry` });
        return;
      }

      const validationResults = await Promise.all(
        providers.map(async (provider) => ({ id: provider.id, name: provider.name, ...(await validateAndSaveStatus(provider.id)) }))
      );
      const validProviders = validationResults.filter((result) => result.valid);
      if (validProviders.length === 0) {
        res.status(400).json({ error: `All ${channel} providers failed validation. Reconfigure and retry.` });
        return;
      }

      let requeued = 0;
      if (channel === 'whatsapp') {
        requeued = await WhatsAppService.retryFailed(campaignId);
      } else if (channel === 'sms') {
        requeued = await SMSService.retryFailed(campaignId);
      } else {
        requeued = await EmailService.retryFailed(campaignId);
      }

      await query(
        `UPDATE campaign_errors SET retried_at = NOW(), resolved = true WHERE campaign_id = $1 AND resolved = false`,
        [campaignId]
      );
      await query(
        `UPDATE campaigns SET status = 'running', updated_at = NOW() WHERE id = $1 AND status IN ('paused', 'failed')`,
        [campaignId]
      );

      publishEvent('campaign:resumed', {
        campaign_id: campaignId,
        channel,
        requeued,
        valid_providers: validProviders.length,
      });

      res.json({ success: true, requeued, validProviders: validProviders.length });
    } catch (err) {
      log.error('retryFailedMessages', err);
      res.status(500).json({ error: 'Retry failed' });
    }
  }

  // ── System overview ────────────────────────────────────────────
  static async systemOverview(_req: Request, res: Response) {
    try {
      const [usersRes, providersRes, campaignsRes, leadsRes] = await Promise.all([
        query('SELECT COUNT(*) as count FROM users WHERE is_active = true'),
        query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'connected\') as healthy FROM provider_configs WHERE is_active = true'),
        query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'running\') as active FROM campaigns'),
        query('SELECT COUNT(*) as count FROM leads'),
      ]);

      res.json({
        success: true,
        overview: {
          users: { total: parseInt(usersRes.rows[0]?.count ?? '0') },
          providers: {
            total: parseInt(providersRes.rows[0]?.total ?? '0'),
            healthy: parseInt(providersRes.rows[0]?.healthy ?? '0'),
          },
          campaigns: {
            total: parseInt(campaignsRes.rows[0]?.total ?? '0'),
            active: parseInt(campaignsRes.rows[0]?.active ?? '0'),
          },
          leads: { total: parseInt(leadsRes.rows[0]?.count ?? '0') },
        },
      });
    } catch (err) {
      log.error('systemOverview', err);
      res.status(500).json({ error: 'Failed to fetch system overview' });
    }
  }

  static async unifiedDashboard(req: AuthRequest, res: Response) {
    try {
      const modules = await DashboardConnectivityService.getUnifiedDashboard(req.tenantId);
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        modules,
      });
    } catch (err) {
      log.error('unifiedDashboard', err);
      res.status(500).json({ error: 'Failed to fetch unified dashboard data' });
    }
  }

  // ── User management ───────────────────────────────────────────
  static async listAllUsers(req: AuthRequest, res: Response) {
    try {
      const result = await query(
        'SELECT id, email, full_name, role, is_active, last_login_at, created_at FROM users ORDER BY created_at DESC'
      );
      res.json({ success: true, users: result.rows });
    } catch (err) {
      log.error('listAllUsers', err);
      res.status(500).json({ error: 'Failed to list users' });
    }
  }

  static async updateUserRole(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { role, is_active } = req.body;
      if (role && !['admin', 'member', 'superadmin'].includes(role)) {
        res.status(400).json({ error: 'Invalid role. Must be superadmin, admin, or member' });
        return;
      }
      // Prevent self-demotion
      if (id === req.userId && role && role !== req.userRole) {
        res.status(400).json({ error: 'Cannot change your own role' });
        return;
      }
      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      if (role !== undefined) { updates.push(`role = $${idx++}`); values.push(role); }
      if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }
      updates.push(`updated_at = NOW()`);
      values.push(id);
      const result = await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, full_name, role, is_active`,
        values
      );
      if (!result.rows[0]) { res.status(404).json({ error: 'User not found' }); return; }
      res.json({ success: true, user: result.rows[0] });
    } catch (err) {
      log.error('updateUserRole', err);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  static async deleteUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (id === req.userId) {
        res.status(400).json({ error: 'Cannot delete your own account' });
        return;
      }
      await query('DELETE FROM users WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      log.error('deleteUser', err);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  static async inviteUser(req: AuthRequest, res: Response) {
    try {
      const { email, fullName, role } = req.body;
      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }
      const validRoles = ['member', 'admin', 'superadmin'];
      const userRole = validRoles.includes(role) ? role : 'member';
      // Check if user already exists
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'User with this email already exists' });
        return;
      }
      // Create user with a random temporary password (they'll reset it)
      const bcrypt = await import('bcryptjs');
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
      const hash = await bcrypt.hash(tempPassword, 12);
      const tenantId = req.tenantId;
      const result = await query(
        `INSERT INTO users (email, password_hash, full_name, role, tenant_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true) RETURNING id, email, full_name, role, is_active, created_at`,
        [email, hash, fullName || null, userRole, tenantId]
      );
      res.json({ success: true, user: result.rows[0], tempPassword });
    } catch (err) {
      log.error('inviteUser', err);
      res.status(500).json({ error: 'Failed to invite user' });
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function maskCredentials(creds: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['accessToken', 'apiKey', 'authKey', 'pass', 'password', 'secret', 'verifyToken', 'token'];
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(creds)) {
    masked[k] = sensitiveKeys.includes(k) && typeof v === 'string' && v.length > 4
      ? v.slice(0, 4) + '***' + v.slice(-4)
      : v;
  }
  return masked;
}
