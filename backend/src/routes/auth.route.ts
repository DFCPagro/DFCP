import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import validate from '../utils/validate';
import * as v from '../validations/auth.validation';
import { authenticate } from "../middlewares/auth";

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, address]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               phone: { type: string }
 *               birthday: { type: string, format: date }
 *               address:
 *                 type: object
 *                 required: [lnt, alt, address]
 *                 properties:
 *                   lnt: { type: number, example: 32.05 }
 *                   alt: { type: number, example: 34.77 }
 *                   address: { type: string, example: "Tel Aviv, Israel" }
 *     responses:
 *       '201':
 *         description: User registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *       '400':
 *         description: Validation error (missing or invalid fields)
 *       '409':
 *         description: Email already registered
 */
router.post('/register', v.register, validate, ctrl.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *           examples:
 *             basicLogin:
 *               value:
 *                 email: admin@gmail.com
 *                 password: admin123
 *     responses:
 *       '200':
 *         description: Authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name: { type: string }
 *                 role: { type: string }
 *                 accessToken: { type: string }
 *                 refreshToken: { type: string }
 *             examples:
 *               success:
 *                 value:
 *                   name: "Admin User"
 *                   role: "admin"
 *                   accessToken: "eyJhbGciOi... (jwt)"
 *                   refreshToken: "eyJhbGciOi... (jwt)"
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Invalid credentials
 */
router.post('/login', v.login, validate, ctrl.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token using refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       '200':
 *         description: New tokens issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     access: { type: string }
 *                     refresh: { type: string }
 *             examples:
 *               success:
 *                 value:
 *                   tokens:
 *                     access: "eyJhbGciOi... (jwt)"
 *                     refresh: "eyJhbGciOi... (jwt)"
 *       '401': { description: Invalid or missing refresh token }
 */
router.post('/refresh', ctrl.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out and revoke refresh token
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       '200':
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Logged out" }
 */
router.post('/logout', ctrl.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 uid: { type: string }
 *                 email: { type: string, format: email }
 *                 name: { type: string }
 *                 role: { type: string }
 *                 activeStatus: { type: boolean }
 *                 phone: { type: string }
 *                 birthday: { type: string, format: date }
 *                 address:
 *                   type: object
 *                   properties:
 *                     lnt: { type: number }
 *                     alt: { type: number }
 *                     address: { type: string }
 *                 createdAt: { type: string, format: date-time }
 *                 updatedAt: { type: string, format: date-time }
 *       '401': { description: Unauthorized }
 */
router.get("/me", authenticate, ctrl.me);

export default router;
