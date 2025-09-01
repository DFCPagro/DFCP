import { Router } from 'express';
import { createAggregation, listAggregations, getAggregationByToken } from '../controllers/aggregations.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// Authenticated farmer endpoints
router.post('/', authenticate, authorize('farmer'), createAggregation);
router.get('/', authenticate, authorize('farmer'), listAggregations);

// Public access via token
router.get('/:token', getAggregationByToken);

export default router;