import React from "react";
import { Box, IconButton, Badge } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/store/cart";

const CartIconButton: React.FC = () => {
  const { state } = useCart();
  const lines = state.items.length;          // distinct items
  // const totalKg = Math.round(state.items.reduce((a, it) => a + it.qtyKg, 0)); // alt badge

  return (
    <Box position="relative">
      <Link to="/cart">
        <IconButton aria-label="Open cart" variant="ghost" size="md">
          <ShoppingCart size={20} />
        </IconButton>
      </Link>

      {lines > 0 && (
        <Badge
          colorPalette="red"
          variant="solid"
          position="absolute"
          top="0"
          right="0"
          transform="translate(30%, -30%)"
          borderRadius="full"
          px="2"
          fontSize="0.7rem"
        >
          {lines}
          {/* or {totalKg} */}
        </Badge>
      )}
    </Box>
  );
};

export default CartIconButton;
