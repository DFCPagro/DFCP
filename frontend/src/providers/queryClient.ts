import { QueryClient } from "@tanstack/react-query";

const g = globalThis as unknown as { __queryClient?: QueryClient };

export const queryClient =
  g.__queryClient ??
  (g.__queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false },
    },
  }));
