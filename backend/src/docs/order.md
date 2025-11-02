# Order Domain Logic

## 1. What is an Order?

An `Order` = "what the customer actually bought".

It is a snapshot at checkout of:
- which items (each tied back to a specific farmer batch / FarmerOrder),
- how much was reserved for them from AvailableMarketStock,
- where and when it should be delivered,
- and how much we estimate they’ll pay.

Important: an Order represents *customer demand*, not just a cart.  
After creation, it becomes the unit that warehouse packers will physically pick and weigh, and that drivers will deliver.

An Order also becomes traceability glue:
- Every line in the order knows which `farmerOrderId` supplied that product.
- Later, if there’s a complaint ("the cucumbers were bad"), we can trace back to the farmer and container.

---

## 2. Core fields in the `Order` model

### Customer + delivery info
- `customerId`: which user placed it.
- `deliveryAddress`: embedded snapshot of address at checkout (not just an ID).  
  This avoids issues if the user later edits their address.
- `deliveryDate`: actual Date, in UTC, when the order is scheduled to go out.
- `shiftName`: `"morning" | "afternoon" | "evening" | "night"`.  
  Which shift will handle fulfillment.
- `LogisticsCenterId`: which LC will fulfill and deliver.

Together, these define the "when/where to send this box."

### Link back to inventory (AMS)
- `amsId`: which `AvailableMarketStock` snapshot we sold from.
  - This guarantees the price, farmer, and stock are consistent with what was available at checkout.
  - Also lets ops audit "what did we promise to sell this shift?"

### Items[]
`items` is an array of line items (see section 3).  
Each line includes:
- which product,
- which farmer batch,
- reserved quantities,
- and future final/actual weight info from packing.

This is super important: we store all the pricing, farmer attribution, and quantity info *inside the order line*, so we don’t have to re-query AMS or FarmerOrder later.

### Stage pipeline for the order
- `stageKey`: which operational stage the order is currently in (e.g. `"pending"`, `"packing"`, `"out_for_delivery"`, `"delivered"`, `"problem"` … see your `ORDER_STAGE_KEYS`).
- `stages[]`: timeline of stages with status like `"current"`, `"done"`, `"ok"`, `"problem"`, timestamps, notes.

Exactly like `FarmerOrder`, but for the customer order flow.

We consider an order "problem" if `stages[stageKey].status === "problem"`.  
This is how dashboards count "problem orders".

### Money + weight snapshots
We keep two sets:

**Before packing (estimate)**
- `itemsSubtotal`
- `deliveryFee`
- `totalPrice`
- `totalOrderWeightKg`

These are based on the *estimated weight*, not final packed weight.

**After packing (final)**
- `finalItemsSubtotal`
- `finalTotalPrice`
- `finalOrderWeightKg`

These only get populated once we have real weights on each line.
Before that, they can be `undefined`.

### Tolerance
- `tolerancePct` (default 0.1 = 10%)

Customers order produce that doesn't have exact weight (like "3 cucumbers" or "1kg tomatoes").  
Actual pack weight will always drift a bit.  
We allow final packed weight to be up to +tolerance compared to the estimated.

This tolerance is enforced per line.

### Delivery assignment (future / WIP)
- `assignedDelivererId`: which driver should deliver.
- `customerDeliveryId`: link to the eventual "delivery/route stop" object.

You already model them in the schema, even if you haven't fully built the delivery service yet.  
This gives you a clean upgrade path to routing, driver app screens, proof-of-delivery, etc.

### Audit
- `historyAuditTrail[]`: append-only log of actions on the order (`addAudit()`).
  Used for debugging and UI timeline (“packed by Miriam 14:20”, “out for delivery 15:05”, etc.).

---

## 3. Order line items: kg, units, mixed, and final weights

Each entry in `items[]` (from `OrderItemSchema`) captures:

- `itemId`, `name`, `imageUrl`, `category`  
  (snapshot so we can render order history even if Item changes later)

- `farmerOrderId`  
  The specific `FarmerOrder` batch this line is sourced from.  
  This is huge for traceability and for decrementing farmer stock.

- `sourceFarmerName`, `sourceFarmName`  
  Snapshot of who actually grew it. Also used in UI ("Your cucumbers from Yousef Haddad / Galilee Farm").

- `unitMode`  
  `"kg" | "unit" | "mixed"`

  - `"kg"` means “I want X kg”.
  - `"unit"` means “I want X pieces (units)”.
  - `"mixed"` means “some kg + some pieces” (like: "1kg + 2 extra peppers").

- `quantityKg` and `units`  
  The requested amount (estimated), normalized at checkout.

- `estimatesSnapshot.avgWeightPerUnitKg`  
  How heavy 1 unit is expected to be in kg, based on AvailableMarketStock for that farmerOrder.  
  Required for `"unit"` and `"mixed"` lines to calculate estimated kg.

- `pricePerUnit` and `pricePerKg`  
  Snapshot of the price-per-kg from AMS at checkout.  
  `derivedUnitPrice` is just a helper we compute for the UI if it's per-piece ("~₪2.10 per cucumber" style).

- `finalWeightKg`  
  The real packed weight for THIS line, once warehouse actually picks and weighs it.
  This is the ground truth you charge for.

- `finalizedBy`, `finalizedAt`  
  Who packed/confirmed that line and when.

### Validation rules on a line
We validate each line in `OrderItemSchema.pre("validate")`:

- For `unitMode="kg"` → must have `quantityKg > 0`.
- For `unitMode="unit"` → must have `units > 0` AND a valid avgWeightPerUnitKg.
- For `unitMode="mixed"` → must have (quantityKg > 0 OR units > 0), and if `units > 0` then avgWeightPerUnitKg must be valid.

We also enforce tolerance when `finalWeightKg` is set:
- We compute the estimated effective kg for that line (kg + units*avgWeightPerUnitKg).
- We compare `finalWeightKg` vs estimated*(1 + tolerancePct on the parent Order).
- If it's too high, error (or optionally cap to tolerance, see `applyPackingWeights()` below).

### How we compute money/weight totals
We expose 3 helper-style methods on each line:

- `estimatedEffectiveKg()`  
  = `quantityKg + units * avgWeightPerUnitKg` (rounded to 0.001kg)

- `estimatedLineSubtotal()`  
  = estimatedEffectiveKg * pricePerUnit (rounded to cents)

- `finalLineSubtotal()`  
  = finalWeightKg * pricePerUnit, if finalWeightKg exists.

The Order uses those to roll up totals.

---

## 4. The Order pipeline (stages)

Orders move through operational stages defined in `ORDER_STAGE_KEYS` / `ORDER_STAGE_LABELS`.

Examples:
- `"pending"` (order placed, waiting for LC to start work)
- `"packing"`
- `"out_for_delivery"`
- `"delivered"`
- `"problem"` (halted, CS/ops needs to look)

Two important fields handle pipeline state:
- `stageKey`: which stage is currently active
- `stages[]`: timeline entries `{ key, status, startedAt, completedAt, note, ... }`

Just like `FarmerOrder`, stage entries can have `status` like:
- `"current"` (we're in this stage now)
- `"done"` (this stage is completed)
- `"ok"` (passed/cleared)
- `"problem"` (halted / escalation needed)

### "problem" logic
We consider an order "problem" if the `stages` entry for `stageKey` has `status === "problem"`.

This is how dashboards get `problemCount` for a shift.  
We do NOT look at an old `status` field — that doesn't exist on Order.  
The dashboard (CS Manager view) is fully stage-driven now.

### Initialization
When we first create the order, we call:

```ts
initOrderStagesAndAudit(orderDoc, customerOID, itemsCount)
