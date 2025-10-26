import { api } from "@/api/config"; // <-- your axios instance file (adjust the path if different)

export interface LogisticsCenterDTO {
  _id: string;
  name: string;
  // ...add any fields you actually expose
}

export interface DeliveryHistoryInput {
  date: string; // ISO
  notes?: string;
}

export const LogisticsCentersAPI = {
  list: async () => {
    const { data } = await api.get<{ ok?: boolean; data: LogisticsCenterDTO[] } | LogisticsCenterDTO[]>("/logistics-centers");
    // Support both shapes (controller sometimes responds {ok, data}, sometimes plain array)
    const arr = Array.isArray((data as any)?.data) ? (data as any).data : (data as any);
    return arr as LogisticsCenterDTO[];
  },

  getById: async (id: string) => {
    const { data } = await api.get<{ ok?: boolean; data: LogisticsCenterDTO } | LogisticsCenterDTO>(`/logistics-centers/${id}`);
    return ((data as any).data ?? data) as LogisticsCenterDTO;
  },

  create: async (payload: Partial<LogisticsCenterDTO>) => {
    const { data } = await api.post<{ ok?: boolean; data: LogisticsCenterDTO } | LogisticsCenterDTO>("/logistics-centers", payload);
    return ((data as any).data ?? data) as LogisticsCenterDTO;
  },

  update: async (id: string, patch: Partial<LogisticsCenterDTO>) => {
    const { data } = await api.patch<{ ok?: boolean; data: LogisticsCenterDTO } | LogisticsCenterDTO>(`/logistics-centers/${id}`, patch);
    return ((data as any).data ?? data) as LogisticsCenterDTO;
  },

  remove: async (id: string) => {
    const { data } = await api.delete<{ ok?: boolean; data?: any }>(`/logistics-centers/${id}`);
    return data;
  },

  addDeliveryHistory: async (id: string, entry: DeliveryHistoryInput) => {
    const { data } = await api.post<{ ok?: boolean; data: any }>(`/logistics-centers/${id}/delivery-history`, entry);
    return data.data ?? data;
  },

  listDeliverers: async (id: string) => {
    const { data } = await api.get<{ ok?: boolean; data: any[] }>(`/logistics-centers/${id}/deliverers`);
    return data.data ?? [];
  },

  assignDeliverer: async (id: string, delivererId: string) => {
    const { data } = await api.post<{ ok?: boolean; data: any }>(`/logistics-centers/${id}/deliverers/${delivererId}`, {});
    return data.data ?? data;
  },

  unassignDeliverer: async (id: string, delivererId: string) => {
    const { data } = await api.delete<{ ok?: boolean; data: any }>(`/logistics-centers/${id}/deliverers/${delivererId}`);
    return data.data ?? data;
  },
};
