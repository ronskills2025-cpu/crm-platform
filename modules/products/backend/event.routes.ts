import { Router } from 'express';
import { EventController } from './event.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

router.post('/', authenticate, EventController.createEvent as never);
router.get('/', authenticate, EventController.listEvents as never);
router.get('/stats', authenticate, EventController.getStats as never);
router.get('/:id', authenticate, EventController.getEvent as never);
router.patch('/:id', authenticate, EventController.updateEvent as never);
router.delete('/:id', authenticate, EventController.deleteEvent as never);

// Registrations
router.post('/:id/registrations', authenticate, EventController.register as never);
router.get('/:id/registrations', authenticate, EventController.listRegistrations as never);
router.patch('/:id/registrations/:regId/status', authenticate, EventController.updateRegistrationStatus as never);

export default router;
