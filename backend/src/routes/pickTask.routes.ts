import { Router } from "express";
import { suggestTask, startTask, completeTask } from "../controllers/pickTask.controller";

const router = Router();

router.get("/_suggest", suggestTask);
router.post("/:id/start", startTask);
router.post("/:id/complete", completeTask);

export default router;
