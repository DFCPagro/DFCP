import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import AuthGuard from "@/guards/AuthGuard";
import GuestGuard from "@/guards/GuestGuard";
import { PATHS } from "./paths";

const Home = lazy(() => import("@/pages/Home"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const OrdersPage = lazy(() => import("@/pages/Orders"))
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const DriverSchedule = lazy(() => import("@/pages/DriverSchedule"));
const NotFound = lazy(() => import("@/pages/NotFound"));
export default function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        {/* Public */}
        <Route path={PATHS.home} element={<Home />} />
        <Route path="/orders-list" element={<OrdersPage/>}/>
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

        {/* Protected */}
        <Route element={<AuthGuard />}>
          <Route path={PATHS.dashboard} element={<Dashboard />} />
          <Route path={PATHS.driverSchedule} element={<DriverSchedule />} />
        </Route>

        {/* 404 page (direct) */}
        <Route path={PATHS.notFound} element={<NotFound />} />

        {/* Redirect any unknown path to /404 */}
        <Route path="*" element={<Navigate to={PATHS.notFound} replace />} />
      </Routes>
    </Suspense>
  );
}
