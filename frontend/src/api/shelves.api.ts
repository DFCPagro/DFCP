import { api } from "./config";
import type { ShelfDTO } from "@/types/logisticCenter";

type ListParams = { centerId: string; zone?: string; type?: string };
type ShelvesResponse = { ok: boolean; data: ShelfDTO[] };

export const ShelvesAPI = {
  async list({ centerId, zone, type }: ListParams): Promise<ShelfDTO[]> {
    const { data } = await api.get<ShelvesResponse>("/shelves", {
      params: { centerId, ...(zone ? { zone } : {}), ...(type ? { type } : {}) },
    });
    return data.data;
  },

  async getWithCrowd(shelfId: string) {
    const { data } = await api.get<{ ok: boolean; data: any }>(`/shelves/${shelfId}`);
    return data.data;
  },

  async place(shelfMongoId: string, body: { slotId: string; containerOpsId: string; weightKg: number }) {
    const { data } = await api.post<{ ok: boolean; data: any }>(
      `/shelves/${shelfMongoId}/slots/place`,
      body
    );
    return data.data;
  },

  async consume(shelfMongoId: string, slotId: string, amountKg: number) {
    const { data } = await api.post<{ ok: boolean; data: any }>(
      `/shelves/${shelfMongoId}/slots/${slotId}/consume`,
      { amountKg }
    );
    return data.data;
  },

  async move(args: { fromShelfId: string; fromSlotId: string; toShelfId: string; toSlotId: string }) {
    const { data } = await api.post<{ ok: boolean; data: any }>(`/shelves/move`, args);
    return data.data;
  },

  async refillFromWarehouse(args: {
    pickerShelfId: string;
    pickerSlotId: string;
    warehouseShelfId: string;
    warehouseSlotId: string;
    targetFillKg: number;
  }) {
    const { data } = await api.post<{ ok: boolean; data: any }>(`/shelves/refill`, args);
    return data.data;
  },

  async emptySlot(shelfMongoId: string, slotId: string, toArea: "warehouse" | "out") {
    const { data } = await api.post<{ ok: boolean; data: any }>(`/shelves/${shelfMongoId}/slots/empty`, {
      slotId,
      toArea,
    });
    return data.data;
  },

  async markStart(shelfId: string, kind: "pick" | "sort" | "audit") {
    const { data } = await api.post<{ ok: boolean; data: any }>(`/shelves/${shelfId}/crowd/start`, { kind });
    return data.data;
  },

  async markEnd(shelfId: string, kind: "pick" | "sort" | "audit") {
    const { data } = await api.post<{ ok: boolean; data: any }>(`/shelves/${shelfId}/crowd/end`, { kind });
    return data.data;
  },
};
