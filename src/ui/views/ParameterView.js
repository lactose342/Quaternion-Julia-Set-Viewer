import { PARAMETER_DEFINITIONS } from "@/core/domain/ParameterDefinitions.js";

export class ParameterView {
  constructor(uiElements) {
    this.uiElements = uiElements;
  }

  update(displayParams, isAutoAnimating, activeElementId = null) {
    const categories = ["fractal", "material", "animation"];

    categories.forEach((category) => {
      if (!displayParams[category]) return;
      
      Object.entries(displayParams[category]).forEach(([key, paramData]) => {
        const def = PARAMETER_DEFINITIONS[key];
        const domId = def ? def.domId : key;

        const inputEl = this.uiElements[domId];
        if (!inputEl) return;

        const isFocused = domId === activeElementId;
        const isChangingCAndAnimating = isAutoAnimating && ["cx", "cy", "cz", "cw"].includes(key);

        // 1. インプット要素の同期
        if (!isFocused || isChangingCAndAnimating) {
          const currentValue = inputEl.type === "color" ? inputEl.value.toLowerCase() : String(inputEl.value);
          const targetValue = inputEl.type === "color" ? String(paramData.value).toLowerCase() : String(paramData.value);
          
          if (currentValue !== targetValue) {
            inputEl.value = paramData.value;
          }
        }

        // 2. ラベル要素の同期
        const labelEl = this.uiElements[`val-${domId}`];
        if (labelEl) {
          labelEl.textContent = paramData.displayText;
        }
      });
    });
  }
}