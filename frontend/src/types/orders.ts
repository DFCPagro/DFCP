export type OrderStatus =
  | "created"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "confirmed";

export type OrderItem = {
  productId: string;
  quantity: number;
  unit?: string;
};

export type OrderRowAPI = {
  id: string;
  orderId: string;
  status: OrderStatus;
  deliverySlot?: string | null;
  createdAt: string;
  items: OrderItem[];
  // optional extra fields you might add later:
  // consumerName?: string;
};

export type PaginatedOrders = {
  page: number;
  pageSize: number;
  total: number;
  items: OrderRowAPI[];
};

export type MintResult = {
  opsUrl: string;
  customerUrl: string;
  opsToken: string;
  customerToken: string;
};
