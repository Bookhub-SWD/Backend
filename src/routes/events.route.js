import express from 'express';
import {
  getEvents,
  getEventDetail,
  createEvent,
  updateEvent,
  deleteEvent,
  checkInEvent,
  rejectRegistration,
  registerEvent,
  cancelRegistration,
  getMyRegistration,
  getMyRegistrations,
  getRegistrationByCode,
} from '../controllers/events.controller.js';
import { authenticate, isInternal, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// ─── IMPORTANT: Static routes MUST come before dynamic /:id routes ────────────

// Public — static
router.get('/events', getEvents);

// Authenticated User — static (BEFORE /:id to avoid collision)
router.get('/events/my-registrations', authenticate, getMyRegistrations);

// Admin/Librarian — static actions (BEFORE /:id)
router.post('/events/check-in', authenticate, isInternal, checkInEvent);
router.post('/events/reject', authenticate, isInternal, rejectRegistration);
router.get('/events/registrations/check-code/:code', authenticate, isInternal, getRegistrationByCode);

// Admin/Librarian — CRUD with dynamic :id
router.post('/events', authenticate, isInternal, createEvent);
router.put('/events/:id', authenticate, isInternal, updateEvent);
router.delete('/events/:id', authenticate, isInternal, deleteEvent);

// Public — dynamic
router.get('/events/:id', getEventDetail);

// Authenticated User — dynamic :id
router.post('/events/:id/register', authenticate, registerEvent);
router.delete('/events/:id/register', authenticate, cancelRegistration);
router.get('/events/:id/my-registration', authenticate, getMyRegistration);

export default router;
