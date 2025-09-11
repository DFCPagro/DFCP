import { Request } from "express";
import User from "../models/user.model"; // <-- relative
import { Types } from "mongoose";

type ShiftCode = "morning" | "afternoon" | "night";

const ID_SEP = "#";

function toLocationId(userId: Types.ObjectId, index: number) {
  return `${userId.toString()}${ID_SEP}${index}`;
}
function parseLocationId(id: string) {
  const [user, idx] = id.split(ID_SEP);
  return { userId: new Types.ObjectId(user), index: Number(idx) };
}

async function getActiveUser(req: Request) {
  // Prefer your auth middleware if available:
  const authId = (req as any)?.user?.id as string | undefined;
  if (authId) {
    const u = await User.findById(authId);
    if (u) return u;
  }
  // Dev fallback: first user in DB
  const fallback = await User.findOne();
  if (!fallback) {
    const e: any = new Error("No users found (auth not configured).");
    e.statusCode = 401;
    throw e;
  }
  return fallback;
}

/* ---------- /locations ---------- */

export async function listLocations(req: Request) {
  const user = await getActiveUser(req);
  const addresses = Array.isArray(user.addresses) ? (user.addresses as any[]) : [];
  return addresses.map((a: any, idx: number) => ({
    locationId: toLocationId(user._id, idx),
    address: a.address,
    lat: a.alt, // your schema uses alt (latitude)
    lng: a.lnt, // and lnt (longitude)
    logisticCenterId: a.logisticCenterId ?? null,
  }));
}

export async function createLocation(req: Request) {
  const body = (req.body ?? {}) as {
    address?: string; lat?: number; lng?: number; label?: string; street?: string; city?: string;
  };

  const addr =
    (typeof body.address === "string" && body.address.trim()) ||
    [body.label, body.street, body.city].filter(Boolean).join(", ").trim();

  if (!addr || typeof body.lat !== "number" || typeof body.lng !== "number") {
    const e: any = new Error("Invalid payload: require address + lat + lng");
    e.statusCode = 400;
    throw e;
  }

  const user = await getActiveUser(req);
  (user.addresses as any[]).push({
    address: addr,
    alt: body.lat,
    lnt: body.lng,
    logisticCenterId: null,
  });

  await user.save();
  const idx = (user.addresses as any[]).length - 1;

  return {
    locationId: toLocationId(user._id, idx),
    address: addr,
    lat: body.lat,
    lng: body.lng,
    logisticCenterId: null,
  };
}

/* ---------- /stock ---------- */

export async function getMarketStock(req: Request) {
  const { locationId, shift, category, search } = req.query as {
    locationId?: string;
    shift?: ShiftCode;
    category?: string;
    search?: string;
  };

  if (!locationId || !shift) {
    const e: any = new Error("locationId and shift are required");
    e.statusCode = 400;
    throw e;
  }

  const { userId, index } = parseLocationId(String(locationId));
  const user = await User.findById(userId).lean();
  if (!user || !Array.isArray(user.addresses) || index < 0 || index >= user.addresses.length) {
    const e: any = new Error("Invalid locationId");
    e.statusCode = 400;
    throw e;
  }

  // demo data
  let data = [
    { _id: "FRT-001", name: "Apple Gala", price: 2.8, stock: 36, farmer: { id: "FM-1", name: "Levy Cohen" }, category: "Fruits" },
    { _id: "VEG-002", name: "Tomato",     price: 3.2, stock: 64, farmer: { id: "FM-2", name: "Green Valley" }, category: "Vegetables" },
    { _id: "EGD-003", name: "Eggs (12)",  price: 7.5, stock: 20, farmer: { id: "FM-3", name: "Sunrise Farm" }, category: "Eggs & Dairy" },
    { _id: "BRD-004", name: "Sourdough",  price: 5.9, stock: 14, farmer: { id: "FM-4", name: "Baker’s Hill" }, category: "Breads" },
  ];

  if (category && category !== "All") {
    const q = category.toLowerCase();
    data = data.filter((x) => x.category?.toLowerCase() === q);
  }
  if (search) {
    const q = search.toLowerCase();
    data = data.filter((x) => x.name.toLowerCase().includes(q));
  }

  return data;
}
