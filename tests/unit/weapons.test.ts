import { describe, expect, it, beforeAll } from "vitest";
import { calculateWeaponActivity, initializeWeaponDatabase } from "../../src/core/domain/weapons";

beforeAll(() => {
  initializeWeaponDatabase();
});

describe("calculateWeaponActivity", () => {
  it("returns 0 when no weapons are installed", () => {
    expect(calculateWeaponActivity([], { weaponActivityComputations: 0 })).toBe(0);
  });

  it("returns normalized active-weight ratio", () => {
    const value = calculateWeaponActivity(
      [
        { weaponId: "pulse_laser_mk1", count: 2, active: true, slotId: 1 },
        { weaponId: "railgun_heavy", count: 1, active: false, slotId: 2 }
      ],
      { weaponActivityComputations: 0 }
    );

    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
  });
});
