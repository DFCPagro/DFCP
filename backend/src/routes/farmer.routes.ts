import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth";
import {
getFarmerBio,
} from "@/controllers/farmer.controller";

const router = Router();

// All cart endpoints are user-specific; require auth.
router.get("/bio/:farmerUserId",authenticate,getFarmerBio);

//For community ? admin gets all but what will customers see?
//roueter.get("/profile/:farmerUserId",authenticate,)

export default router;
