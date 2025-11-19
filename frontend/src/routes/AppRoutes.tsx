// src/routes/index.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import AuthGuard from "@/guards/AuthGuard";
import GuestGuard from "@/guards/GuestGuard";
import RoleGuard from "@/guards/RoleGuard";
import { PATHS } from "./paths";
import AppShell from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/auth";

// Lazy imports...
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
const FarmerCropManagement = lazy(
  () => import("@/pages/farmer/FarmerCropManagement")
);
const FarmerOrderForShift = lazy(
  () => import("@/pages/farmer/farmerOrdersForShift")
);

// Deliverer pages
const DelivererDashboard = lazy(
  () => import("@/pages/deliverer/delivererDashboard")
);
const DelivererSchedule = lazy(
  () => import("@/pages/deliverer/delivererSchedule")
);


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
const PickerTasks = lazy(
  () => import("@/pages/opManager/picker-tasksManagement")
);
const StatisticsAnalytics = lazy(
  () => import("@/pages/Admin/StatisticsAnalytics")
);

const CSManagerOrdersPage = lazy(() => import("@/pages/csManager/Orders"));
const CSManagerShiftOrders = lazy(
  () => import("@/pages/csManager/shiftOrders")
);
const CSManagerDashboard = lazy(
  () => import("@/pages/csManager/Dashboard")
);
const CSManagerCustomers = lazy(
  () => import("@/pages/csManager/Customers")
);
const CSManagerAnalytics = lazy(
  () => import("@/pages/csManager/Analytics")
);
const CSManagerReportsInbox = lazy(
  () => import("@/pages/csManager/Orders/ReportsInbox")
);

const FManagerDashboard = lazy(() => import("@/pages/fManager/Dashboard"));
const FManagerItemManagement = lazy(
  () => import("@/pages/fManager/ItemManager")
);
const FManagerCreateStock = lazy(
  () => import("@/pages/fManager/CreateStock")
);
const FManagerShiftsFarmerOrder = lazy(
  () => import("@/pages/fManager/ShiftsFarmerOrder")
);
const FManagerViewFarmerOrders = lazy(
  () => import("@/pages/fManager/ViewFarmerOrders")
);
const FManagerViewFarmerList = lazy(
  () => import("@/pages/fManager/FarmerList")
);
const FarmerOrderReport = lazy(
  () => import("@/pages/FarmerOrderReport")
);

const TManagerDashboard = lazy(
  () => import("@/pages/TManager/dashboard")
);

const TManagerFarmerDeliveriesShiftDetails =lazy(
  ()=> import("@/pages/TManager/farmerDeliveries")
)

// Misc / Example
const MapPickerExamplePage = lazy(
  () => import("@/pages/MapExampleUsage")
);
const QRExample = lazy(() => import("@/pages/QRExample"));

function ScrollToTopOnMount() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return null;
}

