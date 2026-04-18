import { Response } from 'express';
import { EventService } from './event.service';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:event');

const CreateEventSchema = z.object({
  productId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  eventDate: z.string(),
  eventTime: z.string().optional(),
  location: z.string().optional(),
  eventUrl: z.string().url().optional(),
  maxAttendees: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  eventDate: z.string().optional(),
  eventTime: z.string().optional(),
  location: z.string().optional(),
  eventUrl: z.string().url().optional(),
  recordingUrl: z.string().url().optional(),
  certificateUrl: z.string().url().optional(),
  maxAttendees: z.number().int().positive().optional(),
  status: z.enum(['draft', 'upcoming', 'live', 'completed', 'cancelled']).optional(),
});

const RegisterSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().min(5),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export class EventController {
  static async createEvent(req: AuthRequest, res: Response) {
    try {
      const d = CreateEventSchema.parse(req.body);
      const event = await EventService.createEvent(req.tenantId!, d.productId, {
        title: d.title, description: d.description, event_date: d.eventDate,
        event_time: d.eventTime, location: d.location, event_url: d.eventUrl,
        max_attendees: d.maxAttendees, metadata: d.metadata,
      });
      res.status(201).json({ success: true, event });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('createEvent failed', err);
      res.status(500).json({ error: 'Failed to create event' });
    }
  }

  static async listEvents(req: AuthRequest, res: Response) {
    try {
      const result = await EventService.listEvents(req.tenantId!, {
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listEvents failed', err);
      res.status(500).json({ error: 'Failed to list events' });
    }
  }

  static async getEvent(req: AuthRequest, res: Response) {
    try {
      const event = await EventService.getEvent(req.params.id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      res.json({ success: true, event });
    } catch (err) {
      log.error('getEvent failed', err);
      res.status(500).json({ error: 'Failed to get event' });
    }
  }

  static async updateEvent(req: AuthRequest, res: Response) {
    try {
      const d = UpdateEventSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (d.title !== undefined) updates.title = d.title;
      if (d.description !== undefined) updates.description = d.description;
      if (d.eventDate !== undefined) updates.event_date = d.eventDate;
      if (d.eventTime !== undefined) updates.event_time = d.eventTime;
      if (d.location !== undefined) updates.location = d.location;
      if (d.eventUrl !== undefined) updates.event_url = d.eventUrl;
      if (d.recordingUrl !== undefined) updates.recording_url = d.recordingUrl;
      if (d.certificateUrl !== undefined) updates.certificate_url = d.certificateUrl;
      if (d.maxAttendees !== undefined) updates.max_attendees = d.maxAttendees;
      if (d.status !== undefined) updates.status = d.status;
      const event = await EventService.updateEvent(req.params.id, updates);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      res.json({ success: true, event });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateEvent failed', err);
      res.status(500).json({ error: 'Failed to update event' });
    }
  }

  static async deleteEvent(req: AuthRequest, res: Response) {
    try {
      const ok = await EventService.deleteEvent(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Event not found' });
      res.json({ success: true });
    } catch (err) {
      log.error('deleteEvent failed', err);
      res.status(500).json({ error: 'Failed to delete event' });
    }
  }

  static async register(req: AuthRequest, res: Response) {
    try {
      const d = RegisterSchema.parse(req.body);
      const reg = await EventService.register(req.params.id, req.tenantId!, {
        customer_name: d.customerName, customer_phone: d.customerPhone,
        customer_email: d.customerEmail, metadata: d.metadata,
      });
      res.status(201).json({ success: true, registration: reg });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('register failed', err);
      res.status(500).json({ error: 'Failed to register' });
    }
  }

  static async listRegistrations(req: AuthRequest, res: Response) {
    try {
      const result = await EventService.listRegistrations(req.params.id, {
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 100,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listRegistrations failed', err);
      res.status(500).json({ error: 'Failed to list registrations' });
    }
  }

  static async updateRegistrationStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = z.object({ status: z.enum(['registered', 'confirmed', 'attended', 'missed', 'cancelled']) }).parse(req.body);
      const reg = await EventService.updateRegistrationStatus(req.params.regId, status);
      if (!reg) return res.status(404).json({ error: 'Registration not found' });
      res.json({ success: true, registration: reg });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateRegistrationStatus failed', err);
      res.status(500).json({ error: 'Failed to update registration' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await EventService.getStats(req.tenantId!);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }
}
