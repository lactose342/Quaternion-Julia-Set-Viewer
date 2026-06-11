import { formatParamForUI } from "@/ui/utils/uiParamFormatter.js";
import { hsvToHex } from "@/infra/ColorUtils.js";
import { createParameterElement, createColorPickerElement } from "@/ui/utils/DOMFactory.js";
import { TabView } from "@/ui/views/TabView.js";
import { BottomSheetView } from "@/ui/views/BottomSheetView.js";

export class UIController {
  constructor(
    domainStore,
    uiStore,
    renderer,
    historyManager,
    exportManager,
    toastView,
    paramController,
    actionController,
    parameterView,
    exportView,
    mainMenuView,
    colorPickerView,
    definitions,
  ) {
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.renderer = renderer;
    this.historyManager = historyManager;
    this.exportManager = exportManager;
    this.toastView = toastView;
    this.paramController = paramController;
    this.actionController = actionController;
    this.parameterView = parameterView;
    this.exportView = exportView;
    this.mainMenuView = mainMenuView;
    this.colorPickerView = colorPickerView;
    this.definitions = definitions;
    this.abortController = new AbortController();
    this.qualityTimeoutId = null;
  }

  #generateUI() {
    const container = document.getElementById("parameter-sections-container");
    if (!container) return;

    const SECTION_CONFIGS = [
      {
        id: "section-shape",
        title: "基本形状の調整 (Cパラメータ)",
        open: true,
        groups: ["shape"]
      },
      {
        id: "section-rotation",
        title: "空間の回転 (3D/4D)",
        open: false,
        groups: ["rotation"]
      },
      {
        id: "section-camera",
        title: "カメラと視野角",
        open: false,
        groups: ["camera"]
      },
      {
        id: "section-style",
        title: "色と質感",
        open: false,
        groups: ["style"]
      },
      {
        id: "section-animation",
        title: "アニメーション設定",
        open: false,
        groups: ["animation"]
      }
    ];

