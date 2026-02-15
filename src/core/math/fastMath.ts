export const FastMath = {
  softstep(x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x * x * (3 - 2 * x);
  },

  log1pNormalized(x: number, k: number): number {
    const xk = x * k;
    return xk / (1 + xk);
  },

  inverseSquareFalloff(distanceKm: number, effectiveRange: number): number {
    const ratio = distanceKm / effectiveRange;
    return 1 / (1 + ratio * ratio);
  },

  fastSigmoid(x: number): number {
    if (x < -4) return 0;
    if (x > 4) return 1;
    const normalized = (x + 4) / 8;
    return this.softstep(normalized);
  }
};
