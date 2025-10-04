// src/routes/index.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import AuthGuard from "@/guards/AuthGuard";
import GuestGuard from "@/guards/GuestGuard";
import RoleGuard from "@/guards/RoleGuard";
import { PATHS } from "./paths";
import AppShell from "@/components/layout/AppShell";

// Lazy pages (unchanged)
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const DriverSchedule = lazy(() => import("@/pages/DriverSchedule"));
const JobApplication = lazy(() => import("@/pages/JobApplication"));
const AvailabileJobs = lazy(() => import("@/pages/AvailableJobs"));
const OpsOrderPage = lazy(() => import("@/pages/OpsOrder"));
const CustomerConfirmPage = lazy(() => import("@/pages/CustomerConfirm"));
const ArrivalConfirmPage = lazy(() => import("@/pages/ArrivalConfirm"));
const FarmerDashboard = lazy(() => import("@/pages/FarmerDashboard"));
const FarmerCropManagement = lazy(() => import("@/pages/FarmerCropManagement"));
const Market = lazy(() => import("@/pages/Market"));
const Cart = lazy(() => import("@/pages/Cart"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const Profile = lazy(() => import("@/pages/Profile"));
const Orders = lazy(() => import("@/pages/Orders"));
const DeliveryNote = lazy(() => import("@/pages/DeliveryNote"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const ItemManager = lazy(() => import("@/pages/ItemManager"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const JobAppReview = lazy(() => import("@/pages/JobAppReview"));
const CropHarvest = lazy(() => import("@/pages/AdminExpectedHarvest"));
const PackageSizesPage = lazy(() => import("@/pages/packageSizes"));


//delete this route later, its just an example for using map picker
const MapPickerExamplePage = lazy(() => import("@/pages/MapExampleUsage"));


export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* --- Public, default chrome --- */}
        <Route element={<AppShell />}>
          <Route path={PATHS.home} element={<Home />} />
          <Route path={PATHS.notFound} element={<NotFound />} />
            <Route path={PATHS.MapExample} element={< MapPickerExamplePage/>} />
        </Route>

        {/* --- Public, immersive (no chrome) --- */}
        <Route
          element={
            <AppShell showHeader={false} showFooter={false} px={0} py={0} maxW="container.md" />
          }
        >
          <Route path={PATHS.ops} element={<OpsOrderPage />} />
          <Route path={PATHS.customerConfirm} element={<CustomerConfirmPage />} />
          <Route path={PATHS.arrivalConfirm} element={<ArrivalConfirmPage />} />
        </Route>

        {/* --- Guest-only (login/register), no chrome, narrow --- */}
        <Route element={<GuestGuard />}>
          <Route element={<AppShell showFooter={false} maxW="md" />}>
            <Route path={PATHS.login} element={<Login />} />
            <Route path={PATHS.register} element={<Register />} />
          </Route>
        </Route>

        {/* --- Authenticated, default chrome --- */}
        <Route element={<AuthGuard><AppShell /></AuthGuard>}>
          {/* General protected */}
          <Route path={PATHS.dashboard} element={<Dashboard />} />
          <Route path={PATHS.jobs} element={<AvailabileJobs />} />
          <Route path={PATHS.jobApplication} element={<JobApplication />} />
          <Route path={PATHS.market} element={<Market />} />
          <Route path={PATHS.orders} element={<Orders />} />

          {/* Admin-only */}
          <Route
            path={PATHS.adminDashboard}
            element={
              <RoleGuard allow={["admin"]}>
                <AdminDashboard />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.JobAppReview}
            element={
              <RoleGuard allow={["admin"]}>
                <JobAppReview />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.cropHarvest}
            element={
              <RoleGuard allow={["admin"]}>
                <CropHarvest />
              </RoleGuard>
            }
          />
          <Route path={PATHS.ItemsManagment} element={<ItemManager />} />

          {/* Package sizes (admin + dManager) */}
          <Route
            path={PATHS.PackageSizes}
            element={
              <RoleGuard allow={["admin", "dManager"]}>
                <PackageSizesPage />
              </RoleGuard>
            }
          />

          {/* Driver-only */}
          <Route
            path={PATHS.driverSchedule}
            element={
              <RoleGuard allow={["driver"]}>
                <DriverSchedule />
              </RoleGuard>
            }
          />

          {/* Farmer-only */}
          <Route
            path={PATHS.farmerDashboard}
            element={
              <RoleGuard allow={["farmer"]}>
                <FarmerDashboard />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.FarmerCropManagement}
            element={
              <RoleGuard allow={["farmer"]}>
                <FarmerCropManagement />
              </RoleGuard>
            }
          />
        </Route>

        {/* --- Authenticated, no FOOTER --- */}
        <Route element={<AuthGuard><AppShell showFooter={false} /></AuthGuard>}>
          <Route path={PATHS.cart} element={<Cart />} />
          <Route path={PATHS.checkout} element={<Checkout />} />
        </Route>

        {/* --- Authenticated, no FOOTER + wider --- */}
        <Route element={<AuthGuard><AppShell showFooter={false} maxW="5xl" /></AuthGuard>}>
          <Route path={PATHS.profile} element={<Profile />} />
        </Route>

        {/* --- Authenticated, no HEADER --- */}
        <Route element={<AuthGuard><AppShell showHeader={false} /></AuthGuard>}>
          <Route path={PATHS.deliveryNote} element={<DeliveryNote />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={PATHS.notFound} replace />} />
      </Routes>
    </Suspense>
  );
}