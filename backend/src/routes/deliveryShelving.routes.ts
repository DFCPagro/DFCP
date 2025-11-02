// routes/deliveryShelving.routes.ts
import { Router } from "express";
import * as ctrl from "../controllers/deliveryShelving.controller";

const r = Router();

// POST /delivery-shelving/stage
r.post("/stage", ctrl.stageOrder);

// POST /delivery-shelving/unstage
r.post("/unstage", ctrl.unstagePackage);

// POST /delivery-shelving/move
r.post("/move", ctrl.moveStagedPackage);

export default r;
