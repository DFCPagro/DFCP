import type { Container as FoContainer, ContainerQR, FarmerOrder, PrintPayload } from "@/api/farmerOrders"

export const mockMode = true

export function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

const mockMakeToken = () =>
  `QR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export function mockPayload(id: string, containers = 0): PrintPayload {
  const base: FarmerOrder = {
    _id: id,
    itemId: "66e0item0000000000000001",
    type: "Tomato",
    variety: "Cluster",
    pictureUrl:
      "https://images.unsplash.com/photo-1546470427-c5b384e0b66b?q=80&w=420&fit=crop",
    pickUpDate: "2025-11-07",
    shift: "morning",
    farmerName: "Moshe Levi",
    farmName: "Levi Farms – Valley A",
    farmerId: "66e0farmer0000000000000001",
    logisticCenterId: "66e007000000000000000001",
    forcastedQuantityKg: 520,
    containers: [],
    farmerStatus: "pending",
    pickupAddress: "Moshav HaYogev 12, Emek Yizrael",
  }

  const cQrs: ContainerQR[] = []
  const foContainers: FoContainer[] = []
  for (let i = 1; i <= containers; i++) {
    const cid = `${id}_${i}`
    foContainers.push({ containerId: cid, weightKg: 0 })
    cQrs.push({
      token: mockMakeToken(),
      sig: mockMakeToken().slice(0, 16),
      scope: "container",
      subjectType: "Container",
      subjectId: cid,
    })
  }

  return {
    farmerOrder: { ...base, containers: foContainers },
    farmerOrderQR: {
      token: mockMakeToken(),
      sig: mockMakeToken().slice(0, 16),
      scope: "farmer-order",
    },
    containerQrs: cQrs,
  }
}
