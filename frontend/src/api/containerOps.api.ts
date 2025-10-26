import { api } from "@/api/config";

export interface ContainerOpsDTO {
  _id: string;
  containerId: string;
  logisticCenterId: string;
  state: string;
  totalWeightKg: number;
  distributedWeights: Array<{ shelfId: string; slotId: string; weightKg: number }>;
  // ... add more fields you need
}

export const ContainerOpsAPI = {
  // by Mongo _id
  get: async (id: string) => {
    const { data } = await api.get<{ ok: boolean; data: ContainerOpsDTO }>(`/container-ops/${id}`);
    return data.data;
  },

  // by business containerId
  getByContainerId: async (containerId: string) => {
    const { data } = await api.get<{ ok: boolean; data: ContainerOpsDTO }>(`/container-ops/by-container-id/${containerId}`);
    return data.data;
  },

  // record picking against a container (audit)
  recordPicked: async (id: string, amountKg: number) => {
    const { data } = await api.post<{ ok: boolean; data: any }>(`/container-ops/${id}/pick`, { amountKg });
    return data.data;
  },

  // optional: if slot hit 0kg, flip container state
  markDepletedIfZero: async (id: string, args: { shelfMongoId: string; slotId: string }) => {
    const { data } = await api.post<{ ok: boolean; data: any }>(`/container-ops/${id}/mark-depleted`, args);
    return data.data;
  },
};
