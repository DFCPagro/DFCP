import { Types } from 'mongoose';
import Container from '../models/container.model';
import Aggregation from '../models/aggregation.model';
import { BadRequestError, NotFoundError } from './order.service';
import generateId from '../utils/generateId';

export type CreateContainerInput = {
  produceType: string;
  quantity: number;
  weight?: number;
  qualityGrade?: string;
  aggregationId?: string;
};

export const ContainerService = {
  /** Create a new container for a farmer. If an aggregationId is provided, link the container. */
  async createContainer(farmerId: string, input: CreateContainerInput) {
    if (!input.produceType) throw new BadRequestError('produceType required');
    if (typeof input.quantity !== 'number' || !(input.quantity > 0)) {
      throw new BadRequestError('quantity must be positive');
    }

    let aggregationRef: Types.ObjectId | undefined;
    if (input.aggregationId) {
      // verify aggregation exists and belongs to farmer
      const agg = await Aggregation.findById(input.aggregationId);
      if (!agg) throw new NotFoundError('Aggregation not found');
      if (String(agg.farmerId) !== String(farmerId)) {
        throw new BadRequestError('Aggregation does not belong to farmer');
      }
      aggregationRef = agg._id;
    }

    const barcode = generateId('c_');
    const container = await Container.create({
      produceType: input.produceType,
      quantity: input.quantity,
      weight: input.weight,
      qualityGrade: input.qualityGrade,
      barcode,
      reportedBy: new Types.ObjectId(farmerId),
      aggregationId: aggregationRef,
    });

    // If container linked to aggregation, push id into aggregation document
    if (aggregationRef) {
      await Aggregation.findByIdAndUpdate(aggregationRef, { $push: { containers: container._id } });
    }

    return {
      id: String(container._id),
      produceType: container.produceType,
      quantity: container.quantity,
      weight: container.weight,
      qualityGrade: container.qualityGrade,
      barcode: container.barcode,
      aggregationId: container.aggregationId ? String(container.aggregationId) : undefined,
    };
  },

  /** Fetch a container by its barcode. */
  async getByBarcode(barcode: string) {
    const c = await Container.findOne({ barcode });
    if (!c) throw new NotFoundError('Container not found');
    return {
      id: String(c._id),
      produceType: c.produceType,
      quantity: c.quantity,
      weight: c.weight,
      qualityGrade: c.qualityGrade,
      barcode: c.barcode,
      scannedBy: c.scannedBy ? String(c.scannedBy) : undefined,
      scannedAt: c.scannedAt,
      aggregationId: c.aggregationId ? String(c.aggregationId) : undefined,
    };
  },

  /** List containers reported by a farmer. */
  async listByFarmer(farmerId: string) {
    const cs = await Container.find({ reportedBy: new Types.ObjectId(farmerId) }).lean();
    return cs.map((c) => ({
      id: String(c._id),
      produceType: c.produceType,
      quantity: c.quantity,
      weight: c.weight,
      qualityGrade: c.qualityGrade,
      barcode: c.barcode,
      aggregationId: c.aggregationId ? String(c.aggregationId) : undefined,
      scannedBy: c.scannedBy ? String(c.scannedBy) : undefined,
      scannedAt: c.scannedAt,
    }));
  },
};