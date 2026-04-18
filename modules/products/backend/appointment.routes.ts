import { Router } from 'express';
import { AppointmentController } from './appointment.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

// Services
router.post('/services', authenticate, AppointmentController.createService as never);
router.get('/services', authenticate, AppointmentController.listServices as never);
router.patch('/services/:id', authenticate, AppointmentController.updateService as never);
router.delete('/services/:id', authenticate, AppointmentController.deleteService as never);

// Slots
router.put('/slots', authenticate, AppointmentController.upsertSlot as never);
router.get('/services/:serviceId/slots', authenticate, AppointmentController.listSlots as never);
router.get('/services/:serviceId/available', authenticate, AppointmentController.getAvailableSlots as never);
router.delete('/slots/:slotId', authenticate, AppointmentController.deleteSlot as never);

// Bookings
router.post('/bookings', authenticate, AppointmentController.createBooking as never);
router.get('/bookings', authenticate, AppointmentController.listBookings as never);
router.get('/bookings/:id', authenticate, AppointmentController.getBooking as never);
router.patch('/bookings/:id/status', authenticate, AppointmentController.updateBookingStatus as never);
router.patch('/bookings/:id/reschedule', authenticate, AppointmentController.reschedule as never);
router.post('/bookings/:id/cancel', authenticate, AppointmentController.cancelBooking as never);

// Stats
router.get('/stats', authenticate, AppointmentController.getStats as never);

export default router;
