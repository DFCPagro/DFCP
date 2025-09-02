export const roles = ['customer', 'farmer', 'deliverer', 'admin','industrialDeliverer', 'tmanager', 'fManager', 'opManager'] as const;
export type Role = typeof roles[number];
