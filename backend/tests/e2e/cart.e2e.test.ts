// tests/e2e/cart.e2e.test.ts
import { Types } from "mongoose";
import ShiftConfig from "../../src/models/shiftConfig.model";
import { AvailableMarketStockModel } from "../../src/models/availableMarketStock.model";
import AppConfig from "../../src/models/appConfig.model";
import Cart from "../../src/models/cart.model";
import LogisticsCenter from "../../src/models/logisticsCenter.model";
import {
  addItemToCart,
  removeItemFromCart,
  clearCart,
  checkoutCart,
  refreshCartExpiry,
  wipeCartsForShift,
} from "../../src/services/cart.service";
import { reclaimExpiredCarts } from "../../src/jobs/cart.reclaimer";

const objId = () => new Types.ObjectId();
const utcMidnightToday = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
const utcMinutesNow = () => {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
};

describe("Cart e2e (global shifts)", () => {
  let LCid: Types.ObjectId;
  let LCscope: string;
  let availableDate: Date; // today 00:00 UTC
  const shiftName = "morning" as const;
  let generalEndMin: number; // we’ll set this to “now + 10m”
  let amsId: Types.ObjectId;
  let amsItemId: Types.ObjectId;
  const userId = objId();

  // Build indexes once to avoid IX-lock flakes during first transactional-ish write
  beforeAll(async () => {
    await Promise.all([
      AvailableMarketStockModel.init(),
      Cart.init(),
      ShiftConfig.init(),
      AppConfig.init(),
      LogisticsCenter.init(),
    ]);
  });

  beforeEach(async () => {
    availableDate = utcMidnightToday();

    // Make sure shift end is in the FUTURE (now + 10 minutes), and within [0..1439]
    generalEndMin = Math.min(1439, utcMinutesNow() + 10);

    // Create a real LC (so LCid exists and AppConfig scope = LCid hex)
    const LC = await LogisticsCenter.create({
      logisticName: "LC Tel Aviv",
      location: { name: "TA Hub", geo: { type: "Point", coordinates: [34.78, 32.08] } },
      employeeIds: [],
      deliveryHistory: [],
    });
    LCid = LC._id as Types.ObjectId;
    LCscope = LCid.toHexString();

    // Global shift config for this shift; ends ~10 minutes from now
    await ShiftConfig.create({
      name: shiftName,
      timezone: "Asia/Jerusalem",
      generalStartMin: 0,
      generalEndMin,
      industrialDelivererStartMin: 0,
      industrialDelivererEndMin: generalEndMin,
      delivererStartMin: 0,
      delivererEndMin: generalEndMin,
      deliveryTimeSlotStartMin: 0,
      deliveryTimeSlotEndMin: generalEndMin,
      slotSizeMin: 30,
    });

    // Per-LC inactivity override via scope string (use LC _id hex)
    await AppConfig.create({ scope: LCscope, inactivityMinutes: 5, updatedBy: "test" });

    // AMS with one active line (10 kg)
    amsItemId = objId();
    const itemId = objId();
    const farmerId = objId();

    const ams = await AvailableMarketStockModel.create({
      availableDate,
      availableShift: shiftName,
      LCid,
      createdById: null,
      items: [
        {
          _id: amsItemId,
          itemId,
          displayName: "Tomatoes Cherry",
          imageUrl: null,
          category: "vegetables",
          pricePerUnit: 12.5,
          currentAvailableQuantityKg: 10,
          originalCommittedQuantityKg: 10,
          farmerOrderId: null,
          farmerID: farmerId,
          farmerName: "Farmer Zeev",
          farmName: "Sunny Farm",
          status: "active",
        },
      ],
    });

    amsId = ams._id as Types.ObjectId;
  });

  it("addItemToCart reserves stock, creates cart, expiry respects AppConfig and shift end", async () => {
    const before = await AvailableMarketStockModel.findById(amsId);
    expect(before?.items[0].currentAvailableQuantityKg).toBe(10);

    const cart = await addItemToCart({
      userId,
      availableMarketStockId: amsId,
      amsItemId,
      amountKg: 2,
    });

    const after = await AvailableMarketStockModel.findById(amsId);
    expect(after?.items[0].currentAvailableQuantityKg).toBe(8);

    expect(cart.userId).toBeDefined();
    expect(String(cart.availableMarketStockId)).toBe(String(amsId));
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].amountKg).toBe(2);

    // Expiry should be in the future (~<= 5 minutes, since shift ends ~10 minutes away)
    const now = Date.now();
    const exp = new Date(cart.expiresAt).getTime();
    expect(exp - now).toBeGreaterThan(0);
    expect(exp - now).toBeLessThanOrEqual(5 * 60 * 1000 + 2_000);
  });

  it("removeItemFromCart returns stock (partial and full remove)", async () => {
    const c1 = await addItemToCart({ userId, availableMarketStockId: amsId, amsItemId, amountKg: 3 });

    // String() guard makes this reliable regardless of ObjectId/string in the lean doc
    const cartId = new Types.ObjectId(String(c1._id));
    const cartItemId = new Types.ObjectId(String(c1.items[0]._id));

    // partial remove 1.5 kg
    const c2 = await removeItemFromCart({ userId, cartId, cartItemId, amountKg: 1.5 });
    expect(c2.items[0].amountKg).toBe(1.5);
    let ams = await AvailableMarketStockModel.findById(amsId);
    expect(ams?.items[0].currentAvailableQuantityKg).toBe(8.5); // 10 - 3 + 1.5

    // remove remaining (omit amountKg)
    const c3 = await removeItemFromCart({ userId, cartId, cartItemId });
    expect(c3.items.length).toBe(0);
    ams = await AvailableMarketStockModel.findById(amsId);
    expect(ams?.items[0].currentAvailableQuantityKg).toBe(10);
  });

  it("clearCart returns all stock and marks cart abandoned", async () => {
    const c1 = await addItemToCart({ userId, availableMarketStockId: amsId, amsItemId, amountKg: 4 });
    const cartId = new Types.ObjectId(String(c1._id));

    await clearCart({ userId, cartId });
    const ams = await AvailableMarketStockModel.findById(amsId);
    expect(ams?.items[0].currentAvailableQuantityKg).toBe(10);

    const cartDb = await Cart.findById(cartId);
    expect(cartDb?.status).toBe("abandoned");
    expect(cartDb?.items?.length).toBe(0);
  });

  it("checkoutCart marks checkedout and keeps stock deducted", async () => {
    const c1 = await addItemToCart({ userId, availableMarketStockId: amsId, amsItemId, amountKg: 2.5 });
    const cartId = new Types.ObjectId(String(c1._id));

    const out = await checkoutCart({ userId, cartId });
    expect(out.status).toBe("checkedout");

    const ams = await AvailableMarketStockModel.findById(amsId);
    expect(ams?.items[0].currentAvailableQuantityKg).toBe(7.5);
  });

  it("refreshCartExpiry picks up new AppConfig", async () => {
    const c1 = await addItemToCart({ userId, availableMarketStockId: amsId, amsItemId, amountKg: 1 });
    const cartId = new Types.ObjectId(String(c1._id));
    const firstExp = new Date(c1.expiresAt).getTime();

    // change per-LC inactivity to 1 minute
    await AppConfig.findOneAndUpdate({ scope: LCscope }, { $set: { inactivityMinutes: 1 } });

    const c2 = await refreshCartExpiry(cartId);
    const nextExp = new Date(c2.expiresAt).getTime();

    expect(nextExp).toBeGreaterThan(Date.now() - 100);
    expect(nextExp).toBeLessThan(firstExp); // shorter inactivity picked up
  });

  it("reclaimExpiredCarts returns stock and deletes cart when expired", async () => {
    const c1 = await addItemToCart({ userId, availableMarketStockId: amsId, amsItemId, amountKg: 2 });
    const cartId = new Types.ObjectId(String(c1._id));

    // force expiry
    await Cart.findByIdAndUpdate(cartId, { $set: { expiresAt: new Date(Date.now() - 60_000) } });

    await reclaimExpiredCarts();

    const ams = await AvailableMarketStockModel.findById(amsId);
    expect(ams?.items[0].currentAvailableQuantityKg).toBe(10);

    const gone = await Cart.findById(cartId);
    expect(gone).toBeNull();
  });

  it("wipeCartsForShift empties carts WITHOUT returning stock (global)", async () => {
    const c1 = await addItemToCart({ userId, availableMarketStockId: amsId, amsItemId, amountKg: 3 });
    const cartId = new Types.ObjectId(String(c1._id));

    await wipeCartsForShift({ availableDate, shiftName, hardDelete: false });

    const cartDb = await Cart.findById(cartId);
    expect(cartDb?.status).toBe("expired");
    expect(cartDb?.items?.length).toBe(0);

    // AMS NOT restored (shift-end semantics)
    const ams = await AvailableMarketStockModel.findById(amsId);
    expect(ams?.items[0].currentAvailableQuantityKg).toBe(7);
  });
});
