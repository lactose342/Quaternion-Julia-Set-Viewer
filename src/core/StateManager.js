import { CONFIG } from "@/config/config.js";

export class StateManager extends EventTarget {
  #state;
  #animPhases = { x: 0, y: 0, z: 0, w: 0 };

  constructor() {
    super();
    this.resetToFactoryDefaults();
  }

  resetToFactoryDefaults() {
    const createInitialParams = (category, rawPreset) => {
      const allowedKeys = CONFIG.SCHEMAS[category];
      const filtered = {};
      allowedKeys.forEach((key) => {
        if (key in rawPreset) filtered[key] = rawPreset[key];
      });
      return filtered;
    };

    this.#state = {
      ui: {
        isAutoAnimating: false,
        isInteracting: false,
        isDownloading: false,
        downloadProgress: 0,
        downloadMessage: "",
        renderQuality: CONFIG.SYSTEM.DEFAULT_QUALITY,
        activePreset: "preset1",
        activeAnimPreset: "preset1",
      },
      domain: {
        camera: { position: { x: 0, y: 0, z: 2 }, target: { x: 0, y: 0, z: 0 } },
        params: {
          fractal: createInitialParams("fractal", CONFIG.PRESETS.preset1),
          material: createInitialParams("material", CONFIG.PRESETS.preset1),
          animation: createInitialParams("animation", CONFIG.ANIM_PRESETS.preset1),
        },
      },
    };

    this.#animPhases = { x: 0, y: 0, z: 0, w: 0 };
    this.notifyChange({ type: "ALL" });
    return true;
  }

  notifyChange(detail = {}) {
    this.dispatchEvent(new CustomEvent("statechange", { detail }));
  }

  getState() {
    return structuredClone(this.#state);
  }

  getRawState() {
    return this.#state;
  }

  getRawAnimPhases() {
    return this.#animPhases;
  }

  restoreSnapshot(snapshot) {
    this.#state.domain.params = structuredClone(snapshot.params);
    this.#state.domain.camera = structuredClone(snapshot.camera);
    this.#animPhases = structuredClone(snapshot.animPhases);

    if (snapshot.presets) {
      this.#state.ui.activePreset = snapshot.presets.activePreset;
      this.#state.ui.activeAnimPreset = snapshot.presets.activeAnimPreset;
    }

    this.notifyChange({ type: "ALL" });
  }

  setAnimPhases(phases) {
    this.#animPhases = structuredClone(phases);
    this.notifyChange({ type: "ANIM_PHASES", keys: ["x", "y", "z", "w"] });
  }

  resetAnimPhases() {
    this.#animPhases = { x: 0, y: 0, z: 0, w: 0 };
    this.notifyChange({ type: "ANIM_PHASES", keys: ["x", "y", "z", "w"] });
  }

  updateUiState(payload) {
    const changedKeys = [];
    Object.keys(payload).forEach((key) => {
      if (key in this.#state.ui && this.#state.ui[key] !== payload[key]) {
        this.#state.ui[key] = payload[key];
        changedKeys.push(key);
      }
    });
    if (changedKeys.length > 0) {
      this.notifyChange({ type: "UI", keys: changedKeys });
    }
  }

  updateCameraState(type, payload) {
    const allowedCameraTypes = CONFIG.SCHEMAS.camera;
    if (allowedCameraTypes.includes(type) && type in this.#state.domain.camera) {
      Object.keys(payload).forEach((key) => {
        if (key in this.#state.domain.camera[type]) {
          this.#state.domain.camera[type][key] = payload[key];
        }
      });
      this.notifyChange({ type: "CAMERA" });
    }
  }

  updateParamsState(category, payload) {
    const changedKeys = [];
    if (category in this.#state.domain.params) {
      const allowedKeys = CONFIG.SCHEMAS[category];
      Object.keys(payload).forEach((key) => {
        if (allowedKeys.includes(key) && this.#state.domain.params[category][key] !== payload[key]) {
          this.#state.domain.params[category][key] = payload[key];
          changedKeys.push(key);
        }
      });
    }
    if (changedKeys.length > 0) {
      this.notifyChange({ type: "PARAMS", category, keys: changedKeys });
    }
  }
}