// Landing: if logged in → Market, else → Login
function LandingRedirect() {
  const token = useAuthStore((s) => s.token);

  if (token) {
    return <Navigate to={PATHS.market} replace />;
  }

  return <Navigate to={PATHS.login} replace />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* --- Public, default chrome --- */}
        <Route element={<AppShell />}>
          {/* Home becomes a redirect to Market/Login */}
          <Route path={PATHS.home} element={<LandingRedirect />} />

          <Route
            path={PATHS.notFound}
            element={
              <>
                <NotFound />
                <ScrollToTopOnMount />
              </>
            }
          />

          <Route
            path={PATHS.MapExample}
            element={
              <>
                <MapPickerExamplePage />
                <ScrollToTopOnMount />
              </>
            }
          />
          <Route path={PATHS.QRExample} element={<QRExample />} />
          <Route
            path={PATHS.FarmerOrderReport}
            element={
              <>
                <FarmerOrderReport />
                <ScrollToTopOnMount />
              </>
            }
          />
        </Route>

        {/* --- Public, no Footer --- */}
        <Route
          element={
            <AppShell px={0} py={0} maxW="container.md" />
          }
        >
          <Route
            path={PATHS.logisticCenter}
            element={
              <>
                <ScrollToTopOnMount />
                <LogisticCenter />
              </>
            }
          />
        </Route>

        {/* --- Guest-only --- */}
        <Route element={<GuestGuard />}>
          <Route
            element={
              <>
                <AppShell
                  px={0}
                  py={0}
                  addSurroundingGap={true}
                  showFooter={false}
                  maxW="100hw"
                />
                <ScrollToTopOnMount />
              </>
            }
          >
            <Route
              path={PATHS.login}
              element={
                <>
                  <Login />
                  <ScrollToTopOnMount />
                </>
              }
            />
            <Route
              path={PATHS.register}
              element={
                <>
                  <Register />
                  <ScrollToTopOnMount />
                </>
              }
            />
          </Route>
        </Route>

        {/* --- Authenticated, default chrome --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell />
              <ScrollToTopOnMount />
            </AuthGuard>
          }
        >
          {/* --- Admin-only --- */}
          <Route
            path={PATHS.adminDashboard}
            element={
              <RoleGuard allow={["admin"]}>
                <ScrollToTopOnMount />
                <AdminDashboard />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.StatisticsAnalytics}
            element={
              <RoleGuard allow={["admin"]}>
                <StatisticsAnalytics />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.JobAppReview}
            element={
              <RoleGuard allow={["admin", "fManager"]}>
                <JobAppReview />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />

          <Route
            path={PATHS.cropHarvest}
            element={
              <RoleGuard allow={["admin"]}>
                <CropHarvest />
                <ScrollToTopOnMount />
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
                <ScrollToTopOnMount />
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
                <ScrollToTopOnMount />
                <WorkerProfile />
              </RoleGuard>
            }
          />

          {/* Driver-only */}
          <Route
            path={PATHS.delivererDashboard}
            element={
              <RoleGuard allow={["deliverer"]}>
                <DelivererDashboard />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.delivererSchedule}
            element={
              <RoleGuard allow={["deliverer"]}>
                <DelivererSchedule />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />

          {/* Picker-only */}
          <Route
            path={PATHS.pickerDashboard}
            element={
              <RoleGuard allow={["picker"]}>
                <PickerDashboard />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.pickerTask}
            element={
              <RoleGuard allow={["picker"]}>
                <PickTaskPage />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.pickerSchedule}
            element={
              <RoleGuard allow={["picker"]}>
                <PickerSchedule />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />

          {/* Farmer-only */}
          <Route
            path={PATHS.FarmerDashboard}
            element={
              <RoleGuard allow={["farmer", "admin"]}>
                <FarmerDashboard />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path="/farmer/farmerOrderForShift/:date/:shift"
            element={
              <RoleGuard allow={["farmer", "admin"]}>
                <FarmerOrderForShift />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.FarmerCropManagement}
            element={
              <RoleGuard allow={["farmer", "admin"]}>
                <FarmerCropManagement />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />

          {/* CS Manager-only */}
          <Route
            path={PATHS.csManagerDashboard}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerDashboard />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.csManagerReportsInbox}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerReportsInbox />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.csManagerCustomers}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerCustomers />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.csManagerOrders}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerOrdersPage />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.csManagerShiftOrders}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerShiftOrders />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.csManagerAnalytics}
            element={
              <RoleGuard allow={["csManager", "admin"]}>
                <CSManagerAnalytics />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />

          {/* OP Manager-only */}
          <Route
            path={PATHS.PickerTasksPage}
            element={
              <RoleGuard allow={["opManager", "admin"]}>
                <PickerTasks />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          {/* TManager-only */}
          <Route
            path={PATHS.TManagerDashboard}
            element={
              <RoleGuard allow={["tManager", "admin"]}>
                <TManagerDashboard />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.TManagerFarmerDeliveriesForShift}
            element={
              <RoleGuard allow={["tManager", "admin"]}>
                <TManagerFarmerDeliveriesShiftDetails />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />

          {/* F Manager-only */}
          <Route
            path={PATHS.fManagerDashboard}
            element={
              <RoleGuard allow={["fManager", "admin"]}>
                <FManagerDashboard />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.fManagerItemManagement}
            element={
              <RoleGuard allow={["fManager", "admin"]}>
                <FManagerItemManagement />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.fManagerCreateStock}
            element={
              <RoleGuard allow={["fManager", "admin"]}>
                <FManagerCreateStock />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.fManagerShiftsFarmerOrder}
            element={
              <RoleGuard allow={["fManager", "admin"]}>
                <FManagerShiftsFarmerOrder />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.fManagerViewFarmerOrders}
            element={
              <RoleGuard allow={["fManager", "admin"]}>
                <FManagerViewFarmerOrders />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
          <Route
            path={PATHS.fManagerViewFarmerList}
            element={
              <RoleGuard allow={["fManager", "admin"]}>
                <FManagerViewFarmerList />
                <ScrollToTopOnMount />
              </RoleGuard>
            }
          />
        </Route>

        {/* --- Authenticated, no FOOTER (customer checkout) --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell showFooter={false} maxW="5xl" />
              <ScrollToTopOnMount />
            </AuthGuard>
          }
        >
          <Route
            path={PATHS.checkout}
            element={
              <>
                <Checkout />
                <ScrollToTopOnMount />
              </>
            }
          />
        </Route>

        {/* --- Authenticated, yes FOOTER (customer pages) --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell showFooter={true} />
              <ScrollToTopOnMount />
            </AuthGuard>
          }
        >
          <Route
            path={PATHS.jobs}
            element={
              <>
                <AvailabileJobs />
                <ScrollToTopOnMount />
              </>
            }
          />
          <Route
            path={PATHS.jobApplication}
            element={
              <>
                <JobApplication />
                <ScrollToTopOnMount />
              </>
            }
          />
          <Route
            path={PATHS.orders}
            element={
              <>
                <Orders />
                <ScrollToTopOnMount />
              </>
            }
          />
          <Route
            path={PATHS.profile}
            element={
              <>
                <Profile />
                <ScrollToTopOnMount />
              </>
            }
          />
          <Route
            path={PATHS.market}
            element={
              <>
                <Market />
                <ScrollToTopOnMount />
              </>
            }
          />
        </Route>

        {/* --- Authenticated, no HEADER (delivery note) --- */}
        <Route
          element={
            <AuthGuard>
              <AppShell showHeader={false} />
              <ScrollToTopOnMount />
            </AuthGuard>
          }
        >
          <Route
            path={PATHS.deliveryNote}
            element={
              <>
                <DeliveryNote />
                <ScrollToTopOnMount />
              </>
            }
          />
        </Route>

        {/* Fallback */}
        <Route
          path="*"
          element={
            <>
              <Navigate to={PATHS.notFound} replace />
              <ScrollToTopOnMount />
            </>
          }
        />
      </Routes>
    </Suspense>
  );
}
