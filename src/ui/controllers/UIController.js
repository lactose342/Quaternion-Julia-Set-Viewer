import { CONFIG } from "@/config/config.js";
import { ANIM_UI_MAPPING, UI_IDS } from "@/ui/uiConstants.js";
import { JuliaAnimationService } from "@/core/domain/JuliaAnimationService.js";

export class UIController {
  constructor(
    domainStore, // 1
    uiStore, // 2
    renderer, // 3
    historyManager, // 4
    exportManager, // 5
    toastView, // 6
    paramController, // 7
    actionController, // 8
    parameterView, // 9
    exportView, // 10
    mainMenuView, // 11
    sharedUiElements, // 12
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
    // 各種Viewが要求するDOM要素のIDを完全に網羅して一元収集する
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
    ];

    domIds.forEach((domId) => {
      const el = document.getElementById(domId);
      if (el) this.uiElements[domId] = el;

      const valLabel = document.getElementById(`val-${domId}`);
      if (valLabel) this.uiElements[`val-${domId}`] = valLabel;
    });

    // 各種Viewのコンストラクタでプロパティが展開されるようにバインド情報を確定
    Object.assign(this.exportView.uiElements, this.uiElements);
    Object.assign(this.mainMenuView.uiElements, this.uiElements);
    Object.assign(this.parameterView.uiElements, this.uiElements);

    if (this.uiElements["fps-counter"]) {
      this.renderer.uiElements.fpsCounter = this.uiElements["fps-counter"];
    }

    window.addEventListener("history-updated", () => this.updateHistoryButtons());
    this.updateHistoryButtons();
  }

  // 1. ドメイン状態（数式）の変更をViewへ安全に同期する
  synchronizeParameterValues(category, changedKeys) {
    const params = {
      fractal: this.domainStore.getParams("fractal"),
      material: this.domainStore.getParams("material"),
      animation: this.domainStore.getParams("animation"),
    };
    const isAutoAnimating = this.uiStore.isAutoAnimating;

    // ユーザーが手動スライダー操作中であれば、activeElementのIDを取得してViewへ伝える
    const activeElementId = document.activeElement ? document.activeElement.id : null;

    // アニメーション適用時の現在C値を計算する
    const animatedCVec = { cx: 0, cy: 0, cz: 0, cw: 0 };
    if (params.fractal && params.material && params.animation) {
      JuliaAnimationService.calculateAnimatedC(
        { fractal: params.fractal, material: params.material, animation: params.animation },
        this.domainStore.animPhases,
        animatedCVec
      );
    }

    // View層に計算をやらせず、あらかじめ表示用の形式（180度変換や桁数制御など）に整形したオブジェクトを渡す
    const displayParams = {};
    Object.keys(params).forEach((cat) => {
      if (!params[cat]) return;
      displayParams[cat] = {};

      Object.entries(params[cat]).forEach(([key, value]) => {
        let displayValue = value;

        // アニメーション中等のCの現在形状リアルタイム同期
        if (cat === "fractal" && ["cx", "cy", "cz", "cw"].includes(key)) {
          displayValue = animatedCVec[key];
        }

        let uiValue = displayValue;
        const isAngleParam = key.startsWith("rot") || ["px", "py", "pz", "pw"].includes(key);
        if (typeof uiValue === "number" && isAngleParam) {
          uiValue = (uiValue * 180) / Math.PI;
        }

        let displayText = String(uiValue);

        // 数値型であり、かつ変換可能なもののみに toFixed を適用する
        if (typeof uiValue === "number") {
          if (isAngleParam || key === "fov") {
            displayText = `${uiValue.toFixed(1)}°`;
          } else {
            displayText = uiValue.toFixed(3).replace(/\.?0+$/, "");
          }
        }
        // カラーコードやその他の文字列はそのまま displayText として扱われる

        displayParams[cat][key] = {
          value: uiValue,
          displayText: displayText,
        };
      });
    });

    this.parameterView.update(displayParams, isAutoAnimating, activeElementId);
  }

  // 2. UI状態（ダウンロードやアニメ再生フラグ）の変更をViewへ同期する
  synchronizeUIState(changedKeys) {
    const uiState = this.uiStore.getState();
    this.exportView.update(uiState);
    this.mainMenuView.updatePresets(uiState.activePreset, uiState.activeAnimPreset);

    const customUi = this.uiElements["custom-ui"];
    if (customUi) {
      customUi.classList.toggle("is-interacting", uiState.isInteracting);
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
