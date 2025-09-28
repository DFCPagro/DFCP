import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth";
import {
  getActiveCart,
  getCart,
  addItem,
  removeItem,
  clear,
  checkout,
  refreshExpiry,
  wipeShift,
  abandon,
  expireOne,
  reclaimOne,
} from "@/controllers/cart.controller";

const router = Router();

// All cart endpoints are user-specific; require auth.
router.get("/active", authenticate, getActiveCart);
router.get("/:cartId", authenticate, getCart);
router.post("/add", authenticate, addItem);
router.patch("/:cartId/items/:cartItemId", authenticate, removeItem);
router.post("/:cartId/clear", authenticate, clear);
router.post("/:cartId/checkout", authenticate, checkout);
router.post("/:cartId/refresh-expiry", authenticate, refreshExpiry);

// User: abandon their own cart (release + delete)
router.post("/:cartId/abandon", authenticate, abandon);

// Admin: global shift wipe
router.post("/wipe-shift", authenticate, authorize("admin"), wipeShift);

// Admin: force expire & delete a specific cart
router.post("/:cartId/expire", authenticate, authorize("admin"), expireOne);

// Admin: reclaim inventory but keep cart doc (mark expired)
router.post("/:cartId/reclaim", authenticate, authorize("admin"), reclaimOne);

export default router;
