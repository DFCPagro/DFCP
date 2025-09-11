import { Router } from "express";
import {
  createItemHandler,
  listItemsHandler,
  getItemHandler,
  patchItemHandler,
  putItemHandler,
  deleteItemHandler,
} from "../controllers/items.controller";

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
 * @body    Partial<IItem> (schema validation applied by Mongoose)
 */
router.post("/", createItemHandler);

/**
 * @route   GET /items/:itemId
 */
router.get("/:itemId", getItemHandler);

/**
 * @route   PATCH /items/:itemId
 * @body    Partial fields to update (uses $set)
 */
router.patch("/:itemId", patchItemHandler);

/**
 * @route   PUT /items/:itemId
 * @body    Full replacement document (except itemId in path)
 */
router.put("/:itemId", putItemHandler);

/**
 * @route   DELETE /items/:itemId
 */
router.delete("/:itemId", deleteItemHandler);

export default router;
