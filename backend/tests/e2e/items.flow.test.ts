/**
 * E2E tests for /items
 * - Uses mongodb-memory-server (replica set) via global test setup (tests/setup/int-db.ts)
 * - Uses real controllers/services/model
 * - Mocks auth middleware to inject roles
 * - Seeds using your real db/seeds/dev/items.seeder
 */

import request from "supertest";
import express, { json } from "express";
import mongoose, { Types } from "mongoose";

import itemsRouter from "@/routes/items.route";
import ItemModel from "@/models/Item.model";

// ✅ use your real seeder (no connect/disconnect inside)
import { seedItems } from "../../db/seeds/dev/items.seeder";

// ---- Mock the auth middleware exactly by module id "@/middlewares/auth" ----
jest.mock("@/middlewares/auth", () => ({
  /**
   * For protected routes, always act as an authenticated admin
   */
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: "u1", role: "admin" };
    next();
  },

  /**
   * For public GET routes: act as guest unless header x-test-role is provided.
   * If x-test-role is present, attach req.user with that role so controllers can return full data.
   */
  authenticateIfPresent: (req: any, _res: any, next: any) => {
    const role = req.header?.("x-test-role");
    if (role) req.user = { id: "guest-impersonated", role };
    next();
  },

  /**
   * Standard authorize check against the single role string
   */
  authorize:
    (...allowed: string[]) =>
    (req: any, res: any, next: any) => {
      const role: string | undefined = req.user?.role;
      return role && allowed.includes(role)
        ? next()
        : res.status(403).json({ message: "Forbidden" });
    },
}));

// ---- Express test app using the real router ----
function buildApp() {
  const app = express();
  app.use(json());
  app.use("/items", itemsRouter);

  // centralized error handler like your production app would have
  app.use((err: any, _req: any, res: any, _next: any) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res
      .status(err?.statusCode || err?.status || 500)
      .json({ message: err?.message || "Internal Server Error" });
  });

  return app;
}

