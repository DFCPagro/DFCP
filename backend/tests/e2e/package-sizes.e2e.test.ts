/**
 * E2E tests for /package-sizes
 * - Uses mongodb-memory-server via global setup (tests/setup/int-db.ts)
 * - Real router/controller/service/model
 * - Auth middleware is mocked
 * - Seeds using your real db/seeds/dev/seedPackageSizes.seeder
 */

import request from "supertest";
import express, { json } from "express";
import mongoose from "mongoose";

import packageSizesRouter from "@/routes/packageSize.route";
import { PackageSize } from "@/models/PackageSize";
import { seedPackageSizes } from "../../db/seeds_old/dev/seedPackageSizes.seeder";

// ---- Mock auth middleware exactly by module id "@/middlewares/auth" ----
jest.mock("@/middlewares/auth", () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: "u1", role: "admin" };
    next();
  },
  authenticateIfPresent: (req: any, _res: any, next: any) => {
    const role = req.header?.("x-test-role");
    if (role) req.user = { id: "guest-impersonated", role };
    next();
  },
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
  app.use("/package-sizes", packageSizesRouter);

  // centralized error handler like your production app would have
  // in tests/e2e/package-sizes.e2e.test.ts (buildApp)
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err?.statusCode || err?.status || 500;
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({ message: err?.message || "Internal Server Error" });
});


  return app;
}

describe("PackageSizes E2E", () => {
  let app: express.Express;

  beforeAll(async () => {
    // The replica-set connection is opened by tests/setup/int-db.ts
    expect([1, 2]).toContain(mongoose.connection.readyState); // 1=connected, 2=connecting
    app = buildApp();
  });

  // Global teardown clears DB after each test, so seed before each test
  beforeEach(async () => {
    await seedPackageSizes(); // inserts both vented & non-vented variants
  });

  // ---------- GET /package-sizes (PUBLIC) ----------
  it("lists package sizes with pagination and optional search", async () => {
    const res = await request(app)
      .get("/package-sizes")
      .query({ limit: 3, page: 1, sort: "key" })
      .expect(200);

    expect(res.body).toMatchObject({
      page: 1,
      limit: 3,
      total: expect.any(Number),
    });
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);

    // search by q: should match name or key (service does $or on name/key)
    const res2 = await request(app)
      .get("/package-sizes")
      .query({ q: "Small" })
      .expect(200);

    expect(Array.isArray(res2.body.items)).toBe(true);
    expect(
      res2.body.items.some((it: any) => /small/i.test(it.name) || /small/i.test(it.key))
    ).toBe(true);
  });

  // ---------- GET /package-sizes/:idOrKey (PUBLIC) ----------
  it("gets a single package size by key (toJSON exposes 'id', not '_id')", async () => {
    const res = await request(app).get("/package-sizes/Small").expect(200);
    expect(res.body).toHaveProperty("id");       // your toJSON transform
    expect(res.body).not.toHaveProperty("_id");  // _id removed by toJSON
    expect(res.body).toHaveProperty("key", "Small");
    expect(typeof res.body.usableLiters).toBe("number");
  });

  it("returns 404 for missing idOrKey", async () => {
    await request(app).get("/package-sizes/DOES_NOT_EXIST").expect(404);
  });

  // ---------- POST /package-sizes (protected) ----------
  it("returns 409 when trying to create a duplicate {key, vented} pair", async () => {
    // Your seeder already inserts Small (vented: true and false).
    // Try to create another Small+true (duplicate on {key, vented}).
    const payload = {
      name: "Custom Small Tight",
      key: "Small",
      innerDimsCm: { l: 20, w: 20, h: 18 },
      headroomPct: 0.1,
      maxSkusPerBox: 2,
      maxWeightKg: 5,
      mixingAllowed: true,
      tareWeightKg: 0.2,
      usableLiters: 9999, // ignored if created, but we expect 409
      vented: true,
      values: { "Height (cm)": 18 },
    };

    const res = await request(app).post("/package-sizes").send(payload).expect(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  // ---------- PATCH /package-sizes/:idOrKey (protected) ----------
  it("updates dimensions/headroom successfully (and returns a number for usableLiters)", async () => {
    // Get a stable id using a real Mongoose doc (avoid lean() TS unions)
    const smallDoc = await PackageSize.findOne({ key: "Small" }).select("_id").exec();
    expect(smallDoc).toBeTruthy();
    const id = smallDoc!._id.toString();

    const res = await request(app)
      .patch(`/package-sizes/${id}`)
      .send({
        innerDimsCm: { l: 22, w: 20, h: 20 },
        headroomPct: 0.15,
      })
      .expect(200);

    expect(res.body.innerDimsCm).toMatchObject({ l: 22, w: 20, h: 20 });
    expect(typeof res.body.usableLiters).toBe("number");

    // Verify it actually persisted (no lean to avoid TS unions; cast for tests)
    const reloaded = await PackageSize.findById(id).select("innerDimsCm usableLiters").exec();
    expect((reloaded as any)?.innerDimsCm).toMatchObject({ l: 22, w: 20, h: 20 });
    expect(typeof (reloaded as any)?.usableLiters).toBe("number");
  });

  // ---------- DELETE /package-sizes/:idOrKey (protected) ----------
  it("deletes an existing package size and returns 204", async () => {
    // Delete an existing seeded doc to avoid unique-index conflicts on insert
    const targetDoc = await PackageSize.findOne({ key: "Medium", vented: true })
      .select("_id")
      .exec();
    expect(targetDoc).toBeTruthy();
    const targetId = targetDoc!._id.toString();

    await request(app).delete(`/package-sizes/${targetId}`).expect(204);
    const exists = await PackageSize.findById(targetId);
    expect(exists).toBeNull();
  });
});
