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
const PickerDashboard = lazy(() => import("@/pages/picker/picker-dashboard"));
const CSManagerDashboard = lazy(() => import("@/pages/csManager/Dashboard"));

const CSManagerOrdersPage = lazy(() => import("@/pages/csManager/Orders"));
const CSManagerShiftOrders = lazy(() => import("@/pages/csManager/shiftOrders"));
// New page for picker task page, to be implemented
//

const WorkerProfile = lazy(() => import("@/pages/workerProfile"));
const PickTaskPage = lazy(() => import("@/pages/picker/pick-task"));
const PickerSchedule = lazy(() => import("@/pages/picker/picker-Schedule"));




//delete this route later, its just an example for using map picker
const MapPickerExamplePage = lazy(() => import("@/pages/MapExampleUsage"));
const QRExample = lazy(() => import("@/pages/QRExample"));

export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* --- Public, default chrome --- */}
        <Route element={<AppShell />}>
          <Route path={PATHS.home} element={<Home />} />
          <Route path={PATHS.notFound} element={<NotFound />} />
          <Route path={PATHS.MapExample} element={< MapPickerExamplePage />} />
          <Route path={PATHS.QRExample} element={< QRExample />} />
        </Route>

        {/* --- Public, immersive (no chrome) --- */}
        <Route
          element={
            <AppShell showHeader={false} showFooter={false} px={0} py={0} maxW="container.md" />
          }
        >

        </Route>

        {/* --- Guest-only (login/register), no chrome, narrow --- */}
        <Route element={<GuestGuard />}>
          <Route element={<AppShell showFooter={false} maxW="md" />}>
            <Route path={PATHS.login} element={<Login />} />
            <Route path={PATHS.register} element={<Register />} />
          </Route>
        </Route>

        {/* --- Authenticated, default chrome --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        >
          {/* General protected */}
          <Route path={PATHS.dashboard} element={<Dashboard />} />
          <Route path={PATHS.jobs} element={<AvailabileJobs />} />
          <Route path={PATHS.jobApplication} element={<JobApplication />} />
          <Route path={PATHS.market} element={<Market />} />
          <Route path={PATHS.profile} element={<Profile />} />

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


          {/*---Worker ontly routes---*/}
          <Route path={PATHS.workerProfile} element={<RoleGuard allow={["farmer", "picker", "driver", "dManager", "industrialDeliverer"]

          } >
            <WorkerProfile />
          </RoleGuard>
          }></Route>


          {/* Driver-only */}
          <Route
            path={PATHS.driverSchedule}
            element={
              <RoleGuard allow={["driver"]}>
                <DriverSchedule />
              </RoleGuard>
            }
          />
          {/* Picker-only */}
          <Route
            path={PATHS.pickerDashboard}
            element={
              <RoleGuard allow={["picker"]}>
                <PickerDashboard />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.pickerTask}
            element={
              <RoleGuard allow={["picker"]}>
                <PickTaskPage />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.pickerSchedule}
            element={
              <RoleGuard allow={["picker"]}>
                <PickerSchedule />
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
          {/* CS Manager-only */}
          <Route
            path={PATHS.csManagerDashboard}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerDashboard />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.csManagerOrders}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerOrdersPage />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.csManagerShiftOrders}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerShiftOrders />
              </RoleGuard>
            }
          />
        </Route>

        {/* --- Authenticated, no FOOTER --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell showFooter={false} />
            </AuthGuard>
          }
        >
          <Route path={PATHS.cart} element={<Cart />} />
          <Route path={PATHS.checkout} element={<Checkout />} />
        </Route>

        {/* --- Authenticated, no FOOTER + wider --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell showFooter={true} maxW="5xl" />
            </AuthGuard>
          }
        >
          <Route path={PATHS.profile} element={<Profile />} />
        </Route>

        {/* --- Authenticated, no HEADER --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell showHeader={false} />
            </AuthGuard>
          }
        >
          <Route path={PATHS.deliveryNote} element={<DeliveryNote />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={PATHS.notFound} replace />} />
      </Routes>
    </Suspense>
  );
}