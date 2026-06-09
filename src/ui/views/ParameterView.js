import { ANIM_UI_MAPPING } from "@/ui/uiConstants.js";

export class ParameterView {
  constructor(uiElements) {
    this.uiElements = uiElements;
  }

  update(displayParams, isAutoAnimating, activeElementId = null) {
    const categories = ["fractal", "material", "animation"];

    categories.forEach((category) => {
      if (!displayParams[category]) return;
      
      Object.entries(displayParams[category]).forEach(([key, paramData]) => {
        let domId = key;
        if (category === "animation") {
          const found = ANIM_UI_MAPPING.find((m) => m.key === key);
          if (found) domId = found.id;
        }

        const inputEl = this.uiElements[domId];
        if (!inputEl) return;

        // 判定用のメタデータを上位から貰う形に変更
        const isFocused = domId === activeElementId;
        const isChangingCAndAnimating = isAutoAnimating && ["cx", "cy", "cz", "cw"].includes(key);

        // 1. インプット要素の同期
        if (!isFocused || isChangingCAndAnimating) {
          if (inputEl.value !== String(paramData.value)) {
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