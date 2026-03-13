import express from 'express';
import { authenticate, isInternal } from '../middleware/auth.middleware.js';
import * as usersController from '../controllers/users.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users with pagination and filtering
 *     tags: [Users]
 */
router.get('/users', authenticate, isInternal, usersController.getAllUsers);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 */
router.post('/users', authenticate, isInternal, usersController.createUser);

/**
 * @swagger
 * /api/users/roles:
 *   get:
 *     summary: Get all available roles
 *     tags: [Users]
 */
router.get('/users/roles', authenticate, usersController.getRoles);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user details by ID
 *     tags: [Users]
 */
router.get('/users/:id', authenticate, usersController.getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user information
 *     tags: [Users]
 */
router.put('/users/:id', authenticate, isInternal, usersController.updateUser);

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Update user status - Close/Open user account
 *     tags: [Users]
 */
router.patch('/users/:id/status', authenticate, isInternal, usersController.updateUserStatus);


export default router;