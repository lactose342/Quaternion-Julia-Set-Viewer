import {
  ApplyPresetCommand,
  DownloadHighResCommand,
  ToggleMenuCommand,
  ToggleFullscreenCommand,
  ToggleAutoAnimateCommand,
  ResetStateCommand,
  RandomizeCommand,
  ApplyAnimPresetCommand,
  ShareUrlCommand,
  UpdateParamInputCommand,
  UpdateColorInputCommand,
  UndoCommand,
  RedoCommand,
  CommitHistoryCommand,
  InitializeAppCommand,
  EnterCameraModeCommand,
  ExitCameraModeCommand,
  DownloadArScreenshotCommand
} from "@/core/commands/index.js";

export class App {
  constructor(deps) {
    this.config = deps.config;
    this.abortController = deps.abortController;
    this.dispatcher = deps.dispatcher;
    this.domainStore = deps.domainStore;
    this.uiStore = deps.uiStore;
    this.historyManager = deps.historyManager;
    this.renderer = deps.renderer;
    this.animationController = deps.animationController;
    this.urlManager = deps.urlManager;
    this.presetManager = deps.presetManager;
    this.exportManager = deps.exportManager;
    this.colorPickerView = deps.colorPickerView;
    this.toastView = deps.toastView;
    this.parameterView = deps.parameterView;
    this.exportView = deps.exportView;
    this.mainMenuView = deps.mainMenuView;
    this.statusView = deps.statusView;
    this.onboardingView = deps.onboardingView;
    this.paramController = deps.paramController;
    this.actionController = deps.actionController;
    this.uiController = deps.uiController;

    this.#setupCommands();
    this.#setupDataFlowListeners();
  }

  #setupCommands() {
    this.dispatcher.register("INITIALIZE_APP", new InitializeAppCommand(this.domainStore, this.uiStore, this.urlManager, this.historyManager, this.uiController, this.renderer, this.config));
    this.dispatcher.register("APPLY_PRESET", new ApplyPresetCommand(this.domainStore, this.uiStore, this.presetManager, this.historyManager, this.renderer));
    this.dispatcher.register("APPLY_ANIM_PRESET", new ApplyAnimPresetCommand(this.domainStore, this.uiStore, this.config));
    this.dispatcher.register("DOWNLOAD_HIGH_RES", new DownloadHighResCommand(this.exportManager, this.toastView));
    this.dispatcher.register("TOGGLE_MENU_UI", new ToggleMenuCommand(this.mainMenuView));
    this.dispatcher.register("TOGGLE_FULLSCREEN", new ToggleFullscreenCommand(this.mainMenuView, this.toastView));
    this.dispatcher.register("TOGGLE_AUTO_ANIMATE", new ToggleAutoAnimateCommand(this.uiStore, this.renderer, this.domainStore, this.historyManager));
    this.dispatcher.register("RESET_STATE", new ResetStateCommand(this.domainStore, this.uiStore, this.renderer, this.historyManager, this.config));
    this.dispatcher.register("RANDOMIZE", new RandomizeCommand(this.domainStore, this.uiStore, this.presetManager, this.historyManager));
    this.dispatcher.register("SHARE_URL", new ShareUrlCommand(this.domainStore, this.uiStore, this.urlManager, this.toastView));
    this.dispatcher.register("UPDATE_PARAM_INPUT", new UpdateParamInputCommand(this.domainStore, this.uiStore));
    this.dispatcher.register("UPDATE_COLOR_INPUT", new UpdateColorInputCommand(this.domainStore, this.uiStore));
    this.dispatcher.register("UNDO", new UndoCommand(this.domainStore, this.uiStore, this.historyManager, this.renderer));
    this.dispatcher.register("REDO", new RedoCommand(this.domainStore, this.uiStore, this.historyManager, this.renderer));
    this.dispatcher.register("COMMIT_HISTORY", new CommitHistoryCommand(this.domainStore, this.uiStore, this.historyManager));
    this.dispatcher.register("ENTER_CAMERA_MODE", new EnterCameraModeCommand(this.uiStore));
    this.dispatcher.register("EXIT_CAMERA_MODE", new ExitCameraModeCommand(this.uiStore));
    this.dispatcher.register("DOWNLOAD_AR_SCREENSHOT", new DownloadArScreenshotCommand(this.exportManager));
  }

  #setupDataFlowListeners() {
    this.uiController.watchStores(this.domainStore, this.uiStore, this.historyManager);

    this.exportManager.addEventListener("export-toast", (e) => {
      this.toastView.show(e.detail.message, e.detail.type, e.detail.duration);
    }, { signal: this.abortController.signal });

    this.domainStore.addEventListener("domain-updated", () => {
      this.renderer.requestRender();
    }, { signal: this.abortController.signal });

    this.renderer.onFpsUpdate = (fps, isIdle) => {
      this.statusView.updateFps(fps, isIdle);
    };

    this.renderer.onBeforeUpdateUniforms = (r) => {
      r.updateUniforms(
        this.domainStore.getAnimatedC(),
        this.domainStore.getParams("fractal"),
        this.domainStore.getParams("material"),
        this.domainStore.getParams("camera")
      );
    };
    this.renderer.onCameraChange = (cameraData) => {
      this.domainStore.updateCamera("position", cameraData.position);
      this.domainStore.updateCamera("target", cameraData.target);
    };
  }

  init() {
    try {
      this.dispatcher.listen();

      this.renderer.init();
      this.uiController.init();
      this.actionController.bindEvents();

      this.renderer.onTick = (delta) => this.animationController.update(delta);

      this.dispatcher.dispatch("INITIALIZE_APP", { currentUrl: window.location.href });

      this.renderer.onFirstRender = () => {
        const loader = document.getElementById("loading-overlay");
        if (loader) {
          loader.classList.add("fade-out");
          setTimeout(() => {
            loader.style.display = "none";
          }, 500);
        }
      };

      this.renderer.animate(() => ({
        isDownloading: this.uiStore.isDownloading,
        isAutoAnimating: this.uiStore.isAutoAnimating
      }));

    } catch (error) {
      console.error("Application initialization failed:", error);
    }
  }

  dispose() {
    this.abortController.abort();
    this.renderer.dispose();
  }
}