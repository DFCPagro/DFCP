// FILE: src/controllers/worldLayout.controller.ts
import { Request, Response, NextFunction } from "express";
import { WorldLayoutService } from "../services/worldLayout.service";

export async function getByCenter(req: Request, res: Response, next: NextFunction) {
  try {
    const centerId = (req.params.centerId as string) || (req.query.centerId as string);
    if (!centerId) return res.status(400).json({ ok: false, message: "centerId is required" });
    const minCellW = req.query.minCellW ? Number(req.query.minCellW) : undefined;
    const minCellH = req.query.minCellH ? Number(req.query.minCellH) : undefined;

    const data = await WorldLayoutService.getOrCreateByCenter({ centerId, minCellW, minCellH });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}
