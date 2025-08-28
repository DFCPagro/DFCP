import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import {
  createOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
  mintQrs,
  getByOpsToken,
  confirmByCustomerToken,
} from '../controllers/orders.controller';

const router = Router();

// Create + mint QR
router.post('/', asyncHandler(createOrder));

// List
router.get('/', asyncHandler(listOrders));

// Details
router.get('/:id', asyncHandler(getOrder));

// Update status
router.patch('/:id/status', asyncHandler(updateOrderStatus));

// (Re)mint QRs
router.post('/:id/qrs', asyncHandler(mintQrs));

// Token endpoints (distinct path so we don’t clash with :id)
router.get('/by-ops-token/:token', asyncHandler(getByOpsToken));
router.post('/confirm/:token', asyncHandler(confirmByCustomerToken));

export default router;
