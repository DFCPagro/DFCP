// src/routes/paths.ts
export const PATHS = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",

  driverSchedule: "/driver-schedule",
  jobs: "/jobs",
  jobApplication: "/job-application",

  // customer pages
  market: "/market",
  cart: "/cart",
  checkout: "/checkout",
  profile: "/profile",
  orders: "/orders",
  deliveryNote: "/orders/:id/note", // DeliveryNote page

  // farmer pages
  farmerDashboard: "/FarmerDashboard",
  FarmerCropManagement: "/farmer/crops",

  // item manager
  ItemsManagment: "/admin/items",

  MapExample: "/map-example",
  QRExample: "/qr-example",
  // admin pages
  adminDashboard: "/admin/dashboard",
  JobAppReview: "/admin/jobReview",
  cropHarvest: "/admin/crop-harvest",
  PackageSizes: "/admin/package-sizes",

  // driver pages
  shipments: "/shipments",


  // picker pages
  pickerDashboard: "/picker/dashboard",
  pickerTask: "/picker/task/:taskId", 
  pickerSchedule:"/picker/Schedule",         // ← add this

  // public QR routes
  ops: "/o/:token",
  customerConfirm: "/r/:token",
  arrivalConfirm: "/a/:token",
  aggregationView: "/ag/:token",
  containerView: "/c/:barcode",


  // csManager pages
  csManagerDashboard: "/csManager/dashboard",
  csManagerOrders: "/csManager/orders",
  csManagerShiftOrders: "/csManager/shift-orders",

  
//all worker pages
workerProfile: "/workerProfile",

  notFound: "/404",
} as const;

