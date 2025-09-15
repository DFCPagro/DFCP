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

// ---- Mock the auth middleware so protected routes are reachable ----
// Your router imports from "@/middlewares/auth", so mock the SAME module id:
jest.mock("@/middlewares/auth", () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: "u1", roles: ["admin"] };
    next();
  },
  authorize:
    (...allowed: string[]) =>
    (req: any, res: any, next: any) => {
      const roles: string[] = req.user?.roles ?? [];
      return roles.some((r) => allowed.includes(r))
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
    res.status(500).json({ message: "Internal Server Error" });
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

  // ---------- GET /items (list) ----------
  it("lists items with pagination, filtering & sorting", async () => {
    const res = await request(app)
      .get("/items")
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
    // schema fields present
    expect(res.body.items[0]).toHaveProperty("type");
    expect(res.body.items[0]).toHaveProperty("category");
  });

  it("rejects invalid category with 400", async () => {
    const res = await request(app).get("/items").query({ category: "meat" }).expect(400);
    expect(res.body).toEqual({ message: "invalid category: meat" });
  });

  it("rejects non-number min/max calories with 400", async () => {
    await request(app).get("/items").query({ minCalories: "abc" }).expect(400);
    await request(app).get("/items").query({ maxCalories: "xyz" }).expect(400);
  });

  // ---------- GET /items/:itemId ----------
  it("gets a single item by valid ObjectId", async () => {
    const anyItem = await ItemModel.findOne({}).lean();
    expect(anyItem).toBeTruthy();

    const res = await request(app).get(`/items/${anyItem!._id}`).expect(200);

    // Your toJSON plugin likely hides `_id` and exposes `itemId`
    expect(res.body).toHaveProperty("itemId", String(anyItem!._id));
    expect(res.body).toHaveProperty("type");
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

    // Expect itemId (virtual) rather than _id in JSON
    expect(res.body).toHaveProperty("itemId");
    expect(res.body.type).toBe("Cucumber");

    // And confirm it persisted
    const saved = await ItemModel.findById(res.body.itemId).lean();
    expect(saved).toBeTruthy();
    expect(saved!.type).toBe("Cucumber");
  });

  // ---------- PATCH /items/:itemId (protected) ----------
  it("partially updates an item and returns the updated document", async () => {
    const tomato = await ItemModel.findOne({ type: /tomato/i }).lean();
    expect(tomato).toBeTruthy();

    const res = await request(app).patch(`/items/${tomato!._id}`).send({ variety: "Grape" }).expect(200);

    // Response body exposes itemId instead of _id
    expect(res.body).toHaveProperty("itemId", String(tomato!._id));
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

    // Response exposes itemId instead of _id
    expect(res.body).toHaveProperty("itemId", String(someItem!._id));
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

  // ---------- Calories filtering ----------
  it("filters by calories range", async () => {
    const res = await request(app)
      .get("/items")
      .query({ minCalories: 50, maxCalories: 60, category: "fruit" })
      .expect(200);

    // Assert the *rule*, not specific names (since seedItems controls data)
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const it of res.body.items) {
      expect(it.category).toBe("fruit");
      expect(typeof it.caloriesPer100g === "number" || it.caloriesPer100g === null).toBe(true);
      if (it.caloriesPer100g != null) {
        expect(it.caloriesPer100g).toBeGreaterThanOrEqual(50);
        expect(it.caloriesPer100g).toBeLessThanOrEqual(60);
      }
    }
  });
});
