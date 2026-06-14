import "@/styles/style.css";
import { App } from "@/App.js";
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

/**
 * アプリケーションの依存インスタンス群を生成・組み立て、
 * 依存関係が注入されたAppインスタンスを返します。
 */
export function bootstrap(config) {
  initFormatter(config.definitions);

  const abortController = new AbortController();
  const dispatcher = new CommandDispatcher();

  const domainStore = new DomainStore(config);
  const uiStore = new UIStore(config.SYSTEM.DEFAULT_QUALITY);
  const historyManager = new HistoryManager(config.SYSTEM.MAX_HISTORY);

  const renderer = new Renderer(domainStore, uiStore, config, dispatcher);
  const animationController = new AnimationController(domainStore, uiStore);

  const urlManager = new URLManager(config);
  const presetManager = new PresetManager(config, domainStore);
  const exportManager = new ExportManager(renderer, domainStore, uiStore, config);

  const colorPickerView = new ColorPickerView();
  const toastView = new ToastView();
  const parameterView = new ParameterView(config.definitions);
  const exportView = new ExportView();
  const mainMenuView = new MainMenuView();
  const statusView = new StatusView();
  const onboardingView = new OnboardingView();

  const paramController = new ParameterController(
    dispatcher,
    abortController.signal,
    config.definitions
  );

  const actionController = new ActionController(
    dispatcher,
    abortController.signal
  );

  const uiController = new UIController(
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
    onboardingView
  );

  return new App({
    config,
    abortController,
    dispatcher,
    domainStore,
    uiStore,
    historyManager,
    renderer,
    animationController,
    urlManager,
    presetManager,
    exportManager,
    colorPickerView,
    toastView,
    parameterView,
    exportView,
    mainMenuView,
    statusView,
    onboardingView,
    paramController,
    actionController,
    uiController
  });
}
