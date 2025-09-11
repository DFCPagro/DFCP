import { Badge } from "@chakra-ui/react";
import { useSessionStore } from "@/store/session";

export default function ModeBadge() {
  const mode = useSessionStore((s) => s.mode);
  const role = useSessionStore((s) => s.activeWorkerRole);

  if (mode === "customer") {
    return <Badge variant="subtle" colorScheme="green">Customer</Badge>;
  }
  // Work mode
  return (
    <Badge variant="subtle" colorScheme="purple">
      Work{role ? `: ${role}` : ""}
    </Badge>
  );
}
