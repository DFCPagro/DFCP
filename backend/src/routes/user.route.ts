import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import {
  getMyAddresses,
  postNewAddress,
  getMyName,
  getMyContact,
  patchMyContact,
  getContactInfoById,
  deleteMyAddress,
} from "../controllers/user.controller";

const router = Router();

router.get("/addresses", authenticate, getMyAddresses);
router.post("/addresses", authenticate, postNewAddress);
router.get("/name", authenticate, getMyName);
router.get("/contact", authenticate, getMyContact);
router.patch("/contact", authenticate, patchMyContact);

router.get("/contact-info/:id", authenticate, getContactInfoById);
// routes/user.routes.ts
router.delete("/addresses", authenticate, deleteMyAddress);

export default router;