    SECTION_CONFIGS.forEach(section => {
      const details = document.createElement("details");
      details.id = section.id;
      if (section.open) details.setAttribute("open", "");

      const summary = document.createElement("summary");
      summary.textContent = section.title;
      details.appendChild(summary);

      const allParams = Object.entries(this.definitions)
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
            const def = this.definitions[key];
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

  init() {
    this.#generateUI();

    const container = document.getElementById("parameter-sections-container");
    if (container) {
      this.parameterView.init(container);
      this.paramController.init(container);
      if (this.colorPickerView) {
        this.colorPickerView.init(container);
      }
    }

    this.tabView = new TabView(this.colorPickerView);
    this.tabView.init();

    this.bottomSheetView = new BottomSheetView();
    this.bottomSheetView.init();

    this.updateHistoryButtons();
  }

  watchStores(domainStore, uiStore, historyManager) {
    const signal = this.abortController.signal;

    domainStore.addEventListener("domain-updated", (e) => {
      // VRプレゼンテーション中はデスクトップUIの更新をスキップ（VR内FPSの安定化）
      if (this.renderer.renderer && this.renderer.renderer.xr.isPresenting) {
        return;
      }

      const { type, category, keys } = e.detail;
      if (type === "PARAMS") {
        this.synchronizeParameterValues(category, keys);
      } else if (type === "ALL") {
        this.updateUIFromState();
      } else if (type === "ANIM_PHASES") {
        this.synchronizeParameterValues("fractal", ["cx", "cy", "cz", "cw"]);
      }
    }, { signal });

    uiStore.addEventListener("ui-updated", (e) => {
      const { keys } = e.detail;
      this.synchronizeUIState(keys);
    }, { signal });

    if (historyManager) {
      historyManager.addEventListener("history-updated", () => {
        this.updateHistoryButtons();
      }, { signal: this.abortController.signal });
    }
  }

  synchronizeParameterValues(category, changedKeys) {
    const isAutoAnimating = this.uiStore.isAutoAnimating;
    const activeElementId = document.activeElement ? document.activeElement.id : null;

    const displayParams = {};
    const animatedCVec = this.domainStore.getAnimatedC();

    let categoriesToSync = ["fractal", "material", "animation"];
    let keysToSync = null;

    if (category !== "ALL" && category) {
      categoriesToSync = [category];
      if (changedKeys && Array.isArray(changedKeys)) {
        keysToSync = changedKeys;
      }
    }

    categoriesToSync.forEach((cat) => {
      const catParams = this.domainStore.getParams(cat);
      if (!catParams) return;

      displayParams[cat] = {};
      const targetKeys = keysToSync || Object.keys(catParams);

      targetKeys.forEach((key) => {
        const value = catParams[key];
        if (value === undefined) return;

        let displayValue = value;
        if (cat === "fractal" && ["cx", "cy", "cz", "cw"].includes(key)) {
          displayValue = animatedCVec[key];
        }

        const { numericValue, displayString } = formatParamForUI(key, displayValue);
        displayParams[cat][key] = {
          value: numericValue,
          displayText: displayString,
        };
      });
    });

    const isAll = (category === "ALL" || !category);
    const hasColorChange = category === "material" && (changedKeys && (changedKeys.includes("hue") || changedKeys.includes("saturation")));

    if (isAll || hasColorChange) {
      const matParams = this.domainStore.getParams("material");
      if (matParams && matParams.hue !== undefined && matParams.saturation !== undefined) {
        const val = matParams.value !== undefined ? matParams.value : 1.0;
        const hexColor = hsvToHex(matParams.hue, matParams.saturation, val);
        if (!displayParams.material) displayParams.material = {};
        displayParams.material["baseColorPicker"] = {
          value: hexColor,
          displayText: hexColor
        };
      }
    }

    this.parameterView.update(displayParams, isAutoAnimating, activeElementId);

    if (this.colorPickerView) {
      if (isAll || hasColorChange) {
        this.colorPickerView.syncAll();
      }
    }
  }

  synchronizeUIState(changedKeys) {
    const uiState = this.uiStore.getState();
    this.exportView.update(uiState);
    this.mainMenuView.updatePresets(uiState.activePreset, uiState.activeAnimPreset);

    const customUi = document.getElementById("custom-ui");
    if (customUi) {
      customUi.classList.toggle("is-interacting", !!uiState.isInteracting);
    }

    if (changedKeys && (changedKeys.includes("isInteracting") || changedKeys.includes("isAutoAnimating"))) {
      this.updateRenderQuality();
    }

    if (changedKeys && (changedKeys.includes("isAutoAnimating") || changedKeys.includes("isDownloading"))) {
      this.updateHistoryButtons();
    }
  }

  updateUIFromState() {
    this.synchronizeParameterValues("ALL", null);
    this.synchronizeUIState(null);
    this.updateHistoryButtons();
  }

  updateHistoryButtons() {
    if (!this.historyManager) return;
    const status = this.historyManager.getStatus();
    const isAutoAnimating = this.uiStore.isAutoAnimating;

    const undoBtn = document.getElementById("undo-btn");
    const redoBtn = document.getElementById("redo-btn");
    const presetSelect = document.getElementById("preset-select");
    const playBtn = document.getElementById("auto-animate-btn");

    if (undoBtn) undoBtn.disabled = !status.canUndo || isAutoAnimating;
    if (redoBtn) redoBtn.disabled = !status.canRedo || isAutoAnimating;
    if (presetSelect) presetSelect.disabled = isAutoAnimating;

    if (playBtn) {
      playBtn.classList.toggle("is-playing", isAutoAnimating);
    }

    ["cx", "cy", "cz", "cw"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = isAutoAnimating;
    });
  }

  updateRenderQuality() {
    const uiState = this.uiStore.getState();
    if (uiState.isDownloading) return;

    if (uiState.isInteracting || uiState.isAutoAnimating) {
      if (this.qualityTimeoutId) {
        clearTimeout(this.qualityTimeoutId);
        this.qualityTimeoutId = null;
      }
      this.renderer.setQuality("LOW");
    } else {
      if (this.qualityTimeoutId) {
        clearTimeout(this.qualityTimeoutId);
      }
      this.qualityTimeoutId = setTimeout(() => {
        const currentUiState = this.uiStore.getState();
        if (!currentUiState.isInteracting && !currentUiState.isAutoAnimating) {
          this.renderer.setQuality(currentUiState.renderQuality || "HIGH");
        }
        this.qualityTimeoutId = null;
      }, 300);
    }
  }

  dispose() {
    this.abortController.abort();
    if (this.qualityTimeoutId) {
      clearTimeout(this.qualityTimeoutId);
    }
  }
}