import { Router } from 'express';
import { SurveyController } from './survey.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

// Surveys
router.post('/', authenticate, SurveyController.createSurvey as never);
router.get('/', authenticate, SurveyController.listSurveys as never);
router.get('/stats', authenticate, SurveyController.getStats as never);
router.get('/:id', authenticate, SurveyController.getSurvey as never);
router.patch('/:id', authenticate, SurveyController.updateSurvey as never);
router.delete('/:id', authenticate, SurveyController.deleteSurvey as never);

// Questions
router.put('/:id/questions', authenticate, SurveyController.upsertQuestion as never);
router.get('/:id/questions', authenticate, SurveyController.listQuestions as never);
router.delete('/:id/questions/:questionId', authenticate, SurveyController.deleteQuestion as never);

// Responses
router.post('/:id/responses', authenticate, SurveyController.startResponse as never);
router.get('/:id/responses', authenticate, SurveyController.listResponses as never);
router.post('/responses/:responseId/answer', authenticate, SurveyController.submitAnswer as never);
router.post('/responses/:responseId/complete', authenticate, SurveyController.completeResponse as never);

export default router;
