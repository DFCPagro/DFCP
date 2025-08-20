import { Routes, Route, Link } from "react-router-dom";
import RequireAuth from "./routes/RequireAuth";
import RedirectIfAuth from "./routes/RedirectIfAuth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import NavBar from "./components/layout/NavBar";
import { Box, Heading, Text } from "@chakra-ui/react";
import DriverSchedule from "./pages/DriverSchedule";
function Home() {
  return (
    <Box p={6}>
      <Heading size="lg">Home</Heading>
      <Text mt={2}>
        This is public. Try the <Link to="/dashboard">Dashboard</Link>.
      </Text>
    </Box>
  );
}

export default function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />

        <Route
          path="/login"
          element={
            <RedirectIfAuth>
              <Login />
            </RedirectIfAuth>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuth>
              <Register />
            </RedirectIfAuth>
          }
        />

        <Route path="/driver-schedule" element={<DriverSchedule/>} />

        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        <Route path="*" element={<Box p={6}>Not found</Box>} />
      </Routes>
    </>
  );
}
