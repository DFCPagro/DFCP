import Farmer from "../../../backend/src/models/farmer.model";
// src/routes/paths.ts
export const PATHS = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",

  driverSchedule: "/driver-schedule",
  jobs: "/jobs",
  jobApplication: "/job-application",

  //logistic center
  logisticCenter: "/logistic-center",

  // customer pages
  market: "/market",
  cart: "/cart",
  checkout: "/checkout",
  profile: "/profile",
  orders: "/orders",
  deliveryNote: "/orders/:id/note", // DeliveryNote page

  // farmer pages
  FarmerDashboard: "/farmer/FarmDashboard",
  FarmerCropManagement: "/farmer/FarmCropManagement",
  FarmerOrdersForShift: "/farmer/farmerOrdersForShift",
  FarmerOrderReport: "/farmer/farmer-order-report",

  // item manager
  ItemsManagment: "/admin/items",

  MapExample: "/map-example",
  QRExample: "/qr-example",

  // admin pages
  adminDashboard: "/admin/dashboard",
  JobAppReview: "/admin/jobReview",
  cropHarvest: "/admin/crop-harvest",
  PackageSizes: "/admin/package-sizes",
  PickerTasksPage: "/admin/picker-tasks",

  // driver pages
  shipments: "/shipments",

  // picker pages
  pickerDashboard: "/picker/dashboard",
  pickerTask: "/picker/task/:taskId",
  pickerSchedule: "/picker/Schedule", // ← add this

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

  //fManager pages
  fManagerDashboard: "/fManager/dashboard",
  fManagerCreateStock: "/fManager/create-stock",
  fManagerItemManagement: "/fManager/item-management",
  fManagerShiftsFarmerOrder: "/fManager/shifts-farmer-order",
  fManagerJobAppReview: "/fManager/jobReview",
  fManagerViewFarmerOrders: "/fManager/view-farmer-orders",
  fManagerViewFarmerList: "/fManager/view-farmer-List",
  //all worker pages
  workerProfile: "/workerProfile",

  notFound: "/404",
} as const;
