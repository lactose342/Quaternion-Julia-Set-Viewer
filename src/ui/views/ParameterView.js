import { ANIM_UI_MAPPING } from "@/ui/uiConstants.js";

export class ParameterView {
  constructor(uiElements) {
    this.uiElements = uiElements;
  }

  update(params, isAutoAnimating, animatedCVec, changedKeys = null) {
    const categories = ["fractal", "material", "animation"];

    categories.forEach((category) => {
      if (!params[category]) return;
      
      Object.entries(params[category]).forEach(([key, value]) => {
        if (changedKeys) {
          const isPhaseUpdate = changedKeys.some(k => ['x', 'y', 'z', 'w'].includes(k));
          const isCKey = ['cx', 'cy', 'cz', 'cw'].includes(key);
          if (!changedKeys.includes(key) && !(isPhaseUpdate && isCKey)) return;
        }

        let domId = key;
        if (category === "animation") {
          const found = ANIM_UI_MAPPING.find((m) => m.key === key);
          if (found) domId = found.id;
        }

        let displayValue = value;
        
        // 一時停止中で位相が残っている場合も、常に「BaseC + Phase」の値をUIに表示する
        if (category === "fractal" && ["cx", "cy", "cz", "cw"].includes(key)) {
          displayValue = animatedCVec[key];
        }

        let uiValue = displayValue;
        const isAngleParam = key.startsWith("rot") || ["px", "py", "pz", "pw"].includes(key);
        if (typeof uiValue === "number" && isAngleParam) {
          uiValue = (uiValue * 180) / Math.PI;
        }

        this.#updateInput(domId, uiValue, isAutoAnimating, key);
        this.#updateLabel(domId, uiValue, isAngleParam, key);
      });
    });
  }

  #updateInput(domId, uiValue, isAutoAnimating, key) {
    const inputEl = this.uiElements[domId];
    // アニメーション「再生中」のみ強制上書きし、一時停止中はユーザーが掴めるようにする
    const isChangingCAndAnimating = isAutoAnimating && ["cx", "cy", "cz", "cw"].includes(key);
    
    if (inputEl && (inputEl !== document.activeElement || isChangingCAndAnimating)) {
      if (inputEl.value !== String(uiValue)) {
        inputEl.value = uiValue;
      }
    }
  }

  #updateLabel(domId, uiValue, isAngleParam, key) {
    const labelEl = this.uiElements[`val-${domId}`];
    if (!labelEl) return;

    if (isAngleParam || key === "fov") {
      labelEl.textContent = `${uiValue.toFixed(1)}°`;
    } else if (typeof uiValue === "number") {
      labelEl.textContent = uiValue.toFixed(3).replace(/\.?0+$/, "");
    } else {
      labelEl.textContent = uiValue;
    }
  }
}