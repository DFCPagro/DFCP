import { Router } from 'express';
import authRoutes from './auth.route';
import orderRoutes from './orders.route';
import aggregationsRoutes from './aggregations.route';
import containersRoutes from './containers.route';
import shipmentsRoutes from './shipments.route';
import jobApplicationRouter from "./jobApplication.route";

const router = Router();
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/aggregations', aggregationsRoutes);
router.use('/containers', containersRoutes);
router.use('/shipments', shipmentsRoutes);
router.use("/api/job-applications", jobApplicationRouter);
export default router;
