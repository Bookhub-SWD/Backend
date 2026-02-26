import express from 'express';
import { getSubjects, getCategories } from '../controllers/subjects.controller.js';

const router = express.Router();

router.get('/subjects', getSubjects);
router.get('/subjects/categories', getCategories);

export default router;
