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
import userRoutes from './user.route';
import cartRoutes from './cart.routes';
import configRoutes from './config.routes';
import farmerOrderRoutes from './farmerOrder.route';
import PackageSizeRoute from './packageSize.route';
import ItemPackingRoute from './ItemPacking.route';
import farmerRoute from './farmer.routes';

const router = Router();
router.use('/auth', authRoutes);
router.use('/logistics-centers', logisticsCenterRouter);
router.use('/items', itemRoutes);
router.use('/orders', orderRoutes);
router.use("/jobApp", jobApplicationRouter);
router.use('/market', marketRoutes);
router.use('/deliverers', delivererRoutes);
router.use('/carts', cartRoutes);
router.use('/config', configRoutes);
router.use('/farmer-orders', farmerOrderRoutes);
router.use('/package-sizes', PackageSizeRoute);
router.use('/item-packing', ItemPackingRoute);
router.use('/farmer',farmerRoute);

// router.use(centerMapRoutes);
router.use('/shifts',shiftRoutes);
router.use('/users', userRoutes);
export default router;
