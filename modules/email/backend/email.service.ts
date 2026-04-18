import { config } from '../../../packages/config/src/config';
import { query, bulkInsert } from '../../../packages/db/src/connection';
import { incrCounter, publishEvent, todayKey, getRateLimit } from '../../../packages/db/src/redis';
import { emailQueue } from '../../../packages/utils/src/queues';
import { getDynamicProviders, getRateLimitForProvider } from '../../../packages/utils/src/providerConfig.service';
import { v4 as uuid } from 'uuid';
import nodemailer from 'nodemailer';

type EmailProviderCreds = Record<string, string | number | boolean | undefined>;

async function resolveEmailProvider(
  providerName: string
): Promise<{ creds: EmailProviderCreds; costPerMsg: number; ratePerSec: number } | null> {
  const dbProviders = await getDynamicProviders('email');
  const dbMatch = dbProviders.find((provider) => provider.name === providerName);
  if (dbMatch) {
    return {
      creds: dbMatch.credentials as EmailProviderCreds,
      costPerMsg: Number(dbMatch.cost_per_msg),
      ratePerSec: Number(dbMatch.rate_per_sec || config.email.ratePerSec),
    };
  }

  const staticMatch = config.email.providers.find((provider) => provider.name === providerName);
  if (staticMatch) {
    return {
      creds: staticMatch as unknown as EmailProviderCreds,
      costPerMsg: staticMatch.costPerMsg,
      ratePerSec: config.email.ratePerSec,
    };
  }

  return null;
}

async function getActiveEmailProviderNames(): Promise<string[]> {
  const dbProviders = await getDynamicProviders('email');
  if (dbProviders.length > 0) return dbProviders.map((provider) => provider.name);
  return config.email.providers.map((provider) => provider.name);
}

export class EmailService {
  static async getSortedProviders(chain?: string[]): Promise<string[]> {
    return chain?.length ? chain : getActiveEmailProviderNames();
  }

  static async sendViaProvider(
    providerName: string,
    to: string,
    subject: string,
    htmlBody?: string,
    textBody?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; cost?: number }> {
    const resolved = await resolveEmailProvider(providerName);
    if (!resolved) {
      return { success: false, error: `Provider ${providerName} not found` };
    }

    const { creds, costPerMsg, ratePerSec } = resolved;
    const allowed = await getRateLimit(
      `email:rate:${providerName}:${Math.floor(Date.now() / 1000)}`,
      await getRateLimitForProvider('email', providerName, ratePerSec),
      2
    );
    if (!allowed) return { success: false, error: 'Rate limit exceeded' };

    const fromEmail = (creds.fromEmail as string) || config.email.from;
    const providerType = (creds.provider as string) || providerName;

    try {
      switch (providerType) {
        case 'resend': {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${creds.apiKey}`,
            },
            body: JSON.stringify({ from: fromEmail, to: [to], subject, html: htmlBody, text: textBody }),
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) {
            return { success: false, error: `Resend ${response.status}: ${await response.text()}` };
          }
          const data = (await response.json()) as { id: string };
          return { success: true, messageId: data.id, cost: costPerMsg };
        }

        case 'sendgrid': {
          const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${creds.apiKey}`,
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: to }] }],
              from: { email: fromEmail },
              subject,
              content: [
                ...(textBody ? [{ type: 'text/plain', value: textBody }] : []),
                ...(htmlBody ? [{ type: 'text/html', value: htmlBody }] : []),
              ],
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) {
            return { success: false, error: `SendGrid ${response.status}: ${await response.text()}` };
          }
          return {
            success: true,
            messageId: response.headers.get('x-message-id') || uuid(),
            cost: costPerMsg,
          };
        }

        case 'smtp': {
          const transporter = nodemailer.createTransport({
            host: creds.host as string,
            port: Number(creds.port ?? 587),
            secure: Boolean(creds.secure ?? Number(creds.port) === 465),
            auth: { user: creds.user as string, pass: creds.pass as string },
          });
          const info = await transporter.sendMail({
            from: fromEmail,
            to,
            subject,
            html: htmlBody,
            text: textBody,
          });
          return { success: true, messageId: info.messageId, cost: costPerMsg };
        }

        default:
          return { success: false, error: `Unknown provider: ${providerName}` };
      }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Send failed' };
    }
  }

  static async queueBatch(
    campaignId: string,
    contacts: Array<{ email: string; name?: string; params?: Record<string, string> }>,
    subject: string,
    htmlBody?: string,
    textBody?: string,
    providerChain?: string[],
    priority = 0
  ): Promise<{ queued: number }> {
    const chain = await EmailService.getSortedProviders(providerChain);
    const batchSize = config.email.batchSize;
    let queued = 0;

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const rows = batch.map((contact) => [
        uuid(), campaignId, contact.email, config.email.from,
        subject, htmlBody || null, textBody || null, 'queued', 0,
      ]);

      await bulkInsert(
        'email_messages',
        ['id', 'campaign_id', 'to_email', 'from_email', 'subject', 'html_body', 'text_body', 'status', 'attempts'],
        rows
      );

      await emailQueue.add(
        'send-batch',
        {
          campaign_id: campaignId,
          messages: batch.map((contact, index) => ({
            id: rows[index][0],
            to_email: contact.email,
            subject,
            html_body: htmlBody,
            text_body: textBody,
            provider_chain: chain,
          })),
        },
        { priority }
      );
      queued += batch.length;
    }

    await query(
      `UPDATE campaigns SET total_contacts = total_contacts + $1, status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $2`,
      [queued, campaignId]
    );
    await incrCounter(`stats:email:queued:${todayKey()}`, 86400);
    publishEvent('email:batch_queued', { campaign_id: campaignId, count: queued });
    return { queued };
  }

  static async getCampaignStats(campaignId: string) {
    const result = await query<{ status: string; count: number }>(
      `SELECT status, COUNT(*)::int as count FROM email_messages WHERE campaign_id = $1 GROUP BY status`,
      [campaignId]
    );
    return result.rows.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);
  }

  static async getDailyStats(days = 7) {
    const result = await query(
      `SELECT DATE(sent_at) as date, status, COUNT(*)::int as count
       FROM email_messages WHERE sent_at >= NOW() - $1::interval
       GROUP BY DATE(sent_at), status ORDER BY date DESC`,
      [`${days} days`]
    );
    return result.rows;
  }

  static async getProviderStats() {
    const result = await query(
      `SELECT provider_used, status, COUNT(*)::int as count, COALESCE(SUM(cost), 0) as total_cost
       FROM email_messages WHERE sent_at >= NOW() - INTERVAL '24 hours'
       GROUP BY provider_used, status`
    );
    return result.rows;
  }

  static async retryFailed(campaignId: string): Promise<number> {
    const result = await query(
      `SELECT id, to_email, subject, html_body, text_body
       FROM email_messages WHERE campaign_id = $1 AND status = 'failed' AND attempts < $2`,
      [campaignId, config.maxRetries]
    );
    if (result.rows.length === 0) return 0;

    const chain = await EmailService.getSortedProviders();
    await emailQueue.add('retry-batch', {
      campaign_id: campaignId,
      messages: result.rows.map((row: Record<string, unknown>) => ({ ...row, provider_chain: chain })),
    });
    await query(
      `UPDATE email_messages SET status = 'queued' WHERE campaign_id = $1 AND status = 'failed' AND attempts < $2`,
      [campaignId, config.maxRetries]
    );
    return result.rows.length;
  }
}
