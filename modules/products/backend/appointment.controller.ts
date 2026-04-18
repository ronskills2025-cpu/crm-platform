import { Response } from 'express';
import { AppointmentService } from './appointment.service';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:appointment');

const CreateServiceSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().min(1),
  durationMin: z.number().int().positive().default(30),
  price: z.number().nonnegative().default(0),
  currency: z.string().default('USD'),
  description: z.string().optional(),
  location: z.string().optional(),
});

const UpdateServiceSchema = z.object({
  name: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  isActive: z.boolean().optional(),
});

const UpsertSlotSchema = z.object({
  serviceId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  maxBookings: z.number().int().positive().default(1),
});

const CreateBookingSchema = z.object({
  productId: z.string().uuid(),
  serviceId: z.string().uuid(),
  customerName: z.string().optional(),
  customerPhone: z.string().min(5),
  customerEmail: z.string().email().optional(),
  bookingDate: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  paymentLink: z.string().optional(),
  paymentAmount: z.number().optional(),
  notes: z.string().optional(),
});

const RescheduleSchema = z.object({
  bookingDate: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export class AppointmentController {
  // ── Services ──────────────────────────────────────────────────
  static async createService(req: AuthRequest, res: Response) {
    try {
      const d = CreateServiceSchema.parse(req.body);
      const svc = await AppointmentService.createService(req.tenantId!, d.productId, {
        name: d.name, duration_min: d.durationMin, price: d.price,
        currency: d.currency, description: d.description, location: d.location,
      });
      res.status(201).json({ success: true, service: svc });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('createService failed', err);
      res.status(500).json({ error: 'Failed to create service' });
    }
  }

  static async listServices(req: AuthRequest, res: Response) {
    try {
      const services = await AppointmentService.listServices(req.tenantId!);
      res.json({ success: true, services });
    } catch (err) {
      log.error('listServices failed', err);
      res.status(500).json({ error: 'Failed to list services' });
    }
  }

  static async updateService(req: AuthRequest, res: Response) {
    try {
      const d = UpdateServiceSchema.parse(req.body);
      const svc = await AppointmentService.updateService(req.params.id, {
        name: d.name, duration_min: d.durationMin, price: d.price,
        description: d.description, location: d.location, is_active: d.isActive,
      });
      if (!svc) return res.status(404).json({ error: 'Service not found' });
      res.json({ success: true, service: svc });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateService failed', err);
      res.status(500).json({ error: 'Failed to update service' });
    }
  }

  static async deleteService(req: AuthRequest, res: Response) {
    try {
      await AppointmentService.deleteService(req.params.id);
      res.json({ success: true });
    } catch (err) {
      log.error('deleteService failed', err);
      res.status(500).json({ error: 'Failed to delete service' });
    }
  }

  // ── Slots ─────────────────────────────────────────────────────
  static async upsertSlot(req: AuthRequest, res: Response) {
    try {
      const d = UpsertSlotSchema.parse(req.body);
      const slot = await AppointmentService.upsertSlot(d.serviceId, {
        day_of_week: d.dayOfWeek, start_time: d.startTime,
        end_time: d.endTime, max_bookings: d.maxBookings,
      });
      res.json({ success: true, slot });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('upsertSlot failed', err);
      res.status(500).json({ error: 'Failed to upsert slot' });
    }
  }

  static async listSlots(req: AuthRequest, res: Response) {
    try {
      const slots = await AppointmentService.listSlots(req.params.serviceId);
      res.json({ success: true, slots });
    } catch (err) {
      log.error('listSlots failed', err);
      res.status(500).json({ error: 'Failed to list slots' });
    }
  }

  static async deleteSlot(req: AuthRequest, res: Response) {
    try {
      await AppointmentService.deleteSlot(req.params.slotId);
      res.json({ success: true });
    } catch (err) {
      log.error('deleteSlot failed', err);
      res.status(500).json({ error: 'Failed to delete slot' });
    }
  }

  static async getAvailableSlots(req: AuthRequest, res: Response) {
    try {
      const date = req.query.date as string;
      if (!date) return res.status(400).json({ error: 'date query param required' });
      const slots = await AppointmentService.getAvailableSlots(req.params.serviceId, date);
      res.json({ success: true, slots });
    } catch (err) {
      log.error('getAvailableSlots failed', err);
      res.status(500).json({ error: 'Failed to get available slots' });
    }
  }

  // ── Bookings ──────────────────────────────────────────────────
  static async createBooking(req: AuthRequest, res: Response) {
    try {
      const d = CreateBookingSchema.parse(req.body);
      const booking = await AppointmentService.createBooking(req.tenantId!, d.productId, {
        service_id: d.serviceId, customer_name: d.customerName,
        customer_phone: d.customerPhone, customer_email: d.customerEmail,
        booking_date: d.bookingDate, start_time: d.startTime, end_time: d.endTime,
        payment_link: d.paymentLink, payment_amount: d.paymentAmount, notes: d.notes,
      });
      res.status(201).json({ success: true, booking });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('createBooking failed', err);
      res.status(500).json({ error: 'Failed to create booking' });
    }
  }

  static async listBookings(req: AuthRequest, res: Response) {
    try {
      const result = await AppointmentService.listBookings(req.tenantId!, {
        status: req.query.status as string,
        date: req.query.date as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listBookings failed', err);
      res.status(500).json({ error: 'Failed to list bookings' });
    }
  }

  static async getBooking(req: AuthRequest, res: Response) {
    try {
      const booking = await AppointmentService.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      res.json({ success: true, booking });
    } catch (err) {
      log.error('getBooking failed', err);
      res.status(500).json({ error: 'Failed to get booking' });
    }
  }

  static async updateBookingStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = z.object({ status: z.enum(['confirmed', 'completed', 'no_show']) }).parse(req.body);
      const booking = await AppointmentService.updateBookingStatus(req.params.id, status);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      res.json({ success: true, booking });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateBookingStatus failed', err);
      res.status(500).json({ error: 'Failed to update booking' });
    }
  }

  static async reschedule(req: AuthRequest, res: Response) {
    try {
      const d = RescheduleSchema.parse(req.body);
      const booking = await AppointmentService.reschedule(req.params.id, d.bookingDate, d.startTime, d.endTime);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      res.json({ success: true, booking });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('reschedule failed', err);
      res.status(500).json({ error: 'Failed to reschedule' });
    }
  }

  static async cancelBooking(req: AuthRequest, res: Response) {
    try {
      const booking = await AppointmentService.cancel(req.params.id);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      res.json({ success: true, booking });
    } catch (err) {
      log.error('cancelBooking failed', err);
      res.status(500).json({ error: 'Failed to cancel booking' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await AppointmentService.getStats(req.tenantId!);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }
}
