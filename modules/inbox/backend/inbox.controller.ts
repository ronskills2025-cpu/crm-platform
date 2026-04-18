import { Request, Response } from 'express';
import { z } from 'zod';
import { createLogger } from '../../../packages/utils/src/logger';
import { InboxService } from './inbox.service';
import { AssignThreadSchema, IncomingMessageSchema, ListThreadsQuerySchema, ReplyMessageSchema } from './Inbox';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';

const log = createLogger('ctrl:inbox');

export class InboxController {
  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await InboxService.getStats(req.tenantId);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get inbox stats' });
    }
  }

  static async listThreads(req: AuthRequest, res: Response) {
    try {
      const params = ListThreadsQuerySchema.parse(req.query);
      const { rows: threads, total } = await InboxService.listThreads(params.channel, { ...params, tenant_id: req.tenantId });
      res.json({ success: true, threads, total });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      log.error('listThreads failed', err);
      res.status(500).json({ error: 'Failed to list inbox threads' });
    }
  }

  static async getThread(req: Request, res: Response) {
    try {
      const thread = await InboxService.getThread(req.params.id);
      if (!thread) {
        res.status(404).json({ error: 'Thread not found' });
        return;
      }
      res.json({ success: true, ...thread });
    } catch (err) {
      log.error('getThread failed', err);
      res.status(500).json({ error: 'Failed to get thread' });
    }
  }

  static async markRead(req: Request, res: Response) {
    try {
      const thread = await InboxService.markThreadRead(req.params.id);
      res.json({ success: true, thread });
    } catch (err) {
      log.error('markRead failed', err);
      res.status(500).json({ error: 'Failed to mark thread as read' });
    }
  }

  static async assignThread(req: Request, res: Response) {
    try {
      const { assigned_to } = AssignThreadSchema.parse(req.body);
      const thread = await InboxService.assignThread(req.params.id, assigned_to);
      res.json({ success: true, thread });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      log.error('assignThread failed', err);
      res.status(500).json({ error: 'Failed to assign thread' });
    }
  }

  static async sendReply(req: Request, res: Response) {
    try {
      const data = ReplyMessageSchema.parse(req.body);
      const result = await InboxService.sendReply(req.params.id, data);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      log.error('sendReply failed', err);
      res.status(500).json({ error: (err as Error).message || 'Failed to send reply' });
    }
  }

  static async retryReply(req: Request, res: Response) {
    try {
      const result = await InboxService.retryReply(req.params.messageId);
      res.json(result);
    } catch (err) {
      log.error('retryReply failed', err);
      res.status(500).json({ error: (err as Error).message || 'Failed to retry reply' });
    }
  }

  static async exportThread(req: Request, res: Response) {
    try {
      const payload = await InboxService.exportThread(req.params.id);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="thread-${req.params.id}.json"`);
      res.json(payload);
    } catch (err) {
      log.error('exportThread failed', err);
      res.status(500).json({ error: (err as Error).message || 'Failed to export thread' });
    }
  }

  static async receiveIncoming(req: Request, res: Response) {
    try {
      const payload = IncomingMessageSchema.parse(req.body);
      const result = await InboxService.receiveIncoming(payload);
      res.status(202).json({ success: true, ...result });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: err.errors });
        return;
      }
      log.error('receiveIncoming failed', err);
      res.status(500).json({ error: 'Failed to process incoming message' });
    }
  }
}
