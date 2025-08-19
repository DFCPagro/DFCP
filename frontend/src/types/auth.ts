export type User = {
  id: string;
  email: string;
  name?: string | null;
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type MeResponse = {
  user: User;
};
