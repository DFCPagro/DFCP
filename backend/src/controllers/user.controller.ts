import { Request, Response } from "express";
import ApiError from "../utils/ApiError";
import { Role } from "../utils/constants";
import {
  getUserAddresses,
  addUserAddress,
  getUserName,
 removeAddress,
  updateUserContact,
  getContactInfoByIdService,
} from "../services/user.service";

const ADMIN_ROLES: Role[] = ["admin", "fManager", "tManager"] as const;
// Helper to extract the authenticated user id
function authId(req: Request): string {
  const id = (req as any).user?._id;
  if (!id) throw new Error("Unauthorized");
  return String(id);
}




export async function getContactInfoById(req: Request, res: Response) {
  try {
    const requester = req.user as { _id: string; role: Role } | undefined;
    if (!requester) throw new ApiError(401, "Unauthorized");

    const isPrivileged = ADMIN_ROLES.includes(requester.role);
    const requestedId = (req.params.id as string) || (req.query.id as string) || "";

    // Privileged can target others; everyone else gets self
    const targetUserId = isPrivileged && requestedId ? requestedId : String(requester._id);

    const data = await getContactInfoByIdService(targetUserId);
    res.json({ data });
  } catch (e: any) {
    res
    .status(e.message === "Unauthorized" ? 401 : 400)
     .json({ error: e.message || "Failed to get addresses" });
  }
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
    console.log("postNewAddress body:", req.body);
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
    const data = await getContactInfoByIdService(userId);
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

export async function deleteMyAddress(req: Request, res: Response) {
  try {
    const userId = authId(req);
    const { lnt, alt, address } = req.body ?? {};
    const data = await removeAddress(userId, { lnt, alt, address });
    res.json(data);
  } catch (e: any) {
    const status =
      e.message === "Unauthorized" ? 401 :
      /not found/i.test(e.message) ? 404 : 400;
    res.status(status).json({ error: e.message || "Failed to remove address" });
  }
}