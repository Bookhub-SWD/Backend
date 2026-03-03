import express from 'express';
import * as paymentsController from '../controllers/payments.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/payments/me:
 *   get:
 *     summary: Get current user's fines
 *     tags: [Payments]
 */
router.get('/payments/me', authenticate, paymentsController.getMyFines);

/**
 * @swagger
 * /api/payments/all:
 *   get:
 *     summary: Get all fines (Admin/Librarian)
 *     tags: [Payments]
 */
router.get('/payments/all', authenticate, paymentsController.getAllFines);

/**
 * @swagger
 * /api/payments/{id}/pay:
 *   post:
 *     summary: Mark a fine as paid
 *     tags: [Payments]
 */
router.post('/payments/:id/pay', authenticate, paymentsController.payFine);

export default router;
