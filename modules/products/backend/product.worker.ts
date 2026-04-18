import { Worker, Job, Queue } from 'bullmq';
import { redis } from '../../../packages/db/src/redis';
import { query } from '../../../packages/db/src/connection';
import { FunnelService } from './funnel.service';
import { AppointmentService } from './appointment.service';
import { PaymentBotService } from './payment-bot.service';
import { ReviewService } from './review.service';
import { EventService } from './event.service';
import { CatalogService } from './catalog.service';
import { SurveyService } from './survey.service';
import { MembershipService } from './membership.service';
import { ProductService } from './product.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('worker:product');

type ProductAction =
  | 'funnel_step_execute'
  | 'appointment_reminders'
  | 'payment_reminders'
  | 'payment_escalation'
  | 'payment_overdue'
  | 'review_followups'
  | 'event_reminders'
  | 'event_post_event'
  | 'order_status_updates'
  | 'survey_followups'
  | 'membership_reminders'
  | 'send_whatsapp';

interface ProductJobData {
  action: ProductAction;
  tenantId?: string;
  entityId?: string;
  data?: Record<string, unknown>;
}

// ── Shared WhatsApp sender ──────────────────────────────────────

async function getTenantNumber(tenantId: string): Promise<{ phoneNumberId: string; accessToken: string } | null> {
  const res = await query<{ phone_number_id: string; access_token: string }>(
    `SELECT phone_number_id, access_token FROM tenant_numbers
     WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
    [tenantId]
  ).catch(() => ({ rows: [] as Array<{ phone_number_id: string; access_token: string }> }));
  if (!res.rows[0]) return null;
  return { phoneNumberId: res.rows[0].phone_number_id, accessToken: res.rows[0].access_token };
}

async function sendWhatsApp(tenantId: string, toPhone: string, message: string): Promise<boolean> {
  const creds = await getTenantNumber(tenantId);
  if (!creds) { log.warn('No WhatsApp number for tenant', { tenantId }); return false; }
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toPhone.replace(/\D/g, ''),
          type: 'text',
          text: { body: message },
        }),
      }
    );
    return resp.ok;
  } catch (err) {
    log.error('WhatsApp send failed', err);
    return false;
  }
}

// ── Job processor ────────────────────────────────────────────────

const worker = new Worker<ProductJobData>(
  'product',
  async (job: Job<ProductJobData>) => {
    const { action, tenantId, entityId, data } = job.data;
    log.info('Processing product job', { action, tenantId, entityId });

    switch (action) {

      // ── Funnel: execute a step (send WhatsApp message for a lead) ──
      case 'funnel_step_execute': {
        if (!tenantId || !entityId) break;
        const lead = await FunnelService.getLead(entityId);
        if (!lead || lead.status === 'converted' || lead.status === 'lost') break;
        const steps = await FunnelService.listSteps(lead.product_id);
        const step = steps.find(s => s.step_number === (lead.current_step + 1));
        if (!step) break;
        const message = (step.message_template ?? '')
          .replace('{{name}}', lead.name ?? 'there')
          .replace('{{phone}}', lead.phone);
        const sent = await sendWhatsApp(tenantId, lead.phone, message);
        await FunnelService.logStepExecution(lead.id, step.id, sent ? 'sent' : 'failed', sent ? undefined : 'Send failed');
        if (sent) await FunnelService.advanceStep(lead.id);
        break;
      }

      // ── Appointment: send booking reminders ─────────────────────
      case 'appointment_reminders': {
        const pending = await AppointmentService.getPendingReminders();
        for (const booking of pending) {
          const svc = (await AppointmentService.listServices(booking.tenant_id)).find(s => s.id === booking.service_id);
          const msg = `Reminder: You have a booking for ${svc?.name ?? 'your appointment'} on ${new Date(booking.booking_date).toLocaleDateString()} at ${booking.start_time}. Reply CONFIRM to confirm or CANCEL to cancel.`;
          const sent = await sendWhatsApp(booking.tenant_id, booking.customer_phone, msg);
          if (sent) await AppointmentService.markReminderSent(booking.id);
        }
        break;
      }

      // ── Payment: send payment reminders ─────────────────────────
      case 'payment_reminders': {
        const due = await PaymentBotService.getDuePayments();
        for (const c of due) {
          const remaining = (Number(c.amount_due) - Number(c.amount_paid)).toFixed(2);
          const msg = `Hi ${c.customer_name ?? 'there'}, a payment of ${c.currency} ${remaining} is due${c.status === 'overdue' ? ' (overdue)' : ''}. Reply PAY to make a payment.`;
          const sent = await sendWhatsApp(c.tenant_id, c.customer_phone, msg);
          if (sent) await PaymentBotService.recordReminderSent(c.id);
        }
        break;
      }

      // ── Payment: escalate stubborn cases ────────────────────────
      case 'payment_escalation': {
        const candidates = await PaymentBotService.getEscalationCandidates();
        for (const c of candidates) {
          await PaymentBotService.escalate(c.id);
        }
        break;
      }

      // ── Payment: mark overdue ───────────────────────────────────
      case 'payment_overdue': {
        await PaymentBotService.markOverdue();
        break;
      }

      // ── Review: send follow-ups ─────────────────────────────────
      case 'review_followups': {
        const pending = await ReviewService.getPendingFollowups();
        for (const r of pending) {
          const msg = r.followup_count === 0
            ? `Hi ${r.customer_name ?? 'there'}! We'd love your feedback. How would you rate your recent experience? Reply with a number 1-5 (5 = excellent).`
            : `Hi ${r.customer_name ?? 'there'}, just a quick follow-up! We'd really appreciate your rating (1-5). Your feedback helps us improve!`;
          const sent = await sendWhatsApp(r.tenant_id, r.customer_phone, msg);
          if (sent) await ReviewService.recordFollowup(r.id);
        }
        break;
      }

      // ── Generic send ────────────────────────────────────────────
      case 'send_whatsapp': {
        if (!tenantId || !data?.phone || !data?.message) break;
        await sendWhatsApp(tenantId, data.phone as string, data.message as string);
        break;
      }

      // ── Event: send 24h + 1h reminders ──────────────────────────
      case 'event_reminders': {
        const [reminders24h, reminders1h] = await Promise.all([
          EventService.getPending24hReminders(),
          EventService.getPending1hReminders(),
        ]);
        for (const r of reminders24h) {
          const msg = `Reminder: "${r.event_title}" is happening tomorrow${r.event_time ? ` at ${r.event_time}` : ''}${r.event_location ? ` at ${r.event_location}` : ''}. We look forward to seeing you!`;
          const sent = await sendWhatsApp(r.tenant_id, r.customer_phone, msg);
          if (sent) await EventService.markReminder24hSent(r.id);
        }
        for (const r of reminders1h) {
          const msg = `Starting soon: "${r.event_title}" begins in about 1 hour${r.event_time ? ` at ${r.event_time}` : ''}. Don't miss it!`;
          const sent = await sendWhatsApp(r.tenant_id, r.customer_phone, msg);
          if (sent) await EventService.markReminder1hSent(r.id);
        }
        break;
      }

      // ── Event: send post-event messages ─────────────────────────
      case 'event_post_event': {
        const pending = await EventService.getPendingPostEvent();
        for (const r of pending) {
          let msg = `Thank you for registering for "${r.event_title}"!`;
          if (r.recording_url) msg += ` Watch the recording: ${r.recording_url}`;
          if (r.certificate_url) msg += ` Download your certificate: ${r.certificate_url}`;
          const sent = await sendWhatsApp(r.tenant_id, r.customer_phone, msg);
          if (sent) await EventService.markPostEventSent(r.id);
        }
        break;
      }

      // ── Catalog: remind about pending orders ────────────────────
      case 'order_status_updates': {
        const pending = await CatalogService.getPendingOrders();
        for (const o of pending) {
          const msg = `Hi ${o.customer_name ?? 'there'}, your order of ${o.currency} ${o.total_amount} is pending confirmation.${o.payment_link ? ` Pay here: ${o.payment_link}` : ' Reply PAY to complete your order.'}`;
          await sendWhatsApp(o.tenant_id, o.customer_phone, msg);
        }
        break;
      }

      // ── Survey: follow up on pending responses ──────────────────
      case 'survey_followups': {
        const pending = await SurveyService.getPendingFollowups();
        for (const r of pending) {
          const msg = `Hi ${r.customer_name ?? 'there'}, we'd love your feedback! Please take a moment to complete our survey: "${r.survey_title}". Reply START to begin.`;
          await sendWhatsApp(r.tenant_id!, r.customer_phone, msg);
        }
        break;
      }

      // ── Membership: expiry reminders (7d, 1d, expired) ─────────
      case 'membership_reminders': {
        const [exp7d, exp1d, expired] = await Promise.all([
          MembershipService.getExpiring7d(),
          MembershipService.getExpiring1d(),
          MembershipService.getExpiredToday(),
        ]);
        for (const m of exp7d) {
          const msg = `Hi ${m.customer_name ?? 'there'}, your ${m.tier} membership expires on ${new Date(m.expiry_date).toLocaleDateString()}. Renew now to keep your benefits!${m.payment_link ? ` Renew here: ${m.payment_link}` : ''}`;
          const sent = await sendWhatsApp(m.tenant_id, m.customer_phone, msg);
          if (sent) await MembershipService.markReminder7dSent(m.id);
        }
        for (const m of exp1d) {
          const msg = `Urgent: Your ${m.tier} membership expires tomorrow! Don't lose access.${m.payment_link ? ` Renew now: ${m.payment_link}` : ' Reply RENEW to continue.'}`;
          const sent = await sendWhatsApp(m.tenant_id, m.customer_phone, msg);
          if (sent) await MembershipService.markReminder1dSent(m.id);
        }
        for (const m of expired) {
          const msg = `Your ${m.tier} membership has expired. Renew today to restore your benefits.${m.late_fee > 0 ? ` Late fee: ${m.currency} ${m.late_fee}.` : ''}${m.payment_link ? ` Renew: ${m.payment_link}` : ''}`;
          const sent = await sendWhatsApp(m.tenant_id, m.customer_phone, msg);
          if (sent) {
            await MembershipService.markExpirySent(m.id);
            await ProductService.notify(m.tenant_id, 'membership', 'membership_expired',
              'Membership Expired',
              `${m.customer_name ?? m.customer_phone}'s ${m.tier} membership has expired`,
              { entityId: m.id, priority: 'high' });
          }
        }
        break;
      }

      default:
        log.warn(`Unknown product action: ${action}`);
    }
  },
  { connection: redis, concurrency: 5 }
);

