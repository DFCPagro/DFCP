import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import AuthGuard from "@/guards/AuthGuard";
import GuestGuard from "@/guards/GuestGuard";
import RoleGuard from '@/guards/RoleGuard';
import { PATHS } from "./paths";
// import JobApplication from "@/pages/JobApplication/index";

const Home                = lazy(() => import('@/pages/Home'));
const Login               = lazy(() => import('@/pages/Login'));
const Register            = lazy(() => import('@/pages/Register'));
const Dashboard           = lazy(() => import('@/pages/Dashboard'));
const DriverSchedule      = lazy(() => import('@/pages/DriverSchedule'));
const JobApplication      = lazy(() => import ('@/pages/JobApplication'))
const AvailabileJobs      = lazy(() => import ('@/pages/AvailableJobs'))
const AggregationsPage    = lazy(() => import('@/pages/Aggregations'));
const ContainersPage      = lazy(() => import('@/pages/Containers'));
const ShipmentsPage       = lazy(() => import('@/pages/Shipments'));
const OpsOrderPage        = lazy(() => import('@/pages/OpsOrder'));
const CustomerConfirmPage = lazy(() => import('@/pages/CustomerConfirm'));
const ArrivalConfirmPage  = lazy(() => import('@/pages/ArrivalConfirm'));
const AggregationViewPage = lazy(() => import('@/pages/AggregationView'));
const ContainerViewPage   = lazy(() => import('@/pages/ContainerView'));
const Market              = lazy(() => import('@/pages/Market'));
const NotFound            = lazy(() => import('@/pages/NotFound'));
const ItemManager         = lazy(() => import('@/pages/ItemManager'));

export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path={PATHS.home} element={<Home />} />
        <Route path={PATHS.login} element={<GuestGuard><Login /></GuestGuard>} />
        <Route path={PATHS.register} element={<GuestGuard><Register /></GuestGuard>} />
        <Route path={PATHS.jobs} element={<AvailabileJobs />} />
        <Route path="/job-application" element={<JobApplication />} />

        {/* Public QR endpoints */}
        <Route path={PATHS.ops} element={<OpsOrderPage />} />
        <Route path={PATHS.customerConfirm} element={<CustomerConfirmPage />} />
        <Route path={PATHS.arrivalConfirm} element={<ArrivalConfirmPage />} />
        <Route path={PATHS.aggregationView} element={<AggregationViewPage />} />
        <Route path={PATHS.containerView} element={<ContainerViewPage />} />

        {/* Authenticated routes */}
        <Route element={<AuthGuard />}>
          <Route path={PATHS.ItemsManagment} element={<ItemManager />} />

          <Route path={PATHS.dashboard} element={<Dashboard />} />
          {/* customer-only pages */}
          <Route path={PATHS.market} element={<Market />} />
          
          <Route path={PATHS.driverSchedule} element={<RoleGuard allow={['driver']}><DriverSchedule /></RoleGuard>} />
          {/* farmer-only pages */}
          <Route path={PATHS.aggregations} element={<RoleGuard allow={['farmer']}><AggregationsPage /></RoleGuard>} />
          <Route path={PATHS.containers}   element={<RoleGuard allow={['farmer']}><ContainersPage /></RoleGuard>} />

          {/* driver-only page */}
          <Route path={PATHS.shipments} element={<RoleGuard allow={['driver']}><ShipmentsPage /></RoleGuard>} />
        </Route>

        <Route path={PATHS.notFound} element={<NotFound />} />
        <Route path="*" element={<Navigate to={PATHS.notFound} replace />} />
      </Routes>
    </Suspense>
  );
}
