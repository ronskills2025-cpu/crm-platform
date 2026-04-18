/**
 * Bot Manager Controller
 * 
 * HTTP request handlers for bot management API.
 */

import { Request, Response } from 'express';
import { BotService } from './bot.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('bot-controller');

export class BotController {
  // ══════════════════════════════════════════════════════════════════════════
  // BOT CRUD
  // ══════════════════════════════════════════════════════════════════════════

  static async createBot(req: Request, res: Response) {
    try {
      const bot = await BotService.createBot(req.body);
      res.status(201).json({ success: true, bot });
    } catch (err) {
      log.error('createBot failed', err);
      res.status(500).json({ error: 'Failed to create bot' });
    }
  }

  static async listBots(req: Request, res: Response) {
    try {
      const bots = await BotService.listBots({
        tenant_id: req.query.tenant_id as string,
        channel: req.query.channel as string,
        bot_type: req.query.bot_type as string,
        is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      });
      res.json({ success: true, bots });
    } catch (err) {
      log.error('listBots failed', err);
      res.status(500).json({ error: 'Failed to list bots' });
    }
  }

  static async getBot(req: Request, res: Response) {
    try {
      const bot = await BotService.getBot(req.params.id);
      if (!bot) {
        res.status(404).json({ error: 'Bot not found' });
        return;
      }
      res.json({ success: true, bot });
    } catch (err) {
      log.error('getBot failed', err);
      res.status(500).json({ error: 'Failed to get bot' });
    }
  }

  static async updateBot(req: Request, res: Response) {
    try {
      const bot = await BotService.updateBot(req.params.id, req.body);
      if (!bot) {
        res.status(404).json({ error: 'Bot not found' });
        return;
      }
      res.json({ success: true, bot });
    } catch (err) {
      log.error('updateBot failed', err);
      res.status(500).json({ error: 'Failed to update bot' });
    }
  }

  static async deleteBot(req: Request, res: Response) {
    try {
      const deleted = await BotService.deleteBot(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Bot not found' });
        return;
      }
      res.json({ success: true, message: 'Bot deleted' });
    } catch (err) {
      log.error('deleteBot failed', err);
      res.status(500).json({ error: 'Failed to delete bot' });
    }
  }

  static async toggleBot(req: Request, res: Response) {
    try {
      const bot = await BotService.toggleBot(req.params.id);
      if (!bot) {
        res.status(404).json({ error: 'Bot not found' });
        return;
      }
      res.json({ success: true, bot });
    } catch (err) {
      log.error('toggleBot failed', err);
      res.status(500).json({ error: 'Failed to toggle bot' });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TRIGGERS
  // ══════════════════════════════════════════════════════════════════════════

  static async createTrigger(req: Request, res: Response) {
    try {
      const trigger = await BotService.createTrigger({
        bot_id: req.params.botId,
        ...req.body,
      });
      res.status(201).json({ success: true, trigger });
    } catch (err) {
      log.error('createTrigger failed', err);
      res.status(500).json({ error: 'Failed to create trigger' });
    }
  }

  static async listTriggers(req: Request, res: Response) {
    try {
      const triggers = await BotService.listTriggers(req.params.botId);
      res.json({ success: true, triggers });
    } catch (err) {
      log.error('listTriggers failed', err);
      res.status(500).json({ error: 'Failed to list triggers' });
    }
  }

  static async deleteTrigger(req: Request, res: Response) {
    try {
      const deleted = await BotService.deleteTrigger(req.params.triggerId);
      if (!deleted) {
        res.status(404).json({ error: 'Trigger not found' });
        return;
      }
      res.json({ success: true, message: 'Trigger deleted' });
    } catch (err) {
      log.error('deleteTrigger failed', err);
      res.status(500).json({ error: 'Failed to delete trigger' });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RULES
  // ══════════════════════════════════════════════════════════════════════════

  static async createRule(req: Request, res: Response) {
    try {
      const rule = await BotService.createRule({
        bot_id: req.params.botId,
        ...req.body,
      });
      res.status(201).json({ success: true, rule });
    } catch (err) {
      log.error('createRule failed', err);
      res.status(500).json({ error: 'Failed to create rule' });
    }
  }

  static async listRules(req: Request, res: Response) {
    try {
      const rules = await BotService.listRules(req.params.botId);
      res.json({ success: true, rules });
    } catch (err) {
      log.error('listRules failed', err);
      res.status(500).json({ error: 'Failed to list rules' });
    }
  }

  static async deleteRule(req: Request, res: Response) {
    try {
      const deleted = await BotService.deleteRule(req.params.ruleId);
      if (!deleted) {
        res.status(404).json({ error: 'Rule not found' });
        return;
      }
      res.json({ success: true, message: 'Rule deleted' });
    } catch (err) {
      log.error('deleteRule failed', err);
      res.status(500).json({ error: 'Failed to delete rule' });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  static async createAction(req: Request, res: Response) {
    try {
      const action = await BotService.createAction({
        rule_id: req.params.ruleId,
        ...req.body,
      });
      res.status(201).json({ success: true, action });
    } catch (err) {
      log.error('createAction failed', err);
      res.status(500).json({ error: 'Failed to create action' });
    }
  }

  static async listActions(req: Request, res: Response) {
    try {
      const actions = await BotService.listActions(req.params.ruleId);
      res.json({ success: true, actions });
    } catch (err) {
      log.error('listActions failed', err);
      res.status(500).json({ error: 'Failed to list actions' });
    }
  }

  static async deleteAction(req: Request, res: Response) {
    try {
      const deleted = await BotService.deleteAction(req.params.actionId);
      if (!deleted) {
        res.status(404).json({ error: 'Action not found' });
        return;
      }
      res.json({ success: true, message: 'Action deleted' });
    } catch (err) {
      log.error('deleteAction failed', err);
      res.status(500).json({ error: 'Failed to delete action' });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOGS & STATS
  // ══════════════════════════════════════════════════════════════════════════

  static async getLogs(req: Request, res: Response) {
    try {
      const logs = await BotService.getLogs({
        bot_id: req.query.bot_id as string,
        conversation_id: req.query.conversation_id as string,
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, logs });
    } catch (err) {
      log.error('getLogs failed', err);
      res.status(500).json({ error: 'Failed to get logs' });
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const stats = await BotService.getStats(req.query.tenant_id as string);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MANUAL TRIGGER (for testing)
  // ══════════════════════════════════════════════════════════════════════════

  static async testTrigger(req: Request, res: Response) {
    try {
      const { trigger_type, channel, contact_value, message } = req.body;
      
      if (!trigger_type || !channel || !contact_value) {
        res.status(400).json({ error: 'Missing required fields: trigger_type, channel, contact_value' });
        return;
      }

      await BotService.evaluateTriggers(trigger_type, {
        channel,
        contact_value,
        message,
        metadata: req.body.metadata,
      });

      res.json({ success: true, message: 'Trigger evaluated' });
    } catch (err) {
      log.error('testTrigger failed', err);
      res.status(500).json({ error: 'Failed to test trigger' });
    }
  }
}
