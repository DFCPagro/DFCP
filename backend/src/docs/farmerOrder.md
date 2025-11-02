# FarmerOrder Domain Logic

## 1. What is a FarmerOrder?

A `FarmerOrder` is the object that tracks **a single incoming batch of product from a specific farmer for a specific shift/date at a specific Logistics Center**.

Think of it as "Farmer X will bring ~Y kg of Item Z to LC-1 on 2025-11-02 evening shift."

It is NOT:
- the customer order
- the warehouse container
- the AMS (Available Market Stock) listing

But it is the bridge between all of them.

It ties together:
- farmer commitment ("I'll bring 60kg of Fuji apples tomorrow evening")
- logistics planning (which LC, which shift)
- quality / inspection at intake
- containerization/labeling in the warehouse
- connection to customer demand & marketplace stock

This is one of the core ‘intake pipeline’ objects for the LC.

---

## 2. Key fields in the FarmerOrder model

### Identity / relations
- `itemId`: Which item (e.g. "Apple Fuji").
- `type`, `variety`, `pictureUrl`: denormalized snapshot from the item for UI cards so FE doesn't have to re-lookup `Item` every time.
- `farmerId`, `farmerName`, `farmName`: who is supplying this produce. Again we snapshot name/brand for dashboards and printing labels.

### Scheduling / logistics
- `pickUpDate` (string `"YYYY-MM-DD"`)
- `shift` (`"morning" | "afternoon" | "evening" | "night"`)
- `logisticCenterId`: which LC is expecting to receive this batch.

Together those 3 fields answer: "When and where are we receiving this from which farmer?"

We heavily index by `(logisticCenterId, pickUpDate, shift)` because dashboards and shift views filter exactly by that.

### Quantities / demand
- `orders[]`: array of `{ orderId, allocatedQuantityKg }`
  - every downstream customer order that will be fulfilled from this farmer’s batch
  - `allocatedQuantityKg` (aliased as `orderedQuantityKg`) is “how many kg from THIS farmerOrder are reserved for THAT specific customer order.”

- `sumOrderedQuantityKg`:
  - auto-computed sum of all `allocatedQuantityKg` in `orders[]`
  - aliased to `orderedQuantityKg` so it’s human readable in JSON

- `forcastedQuantityKg` (alias `forecastedQuantityKg` because spelling…)
  - how much the farmer *says* they'll bring
  - comes from planner / fManager when creating the FO, or from conversation with the farmer

- `finalQuantityKg`:
  - after actual weighing of containers at intake (and maybe after trimming rejects), how much really arrived
  - currently computed as `sumOrderedQuantityKg * 1.02` in `recalcQuantities()` (2% buffer)
  - in the future this will reflect real measured weight from containers

There is a pre-validate hook that always recomputes these aggregates so they stay consistent.

### farmerStatus (legacy)
- `farmerStatus`: `"pending" | "ok" | "problem"`
  - This used to be “is the farmer confirmed?” and UI still uses it in some places.
  - We are keeping it for backward compatibility.
  - BUT: the real source of truth for “is this blocked?” is now the stage pipeline (see below).

### Containers
- `containers[]`: subdocs for the physical bins/totes/crates that the farmer dropped off.
  - Each container gets its own QR code.
  - We track weight, staging location, etc.
  - This is created/managed by `initContainersForFarmerOrderService()` and `patchContainerWeightsService()`.

### Quality / inspection
- `farmersQSreport`: what the farmer claims re: quality standards (sugar/brix %, size, color %, etc.)
- `inspectionQSreport`: what our intake inspector measured
- `visualInspection`: quick pass/fail visual notes
- `inspectionStatus`: `"pending" | "passed" | "failed"`

Method `recomputeInspectionStatus()` sets `inspectionStatus`:
1. Requires `visualInspection.status === "ok"`
2. Requires both QS reports to exist
3. Compares farmer vs inspector numbers with tolerance (±2%) and grade
4. Marks `"passed"` or `"failed"`

These will later move to their own controller (planned).

### Audit trail
- `historyAuditTrail[]`: append-only log (`addAudit()`).
  - We call this whenever anything meaningful happens:
    - FO created
    - Stage changed
    - Farmer says "OK"
    - Containers added / weights updated
    - AMS item created

This is used for timeline in UI and for debugging “who touched what.”

---

## 3. Stage pipeline (a.k.a. intake workflow)

### Why do we have stages?
We need to track WHERE in the intake process this FarmerOrder is right now.

Examples of stage keys (from `FARMER_ORDER_STAGE_KEYS`):
- `farmerAck` — farmer acknowledged and committed
- `farmerQSrep` — farmer quality standards report in progress / review
- …etc (you already defined these in `shared/stage.types`)

**Two important fields drive this logic:**

- `stages[]`
  - Array of Stage subdocs.
  - Each stage has:
    - `key` (`farmerAck`, `farmerQSrep`, etc.)
    - `label`
    - `status`: `"pending" | "current" | "ok" | "done" | "problem"`
    - timestamps like `startedAt`, `completedAt`
    - `note`

- `stageKey`
  - The key of the stage that is considered "active"/in focus right now for this FarmerOrder.
  - There should be at most one stage with `status === "current"`.

We enforce valid keys and "only one 'current'" at the schema level using validators.

#### "Problem state"
A FarmerOrder is considered **halted / red** if the currently active stage has `status === "problem"`.

This is the NEW definition of "problem" for dashboards and ops.
This overrides `farmerStatus`.

```ts
isFarmerOrderProblem(fo) ⇒ true
  if fo.stageKey points at a stage with status === "problem"
