import { Router } from 'express';
import authRoutes from './auth.route';
import orderRoutes from './orders.route';
import itemRoutes from './items.route'
import jobApplicationRouter from "./jobApplication.route";

const router = Router();
router.use('/auth', authRoutes);
router.use('/items', itemRoutes);
router.use('/orders', orderRoutes);
router.use("/jobApp", jobApplicationRouter);
export default router;
