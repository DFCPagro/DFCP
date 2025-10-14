// Keep frontend roles aligned with backend
export type Role = "admin" | "customer" | "staff" | "fmanager" |"tManager"|"opManager" | "csManager" | "deliverer" | "industrialDeliverer"|"csManager" | "fManager";

export interface IUser {
  _id: string;
  uid?: string;
  name: string;
  email: string;
  birthday?: string;
  phone?: string;
  role: Role;
  status: boolean;
  createdAt?: string;
  updatedAt?: string;
}
