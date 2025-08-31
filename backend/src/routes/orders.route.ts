import { Router } from 'express';
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
router.post('/', createOrder);

// List
router.get('/', listOrders);

// Details
router.get('/:id', getOrder);

// Update status
router.patch('/:id/status', updateOrderStatus);

// (Re)mint QRs
router.post('/:id/qrs', mintQrs);

// Token endpoints (distinct path so we don’t clash with :id)
router.get('/by-ops-token/:token', getByOpsToken);
router.post('/confirm/:token', confirmByCustomerToken);

export default router;
