// src/app/routes/directMessages.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getConversations,
  getMessages,
  sendMessage,
} from '../controllers/directMessages.controller';

const router = Router();

// All DM routes require authentication
router.use(authMiddleware);

// Get all conversations for the authenticated user
router.get('/conversations', getConversations);

// Get messages in a conversation with another user
router.get('/:otherUserId', getMessages);

// Send a message to another user
router.post('/:otherUserId', sendMessage);

export default router;
