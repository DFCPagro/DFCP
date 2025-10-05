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

// ----------------------------- Create Order (POST /orders) -----------------------------

export type CreateOrderAddress = {
  lnt: number;        // longitude (as per Swagger sample)
  alt: number;        // latitude  (as per Swagger sample)
  address: string;
};

export type CreateOrderItemPayload = {
  farmerOrderId: string;           // required by backend
  itemId: string;
  name: string;
  imageUrl?: string;
  pricePerUnit: number;
  quantity: number;
  category?: string;
  sourceFarmerName?: string;
  sourceFarmName?: string;
};

export type CreateOrderRequest = {
  amsId: string;
  logisticsCenterId: string;       // request uses camelCase
  deliveryDate: string;            // "YYYY-MM-DD"
  deliveryAddress: CreateOrderAddress;
  items: CreateOrderItemPayload[];
};

// The backend response nests the order under { data: {...} } (per your Swagger sample).
export type CreateOrderResponseData = {
  _id: string;
  customerId: string;
  deliveryAddress: CreateOrderAddress;
  deliveryDate: string;            // ISO string in response
  // Server sometimes returns "LogisticsCenterId" (capital L). We normalize in API.
  logisticsCenterId?: string;
  LogisticsCenterId?: string;

  amsId: string;
  items: Array<{
    itemId: string;
    name: string;
    imageUrl?: string;
    pricePerUnit: number;
    quantity: number;
    category?: string;
    sourceFarmerName?: string;
    sourceFarmName?: string;
    farmerOrderId: string;
  }>;

  itemsSubtotal: number;
  deliveryFee: number;
  totalPrice: number;
  totalOrderWeightKg?: number;

  status: string; // e.g., "pending"
  assignedDelivererId?: string | null;
  customerDeliveryId?: string | null;
  historyAuditTrail?: Array<{
    userId?: string;
    action: string;
    note?: string;
    meta?: Record<string, any>;
    timestamp?: string;
  }>;

  createdAt: string;
  updatedAt: string;
};

export type CreateOrderResponse = {
  data: CreateOrderResponseData;
};
