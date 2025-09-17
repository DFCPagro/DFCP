
export const PATHS = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  driverSchedule: "/driver-schedule",
  jobs: "/jobs",
  jobApplication: "/job-application",
  //costumer pages
  market: "/market",
  cart: "/cart",
  checkout: "/checkout",
  // Farmer pages
  aggregations: "/aggregations",
  containers: "/containers",
  // Item manager
  ItemsManagment: "/admin/items",
  //admin pages TEMP:- 
  adminDashboard: "/admin/dashboard",
  JobAppReview: "/admin/jobReview",
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
