import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import validate from '../utils/validate';
import * as v from '../validations/auth.validation';

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
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               phone: { type: string }
 *               birthday: { type: string, format: date }
 *     responses:
 *       '201': { description: Created }
 *       '400': { description: Validation error }
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
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     email: { type: string, format: email }
 *                     role: { type: string }
 *             examples:
 *               success:
 *                 value:
 *                   accessToken: eyJhbGciOi... (jwt)
 *                   refreshToken: eyJhbGciOi... (jwt)
 *                   user:
 *                     id: 64fa1b2c3d4e5f6789012345
 *                     name: Admin User
 *                     email: admin@gmail.com
 *                     role: admin
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Invalid credentials
 */
router.post('/login', v.login, validate, ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);

export default router;
