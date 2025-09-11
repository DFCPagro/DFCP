import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as svc from '../services/logisticsCenter.service';

const isObjectId = (id: string) => mongoose.isValidObjectId(id);

/** CREATE */
export async function create(req: Request, res: Response) {
  const { logisticName, location, employeeIds, deliveryHistory } = req.body;

  if (!logisticName || !location?.name) {
    res.status(400).json({ message: 'logisticName and location.name are required' });
    return;
  }
  // basic shape check for geo if provided
  if (location.geo) {
    const ok = location.geo.type === 'Point'
      && Array.isArray(location.geo.coordinates)
      && location.geo.coordinates.length === 2
      && location.geo.coordinates.every((n: any) => Number.isFinite(n));
    if (!ok) {
      res.status(400).json({ message: 'location.geo must be { type:"Point", coordinates:[lng,lat] }' });
      return;
    }
  }

  const doc = await svc.createLogisticsCenter({
    logisticName,
    location,
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

  if (body.location?.geo) {
    const ok = body.location.geo.type === 'Point'
      && Array.isArray(body.location.geo.coordinates)
      && body.location.geo.coordinates.length === 2
      && body.location.geo.coordinates.every((n: any) => Number.isFinite(n));
    if (!ok) {
      res.status(400).json({ message: 'location.geo must be { type:"Point", coordinates:[lng,lat] }' });
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
