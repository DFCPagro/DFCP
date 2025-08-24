export const roles = ['consumer', 'farmer', 'driver', 'admin'] as const;
export type Role = typeof roles[number];
