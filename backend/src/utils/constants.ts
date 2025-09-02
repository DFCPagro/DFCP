export const roles = ['customer', 'farmer', 'driver', 'admin'] as const;
export type Role = typeof roles[number];
