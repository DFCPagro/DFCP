import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import validate from '../utils/validate';
import * as v from '../validations/auth.validation';

const router = Router();

router.post('/register', v.register, validate, ctrl.register);
router.post('/login', v.login, validate, ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);

export default router;
