// src/app/directMessages/directMessages.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../common/middleware/auth.middleware';
import { validateRequest } from '../validators/validation.middleware';
import {
  sendDirectMessageSchema,
  userIdParamSchema,
  conversationQuerySchema
} from '../validators/schemas/directMessage.schemas';
import {
  getConversations,
  getMessages,
  sendMessage,
} from './directMessages.controller';

const router = Router();

// All DM routes require authentication
router.use(authMiddleware);

// Get all conversations for the authenticated user
router.get('/conversations',
  validateRequest(conversationQuerySchema, 'query'),
  getConversations
);

// Get messages in a conversation with another user
router.get('/:otherUserId',
  validateRequest(userIdParamSchema, 'params'),
  getMessages
);

// Send a message to another user
router.post('/:otherUserId',
  validateRequest(userIdParamSchema, 'params'),
  validateRequest(sendDirectMessageSchema, 'body'),
  sendMessage
);

export default router;
