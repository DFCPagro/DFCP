import { User, Consumer, Farmer, Driver, Admin } from "../models";
import generateId from "../utils/generateId";
import ApiError from "../utils/ApiError";
import { Role } from "../utils/constants";
import { Address } from "../types/address";

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  phone: string;
  address: Address;
  role?: Role;
}) {
  const { role = "customer" } = data;
  let Model: any = User;
 // if (role === "customer") Model = Customer;
  if (role === "farmer") Model = Farmer;
  if (role === "deliverer") Model = Deliverer;
  //if (role === "admin") Model = Admin;

  const uid = generateId("u_");
  const doc = await Model.create({ ...data, uid });
  return doc;
}

export async function findUserByEmail(email: string) {
  return User.findOne({ email });
}

export async function getUserById(id: string) {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");
  return user;
}
