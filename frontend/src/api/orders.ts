import { api } from "./config";
import type {
  PaginatedOrders,
  OrderRowAPI,
  MintResult,
} from "@/types/orders";

export async function fetchOrders(page = 1, pageSize = 20) {
  const { data } = await api.get<PaginatedOrders>("/orders", {
    params: { page, pageSize },
  });
  return data;
}

export async function updateOrderStatus(
  id: string,
  status: OrderRowAPI["status"]
) {
  const { data } = await api.patch<{ id: string; status: OrderRowAPI["status"] }>(
    `/orders/${id}/status`,
    { status }
  );
  return data;
}

export async function mintQrs(id: string, ttlDays = 30) {
  const { data } = await api.post<MintResult>(
    `/orders/${id}/qrs`,
    null,
    { params: { ttlDays } }
  );
  return data;
}
