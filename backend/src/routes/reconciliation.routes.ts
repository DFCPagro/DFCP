import { Router } from "express";
import { reconcileContainer } from "../controllers/reconciliation.controller";

const router = Router();

// POST /containers/:id/reconcile
router.post("/:id/reconcile", reconcileContainer);

export default router;
