// src/routes/index.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import AuthGuard from "@/guards/AuthGuard";
import GuestGuard from "@/guards/GuestGuard";
import RoleGuard from "@/guards/RoleGuard";
import { PATHS } from "./paths";
import AppShell from "@/components/layout/AppShell";
import pick from '../../../backend/src/utils/pick';

// Lazy pages (unchanged) (no role)
const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const JobApplication = lazy(() => import("@/pages/JobApplication"));
const AvailabileJobs = lazy(() => import("@/pages/AvailableJobs"));
const NotFound = lazy(() => import("@/pages/NotFound"));

//unknown
const DriverSchedule = lazy(() => import("@/pages/DriverSchedule"));

//customer pages
const Checkout = lazy(() => import("@/pages/customer/Checkout"));
const Profile = lazy(() => import("@/pages/customer/Profile"));
const Orders = lazy(() => import("@/pages/customer/customerOrders"));
const DeliveryNote = lazy(() => import("@/pages/customer/DeliveryNote"));
const Market = lazy(() => import("@/pages/customer/Market"));


//farmer pages
const FarmerDashboard = lazy(() => import("@/pages/farmer/FarmerDashboard"));
const FarmerCropManagement = lazy(() => import("@/pages/farmer/FarmerCropManagement"));

//picker pages
const PickerDashboard = lazy(() => import("@/pages/picker/picker-dashboard"));
const PickTaskPage = lazy(() => import("@/pages/picker/pick-task"));
const PickerSchedule = lazy(() => import("@/pages/picker/picker-Schedule"));

//admin pages (added to respected manager list later)
const WorkerProfile = lazy(() => import("@/pages/workerProfile"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const JobAppReview = lazy(() => import("@/pages/JobAppReview"));
const CropHarvest = lazy(() => import("@/pages/AdminExpectedHarvest"));
const PackageSizesPage = lazy(() => import("@/pages/packageSizes"));
const LogisticCenter = lazy(() => import("@/pages/LogisticCenter"));
const PickerTasks = lazy(() => import("@/pages/opManager/pickerTasks"));

//csManager pages
const CSManagerOrdersPage = lazy(() => import("@/pages/csManager/Orders"));
const CSManagerShiftOrders = lazy(() => import("@/pages/csManager/shiftOrders"));
const CSManagerDashboard = lazy(() => import("@/pages/csManager/Dashboard"));

//fManager pages
const FManagerDashboard = lazy(() => import("@/pages/fManager/Dashboard"));
const FManagerItemManagement = lazy(() => import("@/pages/fManager/ItemManager"));
const FManagerCreateStock = lazy(() => import("@/pages/fManager/CreateStock"));
const FManagerShiftsFarmerOrder = lazy(() => import("@/pages/fManager/ShiftsFarmerOrder"));
const FManagerJobAppReview = lazy(() => import("@/pages/JobAppReview"));









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
        {/* --- Public, no Footer --- */}
        <Route
          element={
            <AppShell showFooter={false} px={0} py={0} maxW="container.md" />
          }
        >
          <Route path={PATHS.logisticCenter} element={< LogisticCenter />} />
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
              <RoleGuard allow={["admin", "fManager"]}>
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
          <Route path={PATHS.ItemsManagment} element={<FManagerItemManagement />} />

          {/* Package sizes (admin + dManager) */}
          <Route
            path={PATHS.PackageSizes}
            element={
              <RoleGuard allow={["admin", "tManager"]}>
                <PackageSizesPage />
              </RoleGuard>
            }
          />


          {/*---Worker ontly routes---*/}
          <Route path={PATHS.workerProfile} element={<RoleGuard allow={["farmer", "picker", "deliverer", "tManager", "industrialDeliverer"]

          } >
            <WorkerProfile />
          </RoleGuard>
          }></Route>


          {/* Driver-only */}
          <Route
            path={PATHS.driverSchedule}
            element={
              <RoleGuard allow={["deliverer"]}>
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
            path={PATHS.FarmerDashboard}
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
          {/* F Manager-only */}
          <Route
            path={PATHS.fManagerDashboard}
            element={<RoleGuard allow={["fManager"]}>
              <FManagerDashboard />
            </RoleGuard>}
          />
          <Route
            path={PATHS.fManagerItemManagement}
            element={<RoleGuard allow={["fManager"]}>
              <FManagerItemManagement />
            </RoleGuard>}
          />
          <Route
            path={PATHS.fManagerCreateStock}
            element={<RoleGuard allow={["fManager"]}>
              <FManagerCreateStock />
            </RoleGuard>}
          />
          <Route
            path={PATHS.fManagerShiftsFarmerOrder}
            element={<RoleGuard allow={["fManager"]}>
              <FManagerShiftsFarmerOrder />
            </RoleGuard>}
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