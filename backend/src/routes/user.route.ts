import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";

import {
  getMyAddresses,
  postNewAddress,
  getMyName,
  getMyContact,
  patchMyContact,
} from "../controllers/user.controller";

// If you already have auth, you can enable it here.
// import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// router.use(requireAuth); // optional: keep your current auth wiring

// GET /api/user/addresses
router.get("/addresses", authenticate, getMyAddresses);

// POST /api/user/addresses
router.post("/addresses", authenticate, postNewAddress);

// GET /api/user/name
router.get("/name", authenticate, getMyName);

// GET /api/user/contact
router.get("/contact", authenticate, getMyContact);

// PATCH /api/user/contact
router.patch("/contact", authenticate, patchMyContact);

export default router;
