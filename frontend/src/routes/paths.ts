export const PATHS = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  driverSchedule: "/driver-schedule",
  jobs: "/jobs",
//costumer pages
  market: "/market",
  // Farmer pages
  aggregations: "/aggregations",
  containers: "/containers",
  // Driver pages
  shipments: "/shipments",
  // Public QR routes
  ops: "/o/:token",
  customerConfirm: "/r/:token",
  arrivalConfirm: "/a/:token",
  aggregationView: "/ag/:token",
  containerView: "/c/:barcode",
  notFound: "/404",
} as const;
