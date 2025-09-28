import { Router } from "express";
import * as ctrl from "../controllers/farmerOrder.controller";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

// Create
router.post("/", authenticate, authorize("fManager","admin"), ctrl.create);


// Farmer updates status (or manager/admin)
router.patch("/:id/farmer-status",authenticate,authorize("farmer", "fManager", "admin"),ctrl.updateFarmerStatus
);

// Admin/fManager update stage statuses
//they can override the status stage and the stages are updated based on the functions we call and by the stage theyre at 
router.patch("/:id/stage",authenticate,authorize("fManager", "admin"),ctrl.updateStageStatus);




export default router;