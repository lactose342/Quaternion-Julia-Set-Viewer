import { PARAMETER_DEFINITIONS } from "@/core/domain/ParameterDefinitions.js";
import { hexToHsv } from "@/infra/ColorUtils.js";
import { parseParamFromUI } from "@/ui/utils/uiParamFormatter.js";

export class ParameterController {
  constructor(uiElements, signal) {
    this.uiElements = uiElements;
    this.signal = signal;
    this.rafIds = new Map();
    this.pendingPayloads = new Map();
    this.categoryMap = this.#buildCategoryMap();
  }

  #buildCategoryMap() {
    const map = new Map();
    Object.entries(PARAMETER_DEFINITIONS).forEach(([key, def]) => {
      map.set(key, def.category);
    });
    return map;
  }

  #dispatch(type, payload = {}) {
    window.dispatchEvent(new CustomEvent("app-command", { detail: { type, ...payload } }));
  }

  bindEvents() {
    const stopPropagation = (e) => e.stopPropagation();
    
    // スキーマ定義からDOM IDを動的取得
    const domIdsToBind = Object.values(PARAMETER_DEFINITIONS).map((def) => def.domId);

    domIdsToBind.forEach((domId) => {
      const el = this.uiElements[domId];
      if (!el) return;

      const stateKey = this._getStateKey(domId);
      let isOperating = false;

      const flushPending = () => {
        const rafId = this.rafIds.get(domId);
        if (rafId !== undefined) {
          cancelAnimationFrame(rafId);
          this.rafIds.delete(domId);
          
          const payload = this.pendingPayloads.get(domId);
          if (payload) {
             this.#dispatch("UPDATE_PARAM_INPUT", payload);
             this.pendingPayloads.delete(domId);
          }
        }
      };

      const commit = () => {
        if (isOperating) {
           isOperating = false;
           flushPending();
           this.#dispatch("COMMIT_HISTORY");
        }
      };

      el.addEventListener("touchstart", stopPropagation, { passive: true, signal: this.signal });
      
      el.addEventListener("pointerdown", (e) => {
        stopPropagation(e);
        isOperating = true;
        
        const handleGlobalUp = () => {
          commit();
          window.removeEventListener("pointerup", handleGlobalUp);
          window.removeEventListener("pointercancel", handleGlobalUp);
        };
        
        window.addEventListener("pointerup", handleGlobalUp, { signal: this.signal });
        window.addEventListener("pointercancel", handleGlobalUp, { signal: this.signal });
      }, { signal: this.signal });

      el.addEventListener("input", () => {
        isOperating = true;
        const currentRawValue = el.value;
        const inputType = el.type;

        const val = parseParamFromUI(stateKey, currentRawValue, inputType);
        const category = this.categoryMap.get(stateKey) || "fractal";
        
        this.pendingPayloads.set(domId, { category, key: stateKey, value: val });

        if (this.rafIds.has(domId)) return;

        const id = requestAnimationFrame(() => {
          this.rendererUpdateTick(domId);
        });
        this.rafIds.set(domId, id);
      }, { signal: this.signal });

      el.addEventListener("change", () => {
         commit();
      }, { signal: this.signal });
    });

    const baseColorPicker = this.uiElements["baseColorPicker"];
    if (baseColorPicker) {
      let colorRafId = null;
      let pendingColor = null;

      const flushColor = () => {
        if (colorRafId !== null) {
          cancelAnimationFrame(colorRafId);
          colorRafId = null;
        }
        if (pendingColor) {
          this.#dispatch("UPDATE_COLOR_INPUT", pendingColor);
          pendingColor = null;
        }
      };

      baseColorPicker.addEventListener("input", (e) => {
        const hsvVals = hexToHsv(e.target.value);
        pendingColor = { hue: hsvVals.h, saturation: hsvVals.s };

        if (colorRafId !== null) return;

        colorRafId = requestAnimationFrame(() => {
          colorRafId = null;
          if (pendingColor) {
            this.#dispatch("UPDATE_COLOR_INPUT", pendingColor);
            pendingColor = null;
          }
        });
      }, { signal: this.signal });
      
      baseColorPicker.addEventListener("change", () => {
        flushColor();
        this.#dispatch("COMMIT_HISTORY");
      }, { signal: this.signal });
    }
  }

  rendererUpdateTick(domId) {
    this.rafIds.delete(domId);
    const payload = this.pendingPayloads.get(domId);
    if (payload) {
       this.#dispatch("UPDATE_PARAM_INPUT", payload);
       this.pendingPayloads.delete(domId);
    }
  }

  _getStateKey(domId) {
    const entry = Object.entries(PARAMETER_DEFINITIONS).find(([_, def]) => def.domId === domId);
    return entry ? entry[0] : domId;
  }

  clearPendingUpdates() {
    this.rafIds.forEach((rafId) => {
      cancelAnimationFrame(rafId);
    });
    this.rafIds.clear();
    this.pendingPayloads.clear();
  }
}