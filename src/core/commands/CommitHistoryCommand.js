import { Command } from "./Command.js";

export class CommitHistoryCommand extends Command {
  constructor(domainStore, uiStore, historyManager) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.historyManager = historyManager;
  }

  execute() {
    // 2つのStoreから生データをクローンしてかき集める
    const domainSnapshot = this.domainStore.getSnapshot();
    const uiState = this.uiStore.getState();

    // HistoryManager が要求する旧形式と同一のフラットなスナップショット構造に翻訳・統合する
    const fullSnapshot = {
      params: domainSnapshot.params,
      camera: domainSnapshot.camera,
      animPhases: domainSnapshot.animPhases,
      presets: {
        activePreset: uiState.activePreset || "custom",
        activeAnimPreset: uiState.activeAnimPreset || "custom"
      }
    };

    // 綺麗にラッピングされたオブジェクトを渡す
    this.historyManager.pushHistory(fullSnapshot);
    window.dispatchEvent(new CustomEvent("history-updated"));
  }
}