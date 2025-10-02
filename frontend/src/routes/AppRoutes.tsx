// src/routes/index.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import AuthGuard from "@/guards/AuthGuard";
import GuestGuard from "@/guards/GuestGuard";
import RoleGuard from "@/guards/RoleGuard";
import { PATHS } from "./paths";

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
        <Route path={PATHS.home} element={<Home />} />

        <Route
          path={PATHS.login}
          element={
            <GuestGuard>
              <Login />
            </GuestGuard>
          }
        />
        <Route
          path={PATHS.register}
          element={
            <GuestGuard>
              <Register />
            </GuestGuard>
          }
        />

        {/* Public QR endpoints */}
        <Route path={PATHS.ops} element={<OpsOrderPage />} />
        <Route path={PATHS.customerConfirm} element={<CustomerConfirmPage />} />
        <Route path={PATHS.arrivalConfirm} element={<ArrivalConfirmPage />} />

        {/* Authenticated routes */}
        <Route element={<AuthGuard />}>
          {/* jobs now protected */}
          <Route path={PATHS.jobs} element={<AvailabileJobs />} />
          <Route path={PATHS.jobApplication} element={<JobApplication />} />

          {/* admin-only pages */}
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
          <Route path={PATHS.dashboard} element={<Dashboard />} />

          {/* package sizes management (admin + dManager) */}
          <Route
            path={PATHS.PackageSizes}
            element={
              <RoleGuard allow={["admin", "dManager"]}>
                <PackageSizesPage />
              </RoleGuard>
            }
          />

          {/* customer-only pages */}
          <Route path={PATHS.market} element={<Market />} />
          <Route path={PATHS.cart} element={<Cart />} />
          <Route path={PATHS.checkout} element={<Checkout />} />
          <Route path={PATHS.profile} element={<Profile />} />
          <Route path={PATHS.orders} element={<Orders />} />
          <Route path={PATHS.deliveryNote} element={<DeliveryNote />} />

          {/* driver-only page */}
          <Route
            path={PATHS.driverSchedule}
            element={
              <RoleGuard allow={["driver"]}>
                <DriverSchedule />
              </RoleGuard>
            }
          />

          {/* farmer-only pages */}
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

        <Route path={PATHS.notFound} element={<NotFound />} />
        <Route path="*" element={<Navigate to={PATHS.notFound} replace />} />
      </Routes>
    </Suspense>
  );
}
