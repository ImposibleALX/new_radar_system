export function createAnimationLoop(update: (dt: number) => void): {
  start: () => void;
  stop: () => void;
} {
  let rafId = 0;
  let lastTime = 0;
  let active = false;

  const frame = (time: number): void => {
    if (!active) return;
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    update(dt || 0.016);
    rafId = requestAnimationFrame(frame);
  };

  const start = (): void => {
    if (active) return;
    active = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  };

  const stop = (): void => {
    active = false;
    cancelAnimationFrame(rafId);
  };

  return { start, stop };
}
