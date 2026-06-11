import { createParameterElement, createColorPickerElement } from "@/ui/utils/DOMFactory.js";

export class MainMenuView {
  constructor() {
    this.customUi = document.getElementById("custom-ui");
    this.toggleBtn = document.getElementById("toggle-ui-btn");
    this.fullscreenBtn = document.getElementById("fullscreen-btn");
    this.presetSelect = document.getElementById("preset-select");
    this.animPresetSelect = document.getElementById("anim-preset-select");
  }

  generateUI(definitions, sectionsConfig) {
    const container = document.getElementById("parameter-sections-container");
    if (!container) return;

    const sections = sectionsConfig || [];

    sections.forEach(section => {
      const details = document.createElement("details");
      details.id = section.id;
      if (section.open) details.setAttribute("open", "");

      const summary = document.createElement("summary");
      summary.textContent = section.title;
      details.appendChild(summary);

      const allParams = Object.entries(definitions)
        .filter(([_, def]) => section.groups.includes(def.group) && !def.hideSlider);

      const sliderParams = allParams.filter(([_, def]) => def.type !== "color");
      const colorParams = allParams.filter(([_, def]) => def.type === "color");

      if (sliderParams.length > 0) {
        const sliderGrid = document.createElement("div");
        sliderGrid.className = "grid-container";
        sliderParams.forEach(([key, def]) => {
          sliderGrid.appendChild(createParameterElement(key, def));
        });
        details.appendChild(sliderGrid);
      }

      if (colorParams.length > 0) {
        const colorGrid = document.createElement("div");
        colorGrid.className = "color-picker-grid";
        colorParams.forEach(([key, def]) => {
          colorGrid.appendChild(createColorPickerElement(key, def));
        });
        details.appendChild(colorGrid);
      }

      if (section.id === "section-animation") {
        const nestedDetails = document.createElement("details");
        nestedDetails.id = "section-animation-details";
        nestedDetails.style.marginTop = "10px";
        nestedDetails.style.background = "rgba(255, 255, 255, 0.02)";

        const nestedSummary = document.createElement("summary");
        nestedSummary.textContent = "各パラメータの個別動作設定";
        nestedDetails.appendChild(nestedSummary);

        const nestedContainer = document.createElement("div");
        nestedContainer.style.display = "flex";
        nestedContainer.style.flexDirection = "column";
        nestedContainer.style.gap = "16px";
        nestedContainer.style.marginTop = "10px";

        const axes = ["x", "y", "z", "w"];
        axes.forEach(axis => {
          const axisGrid = document.createElement("div");
          axisGrid.className = "grid-3cols";

          const axisKeys = [`s${axis}`, `a${axis}`, `p${axis}`];
          axisKeys.forEach(key => {
            const def = definitions[key];
            if (def) {
              axisGrid.appendChild(createParameterElement(key, def));
            }
          });
          nestedContainer.appendChild(axisGrid);
        });

        nestedDetails.appendChild(nestedContainer);
        details.appendChild(nestedDetails);
      }

      container.appendChild(details);
    });
  }

  toggleMenu() {
    if (!this.customUi || !this.toggleBtn) return;

    this.customUi.classList.toggle("hidden");
    const isOpen = !this.customUi.classList.contains("hidden");
    
    if (isOpen) {
      this.toggleBtn.classList.remove("is-close");
      this.toggleBtn.classList.add("is-open");
      this.toggleBtn.textContent = "閉じる";
    } else {
      this.toggleBtn.classList.remove("is-open");
      this.toggleBtn.classList.add("is-close");
      this.toggleBtn.textContent = "設定";
    }
  }

  updateFullscreen(isFullscreen) {
    if (this.fullscreenBtn) {
      this.fullscreenBtn.classList.toggle("is-fullscreen", isFullscreen);
    }
  }

  updatePresets(activePreset, activeAnimPreset) {
    if (this.presetSelect && activePreset && this.presetSelect.value !== activePreset) {
      this.presetSelect.value = activePreset;
    }
    if (this.animPresetSelect && activeAnimPreset && this.animPresetSelect.value !== activeAnimPreset) {
      this.animPresetSelect.value = activeAnimPreset;
    }
  }
}