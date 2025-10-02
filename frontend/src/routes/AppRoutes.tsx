// src/routes/index.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import AuthGuard from "@/guards/AuthGuard";
import GuestGuard from "@/guards/GuestGuard";
import RoleGuard from "@/guards/RoleGuard";
import { PATHS } from "./paths";
import AppShell from "@/components/layout/AppShell";

// Lazy pages
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
const Profile = lazy(() => import("@/pages/profile"));
const Orders = lazy(() => import("@/pages/Orders"));
const DeliveryNote = lazy(() => import("@/pages/DeliveryNote"));

const NotFound = lazy(() => import("@/pages/NotFound"));
const ItemManager = lazy(() => import("@/pages/ItemManager"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const JobAppReview = lazy(() => import("@/pages/JobAppReview"));
const CropHarvest = lazy(() => import("@/pages/AdminExpectedHarvest"));
const PackageSizesPage = lazy(() => import("@/pages/package-sizes"));

export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* Root shell: by default renders header + footer */}
        <Route element={<AppShell />}>
          {/* Public */}
          <Route path={PATHS.home} element={<Home />} />

          {/* Login/Register: hide chrome, narrow container */}
          <Route element={<GuestGuard />}>
            <Route element={<AppShell showHeader={false} showFooter={false} maxW="md" />}>
              <Route path={PATHS.login} element={<Login />} />
              <Route path={PATHS.register} element={<Register />} />
            </Route>
          </Route>

          {/* Public QR endpoints: immersive (no chrome, zero padding) */}
          <Route element={<AppShell showHeader={false} showFooter={false} px={0} py={0} maxW="container.md" />}>
            <Route path={PATHS.ops} element={<OpsOrderPage />} />
            <Route path={PATHS.customerConfirm} element={<CustomerConfirmPage />} />
            <Route path={PATHS.arrivalConfirm} element={<ArrivalConfirmPage />} />
          </Route>

          {/* Authenticated */}
          <Route element={<AuthGuard />}>
            {/* Jobs (protected) */}
            <Route path={PATHS.jobs} element={<AvailabileJobs />} />
            <Route path={PATHS.jobApplication} element={<JobApplication />} />

            {/* Admin-only */}
            <Route path={PATHS.ItemsManagment} element={<ItemManager />} />
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

            {/* Dashboard */}
            <Route path={PATHS.dashboard} element={<Dashboard />} />

            {/* Package sizes (admin + dManager) */}
            <Route
              path={PATHS.PackageSizes}
              element={
                <RoleGuard allow={["admin", "dManager"]}>
                  <PackageSizesPage />
                </RoleGuard>
              }
            />

            {/* Customer pages */}
            <Route path={PATHS.market} element={<Market />} />
            <Route element={<AppShell showFooter={false} />}>
              <Route path={PATHS.cart} element={<Cart />} />
              <Route path={PATHS.checkout} element={<Checkout />} />
            </Route>
            <Route element={<AppShell maxW="5xl" />}>
              <Route path={PATHS.profile} element={<Profile />} />
            </Route>
            <Route path={PATHS.orders} element={<Orders />} />
            <Route element={<AppShell showHeader={false} />}>
              <Route path={PATHS.deliveryNote} element={<DeliveryNote />} />
            </Route>

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

          {/* Not Found (no footer) */}
          <Route path={PATHS.notFound} element={<NotFound />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={PATHS.notFound} replace />} />
      </Routes>
    </Suspense>
  );
}
