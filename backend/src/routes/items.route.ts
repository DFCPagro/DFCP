import { Router } from "express";
import {
  createItemHandler,
  listItemsHandler,
  getItemHandler,
  patchItemHandler,
  putItemHandler,
  deleteItemHandler,
} from "../controllers/items.controller";
import { authenticate, authorize  } from "../middlewares/auth"; // adjust path if different

const router = Router();

/**
 * @route   GET /items
 * @query   category=fruit|vegetable
 *          type=Apple
 *          variety=Fuji
 *          q=ap  (searches type/variety, case-insensitive)
 *          minCalories=0
 *          maxCalories=120
 *          page=1
 *          limit=20
 *          sort=-updatedAt,type
 */
router.get("/", listItemsHandler);

/**
 * @route   POST /items
 * @body    Partial<Item> (schema validation applied by Mongoose)
 */
router.post("/", authenticate, authorize('admin', 'fManager'), createItemHandler);

/**
 * @route   GET /items/:itemId
 */
router.get("/:itemId", getItemHandler);

/**
 * @route   PATCH /items/:itemId
 * @body    Partial fields to update (uses $set)
 */
router.patch("/:itemId", authenticate, authorize('admin', 'fManager'), patchItemHandler);

/**
 * @route   PUT /items/:itemId
 * @body    Full replacement document (except itemId in path)
 */
router.put("/:itemId", authenticate, authorize('admin', 'fManager'), putItemHandler);

/**
 * @route   DELETE /items/:itemId
 */
router.delete("/:itemId", authenticate, authorize('admin'), deleteItemHandler);

export default router;
