export type QrCardSize = "sm" | "md" | "lg" | "xl"

export const sizeCfg = {
  sm: { qr: 112, minCard: "220px", previewMin: "180px" },
  md: { qr: 140, minCard: "260px", previewMin: "220px" },
  lg: { qr: 168, minCard: "300px", previewMin: "260px" },
  xl: { qr: 208, minCard: "360px", previewMin: "320px" },
} as const
