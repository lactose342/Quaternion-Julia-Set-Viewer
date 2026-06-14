import { hexToHsv } from "@/infra/ColorUtils.js";
import { parseParamFromUI } from "@/ui/utils/uiParamFormatter.js";

export class ParameterController {
  constructor(dispatcher, signal, definitions) {
    this.dispatcher = dispatcher;
    this.signal = signal;
    this.definitions = definitions;
    this.rafIds = new Map();
    this.pendingPayloads = new Map();
    this.categoryMap = this.#buildCategoryMap();
  }

  #buildCategoryMap() {
    const map = new Map();
    Object.entries(this.definitions).forEach(([key, def]) => {
      map.set(key, def.category);
    });
    return map;
  }

  #dispatch(type, payload = {}) {
    if (this.dispatcher) {
      this.dispatcher.dispatch(type, payload);
    }
  }

  init(container) {
    const stopPropagation = (e) => e.stopPropagation();
    
    const elements = container.querySelectorAll("[data-parameter]");

    elements.forEach((el) => {
      const stateKey = el.getAttribute("data-parameter");
      if (!stateKey) return;

      if (stateKey === "baseColorPicker") {
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

        el.addEventListener("input", (e) => {
          const hsvVals = hexToHsv(e.target.value);
          pendingColor = { hue: hsvVals.h, saturation: hsvVals.s, value: hsvVals.v };

          if (colorRafId !== null) return;

          colorRafId = requestAnimationFrame(() => {
            colorRafId = null;
            if (pendingColor) {
              this.#dispatch("UPDATE_COLOR_INPUT", pendingColor);
              pendingColor = null;
            }
          });
        }, { signal: this.signal });
        
        el.addEventListener("change", () => {
          flushColor();
          this.#dispatch("COMMIT_HISTORY");
        }, { signal: this.signal });
      } else {
        let isOperating = false;

        const flushPending = () => {
          const rafId = this.rafIds.get(stateKey);
          if (rafId !== undefined) {
            cancelAnimationFrame(rafId);
            this.rafIds.delete(stateKey);
            
            const payload = this.pendingPayloads.get(stateKey);
            if (payload) {
               this.#dispatch("UPDATE_PARAM_INPUT", payload);
               this.pendingPayloads.delete(stateKey);
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
          
          this.pendingPayloads.set(stateKey, { category, key: stateKey, value: val });

          if (this.rafIds.has(stateKey)) return;

          const id = requestAnimationFrame(() => {
            this.rendererUpdateTick(stateKey);
          });
          this.rafIds.set(stateKey, id);
        }, { signal: this.signal });

        el.addEventListener("change", () => {
           commit();
        }, { signal: this.signal });
      }
    });
  }

  rendererUpdateTick(stateKey) {
    this.rafIds.delete(stateKey);
    const payload = this.pendingPayloads.get(stateKey);
    if (payload) {
       this.#dispatch("UPDATE_PARAM_INPUT", payload);
       this.pendingPayloads.delete(stateKey);
    }
  }

  clearPendingUpdates() {
    this.rafIds.forEach((rafId) => {
      cancelAnimationFrame(rafId);
    });
    this.rafIds.clear();
    this.pendingPayloads.clear();
  }
}