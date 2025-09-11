import { Router, Request, Response, NextFunction } from "express";
import {
  listLocations,
  createLocation,
  getMarketStock,
} from "../controllers/market.controller"; // <-- relative

const router = Router();

router.get("/locations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = await listLocations(req);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

router.post("/locations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = await createLocation(req);
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
});

router.get("/stock", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = await getMarketStock(req);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

export default router;
