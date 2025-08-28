import { Router } from 'express';
import authRoutes from './auth.route';
import orderRoutes from './orders.route'

const router = Router();
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);

export default router;
