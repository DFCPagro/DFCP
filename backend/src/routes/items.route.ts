import { Router } from "express";
import {
  createItemHandler,
  listItemsHandler,
  getItemHandler,
  patchItemHandler,
  putItemHandler,
  deleteItemHandler,
  getItemBenefits,
  marketItemPage,
} from "@/controllers/items.controller";
import { authenticate, authorize, authenticateIfPresent } from "@/middlewares/auth";
import { Types } from "mongoose";

const router = Router();

// Optional: tiny param guard middleware (keeps controllers cleaner)
const requireObjectIdParam = (paramName: string) => (
  req: any, res: any, next: any
) => {
  const id = req.params?.[paramName];
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: `Invalid ${paramName}` });
  }
  next();
};

// Put specific routes BEFORE the catch-all "/:itemId"

// Market helpers (protected)
router.get(
  "/benefits/:itemId",
  authenticate,
  requireObjectIdParam("itemId"),
  getItemBenefits
);

router.get(
  "/marketItemPage/:itemId/:farmerUserId",
  authenticate,
  requireObjectIdParam("itemId"),
  requireObjectIdParam("farmerUserId"),
  marketItemPage
);

// List (public; optional auth)
router.get("/", authenticateIfPresent, listItemsHandler);

// CRUD
router.post("/", authenticate, authorize("admin", "fManager"), createItemHandler);

router.get(
  "/:itemId",
  authenticateIfPresent,
  requireObjectIdParam("itemId"),
  getItemHandler
);

router.patch(
  "/:itemId",
  authenticate,
  authorize("admin", "fManager"),
  requireObjectIdParam("itemId"),
  patchItemHandler
);

router.put(
  "/:itemId",
  authenticate,
  authorize("admin", "fManager"),
  requireObjectIdParam("itemId"),
  putItemHandler
);

router.delete(
  "/:itemId",
  authenticate,
  authorize("admin"),
  requireObjectIdParam("itemId"),
  deleteItemHandler
);

export default router;
