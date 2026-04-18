import { Router } from 'express';
import { TemplateController } from './template.controller';
import { authenticate, optionalAuth } from '../../../packages/utils/src/auth.middleware';

const router = Router();

router.post('/', authenticate, TemplateController.create);
router.get('/', optionalAuth, TemplateController.list);
router.get('/:id', optionalAuth, TemplateController.getById);
router.patch('/:id', authenticate, TemplateController.update);
router.delete('/:id', authenticate, TemplateController.delete);
router.post('/:id/submit', authenticate, TemplateController.submitToMeta);

export default router;
