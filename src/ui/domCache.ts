export interface DomCache {
  canvas: HTMLCanvasElement;
  hudSelectedPos: HTMLElement;
  hudContacts: HTMLElement;
  hudLockOutgoing: HTMLElement;
  hudLockIncoming: HTMLElement;
  hudSelection: HTMLElement;
  hudWeaponName: HTMLElement;
  hudHitProb: HTMLElement;
  threatWarning: HTMLElement;
  rangeLegend: HTMLElement;
  legendContent: HTMLElement;
  entityControlPanel: HTMLElement;
  entityControlId: HTMLElement;
  entityShipType: HTMLSelectElement;
  entityProfileDesc: HTMLElement;
  entityTeam: HTMLSelectElement;
  entityVel: HTMLInputElement;
  entityVelNum: HTMLInputElement;
  entityHead: HTMLInputElement;
  entityHeadNum: HTMLInputElement;
  entityWeaponsList: HTMLElement;
  entitySensorPower: HTMLInputElement;
  entitySensorPowerNum: HTMLInputElement;
  entityEcm: HTMLInputElement;
  entityEcmNum: HTMLInputElement;
  infoSig: HTMLElement;
  infoActivity: HTMLElement;
  infoDetection: HTMLElement;
  infoWeaponActivity: HTMLElement;
  weaponInfoPanel: HTMLElement;
  weaponNameDisplay: HTMLElement;
  weaponAccuracyDisplay: HTMLElement;
  weaponRangeDisplay: HTMLElement;
  weaponTrackingDisplay: HTMLElement;
  weaponGuidanceDisplay: HTMLElement;
  weaponSensitivityDisplay: HTMLElement;
  weaponDistFactor: HTMLElement;
  weaponTrackFactor: HTMLElement;
  weaponHitProbDisplay: HTMLElement;
  weaponActivityWeightDisplay: HTMLElement;
  entityList: HTMLElement;
  logPanel: HTMLElement;
  zoomSlider: HTMLInputElement;
  zoomValNum: HTMLInputElement;
  telemetryToggle: HTMLInputElement;
  showRangeRings: HTMLInputElement;
  showRangeLegend: HTMLInputElement;
  ringVisibilityModeSelect: HTMLSelectElement;
  relativeModeSelect: HTMLSelectElement;
  relativeIncludeAllies: HTMLInputElement;
  relativeIncludeEnemies: HTMLInputElement;
  relativeMaxTargets: HTMLInputElement;
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing required element #${id}`);
  return node as T;
}

export function buildDomCache(): DomCache {
  return {
    canvas: byId("main-canvas"),
    hudSelectedPos: byId("hud-selected-pos"),
    hudContacts: byId("hud-contacts"),
    hudLockOutgoing: byId("hud-lock-outgoing"),
    hudLockIncoming: byId("hud-lock-incoming"),
    hudSelection: byId("hud-selection"),
    hudWeaponName: byId("hud-weapon-name"),
    hudHitProb: byId("hud-hit-prob"),
    threatWarning: byId("threat-warning"),
    rangeLegend: byId("range-legend"),
    legendContent: byId("legend-dynamic"),
    entityControlPanel: byId("entity-control-panel"),
    entityControlId: byId("entity-control-id"),
    entityShipType: byId("entity-ship-type"),
    entityProfileDesc: byId("entity-profile-description"),
    entityTeam: byId("entity-team"),
    entityVel: byId("entity-vel"),
    entityVelNum: byId("entity-vel-num"),
    entityHead: byId("entity-head"),
    entityHeadNum: byId("entity-head-num"),
    entityWeaponsList: byId("entity-weapons-list"),
    entitySensorPower: byId("entity-sensor-power"),
    entitySensorPowerNum: byId("entity-sensor-power-num"),
    entityEcm: byId("entity-ecm"),
    entityEcmNum: byId("entity-ecm-num"),
    infoSig: byId("info-sig"),
    infoActivity: byId("info-activity"),
    infoDetection: byId("info-detection"),
    infoWeaponActivity: byId("info-weapon-activity"),
    weaponInfoPanel: byId("weapon-info-panel"),
    weaponNameDisplay: byId("weapon-name-display"),
    weaponAccuracyDisplay: byId("weapon-accuracy-display"),
    weaponRangeDisplay: byId("weapon-range-display"),
    weaponTrackingDisplay: byId("weapon-tracking-display"),
    weaponGuidanceDisplay: byId("weapon-guidance-display"),
    weaponSensitivityDisplay: byId("weapon-sensitivity-display"),
    weaponDistFactor: byId("weapon-dist-factor"),
    weaponTrackFactor: byId("weapon-track-factor"),
    weaponHitProbDisplay: byId("weapon-hit-prob-display"),
    weaponActivityWeightDisplay: byId("weapon-activity-weight-display"),
    entityList: byId("entity-list"),
    logPanel: byId("log-panel"),
    zoomSlider: byId("zoom-slider"),
    zoomValNum: byId("zoom-val-num"),
    telemetryToggle: byId("telemetry-toggle"),
    showRangeRings: byId("show-range-rings"),
    showRangeLegend: byId("show-range-legend"),
    ringVisibilityModeSelect: byId("ring-visibility-mode-select"),
    relativeModeSelect: byId("relative-mode-select"),
    relativeIncludeAllies: byId("relative-include-allies"),
    relativeIncludeEnemies: byId("relative-include-enemies"),
    relativeMaxTargets: byId("relative-max-targets")
  };
}
