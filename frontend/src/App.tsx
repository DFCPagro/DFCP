// App.tsx (when Chakra is already provided in main.tsx)
import NavBar from "@/components/layout/NavBar";
import AppRoutes from "@/routes/AppRoutes";
import { CartProvider } from "@/store/cart";
import CartHydrator from "@/components/layout/CartHydrator";


export default function App() {
  return (
    <CartProvider>
        <CartHydrator /> {/* ← hydrates store from localStorage on app start */}
        <NavBar />
        <AppRoutes />
      </CartProvider>
  );
}
