import { Command } from "./Command.js";

export class CommitHistoryCommand extends Command {
  constructor(domainStore, uiStore, historyManager) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.historyManager = historyManager;
  }

  execute() {
    // 1. 手を離した瞬間の、最新かつ完全な状態の snapshot をかき集める
    const domainSnapshot = this.domainStore.getSnapshot();
    const uiState = this.uiStore.getState();

    const fullSnapshot = {
      params: domainSnapshot.params,
      camera: domainSnapshot.camera,
      animPhases: domainSnapshot.animPhases,
      presets: {
        activePreset: uiState.activePreset || "custom",
        activeAnimPreset: uiState.activeAnimPreset || "custom"
      }
    };

    // 2. 履歴管理（歴史）に安全に push する
    this.historyManager.pushHistory(fullSnapshot);

    this.uiStore.update({ 
      isInteracting: false 
    });
  }
}