import { Request, Response } from "express";
import {
  getUserAddresses,
  addUserAddress,
  getUserName,
  getUserContactInfo,
  updateUserContact,
} from "../services/user.service";

// Helper to extract the authenticated user id
function authId(req: Request): string {
  const id = (req as any).user?._id;
  if (!id) throw new Error("Unauthorized");
  return String(id);
}

export async function getMyAddresses(req: Request, res: Response) {
  try {
    const userId = authId(req);
    const data = await getUserAddresses(userId);
    res.json(data);
  } catch (e: any) {
    res
      .status(e.message === "Unauthorized" ? 401 : 400)
      .json({ error: e.message || "Failed to get addresses" });
  }
}

export async function postNewAddress(req: Request, res: Response) {
  try {
    const userId = authId(req);
    const { lnt, alt, address } = req.body ?? {};
    const data = await addUserAddress(userId, { lnt, alt, address });

    // NOTE: For now logisticCenterId is always set to DEFAULT_LC_ID inside the service.
    // TODO: Later compute closest LC from coordinates.

    res.status(201).json(data);
  } catch (e: any) {
    res
      .status(e.message === "Unauthorized" ? 401 : 400)
      .json({ error: e.message || "Failed to add address" });
  }
}

export async function getMyName(req: Request, res: Response) {
  try {
    const userId = authId(req);
    const data = await getUserName(userId);
    res.json(data);
  } catch (e: any) {
    res
      .status(e.message === "Unauthorized" ? 401 : 400)
      .json({ error: e.message || "Failed to get name" });
  }
}

export async function getMyContact(req: Request, res: Response) {
  try {
    const userId = authId(req);
    const data = await getUserContactInfo(userId);
    res.json(data);
  } catch (e: any) {
    res
      .status(e.message === "Unauthorized" ? 401 : 400)
      .json({ error: e.message || "Failed to get contact info" });
  }
}

export async function patchMyContact(req: Request, res: Response) {
  try {
    const userId = authId(req);
    const { email, phone } = req.body ?? {};
    const data = await updateUserContact(userId, { email, phone });
    res.json(data);
  } catch (e: any) {
    const isUnauthorized = e.message === "Unauthorized";
    const isDup =
      typeof e.message === "string" && /duplicate key/i.test(e.message);
    res.status(isUnauthorized ? 401 : isDup ? 409 : 400).json({
      error: isDup
        ? "Email already in use"
        : e.message || "Failed to update contact info",
    });
  }
}
