import { CONFIG } from "@/config/config.js";
import { ANIM_UI_MAPPING, UI_IDS } from "@/ui/uiConstants.js";
import { formatParamForUI } from "@/ui/utils/uiParamFormatter.js";
import { ColorUtils } from "@/infra/ColorUtils.js";

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
    sharedUiElements,
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
    this.uiElements = sharedUiElements;
    this.abortController = new AbortController();
  }

  init() {
    const domIds = [
      ...CONFIG.SCHEMAS.fractal,
      ...CONFIG.SCHEMAS.material,
      ...ANIM_UI_MAPPING.map((m) => m.id),
      UI_IDS.EXPORT.CUSTOM_UI,
      UI_IDS.EXPORT.MODAL,
      UI_IDS.EXPORT.PROGRESS_BAR,
      UI_IDS.EXPORT.PROGRESS_TEXT,
      "custom-ui",
      "toggle-ui-btn",
      "fullscreen-btn",
      "preset-select",
      "anim-preset-select",
      "fps-counter",
      "baseColorPicker",
      "zoom"
    ];

    domIds.forEach((domId) => {
      const el = document.getElementById(domId);
      if (el) this.uiElements[domId] = el;

      const valLabel = document.getElementById(`val-${domId}`);
      if (valLabel) this.uiElements[`val-${domId}`] = valLabel;
    });

    Object.assign(this.exportView.uiElements, this.uiElements);
    Object.assign(this.mainMenuView.uiElements, this.uiElements);
    Object.assign(this.parameterView.uiElements, this.uiElements);

    this.updateHistoryButtons();
  }

  watchStores(domainStore, uiStore, historyManager) {
    const signal = this.abortController.signal;

    domainStore.addEventListener("domain-updated", (e) => {
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
    const params = {
      fractal: this.domainStore.getParams("fractal"),
      material: this.domainStore.getParams("material"),
      animation: this.domainStore.getParams("animation"),
    };
    const isAutoAnimating = this.uiStore.isAutoAnimating;
    const activeElementId = document.activeElement ? document.activeElement.id : null;

    const animatedCVec = this.domainStore.getAnimatedC();

    const displayParams = {};
    Object.keys(params).forEach((cat) => {
      if (!params[cat]) return;
      displayParams[cat] = {};

      Object.entries(params[cat]).forEach(([key, value]) => {
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

    if (params.material && params.material.hue !== undefined && params.material.saturation !== undefined) {
      const hexColor = ColorUtils.hsvToHex(params.material.hue, params.material.saturation, 1.0);
      displayParams.material["baseColorPicker"] = {
        value: hexColor,
        displayText: hexColor
      };
    }

    this.parameterView.update(displayParams, isAutoAnimating, activeElementId);
  }

  synchronizeUIState(changedKeys) {
    const uiState = this.uiStore.getState();
    this.exportView.update(uiState);
    this.mainMenuView.updatePresets(uiState.activePreset, uiState.activeAnimPreset);

    const customUi = this.uiElements["custom-ui"];
    if (customUi) {
      customUi.classList.toggle("is-interacting", !!uiState.isInteracting);
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
    const presetSelect = this.uiElements["preset-select"];
    const playBtn = document.getElementById("auto-animate-btn");

    if (undoBtn) undoBtn.disabled = !status.canUndo || isAutoAnimating;
    if (redoBtn) redoBtn.disabled = !status.canRedo || isAutoAnimating;
    if (presetSelect) presetSelect.disabled = isAutoAnimating;

    if (playBtn) {
      playBtn.classList.toggle("is-playing", isAutoAnimating);
    }

    ["cx", "cy", "cz", "cw"].forEach((id) => {
      const el = this.uiElements[id];
      if (el) el.disabled = isAutoAnimating;
    });
  }

  dispose() {
    this.abortController.abort();
  }
}