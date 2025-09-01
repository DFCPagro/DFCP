import { Router } from 'express';
import { createContainer, listContainers, getContainerByBarcode } from '../controllers/containers.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// Farmer endpoints
router.post('/', authenticate, authorize('farmer'), createContainer);
router.get('/', authenticate, authorize('farmer'), listContainers);

// Public lookup by barcode (no auth)
router.get('/:barcode', getContainerByBarcode);

export default router;