import React from "react";
import ReactDOM from "react-dom/client";
import { Provider as ChakraProvider} from "@/components/ui/provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "./providers/queryClient";
import App from "./App";
import { Toaster } from "@/components/ui/toaster";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ChakraProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster />
        </BrowserRouter>
      </QueryClientProvider>
    </ChakraProvider>
  </React.StrictMode>
);
