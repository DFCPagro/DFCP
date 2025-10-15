// src/routes/farmer.routes.ts
import { Router, type RequestHandler, type Request, type Response, type NextFunction } from "express";
import * as farmerCtrl from "../controllers/farmerOrder.controller";
import * as opsCtrl from "../controllers/ops.controller";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

/** Strictly assert "is a RequestHandler". Throws early with a clear message during dev. */
function mustHandler(fn: unknown, name: string): RequestHandler {
  if (typeof fn !== "function") {
    // eslint-disable-next-line no-console
    console.error(`[farmer.routes] "${name}" is NOT a function. typeof=`, typeof fn, "value:", fn);
    throw new Error(`[farmer.routes] ${name} is not a function`);
  }
  // Cast through unknown -> RequestHandler to satisfy the router overload
  return fn as unknown as RequestHandler;
}

// Middlewares (MUST be RequestHandler)
const authn: RequestHandler = mustHandler(authenticate, "authenticate");
// IMPORTANT: authorize must be INVOKED to return a handler
const authzFM: RequestHandler = mustHandler(authorize("fManager", "admin"), `authorize("fManager","admin")`);
const authzFarmerReads: RequestHandler = mustHandler(
  authorize("farmer", "fManager", "admin"),
  `authorize("farmer","fManager","admin")`
);

// Controllers (your exported handlers take (req,res,next) — treat them as RequestHandler)
const create: RequestHandler = mustHandler(farmerCtrl.create, "farmerCtrl.create");
const updateFarmerStatus: RequestHandler = mustHandler(farmerCtrl.updateFarmerStatus, "farmerCtrl.updateFarmerStatus");
const updateStageStatus: RequestHandler = mustHandler(farmerCtrl.updateStageStatus, "farmerCtrl.updateStageStatus");
const listMyOrders: RequestHandler = mustHandler(opsCtrl.listMyOrders, "opsCtrl.listMyOrders");
const getOrderAndQrs: RequestHandler = mustHandler(opsCtrl.getOrderAndQrs, "opsCtrl.getOrderAndQrs");

// Quick health route to prove this Router is mounted
router.get("/__health", (_req, res) => res.json({ ok: true, route: "farmer.routes.__health" }));

// Writes
router.post("/", authn, authzFM, create);
router.patch("/:id/farmer-status", authn, authzFM, updateFarmerStatus);
router.patch("/:id/stage", authn, authzFM, updateStageStatus);

// Reads
router.get("/", authn, authzFarmerReads, listMyOrders);
router.get("/:id/print", authn, authzFarmerReads, getOrderAndQrs);

export default router;
