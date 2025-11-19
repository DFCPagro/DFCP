import { Request, Response, NextFunction } from "express";
import * as svc from "../services/deliverer.service";
import ApiError from "../utils/ApiError";

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const doc = await svc.createDeliverer(req.body);
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await svc.getDelivererById(req.params.id);
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // @ts-ignore injected by authenticate middleware
    const user = req.user;
    if (!user) throw new ApiError(401, "Unauthorized");
    const doc = await svc.getDelivererByUserId(user._id.toString());
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await svc.listDeliverers({
      page: req.query.page ? +req.query.page : undefined,
      limit: req.query.limit ? +req.query.limit : undefined,
      sort: req.query.sort as string,
      user: req.query.user as string,
      logisticCenterId: req.query.logisticCenterId as string,
      currentMonth: req.query.currentMonth
        ? +req.query.currentMonth
        : undefined,
      hasVehicleInsurance:
        typeof req.query.hasVehicleInsurance !== "undefined"
          ? req.query.hasVehicleInsurance === "true" ||
            req.query.hasVehicleInsurance === "1"
          : undefined,
      licenseType: req.query.licenseType as string,
      search: req.query.search as string,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const update = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const doc = await svc.updateDeliverer(req.params.id, req.body);
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await svc.deleteDeliverer(req.params.id);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const listMyCenters = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // @ts-ignore
    const user = req.user;
    if (!user) throw new ApiError(401, "Unauthorized");

    const d = await svc.getDelivererByUserId(user._id.toString());
    const centers = await svc.listCentersForDeliverer(d._id.toString());
    res.json({ delivererId: d._id, centers });
  } catch (e) {
    next(e);
  }
};

export const listCenters = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const centers = await svc.listCentersForDeliverer(req.params.id);
    res.json(centers);
  } catch (e) {
    next(e);
  }
};

export const assignCenter = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const doc = await svc.assignDelivererToCenter(
      req.params.id,
      req.params.centerId
    );
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

export const unassignCenter = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const doc = await svc.unassignDelivererFromCenter(
      req.params.id,
      req.params.centerId
    );
    res.json(doc);
  } catch (e) {
    next(e);
  }
};