describe("Items E2E", () => {
  let app: express.Express;

  beforeAll(async () => {
    // The replica-set connection is opened by tests/setup/int-db.ts
    expect([1, 2]).toContain(mongoose.connection.readyState); // 1=connected, 2=connecting
    app = buildApp();
  });

  // The global int-db.ts clears DB after each test, so we seed before each test
  beforeEach(async () => {
    await seedItems();
  });

  // ---------- GET /items (PUBLIC) ----------
  it("lists items with the PUBLIC shape when unauthenticated", async () => {
    const res = await request(app)
      .get("/items")
      .query({ category: "fruit", limit: 2, page: 1, sort: "type,-updatedAt" })
      .expect(200);

    expect(res.body).toMatchObject({
      page: 1,
      limit: 2,
      total: expect.any(Number),
      pages: expect.any(Number),
    });

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);

    const first = res.body.items[0];

    // PUBLIC fields present:
    expect(first).toHaveProperty("_id");
    expect(first).toHaveProperty("displayName");
    expect(first).toHaveProperty("category");
    expect(first).toHaveProperty("itemUrl");

    // Private fields absent:
    expect(first).not.toHaveProperty("type");
    expect(first).not.toHaveProperty("variety");
    expect(first).not.toHaveProperty("caloriesPer100g");
    expect(first).not.toHaveProperty("price");
  });

  // ---------- GET /items (PRIVILEGED via authenticateIfPresent) ----------
  it("lists items with FULL shape when role is admin (token present)", async () => {
    const res = await request(app)
      .get("/items")
      .set("x-test-role", "admin")
      .query({ category: "fruit", q: "apple", limit: 1, page: 1, sort: "type,-updatedAt" })
      .expect(200);

    expect(res.body).toMatchObject({
      page: 1,
      limit: 1,
      total: expect.any(Number),
      pages: expect.any(Number),
    });
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);

    const item = res.body.items[0];
    expect(item).toHaveProperty("_id");
    expect(item).toHaveProperty("type");
    expect(item).toHaveProperty("category");
  });

  it("rejects invalid category with 400", async () => {
    const res = await request(app).get("/items").query({ category: "meat" }).expect(400);
    expect(res.body).toEqual({ message: "invalid category: meat" });
  });

  it("rejects non-number min/max calories with 400", async () => {
    await request(app).get("/items").query({ minCalories: "abc" }).expect(400);
    await request(app).get("/items").query({ maxCalories: "xyz" }).expect(400);
  });

  // ---------- GET /items/:itemId (PUBLIC) ----------
  it("gets a single item with PUBLIC shape when unauthenticated", async () => {
    const anyItem = await ItemModel.findOne({}).lean();
    expect(anyItem).toBeTruthy();

    const res = await request(app).get(`/items/${anyItem!._id}`).expect(200);

    // PUBLIC shape
    expect(res.body).toHaveProperty("_id", String(anyItem!._id));
    expect(res.body).toHaveProperty("displayName");
    expect(res.body).toHaveProperty("category");
    expect(res.body).toHaveProperty("itemUrl");

    // Private fields absent
    expect(res.body).not.toHaveProperty("type");
    expect(res.body).not.toHaveProperty("variety");
    expect(res.body).not.toHaveProperty("caloriesPer100g");
  });

  // ---------- GET /items/:itemId (PRIVILEGED via authenticateIfPresent) ----------
  it("gets a single item with FULL shape when role is fManager (token present)", async () => {
    const anyItem = await ItemModel.findOne({}).lean();
    expect(anyItem).toBeTruthy();

    const res = await request(app)
      .get(`/items/${anyItem!._id}`)
      .set("x-test-role", "fManager")
      .expect(200);

    expect(res.body).toHaveProperty("_id", String(anyItem!._id));
    expect(res.body).toHaveProperty("type");
    expect(res.body).toHaveProperty("category");
  });

  it("returns 400 for invalid ObjectId", async () => {
    const res = await request(app).get("/items/not-an-objectid").expect(400);
    expect(res.body).toEqual({ message: "Invalid itemId" });
  });

  it("returns 404 for non-existing ObjectId", async () => {
    const missingId = new Types.ObjectId().toHexString();
    const res = await request(app).get(`/items/${missingId}`).expect(404);
    expect(res.body).toEqual({ message: "Item not found" });
  });

  // ---------- POST /items (protected) ----------
  it("creates an item when authorized; ignores client-sent _id", async () => {
    const res = await request(app)
      .post("/items")
      .send({
        _id: new Types.ObjectId().toHexString(), // should be ignored by controller
        category: "vegetable",
        type: "Cucumber",
        variety: "Persian",
        caloriesPer100g: 12,
      })
      .expect(201);

    // Expect _id in JSON
    expect(res.body).toHaveProperty("_id");
    expect(res.body.type).toBe("Cucumber");

    // And confirm it persisted
    const saved = await ItemModel.findById(res.body._id).lean();
    expect(saved).toBeTruthy();
    expect(saved!.type).toBe("Cucumber");
  });

  // ---------- PATCH /items/:itemId (protected) ----------
  it("partially updates an item and returns the updated document", async () => {
    const tomato = await ItemModel.findOne({ type: /tomato/i }).lean();
    expect(tomato).toBeTruthy();

    const res = await request(app).patch(`/items/${tomato!._id}`).send({ variety: "Grape" }).expect(200);

    // Response body includes _id
    expect(res.body).toHaveProperty("_id", String(tomato!._id));
    expect(res.body.variety).toBe("Grape");

    const reloaded = await ItemModel.findById(tomato!._id).lean();
    expect(reloaded!.variety).toBe("Grape");
  });

  it("rejects mismatched body _id in PATCH", async () => {
    const tomato = await ItemModel.findOne({ type: /tomato/i }).lean();
    expect(tomato).toBeTruthy();
    const otherId = new Types.ObjectId().toHexString();

    const res = await request(app)
      .patch(`/items/${tomato!._id}`)
      .send({ _id: otherId, variety: "Roma" })
      .expect(400);

    expect(res.body).toEqual({ message: "Body _id must match path :itemId" });
  });

  // ---------- PUT /items/:itemId ----------
  it("replaces an entire item with PUT", async () => {
    const someItem = await ItemModel.findOne({}).lean();
    expect(someItem).toBeTruthy();

    const payload = {
      _id: String(someItem!._id), // allowed if it matches the path
      category: "fruit",
      type: "Apple",
      variety: "Pink Lady",
      caloriesPer100g: 52,
      customerInfo: ["crisp"],
      price: { a: 2.1, b: 2.4, c: 2.6 },
    };

    const res = await request(app).put(`/items/${someItem!._id}`).send(payload).expect(200);

    expect(res.body).toHaveProperty("_id", String(someItem!._id));
    expect(res.body.type).toBe("Apple");
    expect(res.body.variety).toBe("Pink Lady");

    const reloaded = await ItemModel.findById(someItem!._id).lean();
    expect(reloaded!.variety).toBe("Pink Lady");
    expect(reloaded!.caloriesPer100g).toBe(52);
  });

  it("rejects mismatched body _id in PUT", async () => {
    const anyItem = await ItemModel.findOne({}).lean();
    expect(anyItem).toBeTruthy();
    const otherId = new Types.ObjectId().toHexString();

    const res = await request(app)
      .put(`/items/${anyItem!._id}`)
      .send({ _id: otherId, category: "fruit", type: "Pear" })
      .expect(400);

    expect(res.body).toEqual({ message: "Body _id must match path :itemId" });
  });

  // ---------- DELETE /items/:itemId ----------
  it("deletes an item and returns 204", async () => {
    const toDelete = await ItemModel.create({
      category: "fruit",
      type: "Banana",
      variety: "Cavendish",
    });

    await request(app).delete(`/items/${toDelete._id}`).expect(204);
    const exists = await ItemModel.findById(toDelete._id);
    expect(exists).toBeNull();
  });

  it("returns 404 when deleting a non-existing item", async () => {
    const missingId = new Types.ObjectId().toHexString();
    const res = await request(app).delete(`/items/${missingId}`).expect(404);
    expect(res.body).toEqual({ message: "Item not found" });
  });

  it("returns 400 when deleting with invalid id", async () => {
    const res = await request(app).delete("/items/bad-id").expect(400);
    expect(res.body).toEqual({ message: "Invalid itemId" });
  });

  // ---------- Calories filtering (privileged GET to see caloriesPer100g) ----------
  it("filters by calories range (admin can see caloriesPer100g)", async () => {
    const res = await request(app)
      .get("/items")
      .set("x-test-role", "admin") // privileged GET
      .query({ minCalories: 50, maxCalories: 60, category: "fruit" })
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    for (const it of res.body.items) {
      expect(it.category).toBe("fruit");
      // privileged response includes caloriesPer100g (may be null if not set)
      expect(typeof it.caloriesPer100g === "number" || it.caloriesPer100g === null).toBe(true);
      if (it.caloriesPer100g != null) {
        expect(it.caloriesPer100g).toBeGreaterThanOrEqual(50);
        expect(it.caloriesPer100g).toBeLessThanOrEqual(60);
      }
    }
  });
});
