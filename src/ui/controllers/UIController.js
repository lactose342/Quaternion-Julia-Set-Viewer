import { formatParamForUI } from "@/ui/utils/uiParamFormatter.js";
import { hsvToHex } from "@/infra/ColorUtils.js";

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
    config,
    onboardingView,
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
    this.onboardingView = onboardingView;
    this.config = config;
    this.definitions = config.definitions;
    this.abortController = new AbortController();
    this.qualityTimeoutId = null;
  }

  init() {
    this.mainMenuView.generateUI(this.config.definitions, this.config.UI_SECTIONS);

    const container = document.getElementById("parameter-sections-container");
    if (container) {
      this.parameterView.init(container);
      this.paramController.init(container);
      if (this.colorPickerView) {
        this.colorPickerView.init(container);
      }
    }

    this.tabView = new TabView();
    this.tabView.addEventListener("tab-changed", () => {
      if (this.colorPickerView) {
        this.colorPickerView.syncAll(true);
      }
    }, { signal: this.abortController.signal });
    this.tabView.init();

    this.bottomSheetView = new BottomSheetView();
    this.bottomSheetView.init();

    if (this.onboardingView) {
      this.onboardingView.init();
      
      const triggerBtn = document.getElementById("onboarding-trigger-btn");
      if (triggerBtn) {
        triggerBtn.addEventListener("click", () => {
          this.onboardingView.startTour();
        }, { signal: this.abortController.signal });
      }
    }

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

    let categoriesToSync = ["fractal", "material", "animation", "camera"];
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

    // カメラ撮影モードに伴うUI表示・非表示の同期制御
    const cameraUi = document.getElementById("camera-ui");
    const toggleBtn = document.getElementById("toggle-ui-btn");
    const autoAnimateBtn = document.getElementById("auto-animate-btn");
    const fpsCounter = document.getElementById("fps-counter");
    const vrButton = document.getElementById("VRButton");

    // 初期化時、または isCameraMode の変更時のみ表示状態を同期する
    if (!changedKeys || changedKeys.includes("isCameraMode")) {
      if (uiState.isCameraMode) {
        // A. カメラモード時：調整パネルや不要なボタンを退避（フルスクリーンと自動アニメーションボタンは表示を維持）
        if (customUi) customUi.classList.add("hidden");
        if (cameraUi) cameraUi.classList.remove("hidden");
        if (toggleBtn) toggleBtn.classList.add("hidden");
        if (fpsCounter) fpsCounter.classList.add("hidden");
        if (vrButton) {
          vrButton.classList.add("hidden");
          vrButton.style.setProperty("display", "none", "important");
        }
      } else {
        // B. 通常モード時：カメラUIを隠し、元の調整パネル・ボタン類を復元
        if (cameraUi) cameraUi.classList.add("hidden");
        if (customUi) customUi.classList.remove("hidden");
        
        if (toggleBtn) {
          toggleBtn.classList.remove("hidden");
          // パネルが開いた状態（hidden解除）に合わせるため、設定ボタンも「閉じる（is-open）」状態に同期
          toggleBtn.classList.remove("is-close");
          toggleBtn.classList.add("is-open");
          toggleBtn.textContent = "閉じる";
        }
        if (fpsCounter) fpsCounter.classList.remove("hidden");
        if (vrButton) {
          vrButton.classList.remove("hidden");
          vrButton.style.removeProperty("display");
        }
      }
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