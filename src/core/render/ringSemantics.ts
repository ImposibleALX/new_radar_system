export type RingColorToken = "weapon" | "detectionActive" | "detectionPassive" | "lockVector";

export type RingSemanticType =
  | "weaponEffectiveRange"
  | "relativeDetectionActive"
  | "relativeDetectionPassive"
  | "lockVector";

export interface RingSemanticDefinition {
  type: RingSemanticType;
  label: string;
  meaning: string;
  colorToken: RingColorToken;
  lineStyle: "solid" | "dashed";
  lineDash: number[];
  priority: number;
  visibleWhen: string;
  ownerContext: "focusedEntity" | "sourceTargetPair" | "playerTargetLink";
}

export interface RingFocusVisual {
  lineWidth: number;
  opacity: number;
}

export type RingFocusLevel = "selected" | "hovered" | "ambient";

export interface RingPalette {
  weapon: string;
  detectionActive: string;
  detectionPassive: string;
  lockVector: string;
}

const RING_COLOR_VARS: Record<RingColorToken, string> = {
  weapon: "--ring-weapon",
  detectionActive: "--ring-detection-active",
  detectionPassive: "--ring-detection-passive",
  lockVector: "--ring-lock-vector"
};

const RING_COLOR_FALLBACKS: RingPalette = {
  weapon: "#ffb347",
  detectionActive: "#2ec9ff",
  detectionPassive: "#8ea8ff",
  lockVector: "#ff5e92"
};

export const RING_SEMANTICS: Record<RingSemanticType, RingSemanticDefinition> = {
  weaponEffectiveRange: {
    type: "weaponEffectiveRange",
    label: "Weapon Effective Range",
    meaning: "Maximum effective firing distance for active weapon groups.",
    colorToken: "weapon",
    lineStyle: "solid",
    lineDash: [],
    priority: 20,
    visibleWhen: "Ring layer includes source entity and it has active weapon slots.",
    ownerContext: "focusedEntity"
  },
  relativeDetectionActive: {
    type: "relativeDetectionActive",
    label: "Relative Detection (Active Target)",
    meaning: "Detection envelope against targets radiating active sensor emissions.",
    colorToken: "detectionActive",
    lineStyle: "solid",
    lineDash: [],
    priority: 10,
    visibleWhen: "Ring layer includes source and target is active.",
    ownerContext: "sourceTargetPair"
  },
  relativeDetectionPassive: {
    type: "relativeDetectionPassive",
    label: "Relative Detection (Passive Target)",
    meaning: "Detection envelope against passive/low-emission targets.",
    colorToken: "detectionPassive",
    lineStyle: "dashed",
    lineDash: [6, 6],
    priority: 11,
    visibleWhen: "Ring layer includes source and target is passive.",
    ownerContext: "sourceTargetPair"
  },
  lockVector: {
    type: "lockVector",
    label: "Lock Vector",
    meaning: "Dashed link from selected ship to current lock target.",
    colorToken: "lockVector",
    lineStyle: "dashed",
    lineDash: [10, 8],
    priority: 5,
    visibleWhen: "Outgoing lock target exists and lock status is not NONE.",
    ownerContext: "playerTargetLink"
  }
};

export function resolveRingPalette(doc: Document = document): RingPalette {
  const style = getComputedStyle(doc.documentElement);
  const pick = (token: RingColorToken): string => {
    const cssVar = RING_COLOR_VARS[token];
    const value = style.getPropertyValue(cssVar).trim();
    return value || RING_COLOR_FALLBACKS[token];
  };

  return {
    weapon: pick("weapon"),
    detectionActive: pick("detectionActive"),
    detectionPassive: pick("detectionPassive"),
    lockVector: pick("lockVector")
  };
}

export function getFocusVisualState(focus: RingFocusLevel): RingFocusVisual {
  if (focus === "selected") {
    return { lineWidth: 2.4, opacity: 0.9 };
  }
  if (focus === "hovered") {
    return { lineWidth: 1.4, opacity: 0.55 };
  }
  return { lineWidth: 1.1, opacity: 0.35 };
}

export function getStaticRingSemantics(): RingSemanticDefinition[] {
  return Object.values(RING_SEMANTICS).sort((a, b) => a.priority - b.priority);
}
