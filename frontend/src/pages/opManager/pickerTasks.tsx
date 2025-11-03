import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Heading,
  Stack,
  HStack,
  Text,
  Separator,
  Spinner,
  Alert,
  Button,
} from "@chakra-ui/react";

export default function tasksForShift(){
  return (
    <Box>
      <Heading>Tasks for Shift</Heading>
      {/* Add your task components here */}
    </Box>
  );
} 