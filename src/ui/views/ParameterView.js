export class ParameterView {
  constructor(definitions) {
    this.definitions = definitions;
    this.inputs = new Map();
    this.labels = new Map();
  }

  init(container) {
    Object.values(this.definitions).forEach((def) => {
      const inputEl = container.querySelector(`#${def.domId}`);
      if (inputEl) {
        this.inputs.set(def.domId, inputEl);
      }
      const labelEl = container.querySelector(`#val-${def.domId}`);
      if (labelEl) {
        this.labels.set(def.domId, labelEl);
      }
    });
  }

  update(displayParams, isAutoAnimating, activeElementId = null) {
    const categories = ["fractal", "material", "animation", "camera"];

    categories.forEach((category) => {
      if (!displayParams[category]) return;
      
      Object.entries(displayParams[category]).forEach(([key, paramData]) => {
        const def = this.definitions[key];
        const domId = def ? def.domId : key;

        const inputEl = this.inputs.get(domId);
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
        const labelEl = this.labels.get(domId);
        if (labelEl) {
          labelEl.textContent = paramData.displayText;
        }
      });
    });
  }
}