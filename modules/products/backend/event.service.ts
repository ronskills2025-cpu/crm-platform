/**
 * Event Reminder service — registrations, confirmations, reminders, post-event, attendance.
 */
import { query } from '../../../packages/db/src/connection';
import { ProductService } from './product.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:event');

export interface EventRecord {
  id: string; tenant_id: string; product_id: string;
  title: string; description: string | null;
  event_date: string; event_time: string | null;
  location: string | null; event_url: string | null;
  recording_url: string | null; certificate_url: string | null;
  max_attendees: number | null; status: string;
  metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface EventRegistration {
  id: string; event_id: string; tenant_id: string;
  customer_name: string | null; customer_phone: string; customer_email: string | null;
  status: string; confirmation_sent: boolean;
  reminder_24h_sent: boolean; reminder_1h_sent: boolean; post_event_sent: boolean;
  metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export class EventService {
  // ── Event CRUD ────────────────────────────────────────────────────
  static async createEvent(tenantId: string, productId: string, data: {
    title: string; description?: string; event_date: string; event_time?: string;
    location?: string; event_url?: string; max_attendees?: number;
    metadata?: Record<string, unknown>;
  }): Promise<EventRecord> {
    const res = await query<EventRecord>(
      `INSERT INTO events (tenant_id, product_id, title, description, event_date, event_time,
         location, event_url, max_attendees, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`,
      [tenantId, productId, data.title, data.description ?? null,
       data.event_date, data.event_time ?? null, data.location ?? null,
       data.event_url ?? null, data.max_attendees ?? null,
       JSON.stringify(data.metadata ?? {})]
    );
    await ProductService.logEvent(tenantId, productId, 'event', 'event_created', res.rows[0].id, 'event');
    return res.rows[0];
  }

  static async listEvents(tenantId: string, opts?: {
    status?: string; limit?: number; offset?: number;
  }): Promise<{ events: EventRecord[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 50, opts?.offset ?? 0);
    const [rows, cnt] = await Promise.all([
      query<EventRecord>(`SELECT * FROM events WHERE ${where} ORDER BY event_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM events WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { events: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getEvent(id: string): Promise<EventRecord | null> {
    const res = await query<EventRecord>('SELECT * FROM events WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async updateEvent(id: string, data: Partial<{
    title: string; description: string; event_date: string; event_time: string;
    location: string; event_url: string; recording_url: string;
    certificate_url: string; max_attendees: number; status: string;
  }>): Promise<EventRecord | null> {
    const sets: string[] = []; const params: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      params.push(v); sets.push(`${k} = $${params.length}`);
    }
    if (!sets.length) return this.getEvent(id);
    sets.push('updated_at = NOW()');
    params.push(id);
    const res = await query<EventRecord>(
      `UPDATE events SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  static async deleteEvent(id: string): Promise<boolean> {
    const res = await query('DELETE FROM events WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ── Registration CRUD ─────────────────────────────────────────────
  static async register(eventId: string, tenantId: string, data: {
    customer_name?: string; customer_phone: string; customer_email?: string;
    metadata?: Record<string, unknown>;
  }): Promise<EventRegistration> {
    const res = await query<EventRegistration>(
      `INSERT INTO event_registrations (event_id, tenant_id, customer_name, customer_phone, customer_email, metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,
      [eventId, tenantId, data.customer_name ?? null, data.customer_phone,
       data.customer_email ?? null, JSON.stringify(data.metadata ?? {})]
    );
    const event = await this.getEvent(eventId);
    if (event) {
      await ProductService.logEvent(tenantId, event.product_id, 'event', 'registration_created',
        res.rows[0].id, 'event_registration');
    }
    return res.rows[0];
  }

  static async listRegistrations(eventId: string, opts?: {
    status?: string; limit?: number; offset?: number;
  }): Promise<{ registrations: EventRegistration[]; total: number }> {
    const conds = ['event_id = $1'];
    const params: unknown[] = [eventId];
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 100, opts?.offset ?? 0);
    const [rows, cnt] = await Promise.all([
      query<EventRegistration>(`SELECT * FROM event_registrations WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM event_registrations WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { registrations: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async updateRegistrationStatus(id: string, status: string): Promise<EventRegistration | null> {
    const res = await query<EventRegistration>(
      'UPDATE event_registrations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    return res.rows[0] ?? null;
  }

  static async markConfirmationSent(id: string): Promise<void> {
    await query('UPDATE event_registrations SET confirmation_sent = true, status = $1, updated_at = NOW() WHERE id = $2', ['confirmed', id]);
  }

  static async markReminder24hSent(id: string): Promise<void> {
    await query('UPDATE event_registrations SET reminder_24h_sent = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  static async markReminder1hSent(id: string): Promise<void> {
    await query('UPDATE event_registrations SET reminder_1h_sent = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  static async markPostEventSent(id: string): Promise<void> {
    await query('UPDATE event_registrations SET post_event_sent = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  // ── Worker helpers ────────────────────────────────────────────────
  static async getPending24hReminders(): Promise<(EventRegistration & { event_title: string; event_date: string; event_time: string | null; event_location: string | null })[]> {
    const res = await query<EventRegistration & { event_title: string; event_date: string; event_time: string | null; event_location: string | null }>(
      `SELECT r.*, e.title AS event_title, e.event_date, e.event_time, e.location AS event_location
       FROM event_registrations r JOIN events e ON e.id = r.event_id
       WHERE r.reminder_24h_sent = false AND r.status IN ('registered','confirmed')
         AND e.status = 'upcoming' AND e.event_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '1 day'`,
      []
    );
    return res.rows;
  }

  static async getPending1hReminders(): Promise<(EventRegistration & { event_title: string; event_date: string; event_time: string | null })[]> {
    const res = await query<EventRegistration & { event_title: string; event_date: string; event_time: string | null }>(
      `SELECT r.*, e.title AS event_title, e.event_date, e.event_time
       FROM event_registrations r JOIN events e ON e.id = r.event_id
       WHERE r.reminder_1h_sent = false AND r.status IN ('registered','confirmed')
         AND e.status = 'upcoming' AND e.event_date = CURRENT_DATE
         AND e.event_time IS NOT NULL AND e.event_time <= (CURRENT_TIME + INTERVAL '1 hour')`,
      []
    );
    return res.rows;
  }

  static async getPendingPostEvent(): Promise<(EventRegistration & { event_title: string; recording_url: string | null; certificate_url: string | null })[]> {
    const res = await query<EventRegistration & { event_title: string; recording_url: string | null; certificate_url: string | null }>(
      `SELECT r.*, e.title AS event_title, e.recording_url, e.certificate_url
       FROM event_registrations r JOIN events e ON e.id = r.event_id
       WHERE r.post_event_sent = false AND r.status IN ('registered','confirmed','attended')
         AND e.status = 'completed'`,
      []
    );
    return res.rows;
  }

  // ── Stats ─────────────────────────────────────────────────────────
  static async getStats(tenantId: string) {
    const res = await query<{
      total_events: string; upcoming: string; completed: string;
      total_registrations: string; confirmed: string; attended: string; missed: string;
    }>(
      `SELECT
         COUNT(DISTINCT e.id) AS total_events,
         SUM(CASE WHEN e.status = 'upcoming' THEN 1 ELSE 0 END) AS upcoming,
         SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END) AS completed,
         COUNT(r.id) AS total_registrations,
         SUM(CASE WHEN r.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
         SUM(CASE WHEN r.status = 'attended' THEN 1 ELSE 0 END) AS attended,
         SUM(CASE WHEN r.status = 'missed' THEN 1 ELSE 0 END) AS missed
       FROM events e LEFT JOIN event_registrations r ON r.event_id = e.id
       WHERE e.tenant_id = $1`,
      [tenantId]
    );
    const r = res.rows[0];
    const totalReg = parseInt(r?.total_registrations ?? '0');
    const attended = parseInt(r?.attended ?? '0');
    return {
      totalEvents: parseInt(r?.total_events ?? '0'),
      upcoming: parseInt(r?.upcoming ?? '0'),
      completed: parseInt(r?.completed ?? '0'),
      totalRegistrations: totalReg,
      confirmed: parseInt(r?.confirmed ?? '0'),
      attended,
      missed: parseInt(r?.missed ?? '0'),
      attendanceRate: totalReg > 0 ? Math.round((attended / totalReg) * 100) : 0,
    };
  }
}
