import express from 'express';
import { getBooks } from '../controllers/books.controller.js';

const router = express.Router();

/**
 * GET /api/books?subject=xxx
 * Query books by subject (partial match on subject code or name).
 * If no subject query param, return all books.
 */
router.get('/books', getBooks);

export default router;
