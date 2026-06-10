import { CONFIG } from "@/config/config.js";
import { ANIM_UI_MAPPING } from "@/ui/uiConstants.js";
import { ColorUtils } from "@/infra/ColorUtils.js";
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
    CONFIG.SCHEMAS.fractal.forEach(k => map.set(k, "fractal"));
    CONFIG.SCHEMAS.material.forEach(k => map.set(k, "material"));
    CONFIG.SCHEMAS.animation.forEach(k => map.set(k, "animation"));
    map.set("zoom", "material");
    return map;
  }

  #dispatch(type, payload = {}) {
    window.dispatchEvent(new CustomEvent("app-command", { detail: { type, ...payload } }));
  }

  bindEvents() {
    const stopPropagation = (e) => e.stopPropagation();
    
    const domIdsToBind = [
      ...CONFIG.SCHEMAS.fractal,
      ...CONFIG.SCHEMAS.material,
      ...ANIM_UI_MAPPING.map((m) => m.id),
      "zoom" 
    ];

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
          this.rafIds.delete(domId);
          const payload = this.pendingPayloads.get(domId);
          if (payload) {
             this.#dispatch("UPDATE_PARAM_INPUT", payload);
             this.pendingPayloads.delete(domId);
          }
        });
        this.rafIds.set(domId, id);
      }, { signal: this.signal });

      el.addEventListener("change", () => {
         commit();
      }, { signal: this.signal });
    });

    const baseColorPicker = this.uiElements["baseColorPicker"];
    if (baseColorPicker) {
      baseColorPicker.addEventListener("input", (e) => {
        const hsvVals = ColorUtils.hexToHsv(e.target.value);
        this.#dispatch("UPDATE_COLOR_INPUT", { hue: hsvVals.h, saturation: hsvVals.s });
      }, { signal: this.signal });
      
      baseColorPicker.addEventListener("change", () => {
        this.#dispatch("COMMIT_HISTORY");
      }, { signal: this.signal });
    }
  }

  _getStateKey(domId) {
    const mapping = ANIM_UI_MAPPING.find((m) => m.id === domId);
    return mapping ? mapping.key : domId;
  }
}