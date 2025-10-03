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


const router = Router();

/**
 * @route   GET /items
 * Public route, but if a valid Bearer token of admin/fManager is present,
 * controllers will detect req.user and return full item data.
 */
router.get("/", authenticateIfPresent, listItemsHandler);

/**
 * @route   POST /items (protected)
 */
router.post("/", authenticate, authorize("admin", "fManager"), createItemHandler);

/**
 * @route   GET /items/:itemId
 * Public route, same optional auth behavior.
 */
router.get("/:itemId", authenticateIfPresent, getItemHandler);

/**
 * @route   PATCH /items/:itemId (protected)
 */
router.patch("/:itemId", authenticate, authorize("admin", "fManager"), patchItemHandler);

/**
 * @route   PUT /items/:itemId (protected)
 */
router.put("/:itemId", authenticate, authorize("admin", "fManager"), putItemHandler);

/**
 * @route   DELETE /items/:itemId (protected)
 */
router.delete("/:itemId", authenticate, authorize("admin"), deleteItemHandler);


//for market page
router.get("/benefits/:itemId",authenticate,getItemBenefits);
router.get("/marketItemPage/:itemId/:farmerUserId",authenticate, marketItemPage);

export default router;
