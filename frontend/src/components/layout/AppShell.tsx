import { Box, Container } from "@chakra-ui/react";
import { useColorModeValue } from "@/components/ui/color-mode";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import { Outlet } from "react-router-dom";
//import { Toaster } from "react-hot-toast"; // ← add

export type AppShellProps = {
  showHeader?: boolean;
  showFooter?: boolean;
  maxW?: string | number;
  px?: any;
  py?: any;
};

export default function AppShell({
  showHeader = true,
  showFooter = true,
  maxW = "7xl",
  px = { base: 3, md: 6 },
  py = { base: 4, md: 6 },
}: AppShellProps) {
  const bg = useColorModeValue("white", "gray.950");

  return (
    <Box minH="100dvh" bg={bg} display="flex" flexDir="column">
      {showHeader && <NavBar />}

      <Container as="main" maxW={maxW} px={px} py={py} flex="1 1 auto">
        <Outlet />
      </Container>

      {showFooter && <Footer />}
    </Box>
  );
}
