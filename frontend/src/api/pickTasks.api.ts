import { api } from "@/api/config";

export interface PickTaskDTO {
  _id: string;
  state: "pending" | "in_progress" | "completed" | "canceled";
  logisticCenterId: string;
  assignedTo?: string | null;
  aggregateCrowdScore?: number | null;
  // ... add fields you render (items, targetSlots, etc.)
}

export const PickTasksAPI = {
  // both paths available; prefer the stable "/suggest"
  suggest: async () => {
    const { data } = await api.get<PickTaskDTO | null>("/pick-tasks/suggest");
    return data;
  },

  start: async (id: string, userId?: string) => {
    const { data } = await api.post<PickTaskDTO>(`/pick-tasks/${id}/start`, userId ? { userId } : {});
    return data;
    // controller returns the raw task (not wrapped)
  },

  complete: async (id: string) => {
    const { data } = await api.post<PickTaskDTO>(`/pick-tasks/${id}/complete`, {});
    return data;
  },
};
