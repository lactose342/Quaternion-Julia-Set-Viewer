import { CONFIG } from "@/config/config.js";
import { ANIM_UI_MAPPING, UI_IDS } from "@/ui/uiConstants.js";
import { JuliaAnimationService } from "@/core/domain/JuliaAnimationService.js";

export class UIController {
  constructor(
    stateManager, renderer, historyManager, exportManager, 
    toastView, paramController, actionController, parameterView, exportView,
    sharedUiElements
  ) {
    this.stateManager = stateManager;
    this.renderer = renderer;
    this.historyManager = historyManager;
    this.exportManager = exportManager;
    this.toastView = toastView;
    this.paramController = paramController;
    this.actionController = actionController;
    this.parameterView = parameterView;
    this.exportView = exportView;
    this.uiElements = sharedUiElements; 
    this.abortController = new AbortController();
  }

  init() {
    const domIds = [
      ...CONFIG.SCHEMAS.fractal,
      ...CONFIG.SCHEMAS.material,
      ...ANIM_UI_MAPPING.map((m) => m.id),
      UI_IDS.EXPORT.CUSTOM_UI,
      "fps-counter",
    ];

    domIds.forEach((domId) => {
      const el = document.getElementById(domId);
      if (el) this.uiElements[domId] = el; 
      const valLabel = document.getElementById(`val-${domId}`);
      if (valLabel) this.uiElements[`val-${domId}`] = valLabel;
    });

    if (this.uiElements["fps-counter"]) {
      this.renderer.uiElements.fpsCounter = this.uiElements["fps-counter"];
    }

    this.paramController.bindEvents();
    this.actionController.bindEvents();
    this.updateHistoryButtons();
  }

  updateUIFromState(stateParams = null, changedKeys = null) {
    const state = this.stateManager.getRawState();
    const params = stateParams || state.domain.params;

    const animatedCVec = { cx: 0, cy: 0, cz: 0, cw: 0 };
    // 一時停止中（位相あり）でも常に現在値（C）を計算する
    JuliaAnimationService.calculateAnimatedC(params, this.stateManager.getRawAnimPhases(), animatedCVec);

    this.parameterView.update(params, state.ui.isAutoAnimating, animatedCVec, changedKeys);
    this.updateHistoryButtons();
  }

  updateExportUIFromState(uiState) {
    this.exportView.update(uiState);
  }

  updateHistoryButtons() {
    if (!this.historyManager) return;
    const status = this.historyManager.getStatus();
    const isAutoAnimating = this.stateManager.getState().ui.isAutoAnimating;

    const undoBtn = document.getElementById("undo-btn");
    const redoBtn = document.getElementById("redo-btn");
    const presetSelect = document.getElementById("preset-select");
    const playBtn = document.getElementById("auto-animate-btn");

    if (undoBtn) undoBtn.disabled = !status.canUndo || isAutoAnimating;
    if (redoBtn) redoBtn.disabled = !status.canRedo || isAutoAnimating;
    if (presetSelect) presetSelect.disabled = isAutoAnimating;

    if (playBtn) {
      if (isAutoAnimating) playBtn.classList.add("is-playing");
      else playBtn.classList.remove("is-playing");
    }

    ["cx", "cy", "cz", "cw"].forEach((id) => {
      const el = this.uiElements[id];
      if (el) el.disabled = isAutoAnimating;
    });
  }

  pushHistory() {
    this.historyManager.pushHistory(this.stateManager.getState(), this.stateManager.getRawAnimPhases());
    this.updateHistoryButtons();
  }

  dispose() {
    this.abortController.abort();
  }
}