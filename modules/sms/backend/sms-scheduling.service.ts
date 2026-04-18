import { query } from '../../../packages/db/src/connection';
import { smsQueue } from '../../../packages/utils/src/queues';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('svc:sms-schedule');

export class SMSSchedulingService {
  static async listJobs(tenantId: string) {
    const result = await query(
      `SELECT * FROM sms_scheduled_jobs WHERE tenant_id = $1 ORDER BY next_run_at ASC`,
      [tenantId]
    );
    return result.rows;
  }

  static async createJob(tenantId: string, data: {
    campaign_id: string;
    schedule_type: 'once' | 'recurring';
    run_at?: string;
    cron_expression?: string;
    timezone?: string;
  }) {
    const nextRunAt = data.schedule_type === 'once' && data.run_at
      ? data.run_at
      : null;
    const result = await query(
      `INSERT INTO sms_scheduled_jobs (tenant_id, campaign_id, schedule_type, run_at, cron_expression, timezone, next_run_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, data.campaign_id, data.schedule_type, data.run_at || null, data.cron_expression || null, data.timezone || 'UTC', nextRunAt]
    );
    return result.rows[0];
  }

  static async cancelJob(tenantId: string, id: string) {
    const result = await query(
      `UPDATE sms_scheduled_jobs SET status = 'cancelled', updated_at = NOW() WHERE tenant_id = $1 AND id = $2 RETURNING *`,
      [tenantId, id]
    );
    return result.rows[0] || null;
  }

  static async deleteJob(tenantId: string, id: string) {
    const result = await query(`DELETE FROM sms_scheduled_jobs WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Process due scheduled jobs. Called by a periodic timer.
   */
  static async processDueJobs() {
    const due = await query(
      `SELECT sj.*, c.status as campaign_status
       FROM sms_scheduled_jobs sj
       JOIN campaigns c ON sj.campaign_id = c.id
       WHERE sj.status = 'pending' AND sj.next_run_at <= NOW()
       ORDER BY sj.next_run_at ASC
       LIMIT 50`
    );

    for (const job of due.rows) {
      try {
        if (job.campaign_status === 'paused' || job.campaign_status === 'completed') {
          await query(
            `UPDATE sms_scheduled_jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
            [job.id]
          );
          continue;
        }

        // Queue the campaign for sending via BullMQ
        await smsQueue.add('scheduled-campaign', {
          campaign_id: job.campaign_id,
          scheduled_job_id: job.id,
        }, { priority: 5 });

        if (job.schedule_type === 'once') {
          await query(
            `UPDATE sms_scheduled_jobs SET status = 'completed', last_run_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [job.id]
          );
        } else {
          // For recurring, compute next run based on cron (simplified: add 24h for daily)
          await query(
            `UPDATE sms_scheduled_jobs SET last_run_at = NOW(), next_run_at = NOW() + INTERVAL '24 hours', updated_at = NOW() WHERE id = $1`,
            [job.id]
          );
        }

        log.info(`Processed scheduled job ${job.id} for campaign ${job.campaign_id}`);
      } catch (err) {
        log.error(`Failed to process scheduled job ${job.id}`, err);
        await query(
          `UPDATE sms_scheduled_jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`,
          [job.id]
        );
      }
    }

    return due.rows.length;
  }
}
