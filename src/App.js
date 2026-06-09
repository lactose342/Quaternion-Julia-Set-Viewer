import "@/styles/style.css";
import { StateManager } from "@/core/StateManager.js";
import { HistoryManager } from "@/core/HistoryManager.js";
import { URLManager } from "@/infra/URLManager.js";
import { PresetManager } from "@/infra/PresetManager.js";
import { ExportManager } from "@/infra/ExportManager.js";
// WebXRManager は削除されました
import { Renderer } from "@/infra/Renderer.js";
import { UIController } from "@/ui/controllers/UIController.js";
import { AnimationController } from "@/core/AnimationController.js";
import { ParameterController } from "@/ui/controllers/ParameterController.js";
import { ActionController } from "@/ui/controllers/ActionController.js";
import { ToastView } from "@/ui/views/ToastView.js";
import { ParameterView } from "@/ui/views/ParameterView.js";
import { ExportView } from "@/ui/views/ExportView.js";
import { MainMenuView } from "@/ui/views/MainMenuView.js";
import { CONFIG } from "@/config/config.js";
import { JuliaAnimationService } from "@/core/domain/JuliaAnimationService.js";

class App {
  constructor() {
    this.abortController = new AbortController();

    this.stateManager = new StateManager();
    this.historyManager = new HistoryManager();
    this.renderer = new Renderer(this.stateManager);
    this.animationController = new AnimationController(this.stateManager);
    this.urlManager = new URLManager(this.stateManager, this.renderer);
    this.presetManager = new PresetManager(this.stateManager);
    this.exportManager = new ExportManager(this.renderer, this.stateManager);

    const sharedUiElements = {}; 
    this.toastView = new ToastView();
    this.parameterView = new ParameterView(sharedUiElements);
    this.exportView = new ExportView(sharedUiElements);
    this.mainMenuView = new MainMenuView(); 

    this.paramController = new ParameterController(this.stateManager, sharedUiElements, this.abortController.signal);
    this.actionController = new ActionController(this.abortController.signal);

    this.uiController = new UIController(
      this.stateManager, this.renderer, this.historyManager, this.exportManager,
      this.toastView, this.paramController, this.actionController, this.parameterView, this.exportView,
      sharedUiElements
    );

    this.#setupEventMediator();
    this.#setupStateSync();

    this.renderer.onTick = (delta) => this.animationController.update(delta);
  }

