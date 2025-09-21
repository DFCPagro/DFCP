import AppConfig from "../../src/models/appConfig.model";
import { getInactivityMinutes, setInactivityMinutes } from "../../src/services/config.service";

describe("AppConfig e2e (dynamic inactivity)", () => {
  it("falls back to 20 when no config exists", async () => {
    const minutes = await getInactivityMinutes(undefined);
    expect(minutes).toBe(20);
  });

  it("global overrides default", async () => {
    await AppConfig.create({ scope: "global", inactivityMinutes: 33, updatedBy: "test" });
    const minutes = await getInactivityMinutes(undefined);
    expect(minutes).toBe(33);
  });

  it("per-LC overrides global; other LC uses global", async () => {
    await AppConfig.create({ scope: "global", inactivityMinutes: 40, updatedBy: "test" });
    await AppConfig.create({ scope: "LC_X", inactivityMinutes: 10, updatedBy: "test" });

    expect(await getInactivityMinutes("LC_X")).toBe(10);
    expect(await getInactivityMinutes("LC_Y")).toBe(40);
  });

  it("setInactivityMinutes upserts and bounds values", async () => {
    const a = await setInactivityMinutes("LC_Z", 5, "admin@test");
    expect(a.scope).toBe("LC_Z");
    expect(a.inactivityMinutes).toBe(5);

    const b = await setInactivityMinutes("LC_Z", 999, "admin@test");
    expect(b.inactivityMinutes).toBe(240); // bounded to max
  });
});
