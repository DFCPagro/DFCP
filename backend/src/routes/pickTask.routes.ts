import { Router } from "express";
import { suggestTask, startTask, completeTask } from "../controllers/pickTask.controller";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

// Suggest next task
router.get("/_suggest", authenticate, authorize("picker", "opManager", "admin"), suggestTask);
router.get("/suggest", authenticate, authorize("picker", "opManager", "admin"), suggestTask);

// Start/Complete
router.post("/:id/start", authenticate, authorize("picker", "opManager", "admin"), startTask);
router.post("/:id/complete", authenticate, authorize("picker", "opManager", "admin"), completeTask);

export default router;
