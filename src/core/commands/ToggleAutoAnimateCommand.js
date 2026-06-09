import { Command } from "./Command.js";

export class ToggleAutoAnimateCommand extends Command {
  constructor(uiStore, renderer) {
    super();
    this.uiStore = uiStore;
    this.renderer = renderer;
  }

  execute() {
    const currentState = this.uiStore.getState();
    const nextState = !currentState.isAutoAnimating;

    // 1. レンダラーの画質調整を先行
    if (nextState) {
      this.renderer.setQuality("LOW");
    } else {
      this.renderer.setQuality("HIGH");
    }

    // 2. UIStoreが解釈できるプレーンなオブジェクト構造でアップデートをかける
    this.uiStore.update({ 
      isAutoAnimating: nextState 
    });

    if (!nextState) {
      window.dispatchEvent(new CustomEvent("app-command", { detail: { type: "COMMIT_HISTORY" } }));
    }
  }
}