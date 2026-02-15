import type { WeaponConfig } from "../core/domain/types";

export const WEAPON_DB: { weapons_test: WeaponConfig[] } = {
  weapons_test: [
    {
      id: "pulse_laser_mk1",
      name: "Pulse Laser Mk I (PL-1)",
      baseAccuracy: 0.78,
      effectiveRange_km: 25,
      trackingSpeed: 0.18,
      trackingSensitivity: 2.4,
      guidance: "unguided",
      baseActivityWeight: 18,
      weaponClass: "standard"
    },
    {
      id: "pulse_laser_mk2",
      name: "Pulse Laser Mk II (PL-2)",
      baseAccuracy: 0.85,
      effectiveRange_km: 28,
      trackingSpeed: 0.22,
      trackingSensitivity: 2.0,
      guidance: "unguided",
      baseActivityWeight: 22,
      weaponClass: "standard"
    },
    {
      id: "beam_laser_x1",
      name: "Beam Laser X1 (BL-X1)",
      baseAccuracy: 0.92,
      effectiveRange_km: 30,
      trackingSpeed: 0.12,
      trackingSensitivity: 2.2,
      guidance: "unguided",
      baseActivityWeight: 24,
      weaponClass: "standard"
    },
    {
      id: "autocannon_20mm",
      name: "20 mm Autocannon",
      baseAccuracy: 0.65,
      effectiveRange_km: 4,
      trackingSpeed: 0.3,
      trackingSensitivity: 1.6,
      guidance: "unguided",
      baseActivityWeight: 6,
      weaponClass: "pointdefense"
    },
    {
      id: "autocannon_75mm",
      name: "75 mm Autocannon",
      baseAccuracy: 0.72,
      effectiveRange_km: 26,
      trackingSpeed: 0.14,
      trackingSensitivity: 1.9,
      guidance: "unguided",
      baseActivityWeight: 20,
      weaponClass: "standard"
    },
    {
      id: "railgun_light",
      name: "Light Railgun (RG-L)",
      baseAccuracy: 0.88,
      effectiveRange_km: 28,
      trackingSpeed: 0.06,
      trackingSensitivity: 2.8,
      guidance: "unguided",
      baseActivityWeight: 45,
      weaponClass: "heavy"
    },
    {
      id: "railgun_heavy",
      name: "Heavy Railgun (RG-H)",
      baseAccuracy: 0.92,
      effectiveRange_km: 30,
      trackingSpeed: 0.04,
      trackingSensitivity: 3.4,
      guidance: "unguided",
      baseActivityWeight: 60,
      weaponClass: "heavy"
    },
    {
      id: "plasma_cannon",
      name: "Plasma Cannon (PC-1)",
      baseAccuracy: 0.8,
      effectiveRange_km: 27,
      trackingSpeed: 0.09,
      trackingSensitivity: 2.6,
      guidance: "unguided",
      baseActivityWeight: 28,
      weaponClass: "standard"
    },
    {
      id: "pulse_beam_field",
      name: "Pulse Field Generator (PFG-1)",
      baseAccuracy: 0.7,
      effectiveRange_km: 26,
      trackingSpeed: 0.2,
      trackingSensitivity: 2.1,
      guidance: "unguided",
      baseActivityWeight: 30,
      weaponClass: "area"
    },
    {
      id: "missile_light_flare",
      name: "Light Guided Missile (LGM-1)",
      baseAccuracy: 0.9,
      effectiveRange_km: 40,
      trackingSpeed: 0.09,
      trackingSensitivity: 1.6,
      guidance: "guided",
      baseActivityWeight: 18,
      weaponClass: "missile"
    },
    {
      id: "missile_striker",
      name: "Guided Strike Missile (GSM-2)",
      baseAccuracy: 0.95,
      effectiveRange_km: 45,
      trackingSpeed: 0.08,
      trackingSensitivity: 1.5,
      guidance: "guided",
      baseActivityWeight: 26,
      weaponClass: "missile"
    },
    {
      id: "missile_heavy_torpedo",
      name: "Heavy Torpedo (HT-1)",
      baseAccuracy: 0.98,
      effectiveRange_km: 45,
      trackingSpeed: 0.045,
      trackingSensitivity: 2.0,
      guidance: "guided",
      baseActivityWeight: 70,
      weaponClass: "heavy_missile"
    }
  ]
};
