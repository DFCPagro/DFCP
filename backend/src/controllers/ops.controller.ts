// src/controllers/ops.controller.ts
import { Request, Response, NextFunction } from "express";
import { OpsService } from "../services/ops.service";

/** GET /api/farmer-orders  (read-only listing for farmer/fManager/admin) */
export async function listMyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    // @ts-ignore
    const user = req.user;
    const data = await OpsService.listMyOrders(user._id);
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /api/farmer-orders/:id/print  (order + orderQR + containerQrs) */
export async function getOrderAndQrs(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;
    const payload = await OpsService.ensureOrderPrintPayload({ orderId: id, userId: user._id });
    res.json({
      ok: true,
      data: {
        order: payload.order,
        orderQR: {
          token: payload.orderQR.token,
          sig: payload.orderQR.sig,
          scope: payload.orderQR.scope,
        },
        containerQrs: payload.containerQrs,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/industrialDeliverer  (create a delivery run + delivery QR) */
export async function createDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    // @ts-ignore
    const user = req.user;
    const { date, shift, logisticsCenterId, pickupStops } = req.body;
    const out = await OpsService.createDeliveryRun({
      delivererId: user._id,
      date,
      shift,
      logisticsCenterId,
      pickupStops,
    });
    res.status(201).json({ ok: true, data: out });
  } catch (err) {
    next(err);
  }
}

/** POST /api/industrialDeliverer/:farmerDeliveryId/stops/append */
export async function appendContainerToStop(req: Request, res: Response, next: NextFunction) {
  try {
    // @ts-ignore
    const user = req.user;
    const { farmerDeliveryId } = req.params;
    const { stopIndex, containerId, containerQrToken, farmerOrderId, weightKg } = req.body;
    const out = await OpsService.appendContainerScanToStop({
      farmerDeliveryId,
      stopIndex: Number(stopIndex),
      containerId,
      containerQrToken,
      farmerOrderId,
      weightKg,
      userId: user._id,
    });
    res.json({ ok: true, data: out });
  } catch (err) {
    next(err);
  }
}

/** POST /api/scan/:token */
export async function scan(req: Request, res: Response, next: NextFunction) {
  try {
    // @ts-ignore
    const user = req.user;
    const { token } = req.params;
    const { geo } = req.body ?? {};
    const out = await OpsService.scanByToken({ token, user, geo });
    res.json({ ok: true, data: out });
  } catch (err) {
    next(err);
  }
}
