import { Types } from "mongoose";
import { Farmer } from "../models/farmer.model"; // adjust import path
import { User } from "../models/user.model";     // only needed if logo comes from User

export async function getFarmerBioByUserId(farmerUserId: string) {
  if (!Types.ObjectId.isValid(farmerUserId)) return null;

  const farmer = await Farmer.findOne({ user: farmerUserId })
    .select("farmName farmLogo farmerBio user")
    .populate("user", "logo"); // logo comes from User model

  if (!farmer) return null;

  return {
    logo: (farmer.user as any)?.logo ?? null,  // from User
    farmName: farmer.farmName,
    farmLogo: farmer.farmLogo,
    farmerBio: farmer.farmerBio,
  };
}
