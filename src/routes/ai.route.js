import express from 'express';
import * as aiController from '../controllers/ai.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Chat with AI Librarian Assistant
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *               history:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: AI response
 *       500:
 *         description: Server error
 */
router.post('/chat', aiController.chatWithAI);

export default router;
