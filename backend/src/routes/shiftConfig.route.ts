import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import validate from "../utils/validate";
import * as v from "../validations/shiftConfig.validation";
import * as ctrl from "../controllers/shiftConfig.controller";

const router = Router();

/**
 * @swagger
 * /shifts/windows:
 *   get:
 *     summary: Get windows for a specific shift
 *     tags: [ShiftConfig]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: lc
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: name
 *         required: true
 *         schema: { type: string, enum: [morning,afternoon,evening,night] }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 */
router.get("/windows", authenticate, ...v.windowsQuery, validate, ctrl.getShiftWindowsController);

/**
 * @swagger
 * /shifts/windows/all:
 *   get:
 *     summary: List windows for all shifts under a logistic center
 *     tags: [ShiftConfig]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: lc
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 */
router.get("/windows/all", authenticate, ...v.listAllQuery, validate, ctrl.listShiftWindowsByLCController);

export default router;
