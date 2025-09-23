// src/components/common/CartIconButton.tsx
import { IconButton, Badge } from "@chakra-ui/react";
import { ShoppingCart } from "lucide-react";

export default function CartIconButton({ count = 0 }: { count?: number }) {
  return (
    <div style={{ position: "relative" }}>
      <IconButton aria-label="Cart" variant="solid">
        <ShoppingCart size={18} />
      </IconButton>
      {count > 0 && (
        <Badge
          colorPalette="red"
          style={{
            position: "absolute",
            top: -6,
            right: -6,
          }}
        >
          {count}
        </Badge>
      )}
    </div>
  );
}
