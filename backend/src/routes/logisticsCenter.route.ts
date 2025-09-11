import { Router } from 'express';
import * as ctrl from '../controllers/logisticsCenter.controller';
import { authenticate, authorize } from '../middlewares/auth'; // adjust path if needed

const router = Router();

// Read: any authenticated user
router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);

// Create/Update: managers + admin
router.post('/', authenticate, authorize('dManager', 'opManager', 'admin'), ctrl.create);
router.patch('/:id', authenticate, authorize('dManager', 'opManager', 'admin'), ctrl.update);

// Delete: opManager + admin (or make it admin-only if you prefer)
router.delete('/:id', authenticate, authorize('opManager', 'admin'), ctrl.remove);

// Delivery history: managers + admin
router.post('/:id/delivery-history', authenticate, authorize('dManager', 'opManager', 'admin'), ctrl.addDeliveryHistory);

export default router;
