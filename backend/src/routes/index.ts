import { Router } from 'express';
import authRoutes from './auth.route';
import orderRoutes from './orders.route';
import itemRoutes from './items.route'
import jobApplicationRouter from "./jobApplication.route";
import logisticsCenterRouter from './logisticsCenter.route';
import centerMapRoutes from './centerMap.routes';
import marketRoutes from './availableMarketStock.routes';
import delivererRoutes from './deliverer.routes';
import shiftRoutes from './shiftConfig.route';

const router = Router();
router.use('/auth', authRoutes);
router.use('/logistics-centers', logisticsCenterRouter);
router.use('/items', itemRoutes);
router.use('/orders', orderRoutes);
// router.use("/jobApp", jobApplicationRouter);
router.use('/market', marketRoutes);
router.use('/deliverers', delivererRoutes);
router.use(centerMapRoutes);
router.use('/shifts',shiftRoutes);
export default router;
