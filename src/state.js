import { CONFIG } from "./constants.js";

function calculateAnimatedFractal(frac, anim, phases) {
  const mAmp = anim.amp;
  const getAmp = (base, ratio) => Math.min(mAmp * ratio, CONFIG.SYSTEM.AMP_LIMIT - Math.abs(base));

  return {
    cx: frac.cx + (Math.sin(phases.x + anim.px) - Math.sin(anim.px)) * getAmp(frac.cx, anim.ax),
    cy: frac.cy + (Math.sin(phases.y + anim.py) - Math.sin(anim.py)) * getAmp(frac.cy, anim.ay),
    cz: frac.cz + (Math.sin(phases.z + anim.pz) - Math.sin(anim.pz)) * getAmp(frac.cz, anim.az),
    cw: frac.cw + (Math.sin(phases.w + anim.pw) - Math.sin(anim.pw)) * getAmp(frac.cw, anim.aw),
  };
}

export class StateManager {
  #state;
  #animPhases = { x: 0, y: 0, z: 0, w: 0 };

  constructor() {
    this.history = [];
    this.historyIndex = -1;
    this.resetToFactoryDefaults();
    this.pushHistory();
  }

  resetToFactoryDefaults() {
    const createInitialParams = (category, rawPreset) => {
      const allowedKeys = CONFIG.SCHEMAS[category];
      const filtered = {};
      allowedKeys.forEach((key) => {
        if (key in rawPreset) {
          filtered[key] = rawPreset[key];
        }
      });
      return filtered;
    };

    this.#state = {
      ui: {
        isAutoAnimating: false,
        isInteracting: false,
        isDownloading: false,
        renderQuality: CONFIG.SYSTEM.DEFAULT_QUALITY,
      },
      domain: {
        camera: {
          position: { x: 0, y: 0, z: 2 },
          target: { x: 0, y: 0, z: 0 },
        },
        params: {
          fractal: createInitialParams("fractal", CONFIG.PRESETS.preset1),
          material: createInitialParams("material", CONFIG.PRESETS.preset1),
          animation: createInitialParams("animation", CONFIG.ANIM_PRESETS.preset1),
        },
      },
    };

    this.#animPhases = { x: 0, y: 0, z: 0, w: 0 };

    return true;
  }

  getState() {
    const clone = structuredClone(this.#state);

    const frac = clone.domain.params.fractal;
    const anim = clone.domain.params.animation;
    Object.assign(frac, calculateAnimatedFractal(frac, anim, this.#animPhases));

    return clone;
  }

  getRawState() {
    return this.#state;
  }

  getRawAnimPhases() {
    return this.#animPhases;
  }

  setAnimPhases(phases) {
    this.#animPhases = structuredClone(phases);
    this.renderer?.requestRender();
  }

  getAnimatedC(outVec) {
    const frac = this.#state.domain.params.fractal;
    const anim = this.#state.domain.params.animation;
    const phases = this.#animPhases;
    const mAmp = anim.amp;
    const getAmp = (base, ratio) => Math.min(mAmp * ratio, CONFIG.SYSTEM.AMP_LIMIT - Math.abs(base));

    outVec.cx = frac.cx + (Math.sin(phases.x + anim.px) - Math.sin(anim.px)) * getAmp(frac.cx, anim.ax);
    outVec.cy = frac.cy + (Math.sin(phases.y + anim.py) - Math.sin(anim.py)) * getAmp(frac.cy, anim.ay);
    outVec.cz = frac.cz + (Math.sin(phases.z + anim.pz) - Math.sin(anim.pz)) * getAmp(frac.cz, anim.az);
    outVec.cw = frac.cw + (Math.sin(phases.w + anim.pw) - Math.sin(anim.pw)) * getAmp(frac.cw, anim.aw);
  }

  advanceAnimPhases(delta) {
    if (!this.#state.ui.isAutoAnimating) return;
    const anim = this.#state.domain.params.animation;
    this.#animPhases.x += delta * (anim.speed * anim.sx);
    this.#animPhases.y += delta * (anim.speed * anim.sy);
    this.#animPhases.z += delta * (anim.speed * anim.sz);
    this.#animPhases.w += delta * (anim.speed * anim.sw);
  }

  resetAnimPhases() {
    this.#animPhases = { x: 0, y: 0, z: 0, w: 0 };
  }

  commitAnimatedC() {
    const out = { cx: 0, cy: 0, cz: 0, cw: 0 };
    this.getAnimatedC(out);
    const frac = this.#state.domain.params.fractal;
    frac.cx = out.cx;
    frac.cy = out.cy;
    frac.cz = out.cz;
    frac.cw = out.cw;
  }

  updateUiState(payload) {
    Object.keys(payload).forEach((key) => {
      if (key in this.#state.ui) this.#state.ui[key] = payload[key];
    });
  }

  updateCameraState(type, payload) {
    const allowedCameraTypes = CONFIG.SCHEMAS.camera;
    if (allowedCameraTypes.includes(type) && type in this.#state.domain.camera) {
      Object.keys(payload).forEach((key) => {
        if (key in this.#state.domain.camera[type]) {
          this.#state.domain.camera[type][key] = payload[key];
        }
      });
    }
  }

  updateParamsState(category, payload) {
    if (category in this.#state.domain.params) {
      const allowedKeys = CONFIG.SCHEMAS[category];
      Object.keys(payload).forEach((key) => {
        if (allowedKeys.includes(key)) {
          this.#state.domain.params[category][key] = payload[key];
        }
      });
    }
  }

  pushHistory() {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push({
      params: structuredClone(this.#state.domain.params),
      camera: structuredClone(this.#state.domain.camera),
      animPhases: structuredClone(this.#animPhases),
    });

    if (this.history.length > CONFIG.SYSTEM.MAX_HISTORY) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  }

  replaceInitialHistory() {
    this.history = [
      {
        params: structuredClone(this.#state.domain.params),
        camera: structuredClone(this.#state.domain.camera),
        animPhases: structuredClone(this.#animPhases),
      },
    ];
    this.historyIndex = 0;
  }
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const snapshot = this.history[this.historyIndex];
      this.#restoreSnapshot(snapshot);
      return structuredClone(snapshot);
    }
    return null;
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const snapshot = this.history[this.historyIndex];
      this.#restoreSnapshot(snapshot);
      return structuredClone(snapshot);
    }
    return null;
  }

  #restoreSnapshot(snapshot) {
    this.#state.domain.params = structuredClone(snapshot.params);
    this.#state.domain.camera = structuredClone(snapshot.camera);
    this.#animPhases = structuredClone(snapshot.animPhases);
  }

  getHistoryStatus() {
    return {
      canUndo: this.historyIndex > 0,
      canRedo: this.historyIndex < this.history.length - 1,
    };
  }
}
