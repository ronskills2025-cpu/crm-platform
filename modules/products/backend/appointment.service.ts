/**
 * Appointment Booking Bot service — chatbot flow, slot management, reminders.
 */
import { query } from '../../../packages/db/src/connection';
import { ProductService } from './product.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:appointment');

export interface BookingService {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;
  currency: string;
  location: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BookingSlot {
  id: string;
  service_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_bookings: number;
  is_active: boolean;
}

export interface Booking {
  id: string;
  tenant_id: string;
  product_id: string;
  service_id: string | null;
  customer_name: string | null;
  customer_phone: string;
  customer_email: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  payment_amount: number;
  payment_link: string | null;
  reminder_sent: boolean;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class AppointmentService {
  // ── Service CRUD ──────────────────────────────────────────────────────
  static async createService(tenantId: string, productId: string, data: {
    name: string; description?: string; duration_min?: number; price?: number;
    currency?: string; location?: string;
  }): Promise<BookingService> {
    const res = await query<BookingService>(
      `INSERT INTO booking_services (tenant_id, product_id, name, description, duration_min, price, currency, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenantId, productId, data.name, data.description ?? null,
       data.duration_min ?? 30, data.price ?? 0, data.currency ?? 'INR', data.location ?? null]
    );
    return res.rows[0];
  }

  static async listServices(tenantId: string): Promise<BookingService[]> {
    const res = await query<BookingService>(
      'SELECT * FROM booking_services WHERE tenant_id = $1 AND is_active = true ORDER BY name', [tenantId]
    );
    return res.rows;
  }

  static async updateService(id: string, data: Partial<{
    name: string; description: string; duration_min: number; price: number; location: string; is_active: boolean;
  }>): Promise<BookingService | null> {
    const sets = ['updated_at = NOW()'];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) { params.push(v); sets.push(`${k} = $${params.length}`); }
    }
    if (!params.length) return null;
    params.push(id);
    const res = await query<BookingService>(
      `UPDATE booking_services SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  static async deleteService(id: string): Promise<boolean> {
    const res = await query('DELETE FROM booking_services WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ── Slots ─────────────────────────────────────────────────────────────
  static async upsertSlot(serviceId: string, data: {
    day_of_week: number; start_time: string; end_time: string; max_bookings?: number;
  }): Promise<BookingSlot> {
    const res = await query<BookingSlot>(
      `INSERT INTO booking_slots (service_id, day_of_week, start_time, end_time, max_bookings)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [serviceId, data.day_of_week, data.start_time, data.end_time, data.max_bookings ?? 1]
    );
    return res.rows[0];
  }

  static async listSlots(serviceId: string): Promise<BookingSlot[]> {
    const res = await query<BookingSlot>(
      'SELECT * FROM booking_slots WHERE service_id = $1 AND is_active = true ORDER BY day_of_week, start_time',
      [serviceId]
    );
    return res.rows;
  }

  static async deleteSlot(id: string): Promise<boolean> {
    const res = await query('DELETE FROM booking_slots WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ── Available slots for a specific date ───────────────────────────────
  static async getAvailableSlots(serviceId: string, date: string): Promise<Array<{ start_time: string; end_time: string; available: number }>> {
    const dow = new Date(date).getDay();
    const slots = await query<BookingSlot>(
      'SELECT * FROM booking_slots WHERE service_id = $1 AND day_of_week = $2 AND is_active = true ORDER BY start_time',
      [serviceId, dow]
    );

    const result: Array<{ start_time: string; end_time: string; available: number }> = [];
    for (const slot of slots.rows) {
      const booked = await query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM bookings
         WHERE service_id = $1 AND booking_date = $2 AND start_time = $3 AND status NOT IN ('cancelled')`,
        [serviceId, date, slot.start_time]
      );
      const used = parseInt(booked.rows[0]?.count ?? '0');
      const avail = slot.max_bookings - used;
      if (avail > 0) {
        result.push({ start_time: slot.start_time, end_time: slot.end_time, available: avail });
      }
    }
    return result;
  }

  // ── Booking CRUD ──────────────────────────────────────────────────────
  static async createBooking(tenantId: string, productId: string, data: {
    service_id: string; customer_name?: string; customer_phone: string;
    customer_email?: string; booking_date: string; start_time: string;
    end_time: string; payment_link?: string; payment_amount?: number; notes?: string;
  }): Promise<Booking> {
    const res = await query<Booking>(
      `INSERT INTO bookings (tenant_id, product_id, service_id, customer_name, customer_phone,
        customer_email, booking_date, start_time, end_time, payment_link, payment_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [tenantId, productId, data.service_id, data.customer_name ?? null,
       data.customer_phone, data.customer_email ?? null, data.booking_date,
       data.start_time, data.end_time, data.payment_link ?? null,
       data.payment_amount ?? 0, data.notes ?? null]
    );

    const booking = res.rows[0];

    await ProductService.logEvent(tenantId, productId, 'appointment', 'booking_created', booking.id, 'booking');
    await ProductService.notify(tenantId, 'appointment', 'booking_confirmed', 'New Booking',
      `${data.customer_name ?? data.customer_phone} booked for ${data.booking_date} ${data.start_time}`,
      { entityId: booking.id });

    return booking;
  }

  static async listBookings(tenantId: string, opts?: {
    status?: string; date?: string; limit?: number; offset?: number;
  }): Promise<{ bookings: Booking[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    if (opts?.date) { params.push(opts.date); conds.push(`booking_date = $${params.length}`); }
    const where = conds.join(' AND ');
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    params.push(limit, offset);

    const [rows, cnt] = await Promise.all([
      query<Booking>(`SELECT * FROM bookings WHERE ${where} ORDER BY booking_date DESC, start_time DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM bookings WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { bookings: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getBooking(id: string): Promise<Booking | null> {
    const res = await query<Booking>('SELECT * FROM bookings WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async updateBookingStatus(id: string, status: string): Promise<Booking | null> {
    const res = await query<Booking>(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    return res.rows[0] ?? null;
  }

  static async reschedule(id: string, newDate: string, newStart: string, newEnd: string): Promise<Booking | null> {
    const res = await query<Booking>(
      `UPDATE bookings SET booking_date = $1, start_time = $2, end_time = $3, updated_at = NOW()
       WHERE id = $4 AND status NOT IN ('cancelled','completed') RETURNING *`,
      [newDate, newStart, newEnd, id]
    );
    return res.rows[0] ?? null;
  }

  static async cancel(id: string): Promise<Booking | null> {
    return AppointmentService.updateBookingStatus(id, 'cancelled');
  }

  static async markReminderSent(id: string): Promise<void> {
    await query('UPDATE bookings SET reminder_sent = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  // ── Get upcoming bookings that need reminders (24h before) ────────────
  static async getPendingReminders(): Promise<Booking[]> {
    const res = await query<Booking>(
      `SELECT * FROM bookings
       WHERE status = 'confirmed' AND reminder_sent = false
         AND (booking_date + start_time) <= (NOW() + INTERVAL '24 hours')
         AND (booking_date + start_time) > NOW()
       ORDER BY booking_date, start_time
       LIMIT 100`
    );
    return res.rows;
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  static async getStats(tenantId: string) {
    const res = await query<{
      total: string; confirmed: string; completed: string; cancelled: string;
      no_show: string; total_revenue: string;
    }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
              SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_show,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN payment_amount ELSE 0 END), 0) AS total_revenue
       FROM bookings WHERE tenant_id = $1`,
      [tenantId]
    );
    const r = res.rows[0];
    return {
      total: parseInt(r?.total ?? '0'),
      confirmed: parseInt(r?.confirmed ?? '0'),
      completed: parseInt(r?.completed ?? '0'),
      cancelled: parseInt(r?.cancelled ?? '0'),
      noShow: parseInt(r?.no_show ?? '0'),
      totalRevenue: parseFloat(r?.total_revenue ?? '0'),
    };
  }
}
