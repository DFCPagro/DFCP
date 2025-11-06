import { Box, Container } from "@chakra-ui/react";
import { useColorModeValue } from "@/components/ui/color-mode";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import { Outlet } from "react-router-dom";
//import { Toaster } from "react-hot-toast"; // ← add

export type AppShellProps = {
  showHeader?: boolean;
  showFooter?: boolean;
  addSurroundingGap?: boolean;
  maxW?: string | number;
  px?: any;
  py?: any;
};

export default function AppShell({
  showHeader = true,
  showFooter = false,
  addSurroundingGap = false,
  maxW = "7xl",
  px = { base: 3, md: 6 },
  py = { base: 4, md: 6 },
}: AppShellProps) {
  const bg = useColorModeValue("white", "gray.950");

  // Choose which wrapper to use for <main>
  const Main = addSurroundingGap ? Box : Container;

  return (
    <Box minH="100dvh" bg={bg} display="flex" flexDir="column">
      {showHeader && <NavBar />}

      <Main as="main" maxW={maxW} px={px} py={py} flex="1 1 auto">
        <Outlet />
      </Main>

      {showFooter && <Footer />}
    </Box>
  );
}
