import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as svc from '../services/logisticsCenter.service';

const isObjectId = (id: string) => mongoose.isValidObjectId(id);

/** CREATE */
export async function create(req: Request, res: Response) {
  const { logisticName, address, employeeIds, deliveryHistory } = req.body;

  if (!logisticName || !address?.name) {
    res.status(400).json({ message: 'logisticName and address.name are required' });
    return;
  }
  // basic shape check for geo if provided
  if (address.geo) {
    const ok = address.geo.type === 'Point'
      && Array.isArray(address.geo.coordinates)
      && address.geo.coordinates.length === 2
      && address.geo.coordinates.every((n: any) => Number.isFinite(n));
    if (!ok) {
      res.status(400).json({ message: 'address.geo must be { type:"Point", coordinates:[lng,lat] }' });
      return;
    }
  }

  const doc = await svc.createLogisticsCenter({
    logisticName,
    address,
    employeeIds,
    deliveryHistory,
  });

  res.status(201).json(doc);
}

/** GET BY ID */
export async function getById(req: Request, res: Response) {
  const { id } = req.params;
  if (!isObjectId(id)) {
    res.status(400).json({ message: 'Invalid id' });
    return;
  }

  const doc = await svc.getLogisticsCenterById(id, {
    populate: req.query.populate === 'true',
    select: (req.query.select as string) || undefined,
  });

  if (!doc) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  res.json(doc);
}

/** LIST / QUERY */
export async function list(req: Request, res: Response) {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 200);

  const filter = {
    search: (req.query.search as string) || undefined,
    employeeId: (req.query.employeeId as string) || undefined,
    active: typeof req.query.active === 'string' ? req.query.active === 'true' : undefined,
    nearLng: req.query.nearLng != null ? Number(req.query.nearLng) : undefined,
    nearLat: req.query.nearLat != null ? Number(req.query.nearLat) : undefined,
    maxMeters: req.query.maxMeters != null ? Number(req.query.maxMeters) : undefined,
  };

  const data = await svc.queryLogisticsCenters(filter, {
    page,
    limit,
    sort: (req.query.sort as string) || '-createdAt',
    select: (req.query.select as string) || undefined,
    populate: req.query.populate === 'true',
  });

  res.json(data);
}

/** UPDATE */
export async function update(req: Request, res: Response) {
  const { id } = req.params;
  if (!isObjectId(id)) {
    res.status(400).json({ message: 'Invalid id' });
    return;
  }

  const body = req.body;

  if (body.address?.geo) {
    const ok = body.address.geo.type === 'Point'
      && Array.isArray(body.address.geo.coordinates)
      && body.address.geo.coordinates.length === 2
      && body.address.geo.coordinates.every((n: any) => Number.isFinite(n));
    if (!ok) {
      res.status(400).json({ message: 'address.geo must be { type:"Point", coordinates:[lng,lat] }' });
      return;
    }
  }

  const doc = await svc.updateLogisticsCenterById(id, body, {
    newDoc: true,
    populate: req.query.populate === 'true',
    select: (req.query.select as string) || undefined,
  });

  if (!doc) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  res.json(doc);
}

/** DELETE */
export async function remove(req: Request, res: Response) {
  const { id } = req.params;
  if (!isObjectId(id)) {
    res.status(400).json({ message: 'Invalid id' });
    return;
  }
  await svc.deleteLogisticsCenterById(id);
  res.status(204).send();
}

/** DOMAIN — keep your existing employee/history endpoints if you still want them */

// add employee
export async function addEmployee(req: Request, res: Response) {
  res.status(501).json({ message: 'Deprecated: manage employees via update() employeeIds' });
}
// remove employee
export async function removeEmployee(req: Request, res: Response) {
  res.status(501).json({ message: 'Deprecated: manage employees via update() employeeIds' });
}
// append delivery history entry
export async function addDeliveryHistory(req: Request, res: Response) {
  const { id } = req.params;
  if (!isObjectId(id)) { res.status(400).json({ message: 'Invalid id' }); return; }
  const { entry, by } = req.body as { entry?: string; by?: string };
  if (!entry) { res.status(400).json({ message: 'entry is required' }); return; }

  const update = { $push: { deliveryHistory: { message: entry, at: new Date(), by: by && isObjectId(by) ? new mongoose.Types.ObjectId(by) : null } } };
  const doc = await (await import('../models/logisticsCenter.model')).default
    .findByIdAndUpdate(id, update, { new: true }).lean().exec();
  if (!doc) { res.status(404).json({ message: 'Not found' }); return; }
  res.json(doc);
}


export async function listDeliverers(req: Request, res: Response) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

  const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "20", 10), 1), 200);
  const sort = (req.query.sort as string) || "-createdAt";

  const data = await svc.listDeliverersForCenter(id, { page, limit, sort });
  res.json(data);
}

export async function assignDeliverer(req: Request, res: Response) {
  const { id, delivererId } = req.params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(delivererId)) {
    return res.status(400).json({ message: "Invalid id(s)" });
  }
  const result = await svc.assignCenterDeliverer(id, delivererId);
  res.json(result);
}

export async function unassignDeliverer(req: Request, res: Response) {
  const { id, delivererId } = req.params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(delivererId)) {
    return res.status(400).json({ message: "Invalid id(s)" });
  }
  const result = await svc.unassignCenterDeliverer(id, delivererId);
  res.json(result);
}