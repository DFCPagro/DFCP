export type Role = "customer" | "admin" | "deliverer" | string;

// Add optional fields you showed in your sample response
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  uid?: string;
  status?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// What your app uses everywhere
export type AuthResponse = {
  user: User;
  token: string;
};

// What the backend might actually return (v1 vs v2)
export type AuthResponseRaw =
  | { user: User; token: string }
  | { user: User; tokens: { access: string } };

export type MeResponse = {
  user: User;
};
