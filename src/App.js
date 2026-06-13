import "@/styles/style.css";
import { DomainStore } from "@/core/store/DomainStore.js";
import { UIStore } from "@/core/store/UIStore.js";
import { HistoryManager } from "@/core/HistoryManager.js";
import { URLManager } from "@/infra/URLManager.js";
import { PresetManager } from "@/infra/PresetManager.js";
import { ExportManager } from "@/infra/ExportManager.js";
import { Renderer } from "@/infra/Renderer.js";
import { UIController } from "@/ui/controllers/UIController.js";
import { AnimationController } from "@/core/AnimationController.js";
import { ParameterController } from "@/ui/controllers/ParameterController.js";
import { ActionController } from "@/ui/controllers/ActionController.js";
import { ToastView } from "@/ui/views/ToastView.js";
import { ParameterView } from "@/ui/views/ParameterView.js";
import { ExportView } from "@/ui/views/ExportView.js";
import { MainMenuView } from "@/ui/views/MainMenuView.js";
import { StatusView } from "@/ui/views/StatusView.js";
import { ColorPickerView } from "@/ui/views/ColorPickerView.js";
import { OnboardingView } from "@/ui/views/OnboardingView.js";
import { initFormatter } from "@/ui/utils/uiParamFormatter.js";

import { CommandDispatcher } from "@/core/CommandDispatcher.js";
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
  ExitCameraModeCommand
} from "@/core/commands/index.js";

export class App {
  constructor(config) {
    this.config = config;
    initFormatter(this.config.definitions);

    this.abortController = new AbortController();

    this.domainStore = new DomainStore(this.config);
    this.uiStore = new UIStore(this.config.SYSTEM.DEFAULT_QUALITY);
    this.historyManager = new HistoryManager(this.config.SYSTEM.MAX_HISTORY);

    this.renderer = new Renderer(this.domainStore, this.uiStore, this.config);
    this.animationController = new AnimationController(this.domainStore, this.uiStore);

    this.urlManager = new URLManager(this.config);
    this.presetManager = new PresetManager(this.config, this.domainStore);
    this.exportManager = new ExportManager(this.renderer, this.domainStore, this.uiStore, this.config);

    this.colorPickerView = new ColorPickerView();

    this.toastView = new ToastView();
    this.parameterView = new ParameterView(this.config.definitions);
    this.exportView = new ExportView();
    this.mainMenuView = new MainMenuView();
    this.statusView = new StatusView();
    this.onboardingView = new OnboardingView();

    this.dispatcher = new CommandDispatcher();

    this.paramController = new ParameterController(
      this.dispatcher,
      this.abortController.signal,
      this.config.definitions,
    );

    this.actionController = new ActionController(
      this.dispatcher,
      this.abortController.signal,
    );

    this.uiController = new UIController(
      this.domainStore,
      this.uiStore,
      this.renderer,
      this.historyManager,
      this.exportManager,
      this.toastView,
      this.paramController,
      this.actionController,
      this.parameterView,
      this.exportView,
      this.mainMenuView,
      this.colorPickerView,
      this.config,
      this.onboardingView,
    );

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