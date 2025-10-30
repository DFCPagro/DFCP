export interface AuditEvent {
  action: string;
  note?: string;
  by:
    | string
    | {
        id: string;        // <- always exists in enriched path
        name?: string;
        role?: string;
      };
  at: string | Date;
  meta?: Record<string, any>;
}

