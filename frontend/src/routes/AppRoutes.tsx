// src/routes/index.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import AuthGuard from "@/guards/AuthGuard";
import GuestGuard from "@/guards/GuestGuard";
import RoleGuard from "@/guards/RoleGuard";
import { PATHS } from "./paths";
import AppShell from "@/components/layout/AppShell";


// Lazy imports...
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
const CSManagerCustomers = lazy(() => import("@/pages/csManager/Customers"));
const CSManagerAnalytics = lazy(() => import("@/pages/csManager/Analytics"));
const CSManagerReportsInbox = lazy(() => import("@/pages/csManager/Orders/ReportsInbox"));

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
          <Route path={PATHS.FarmerOrderReport} element={< FarmerOrderReport />} />

        </Route>

        {/* --- Public, no Footer --- */}
        <Route element={<AppShell px={0} py={0} maxW="container.md" />}>
          <Route path={PATHS.logisticCenter} element={<LogisticCenter />} />
        </Route>

        {/* --- Guest-only --- */}
        <Route element={<GuestGuard />}>
          <Route
            element={
              <AppShell
                px={0}
                py={0}
                addSurroundingGap={true}
                showFooter={false}
                maxW="100hw"
              />
            }
          >
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
          {/* --- Admin-only --- */}
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
          <Route
            path={PATHS.ItemsManagment}
            element={<FManagerItemManagement />}
          />

          {/* Package sizes */}
          <Route
            path={PATHS.PackageSizes}
            element={
              <RoleGuard allow={["admin", "tManager"]}>
                <PackageSizesPage />
              </RoleGuard>
            }
          />

          {/* Worker routes */}
          <Route
            path={PATHS.workerProfile}
            element={
              <RoleGuard
                allow={[
                  "farmer",
                  "picker",
                  "deliverer",
                  "tManager",
                  "industrialDeliverer",
                ]}
              >
                <WorkerProfile />
              </RoleGuard>
            }
          />

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
              <RoleGuard allow={["farmer","admin"]}>
                <FarmerDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="/farmer/farmerOrderForShift/:date/:shift"
            element={
              <RoleGuard allow={["farmer","admin"]}>
                <FarmerOrderForShift />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.FarmerCropManagement}
            element={
              <RoleGuard allow={["farmer","admin"]}>
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
            path={PATHS.csManagerReportsInbox}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerReportsInbox />
              </RoleGuard>
            }
          />  
              <Route
            path={PATHS.csManagerCustomers}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerCustomers />
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
                   <Route
            path={PATHS.csManagerAnalytics}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerAnalytics />
              </RoleGuard>
            }
          />

          {/* OP Manager-only */}
          <Route
            path={PATHS.PickerTasksPage}
            element={
              <RoleGuard allow={["opManager", "admin"]}>
                <PickerTasks />
              </RoleGuard>
            }
          />

          {/* F Manager-only */}
          <Route
            path={PATHS.fManagerDashboard}
            element={
              <RoleGuard allow={["fManager","admin"]}>
                <FManagerDashboard />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.fManagerItemManagement}
            element={
              <RoleGuard allow={["fManager","admin"]}>
                <FManagerItemManagement />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.fManagerCreateStock}
            element={
              <RoleGuard allow={["fManager","admin"]}>
                <FManagerCreateStock />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.fManagerShiftsFarmerOrder}
            element={
              <RoleGuard allow={["fManager","admin"]}>
                <FManagerShiftsFarmerOrder />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.fManagerViewFarmerOrders}
            element={
              <RoleGuard allow={["fManager","admin"]}>
                <FManagerViewFarmerOrders />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.fManagerViewFarmerList}
            element={
              <RoleGuard allow={["fManager","admin"]}>
                <FManagerViewFarmerList />
              </RoleGuard>
            }
          />
        </Route>

        {/* --- Authenticated, no FOOTER (customer checkout) --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell showFooter={false} maxW="5xl" />
            </AuthGuard>
          }
        >
          <Route path={PATHS.checkout} element={<Checkout />} />
        </Route>

        {/* --- Authenticated, yes FOOTER (customer pages) --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell showFooter={true} />
            </AuthGuard>
          }
        >
          <Route path={PATHS.jobs} element={<AvailabileJobs />} />
          <Route path={PATHS.jobApplication} element={<JobApplication />} />
          <Route path={PATHS.orders} element={<Orders />} />
          <Route path={PATHS.profile} element={<Profile />} />
          <Route path={PATHS.market} element={<Market />} />
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
