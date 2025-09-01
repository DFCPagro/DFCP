import { Router } from 'express';
import { listMyShipments, scanContainer, mintArrivalToken, confirmArrivalByToken } from '../controllers/shipments.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// Driver endpoints
router.get('/me', authenticate, authorize('driver'), listMyShipments);
router.post('/:id/scan', authenticate, authorize('driver'), scanContainer);

// Mint arrival token (drivers or admins can initiate)
router.post('/:id/arrival-token', authenticate, authorize('driver', 'admin'), mintArrivalToken);

// Public arrival confirmation
router.post('/arrival/:token', confirmArrivalByToken);

export default router;