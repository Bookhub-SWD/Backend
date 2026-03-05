import express from 'express';
import multer from 'multer';
import { scanBarcode, lookupBarcode } from '../controllers/ocr.controller.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/ocr/scan:
 *   post:
 *     summary: Scan an image for barcodes using Cloudmersive
 *     tags: [OCR]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               imageFile:
 *                 type: string
 *                 format: binary
 */
router.post('/scan', upload.single('imageFile'), scanBarcode);

/**
 * @swagger
 * /api/ocr/lookup:
 *   post:
 *     summary: Lookup barcode info (EAN/ISBN)
 *     tags: [OCR]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value:
 *                 type: string
 */
router.post('/lookup', lookupBarcode);

export default router;
