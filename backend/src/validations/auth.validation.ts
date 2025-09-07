import { body } from 'express-validator';
import { roles } from '../utils/constants';

export const register = [
  body("name").trim().notEmpty().withMessage("name required"),
  body("email").isEmail().normalizeEmail().withMessage("valid email required"),
  body("password").isLength({ min: 6 }).withMessage("password min length 6"),
  body("role")
    .optional()
    .isIn(roles) // ✅ uses ["admin", "customer", "staff"] or whatever you defined
    .withMessage("invalid role"),
];
export const login = [
  body('email').isEmail().normalizeEmail().withMessage('valid email required'),
  body('password').isString().notEmpty().withMessage('password required'),
];
