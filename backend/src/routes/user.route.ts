import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import {
  getMyAddresses,
  postNewAddress,
  getMyName,
  getMyContact,
  patchMyContact,
  getContactInfoById,
} from "../controllers/user.controller";

const router = Router();

router.get("/addresses", authenticate, getMyAddresses);
router.post("/addresses", authenticate, postNewAddress);
router.get("/name", authenticate, getMyName);
router.get("/contact", authenticate, getMyContact);
router.patch("/contact", authenticate, patchMyContact);

// NEW: GET /api/user/contact-info (self) or /api/user/contact-info/:id (admins/fManagers/tManagers)
// NEW: privileged can pass :id; others always get self
router.get("/contact-info/:id?", authenticate, getContactInfoById);
export default router;