  #setupEventMediator() {
    window.addEventListener("app-command", async (e) => {
      const { type, value, format, scale } = e.detail;

      switch (type) {
        case "TOGGLE_MENU_UI":
          this.mainMenuView.toggleMenu();
          break;

        case "APPLY_PRESET":
          this.stateManager.updateUiState({ isInteracting: true, activePreset: value });
          if (this.presetManager.applyPreset(value)) {
            this.stateManager.resetAnimPhases();
            this.stateManager.notifyChange({ type: "ALL" });
            this.stateManager.notifyChange({ type: "COMMIT_HISTORY" });
          }
          this.stateManager.updateUiState({ isInteracting: false });
          break;

        case "APPLY_ANIM_PRESET":
          this.stateManager.updateUiState({ isInteracting: true, activeAnimPreset: value });
          const animPreset = CONFIG.ANIM_PRESETS[value];
          if (animPreset) {
            const state = this.stateManager.getState();
            if (!state.ui.isAutoAnimating) {
              const animatedCVec = { cx: 0, cy: 0, cz: 0, cw: 0 };
              JuliaAnimationService.calculateAnimatedC(state.domain.params, this.stateManager.getRawAnimPhases(), animatedCVec);
              this.stateManager.updateParamsState("fractal", {
                cx: animatedCVec.cx, cy: animatedCVec.cy, cz: animatedCVec.cz, cw: animatedCVec.cw
              });
            }
            this.stateManager.updateParamsState("animation", animPreset);
            this.stateManager.resetAnimPhases();
            this.stateManager.notifyChange({ type: "ALL" });
          }
          this.stateManager.updateUiState({ isInteracting: false });
          break;

        case "TOGGLE_AUTO_ANIMATE":
          const nextAnimState = !this.stateManager.getState().ui.isAutoAnimating;
          this.stateManager.updateUiState({ isAutoAnimating: nextAnimState });
          this.renderer.setQuality(nextAnimState ? "LOW" : "HIGH");
          
          if (!nextAnimState) {
            this.stateManager.notifyChange({ type: "COMMIT_HISTORY" });
          }
          this.stateManager.notifyChange({ type: "ALL" });
          break;

        case "RESET_STATE":
          this.stateManager.resetToFactoryDefaults();
          this.stateManager.resetAnimPhases();
          this.stateManager.updateUiState({ activePreset: "preset1", activeAnimPreset: "preset1" });
          this.stateManager.notifyChange({ type: "ALL" });
          this.stateManager.notifyChange({ type: "COMMIT_HISTORY" });
          break;

        case "RANDOMIZE":
          this.stateManager.updateUiState({ isInteracting: true, activePreset: "custom" });
          const randomParams = this.presetManager.generateRandomParams();
          this.stateManager.updateParamsState("fractal", randomParams.fractal);
          this.stateManager.updateParamsState("material", randomParams.material);
          this.stateManager.notifyChange({ type: "ALL" });
          this.stateManager.notifyChange({ type: "COMMIT_HISTORY" });
          this.stateManager.updateUiState({ isInteracting: false });
          break;

        case "UNDO":
        case "REDO":
          const snapshot = type === "UNDO" ? this.historyManager.undo() : this.historyManager.redo();
          if (snapshot) {
            this.stateManager.restoreSnapshot(snapshot);
            const cam = snapshot.camera;
            this.renderer.camera.position.set(cam.position.x, cam.position.y, cam.position.z);
            this.renderer.controls.target.set(cam.target.x, cam.target.y, cam.target.z);
            this.renderer.controls.update();
            this.stateManager.notifyChange({ type: "ALL" });
          }
          break;

        case "DOWNLOAD_HIGH_RES":
          await this.exportManager.downloadHighRes(format, scale);
          break;

        case "SHARE_URL":
          try {
            await navigator.clipboard.writeText(this.urlManager.generateShareURL());
            this.uiController.toastView.show("共有URLをクリップボードにコピーしました");
          } catch (err) {
            this.uiController.toastView.show("URLのコピーに失敗しました", "error");
          }
          break;

        default:
          console.warn(`未定義のコマンドタイプです: ${type}`);
      }
    });

    this.exportManager.addEventListener("export-toast", (e) => {
      this.toastView.show(e.detail.message, e.detail.type, e.detail.duration);
    });

    document.addEventListener("fullscreenchange", () => {
      this.mainMenuView.updateFullscreen(!!document.fullscreenElement);
    });
  }

  #setupStateSync() {
    this.stateManager.addEventListener("statechange", (e) => {
      this.renderer.requestRender();

      const detail = e.detail || {};
      const state = this.stateManager.getState();

      if (detail.type === "COMMIT_HISTORY") {
        this.historyManager.pushHistory(state, this.stateManager.getRawAnimPhases());
        this.uiController.updateHistoryButtons();
      }

      if (detail.type === "UI" || detail.type === "ALL") {
        this.uiController.updateExportUIFromState(state.ui);
        this.mainMenuView.updatePresets(state.ui.activePreset, state.ui.activeAnimPreset);
        if (detail.keys && detail.keys.includes("isAutoAnimating")) {
          this.uiController.updateHistoryButtons();
        }
      }

      if (detail.type === "PARAMS" || detail.type === "ANIM_PHASES" || detail.type === "ALL") {
        this.uiController.updateUIFromState(state.domain.params, detail.keys);

        if (!detail.keys || detail.keys.includes("fov")) {
          this.renderer.camera.fov = state.domain.params.fractal.fov;
          this.renderer.camera.updateProjectionMatrix();
        }
      }
    });
  }

  init() {
    try {
      this.renderer.init();
      this.uiController.init();
      
      this.urlManager.loadFromURL();
      
      const state = this.stateManager.getState();
      if (!state.ui.activePreset) {
        this.stateManager.updateUiState({ activePreset: "preset1", activeAnimPreset: "preset1" });
      }
      
      this.uiController.updateUIFromState();
      this.historyManager.replaceInitialHistory(this.stateManager.getState(), this.stateManager.getRawAnimPhases());

      this.renderer.animate();
    } catch (error) {
      console.error("アプリケーションの初期化に失敗しました:", error);
      alert("初期化エラーが発生しました。");
    }
  }
}

const app = new App();
app.init();