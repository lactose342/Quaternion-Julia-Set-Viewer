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

import { CommandDispatcher } from "@/core/CommandDispatcher.js";
import { ApplyPresetCommand } from "@/core/commands/ApplyPresetCommand.js";
import { DownloadHighResCommand } from "@/core/commands/DownloadHighResCommand.js";
import { ToggleMenuCommand } from "@/core/commands/ToggleMenuCommand.js";
import { ToggleFullscreenCommand } from "@/core/commands/ToggleFullscreenCommand.js";
import { ToggleAutoAnimateCommand } from "@/core/commands/ToggleAutoAnimateCommand.js";
import { ResetStateCommand } from "@/core/commands/ResetStateCommand.js";
import { RandomizeCommand } from "@/core/commands/RandomizeCommand.js";
import { ApplyAnimPresetCommand } from "@/core/commands/ApplyAnimPresetCommand.js";
import { ShareUrlCommand } from "@/core/commands/ShareUrlCommand.js";
import { UpdateParamInputCommand } from "@/core/commands/UpdateParamInputCommand.js";
import { UpdateColorInputCommand } from "@/core/commands/UpdateColorInputCommand.js";
import { UndoCommand } from "@/core/commands/UndoCommand.js";
import { RedoCommand } from "@/core/commands/RedoCommand.js";
import { CommitHistoryCommand } from "@/core/commands/CommitHistoryCommand.js";
import { InitializeAppCommand } from "@/core/commands/InitializeAppCommand.js"; // 追加

export class App {
  constructor(config) {
    this.config = config;
    this.abortController = new AbortController();
    this.sharedUiElements = {};

    this.domainStore = new DomainStore(this.config.SCHEMAS);
    this.uiStore = new UIStore(this.config.SYSTEM.DEFAULT_QUALITY);
    this.historyManager = new HistoryManager();

    this.renderer = new Renderer(this.domainStore, this.uiStore);
    this.animationController = new AnimationController(this.domainStore, this.uiStore);

    this.urlManager = new URLManager(this.domainStore, this.uiStore, this.renderer);
    this.presetManager = new PresetManager(this.domainStore, this.uiStore);
    this.exportManager = new ExportManager(this.renderer, this.domainStore, this.uiStore);

    this.toastView = new ToastView();
    this.parameterView = new ParameterView(this.sharedUiElements);
    this.exportView = new ExportView(this.sharedUiElements);
    this.mainMenuView = new MainMenuView(this.sharedUiElements); // 引数追加修正済
    this.statusView = new StatusView();

    this.paramController = new ParameterController(
      this.domainStore,
      this.uiStore,
      this.sharedUiElements,
      this.abortController.signal,
    );

    this.actionController = new ActionController(this.abortController.signal, window);

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
      this.sharedUiElements,
    );

    this.dispatcher = new CommandDispatcher();
    this.#setupCommands();
    this.#setupDataFlowListeners();
  }

  #setupCommands() {
    this.dispatcher.register(
      "INITIALIZE_APP",
      new InitializeAppCommand(
        this.domainStore,
        this.uiStore,
        this.urlManager,
        this.historyManager,
        this.uiController,
        this.renderer,
        this.config,
      ),
    );
    this.dispatcher.register(
      "APPLY_PRESET",
      new ApplyPresetCommand(this.domainStore, this.uiStore, this.presetManager),
    );
    this.dispatcher.register(
      "APPLY_ANIM_PRESET",
      new ApplyAnimPresetCommand(this.domainStore, this.uiStore, this.config.ANIM_PRESETS),
    );
    this.dispatcher.register("DOWNLOAD_HIGH_RES", new DownloadHighResCommand(this.exportManager));
    this.dispatcher.register("TOGGLE_MENU_UI", new ToggleMenuCommand(this.mainMenuView));
    this.dispatcher.register("TOGGLE_FULLSCREEN", new ToggleFullscreenCommand(this.mainMenuView, this.toastView));
    this.dispatcher.register("TOGGLE_AUTO_ANIMATE", new ToggleAutoAnimateCommand(this.uiStore, this.renderer));
    this.dispatcher.register("RESET_STATE", new ResetStateCommand(this.domainStore, this.uiStore, this.renderer));
    this.dispatcher.register("RANDOMIZE", new RandomizeCommand(this.domainStore, this.uiStore, this.presetManager));
    this.dispatcher.register(
      "SHARE_URL",
      new ShareUrlCommand(this.domainStore, this.uiStore, this.urlManager, this.toastView),
    );
    this.dispatcher.register("UPDATE_PARAM_INPUT", new UpdateParamInputCommand(this.domainStore, this.uiStore));
    this.dispatcher.register("UPDATE_COLOR_INPUT", new UpdateColorInputCommand(this.domainStore, this.uiStore));

    this.dispatcher.register(
      "UNDO",
      new UndoCommand(this.domainStore, this.uiStore, this.historyManager, this.renderer),
    );
    this.dispatcher.register(
      "REDO",
      new RedoCommand(this.domainStore, this.uiStore, this.historyManager, this.renderer),
    );
    this.dispatcher.register(
      "COMMIT_HISTORY",
      new CommitHistoryCommand(this.domainStore, this.uiStore, this.historyManager),
    );
  }

  #setupDataFlowListeners() {
    this.domainStore.addEventListener("domain-updated", (e) => {
      const { type, category, keys } = e.detail;
      this.renderer.requestRender();

      if (type === "PARAMS" || type === "ALL" || type === "ANIM_PHASES") {
        this.uiController.synchronizeParameterValues(category, keys);
      }
      // ALL（Undo/Redoなど全体更新）のときは履歴ボタンも再評価する
      if (type === "ALL") {
        this.uiController.updateHistoryButtons();
      }
    });

    this.uiStore.addEventListener("ui-updated", (e) => {
      const { keys } = e.detail;
      this.uiController.synchronizeUIState(keys);
    });

    window.addEventListener("history-updated", () => {
      this.uiController.updateHistoryButtons();
    });
  }

  init() {
    try {
      // 1. イベントルーターの監視を最優先でスタート
      this.dispatcher.listen();

      // 2. 各種インフラおよびライフサイクルの開始
      this.renderer.init();
      this.uiController.init();
      this.paramController.bindEvents();
      this.actionController.bindEvents();

      document.addEventListener("fullscreenchange", () => {
        const isFullscreen = !!document.fullscreenElement;
        window.dispatchEvent(new CustomEvent("app-command", {
          detail: { type: "TOGGLE_FULLSCREEN", isFullscreen }
        }));
      }, { signal: this.abortController.signal });

      // アニメーション更新処理のバインド
      this.renderer.onTick = (delta) => this.animationController.update(delta);

      window.dispatchEvent(
        new CustomEvent("app-command", {
          detail: {
            type: "INITIALIZE_APP",
            currentUrl: window.location.href,
          },
        }),
      );

      // 4. アニメーションループの開始
      this.renderer.animate();
    } catch (error) {
      console.error("アプリケーションの初期化に失敗しました:", error);
    }
  }

  dispose() {
    this.abortController.abort();
    this.renderer.dispose();
  }
}
