import { Response } from 'express';
import { SurveyService } from './survey.service';
import { z } from 'zod';
import type { AuthRequest } from '../../../packages/utils/src/auth.middleware';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('ctrl:survey');

const CreateSurveySchema = z.object({
  productId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateSurveySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
});

const UpsertQuestionSchema = z.object({
  questionOrder: z.number().int().min(0),
  questionType: z.enum(['rating', 'text', 'multiple_choice', 'yes_no']),
  questionText: z.string().min(1),
  options: z.array(z.unknown()).optional(),
  isRequired: z.boolean().optional(),
  condition: z.record(z.unknown()).optional(),
});

const StartResponseSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().min(5),
  metadata: z.record(z.unknown()).optional(),
});

const SubmitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.unknown(),
});

export class SurveyController {
  // ── Surveys ───────────────────────────────────────────────────────
  static async createSurvey(req: AuthRequest, res: Response) {
    try {
      const d = CreateSurveySchema.parse(req.body);
      const survey = await SurveyService.createSurvey(req.tenantId!, d.productId, {
        title: d.title, description: d.description, metadata: d.metadata,
      });
      res.status(201).json({ success: true, survey });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('createSurvey failed', err);
      res.status(500).json({ error: 'Failed to create survey' });
    }
  }

  static async listSurveys(req: AuthRequest, res: Response) {
    try {
      const result = await SurveyService.listSurveys(req.tenantId!, {
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listSurveys failed', err);
      res.status(500).json({ error: 'Failed to list surveys' });
    }
  }

  static async getSurvey(req: AuthRequest, res: Response) {
    try {
      const survey = await SurveyService.getSurvey(req.params.id);
      if (!survey) return res.status(404).json({ error: 'Survey not found' });
      const questions = await SurveyService.listQuestions(survey.id);
      res.json({ success: true, survey, questions });
    } catch (err) {
      log.error('getSurvey failed', err);
      res.status(500).json({ error: 'Failed to get survey' });
    }
  }

  static async updateSurvey(req: AuthRequest, res: Response) {
    try {
      const d = UpdateSurveySchema.parse(req.body);
      const survey = await SurveyService.updateSurvey(req.params.id, d);
      if (!survey) return res.status(404).json({ error: 'Survey not found' });
      res.json({ success: true, survey });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('updateSurvey failed', err);
      res.status(500).json({ error: 'Failed to update survey' });
    }
  }

  static async deleteSurvey(req: AuthRequest, res: Response) {
    try {
      const ok = await SurveyService.deleteSurvey(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Survey not found' });
      res.json({ success: true });
    } catch (err) {
      log.error('deleteSurvey failed', err);
      res.status(500).json({ error: 'Failed to delete survey' });
    }
  }

  // ── Questions ─────────────────────────────────────────────────────
  static async upsertQuestion(req: AuthRequest, res: Response) {
    try {
      const d = UpsertQuestionSchema.parse(req.body);
      const q = await SurveyService.upsertQuestion(req.params.id, {
        question_order: d.questionOrder, question_type: d.questionType,
        question_text: d.questionText, options: d.options,
        is_required: d.isRequired, condition: d.condition,
      });
      res.json({ success: true, question: q });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('upsertQuestion failed', err);
      res.status(500).json({ error: 'Failed to upsert question' });
    }
  }

  static async listQuestions(req: AuthRequest, res: Response) {
    try {
      const questions = await SurveyService.listQuestions(req.params.id);
      res.json({ success: true, questions });
    } catch (err) {
      log.error('listQuestions failed', err);
      res.status(500).json({ error: 'Failed to list questions' });
    }
  }

  static async deleteQuestion(req: AuthRequest, res: Response) {
    try {
      const ok = await SurveyService.deleteQuestion(req.params.questionId);
      if (!ok) return res.status(404).json({ error: 'Question not found' });
      res.json({ success: true });
    } catch (err) {
      log.error('deleteQuestion failed', err);
      res.status(500).json({ error: 'Failed to delete question' });
    }
  }

  // ── Responses ─────────────────────────────────────────────────────
  static async startResponse(req: AuthRequest, res: Response) {
    try {
      const d = StartResponseSchema.parse(req.body);
      const response = await SurveyService.startResponse(req.params.id, req.tenantId!, {
        customer_name: d.customerName, customer_phone: d.customerPhone,
        metadata: d.metadata,
      });
      res.status(201).json({ success: true, response });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('startResponse failed', err);
      res.status(500).json({ error: 'Failed to start response' });
    }
  }

  static async submitAnswer(req: AuthRequest, res: Response) {
    try {
      const d = SubmitAnswerSchema.parse(req.body);
      const response = await SurveyService.submitAnswer(req.params.responseId, d.questionId, d.answer);
      if (!response) return res.status(404).json({ error: 'Response not found' });
      res.json({ success: true, response });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('submitAnswer failed', err);
      res.status(500).json({ error: 'Failed to submit answer' });
    }
  }

  static async completeResponse(req: AuthRequest, res: Response) {
    try {
      const { sentiment } = z.object({ sentiment: z.enum(['positive', 'neutral', 'negative']).optional() }).parse(req.body);
      const response = await SurveyService.completeResponse(req.params.responseId, sentiment);
      if (!response) return res.status(404).json({ error: 'Response not found' });
      res.json({ success: true, response });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
      log.error('completeResponse failed', err);
      res.status(500).json({ error: 'Failed to complete response' });
    }
  }

  static async listResponses(req: AuthRequest, res: Response) {
    try {
      const result = await SurveyService.listResponses(req.params.id, {
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      log.error('listResponses failed', err);
      res.status(500).json({ error: 'Failed to list responses' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await SurveyService.getStats(req.tenantId!);
      res.json({ success: true, stats });
    } catch (err) {
      log.error('getStats failed', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  }
}
