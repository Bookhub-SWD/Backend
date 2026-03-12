import express from 'express';
import * as paymentsController from '../controllers/payments.controller.js';
import { authenticate, isInternal } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/payments/me:
 *   get:
 *     summary: Get current user's fines
 *     tags: [Payments]
 */
// User routes
router.get('/payments/me', authenticate, paymentsController.getMyFines);
router.get('/payments/overdue/me', authenticate, paymentsController.getMyOverdueBorrows);

/**
 * @swagger
 * /api/payments/all:
 *   get:
 *     summary: Get all fines (Admin/Librarian)
 *     tags: [Payments]
 */
// Admin/Librarian routes
router.get('/payments/all', authenticate, isInternal, paymentsController.getAllFines);
router.get('/payments/overdue/all', authenticate, isInternal, paymentsController.getAllOverdueBorrows);

/**
 * @swagger
 * /api/payments/stats:
 *   get:
 *     summary: Get fine statistics (Admin/Librarian)
 *     tags: [Payments]
 */
router.get('/payments/stats', authenticate, isInternal, paymentsController.getFineStats);

/**
 * @swagger
 * /api/payments/{id}/pay:
 *   post:
 *     summary: Mark a fine as paid
 *     tags: [Payments]
 */
// Webhook from SePay (No auth needed - must be BEFORE /:id routes to avoid conflict)
router.post('/payments/webhook/sepay', paymentsController.handleSepayWebhook);

// Check status (polling)
router.get('/payments/status/:id', authenticate, paymentsController.checkFineStatus);

router.post('/payments/:id/pay', authenticate, paymentsController.payFine);

export default router;
