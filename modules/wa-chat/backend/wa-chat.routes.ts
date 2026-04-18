import { Router } from 'express';
import { WaChatController } from './wa-chat.controller';
import { authenticate } from '../../../packages/utils/src/auth.middleware';

const router = Router();

// ── Public webhook endpoints (no auth – Meta needs direct access) ──
router.get('/webhook', WaChatController.verifyWebhook);
router.post('/webhook', WaChatController.receiveWebhook);

// ── Authenticated endpoints ──
router.use(authenticate);

// Credentials
router.get('/credentials', WaChatController.getCredentials);
router.post('/credentials', WaChatController.saveCredentials);
router.post('/credentials/verify', WaChatController.verifyCredentials);
router.delete('/credentials', WaChatController.deleteCredentials);

// Conversations
router.get('/conversations', WaChatController.listConversations);
router.get('/conversations/:id', WaChatController.getConversation);
router.post('/conversations/:id/read', WaChatController.markConversationRead);
router.post('/conversations/:id/archive', WaChatController.archiveConversation);
router.post('/conversations/:id/pin', WaChatController.pinConversation);

// Messages
router.get('/conversations/:id/messages', WaChatController.listMessages);
router.get('/conversations/:id/window-status', WaChatController.getWindowStatus);
router.post('/conversations/:id/send', WaChatController.sendText);
router.post('/conversations/:id/send-media', WaChatController.sendMedia);

// Contacts
router.get('/contacts', WaChatController.listContacts);

// Test endpoint
router.post('/test', WaChatController.sendTestMessage);

export default router;
