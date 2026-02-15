export type DirtyKey = "dirtyHUD" | "dirtyEntityList" | "dirtyLegend" | "dirtyWeaponPanel";

export interface DirtyState {
  dirtyHUD: boolean;
  dirtyEntityList: boolean;
  dirtyLegend: boolean;
  dirtyWeaponPanel: boolean;
}

export function createUiScheduler(): {
  readonly dirty: DirtyState;
  mark: (...keys: DirtyKey[]) => void;
  flush: (handlers: Partial<Record<DirtyKey, () => void>>) => void;
  reset: () => void;
} {
  const dirty: DirtyState = {
    dirtyHUD: true,
    dirtyEntityList: true,
    dirtyLegend: true,
    dirtyWeaponPanel: true
  };

  const mark = (...keys: DirtyKey[]): void => {
    keys.forEach((key) => {
      dirty[key] = true;
    });
  };

  const flush = (handlers: Partial<Record<DirtyKey, () => void>>): void => {
    (Object.keys(dirty) as DirtyKey[]).forEach((key) => {
      if (!dirty[key]) return;
      handlers[key]?.();
      dirty[key] = false;
    });
  };

  const reset = (): void => {
    dirty.dirtyHUD = true;
    dirty.dirtyEntityList = true;
    dirty.dirtyLegend = true;
    dirty.dirtyWeaponPanel = true;
  };

  return { dirty, mark, flush, reset };
}
