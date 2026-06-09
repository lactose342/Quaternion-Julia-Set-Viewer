import { CONFIG } from "@/config/config.js";
import { ANIM_UI_MAPPING } from "@/ui/uiConstants.js";
import { ColorUtils } from "@/infra/ColorUtils.js";
import { JuliaAnimationService } from "@/core/domain/JuliaAnimationService.js";

export class ParameterController {
  constructor(stateManager, uiElements, signal) {
    this.stateManager = stateManager;
    this.uiElements = uiElements;
    this.signal = signal;
  }

  bindEvents() {
    const stopPropagation = (e) => e.stopPropagation();
    const cParams = ["cx", "cy", "cz", "cw"];
    const domIdsToBind = [
      ...CONFIG.SCHEMAS.fractal,
      ...CONFIG.SCHEMAS.material,
      ...ANIM_UI_MAPPING.map((m) => m.id),
    ];

    domIdsToBind.forEach((domId) => {
      const el = this.uiElements[domId];
      if (!el) return;

      const stateKey = this._getStateKey(domId);

      el.addEventListener("touchstart", stopPropagation, { passive: true, signal: this.signal });
      el.addEventListener("pointerdown", stopPropagation, { signal: this.signal });

      el.addEventListener("input", () => {
        requestAnimationFrame(() => {
          const state = this.stateManager.getRawState();
          const isAnimParam = CONFIG.SCHEMAS.animation.includes(stateKey);
          const isAngleParam = stateKey.startsWith("rot") || ["px", "py", "pz", "pw"].includes(stateKey);

          let val = el.type === "color" ? el.value : parseFloat(el.value);
          
          if (typeof val === "number" && isAngleParam) {
            val = (val * Math.PI) / 180;
          }

          const category = CONFIG.SCHEMAS.fractal.includes(stateKey) ? "fractal" 
                         : CONFIG.SCHEMAS.material.includes(stateKey) ? "material" 
                         : "animation";

          this.stateManager.updateParamsState(category, { [stateKey]: val });

          if (category === "fractal" || category === "material") {
            this.stateManager.updateUiState({ activePreset: "custom" });
          } else if (category === "animation") {
            this.stateManager.updateUiState({ activeAnimPreset: "custom" });
          }

          if (isAnimParam && !state.ui.isAutoAnimating) {
            // 一時停止中のアニメパラメータを変更した場合現在形状をBaseCに確定し、位相をリセット
            const animatedCVec = { cx: 0, cy: 0, cz: 0, cw: 0 };
            JuliaAnimationService.calculateAnimatedC(state.domain.params, this.stateManager.getRawAnimPhases(), animatedCVec);
            
            this.stateManager.updateParamsState("fractal", {
              cx: animatedCVec.cx,
              cy: animatedCVec.cy,
              cz: animatedCVec.cz,
              cw: animatedCVec.cw
            });
            this.stateManager.resetAnimPhases();
            this.stateManager.notifyChange({ type: 'ALL' });
          } else if (cParams.includes(stateKey)) {
            // 手動でBaseCを動かしたときも位相をリセット
            this.stateManager.resetAnimPhases();
            this.stateManager.notifyChange({ type: 'PARAMS', category, keys: [stateKey] });
          } else {
            this.stateManager.notifyChange({ type: 'PARAMS', category, keys: [stateKey] });
          }
        });
      }, { signal: this.signal });

      el.addEventListener("change", () => {
        const state = this.stateManager.getRawState();
        if (!state.ui.isAutoAnimating) {
          this.stateManager.notifyChange({ type: 'COMMIT_HISTORY' });
        }
        this.stateManager.updateUiState({ isInteracting: false });
      }, { signal: this.signal });
    });

    const baseColorPicker = document.getElementById("baseColorPicker");
    if (baseColorPicker) {
      baseColorPicker.addEventListener("input", (e) => {
        const hsvVals = ColorUtils.hexToHsv(e.target.value);
        this.stateManager.updateParamsState("material", { hue: hsvVals.h, saturation: hsvVals.s });
        this.stateManager.updateUiState({ activePreset: "custom" });
        this.stateManager.notifyChange({ type: 'PARAMS', category: 'material', keys: ['hue', 'saturation'] });
      }, { signal: this.signal });
      
      baseColorPicker.addEventListener("change", () => {
        const state = this.stateManager.getRawState();
        if (!state.ui.isAutoAnimating) {
          this.stateManager.notifyChange({ type: 'COMMIT_HISTORY' });
        }
        this.stateManager.updateUiState({ isInteracting: false });
      }, { signal: this.signal });
    }
  }

  _getStateKey(domId) {
    const mapping = ANIM_UI_MAPPING.find((m) => m.id === domId);
    return mapping ? mapping.key : domId;
  }
}