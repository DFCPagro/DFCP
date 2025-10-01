import AppRoutes from "@/routes/AppRoutes";
import { CartProvider } from "@/store/cart";
import CartHydrator from "@/components/layout/CartHydrator";

export default function App() {
  return (
    <CartProvider>
      <CartHydrator />
      <AppRoutes />
    </CartProvider>
  );
}
