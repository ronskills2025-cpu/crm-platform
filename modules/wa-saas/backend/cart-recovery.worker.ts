import { Worker, Job } from 'bullmq';
import { redis } from '../../../packages/db/src/redis';
import { query } from '../../../packages/db/src/connection';
import { CartRecoveryService } from './cart-recovery.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('worker:cart-recovery');

interface CartRecoveryJob {
  sessionId: string;
  tenantId: string | null;
  phone: string;
  checkoutUrl: string | null;
  items: Array<{ title: string; quantity: number; price: number }>;
  cartValue: number;
  currency: string;
  customerName: string | null;
  sequence: number;   // 1 = first message, 2 = follow-up
}

async function buildMessage(job: CartRecoveryJob): Promise<string> {
  const name = job.customerName ? `, ${job.customerName}` : '';
  const topItem = job.items[0]?.title ?? 'your items';
  const value = `${job.currency} ${job.cartValue.toFixed(2)}`;
  const link = job.checkoutUrl ? `\n\n🛒 Complete your purchase: ${job.checkoutUrl}` : '';

  if (job.sequence === 1) {
    return `Hey${name}! 👋\n\nYou left *${topItem}* and more (${value}) in your cart.${link}\n\nNeed help? Just reply!`;
  }
  return `Hi${name}, just following up! 😊\n\nYour cart (${value}) is still waiting for you.${link}\n\nReply STOP to opt out.`;
}

async function getTenantNumber(tenantId: string | null): Promise<{ phoneNumberId: string; accessToken: string } | null> {
  if (!tenantId) return null;
  const res = await query<{ phone_number_id: string; access_token: string }>(
    `SELECT phone_number_id, access_token FROM tenant_numbers
     WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
    [tenantId]
  );
  if (!res.rows[0]) return null;
  return { phoneNumberId: res.rows[0].phone_number_id, accessToken: res.rows[0].access_token };
}

async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  toPhone: string,
  message: string
): Promise<boolean> {
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
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
    log.error('WhatsApp send failed', { err: (err as Error).message });
    return false;
  }
}

const worker = new Worker<CartRecoveryJob>(
  'cart-recovery',
  async (job: Job<CartRecoveryJob>) => {
    const data = job.data;
    log.info('Processing cart recovery', { sessionId: data.sessionId, seq: data.sequence });

    // Skip if cart already recovered
    const session = await query<{ status: string }>(
      `SELECT status FROM cart_sessions WHERE id = $1`,
      [data.sessionId]
    ).catch(() => null);

    if (session?.rows[0]?.status === 'recovered') {
      log.info('Cart already recovered, skipping', { sessionId: data.sessionId });
      return;
    }

    const numberCreds = await getTenantNumber(data.tenantId);
    if (!numberCreds) {
      log.warn('No WhatsApp number configured for tenant', { tenantId: data.tenantId });
      return;
    }

    const message = await buildMessage(data);
    const sent = await sendWhatsAppMessage(
      numberCreds.phoneNumberId,
      numberCreds.accessToken,
      data.phone,
      message
    );

    if (sent) {
      await CartRecoveryService.recordMessageSent(data.sessionId, data.sequence);
      log.info('Cart recovery message sent', { sessionId: data.sessionId, seq: data.sequence });
    } else {
      throw new Error('Failed to send cart recovery message');
    }
  },
  {
    connection: redis,
    concurrency: 10,
  }
);

worker.on('failed', (job, err) => {
  log.error('Cart recovery job failed', { jobId: job?.id, err: err?.message });
});

worker.on('error', (err) => {
  log.error('Cart recovery worker error', err);
});

log.info('Cart recovery worker started');

export default worker;
