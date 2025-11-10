// src/routes/index.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, type ReactElement } from "react";
import AuthGuard from "@/guards/AuthGuard";
import GuestGuard from "@/guards/GuestGuard";
import RoleGuard from "@/guards/RoleGuard";
import { PATHS } from "./paths";
import AppShell from "@/components/layout/AppShell";

/* =========================
 * Lazy imports (unchanged)
 * ========================= */
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));

const JobApplication = lazy(() => import("@/pages/JobApplication"));
const AvailabileJobs = lazy(() => import("@/pages/AvailableJobs"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const DriverSchedule = lazy(() => import("@/pages/DriverSchedule"));

// Customer pages
const Checkout = lazy(() => import("@/pages/customer/Checkout"));
const Profile = lazy(() => import("@/pages/customer/Profile"));
const Orders = lazy(() => import("@/pages/customer/customerOrders"));
const DeliveryNote = lazy(() => import("@/pages/customer/DeliveryNote"));
const Market = lazy(() => import("@/pages/customer/Market"));

// Farmer pages
const FarmerDashboard = lazy(() => import("@/pages/farmer/FarmerDashboard"));
const FarmerCropManagement = lazy(() => import("@/pages/farmer/FarmerCropManagement"));
const FarmerOrderForShift = lazy(() => import("@/pages/farmer/farmerOrdersForShift"));

// Picker pages
const PickerDashboard = lazy(() => import("@/pages/picker/picker-dashboard"));
const PickTaskPage = lazy(() => import("@/pages/picker/picker-task"));
const PickerSchedule = lazy(() => import("@/pages/picker/picker-Schedule"));

// Admin / Manager pages
const WorkerProfile = lazy(() => import("@/pages/workerProfile"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const JobAppReview = lazy(() => import("@/pages/JobAppReview"));
const CropHarvest = lazy(() => import("@/pages/AdminExpectedHarvest"));
const PackageSizesPage = lazy(() => import("@/pages/packageSizes"));
const LogisticCenter = lazy(() => import("@/pages/LogisticCenter"));
const PickerTasks = lazy(() => import("@/pages/opManager/picker-tasksManagement"));

const CSManagerOrdersPage = lazy(() => import("@/pages/csManager/Orders"));
const CSManagerShiftOrders = lazy(() => import("@/pages/csManager/shiftOrders"));
const CSManagerDashboard = lazy(() => import("@/pages/csManager/Dashboard"));

const FManagerDashboard = lazy(() => import("@/pages/fManager/Dashboard"));
const FManagerItemManagement = lazy(() => import("@/pages/fManager/ItemManager"));
const FManagerCreateStock = lazy(() => import("@/pages/fManager/CreateStock"));
const FManagerShiftsFarmerOrder = lazy(() => import("@/pages/fManager/ShiftsFarmerOrder"));
const FManagerViewFarmerOrders = lazy(() => import("@/pages/fManager/ViewFarmerOrders"));
const FManagerViewFarmerList = lazy(() => import("@/pages/fManager/FarmerList"));
const FarmerOrderReport = lazy(() => import("@/pages/FarmerOrderReport"));

// Misc / Example
const MapPickerExamplePage = lazy(() => import("@/pages/MapExampleUsage"));
const QRExample = lazy(() => import("@/pages/QRExample"));

/* =========================
 * Types to keep TS happy
 * ========================= */
type Role =
  | "admin"
  | "farmer"
  | "picker"
  | "deliverer"
  | "tManager"
  | "industrialDeliverer"
  | "fManager"
  | "csManager"
  | "opManager";

type RouteItem = {
  path: string;
  element: ReactElement;
  roles?: Role[];       // optional explicit allow list for RoleGuard
  showHeader?: boolean; // AppShell override
  showFooter?: boolean; // AppShell override
};

type RoleRoutes = Record<string, RouteItem[]>;

/* =========================
 * Route configs (DRY)
 * ========================= */

// Public (default chrome)
const PUBLIC_ROUTES: RouteItem[] = [
  { path: PATHS.home, element: <Home /> },
  { path: PATHS.notFound, element: <NotFound /> },
  { path: PATHS.MapExample, element: <MapPickerExamplePage /> },
  { path: PATHS.QRExample, element: <QRExample /> },
];

// Public (no footer) – special shell props
const PUBLIC_NO_FOOTER_ROUTES: RouteItem[] = [
  // Logistic Center with its own layout props
  { path: PATHS.logisticCenter, element: <LogisticCenter /> },
];

// Guest-only
const GUEST_ROUTES: RouteItem[] = [
  { path: PATHS.login, element: <Login /> },
  { path: PATHS.register, element: <Register /> },
];

// Authenticated customer pages
const CUSTOMER_ROUTES: RouteItem[] = [
  { path: PATHS.jobs, element: <AvailabileJobs />, showFooter: true },
  { path: PATHS.jobApplication, element: <JobApplication />, showFooter: true },
  { path: PATHS.orders, element: <Orders />, showFooter: true },
  { path: PATHS.profile, element: <Profile />, showFooter: true },
  { path: PATHS.market, element: <Market />, showFooter: true },

  // checkout has no footer
  { path: PATHS.checkout, element: <Checkout />, showFooter: false },

  // deliveryNote has no header
  { path: PATHS.deliveryNote, element: <DeliveryNote />, showHeader: false },
];

// Authenticated + role-protected
const ROLE_ROUTES: RoleRoutes = {
  // Admin
  admin: [
    { path: PATHS.adminDashboard, element: <AdminDashboard /> },
    { path: PATHS.cropHarvest, element: <CropHarvest /> },
    { path: PATHS.JobAppReview, element: <JobAppReview /> },
    { path: PATHS.PackageSizes, element: <PackageSizesPage /> },
  ],

  // Farmer
  farmer: [
    { path: PATHS.FarmerDashboard, element: <FarmerDashboard /> },
    { path: PATHS.FarmerCropManagement, element: <FarmerCropManagement /> },
    { path: PATHS.FarmerOrderReport, element: <FarmerOrderReport />, roles: ["farmer", "admin"] },
    { path: "/farmer/farmerOrderForShift/:date/:shift", element: <FarmerOrderForShift /> },
  ],

  // Picker
  picker: [
    { path: PATHS.pickerDashboard, element: <PickerDashboard /> },
    { path: PATHS.pickerTask, element: <PickTaskPage /> },
    { path: PATHS.pickerSchedule, element: <PickerSchedule /> },
  ],

  // Deliverer
  deliverer: [
    { path: PATHS.driverSchedule, element: <DriverSchedule /> },
  ],

  // OP Manager
  opManager: [
    { path: PATHS.PickerTasksPage, element: <PickerTasks />, roles: ["opManager", "admin"] },
  ],

  // CS Manager
  csManager: [
    { path: PATHS.csManagerDashboard, element: <CSManagerDashboard />, roles: ["csManager", "admin"] },
    { path: PATHS.csManagerOrders, element: <CSManagerOrdersPage />, roles: ["csManager", "admin"] },
    { path: PATHS.csManagerShiftOrders, element: <CSManagerShiftOrders />, roles: ["csManager", "admin"] },
  ],

  // F Manager
  fManager: [
    { path: PATHS.fManagerDashboard, element: <FManagerDashboard /> },
    { path: PATHS.fManagerItemManagement, element: <FManagerItemManagement /> },
    { path: PATHS.fManagerCreateStock, element: <FManagerCreateStock /> },
    { path: PATHS.fManagerShiftsFarmerOrder, element: <FManagerShiftsFarmerOrder /> },
    { path: PATHS.fManagerViewFarmerOrders, element: <FManagerViewFarmerOrders /> },
    { path: PATHS.fManagerViewFarmerList, element: <FManagerViewFarmerList /> },
    // Keeping your admin ItemsManagment path accessible to fManager as it was unguarded in your file
    { path: PATHS.ItemsManagment, element: <FManagerItemManagement />, roles: ["fManager"] },
  ],

  // Worker profile (multi-role)
  worker: [
    {
      path: PATHS.workerProfile,
      element: <WorkerProfile />,
      roles: ["farmer", "picker", "deliverer", "tManager", "industrialDeliverer"],
    },
  ],
};

/* =========================
 * Small render helpers
 * ========================= */
const renderSimpleRoutes = (routes: RouteItem[]) =>
  routes.map(({ path, element }) => <Route key={path} path={path} element={element} />);

const renderRoleProtectedRoutes = () =>
  Object.entries(ROLE_ROUTES).flatMap(([role, routes]) =>
    routes.map(({ path, element, roles }) => (
      <Route
        key={path}
        path={path}
        element={<RoleGuard allow={roles ?? [role as Role]}>{element}</RoleGuard>}
      />
    ))
  );

/* =========================
 * Router Component
 * ========================= */
export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* --- Public, default chrome --- */}
        <Route element={<AppShell />}>{renderSimpleRoutes(PUBLIC_ROUTES)}</Route>

        {/* --- Public, no Footer (special shell props) --- */}
        <Route element={<AppShell px={0} py={0} maxW="container.md" />}>
          {renderSimpleRoutes(PUBLIC_NO_FOOTER_ROUTES)}
        </Route>

        {/* --- Guest-only --- */}
        <Route
          element={
            <GuestGuard>
              <AppShell
                px={0}
                py={0}
                addSurroundingGap={true}
                showFooter={false}
                maxW="100hw"
              />
            </GuestGuard>
          }
        >
          {renderSimpleRoutes(GUEST_ROUTES)}
        </Route>

        {/* --- Authenticated, default chrome (role-protected inside) --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        >
          {renderRoleProtectedRoutes()}
        </Route>

        {/* --- Authenticated, yes FOOTER (customer pages) --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell showFooter={true} />
            </AuthGuard>
          }
        >
          {renderSimpleRoutes(CUSTOMER_ROUTES.filter(r => r.showFooter === true))}
        </Route>

        {/* --- Authenticated, no FOOTER (customer checkout) --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell showFooter={false} maxW="5xl" />
            </AuthGuard>
          }
        >
          {renderSimpleRoutes(CUSTOMER_ROUTES.filter(r => r.showFooter === false))}
        </Route>

        {/* --- Authenticated, no HEADER (delivery note) --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell showHeader={false} />
            </AuthGuard>
          }
        >
          {renderSimpleRoutes(CUSTOMER_ROUTES.filter(r => r.showHeader === false))}
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={PATHS.notFound} replace />} />
      </Routes>
    </Suspense>
  );
}
