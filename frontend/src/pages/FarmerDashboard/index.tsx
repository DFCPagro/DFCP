// src/pages/farmer/index.tsx
import { useEffect, useState } from "react";
import { Container, Heading, Text } from "@chakra-ui/react";
import ApprovedShipmentsTable from "@/components/feature/farmer/ApprovedShipmentsTable";
import PendingRequestsTable from "@/components/feature/farmer/PendingRequestsTable";
import CropsTable from "@/components/feature/farmer/CropsTable";
import ApproveRequestDialog from "@/components/feature/farmer/modals/ApproveRequestDialog";
import StartPreparingDialog from "@/components/feature/farmer/modals/StartPreparingDialog";
import { fetchFarmerDashboard, approveShipmentRequest, startPreparingShipment } from "@/api/farmer";
import type { Shipment, ShipmentRequest, CropRow } from "@/types/farmer";

export default function FarmerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState<Shipment[]>([]);
  const [requests, setRequests] = useState<ShipmentRequest[]>([]);
  const [crops, setCrops] = useState<CropRow[]>([]);
  const [activeShipment, setActiveShipment] = useState<Shipment | null>(null);
  const [activeRequest, setActiveRequest] = useState<ShipmentRequest | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchFarmerDashboard();
      setApproved(data.approvedShipments);
      setRequests(data.shipmentRequests);
      setCrops(data.crops);
      setLoading(false);
    })();
  }, []);

  return (
    <Container maxW="7xl" py={6}>
      <Heading size="lg" mb={6}>Farmer Dashboard</Heading>

      {loading ? (
        <Text color="fg.muted">Loading…</Text>
      ) : (
        <>
          {/* 1) Approved Shipments (Next Pickup First) */}
          <ApprovedShipmentsTable
            rows={approved}
            onStart={(row) => setActiveShipment(row)}
          />

          {/* 2) Pending Shipment Requests */}
          <PendingRequestsTable
            rows={requests}
            onApprove={(row) => setActiveRequest(row)}
          />

          {/* 3) My Crops Status */}
          <CropsTable rows={crops} />
        </>
      )}

      {/* Modals (triggered from table actions) */}
      <StartPreparingDialog
        isOpen={!!activeShipment}
        onClose={() => setActiveShipment(null)}
        shipment={activeShipment}
        onStart={async () => {
          if (!activeShipment) return;
          await startPreparingShipment(activeShipment.id);
          setActiveShipment(null);
          // navigate(`/farmer/shipments/${activeShipment.id}`) — wire later if needed
        }}
      />

      <ApproveRequestDialog
        isOpen={!!activeRequest}
        onClose={() => setActiveRequest(null)}
        request={activeRequest}
        onApproved={async (approvedKg, validUntilISO) => {
          if (!activeRequest) return;
          await approveShipmentRequest(activeRequest.id, approvedKg, validUntilISO);

          // optimistic update: remove request and add to approved
          setRequests((prev) => prev.filter((r) => r.id !== activeRequest.id));
          setApproved((prev) => [
            ...prev,
            {
              id: `SHP-${Math.random().toString(36).slice(2, 7)}`,
              shipmentNumber: `SHP-${Math.floor(Math.random() * 900 + 100)}`,
              itemName: activeRequest.itemName,
              amountKg: approvedKg,
              containerCount: Math.max(1, Math.round(approvedKg / 5)),
              pickupTimeISO: activeRequest.pickupTimeISO,
              location: "LC - Pending Assignment",
            },
          ]);

          setActiveRequest(null);
        }}
      />
    </Container>
  );
}
