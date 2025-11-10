// src/pages/csManagerDashboard/index.tsx
import { Box, Stack, Heading, Separator, SimpleGrid } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import {PATHS} from "@/routes/paths";
export default function CSManagerCustomers() {
    return (
        <Box p={6}>
            <Heading mb={4}>Customer Service Manager Dashboard</Heading>
            <Separator mb={4} />
        </Box>
    );
}