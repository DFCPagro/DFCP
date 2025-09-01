import { Types } from 'mongoose';
import Shipment from '../models/shipment.model';
import Container from '../models/container.model';
import QrToken from '../models/QrToken.model';
import { randToken } from '../utils/crypto';
import { BadRequestError, NotFoundError, ConflictError, GoneError } from './order.service';
import { withOptionalTxn } from '../utils/txn';
import { PUBLIC_APP_URL } from '../config/env';

export type ShipmentView = {
  id: string;
  status: string;
  containers: Array<{ id: string; barcode: string; produceType: string; quantity: number; scanned: boolean }>;
  arrivalToken?: string;
  arrivalUrl?: string;
  arrivalUsedAt?: Date;
  arrivalExpiresAt?: Date;
};

export const ShipmentService = {
  /** List shipments assigned to a driver with container scan state. */
  async listByDriver(driverId: string): Promise<ShipmentView[]> {
    const shipments = await Shipment.find({ driverId: new Types.ObjectId(driverId) }).lean();
    const out: ShipmentView[] = [];
    for (const s of shipments) {
      const containers = await Container.find({ _id: { $in: s.containers || [] } }).lean();
      out.push({
        id: String(s._id),
        status: s.status ?? 'planned',
        containers: containers.map((c) => ({
          id: String(c._id),
          barcode: c.barcode || '',
          produceType: c.produceType,
          quantity: c.quantity,
          scanned: !!c.scannedAt,
        })),
        arrivalToken: s.arrivalToken,
        arrivalUsedAt: s.arrivalUsedAt,
        arrivalExpiresAt: s.arrivalExpiresAt,
        arrivalUrl: s.arrivalToken ? `${PUBLIC_APP_URL}/a/${s.arrivalToken}` : undefined,
      });
    }
    return out;
  },

  /** Mark a container as scanned by a driver if it belongs to the shipment. Idempotent. */
  async scanContainer(driverId: string, shipmentId: string, barcode: string) {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) throw new NotFoundError('Shipment not found');
    if (!shipment.containers || shipment.containers.length === 0) {
      throw new BadRequestError('Shipment has no containers');
    }
    if (!shipment.driverId || String(shipment.driverId) !== driverId) {
      throw new ConflictError('Not assigned to this driver');
    }

    const container = await Container.findOne({ barcode });
    if (!container) throw new NotFoundError('Container not found');
    // ensure container belongs to shipment
    if (!shipment.containers.some((id) => String(id) === String(container._id))) {
      throw new ConflictError('Container does not belong to this shipment');
    }
    // idempotent: if already scanned, return current state
    if (!container.scannedAt) {
      container.scannedBy = new Types.ObjectId(driverId);
      container.scannedAt = new Date();
      await container.save();
    }
    // compute progress
    const total = shipment.containers.length;
    const scannedCount = await Container.countDocuments({ _id: { $in: shipment.containers }, scannedAt: { $exists: true, $ne: null } });
    return { total, scanned: scannedCount };
  },

  /** Mint a new arrival token for a shipment. Typically done when shipment is dispatched. */
  async createArrivalToken(shipmentId: string, ttlDays = 1) {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) throw new NotFoundError('Shipment not found');
    const token = randToken();
    const expiresAt = new Date(Date.now() + ttlDays * 86400_000);
    // save to shipment and create QR token
    shipment.arrivalToken = token;
    shipment.arrivalExpiresAt = expiresAt;
    shipment.arrivalUsedAt = undefined;
    await shipment.save();
    await QrToken.create({ shipment: shipment._id, purpose: 'arrival', token, expiresAt });
    const url = `${PUBLIC_APP_URL}/a/${token}`;
    return { token, url, expiresAt };
  },

  /** Confirm arrival via token. Marks shipment as arrived and consumes token. */
  async confirmArrivalByToken(token: string) {
    return withOptionalTxn(async (session) => {
      const qr = await QrToken.findOne({ token, purpose: 'arrival' }).session(session || null);
      if (!qr) throw new NotFoundError('Invalid arrival code');
      if (qr.expiresAt && qr.expiresAt < new Date()) throw new GoneError('Arrival code expired');
      if (qr.usedAt) throw new ConflictError('Arrival already confirmed');
      const shipment = await Shipment.findById(qr.shipment).session(session || null);
      if (!shipment) throw new NotFoundError('Shipment not found');
      // update shipment arrival time
      shipment.arrivalTime = new Date();
      shipment.arrivalUsedAt = new Date();
      await shipment.save(session ? { session } : {});
      // mark token used
      qr.usedAt = new Date();
      await qr.save(session ? { session } : {});
      return { ok: true, shipmentId: String(shipment._id), arrivalTime: shipment.arrivalTime };
    });
  },
};