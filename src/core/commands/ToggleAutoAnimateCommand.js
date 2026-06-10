import { Command } from "./Command.js";

export class ToggleAutoAnimateCommand extends Command {
  // ★修正: 停止時のフェーズを保存するため domainStore と historyManager を注入
  constructor(uiStore, renderer, domainStore, historyManager) {
    super();
    this.uiStore = uiStore;
    this.renderer = renderer;
    this.domainStore = domainStore;
    this.historyManager = historyManager;
  }

  execute() {
    const currentState = this.uiStore.getState();
    const nextState = !currentState.isAutoAnimating;

    if (nextState) {
      this.renderer.setQuality("LOW");
    } else {
      this.renderer.setQuality("HIGH");
    }

    this.uiStore.update({ 
      isAutoAnimating: nextState,
    });

    if (nextState) {
      this.renderer.requestRender();
    } else {
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

      this.historyManager.pushHistory(fullSnapshot);
    }
  }
}