worker.on('failed', (job: Job<ProductJobData> | undefined, err?: Error) => {
  log.error(`Product job ${job?.id} (${job?.data?.action}) failed`, err);
});

log.info('Product worker started');

// ── Schedule recurring jobs ───────────────────────────────────

async function scheduleRecurring() {
  const q = new Queue<ProductJobData>('product', { connection: redis });

  await q.add('appointment_reminders', { action: 'appointment_reminders' }, {
    repeat: { every: 3_600_000 }, // hourly
    jobId: 'recurring:appointment_reminders',
  });

  await q.add('payment_reminders', { action: 'payment_reminders' }, {
    repeat: { every: 86_400_000 }, // daily
    jobId: 'recurring:payment_reminders',
  });

  await q.add('payment_escalation', { action: 'payment_escalation' }, {
    repeat: { every: 86_400_000 },
    jobId: 'recurring:payment_escalation',
  });

  await q.add('payment_overdue', { action: 'payment_overdue' }, {
    repeat: { every: 86_400_000 },
    jobId: 'recurring:payment_overdue',
  });

  await q.add('review_followups', { action: 'review_followups' }, {
    repeat: { every: 86_400_000 },
    jobId: 'recurring:review_followups',
  });

  await q.add('event_reminders', { action: 'event_reminders' }, {
    repeat: { every: 3_600_000 }, // hourly
    jobId: 'recurring:event_reminders',
  });

  await q.add('event_post_event', { action: 'event_post_event' }, {
    repeat: { every: 86_400_000 }, // daily
    jobId: 'recurring:event_post_event',
  });

  await q.add('order_status_updates', { action: 'order_status_updates' }, {
    repeat: { every: 86_400_000 },
    jobId: 'recurring:order_status_updates',
  });

  await q.add('survey_followups', { action: 'survey_followups' }, {
    repeat: { every: 86_400_000 },
    jobId: 'recurring:survey_followups',
  });

  await q.add('membership_reminders', { action: 'membership_reminders' }, {
    repeat: { every: 86_400_000 },
    jobId: 'recurring:membership_reminders',
  });

  log.info('Recurring product jobs scheduled');
}

scheduleRecurring().catch((err) => log.error('Failed to schedule product jobs', err));

export default worker;
