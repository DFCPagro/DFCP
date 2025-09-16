// App.tsx (when Chakra is already provided in main.tsx)
import NavBar from "@/components/layout/NavBar";
import AppRoutes from "@/routes/AppRoutes";
import { CartProvider } from "@/store/cart";

export default function App() {
  return (
    <CartProvider>
      <NavBar />
      <AppRoutes />
    </CartProvider>
  );
}
