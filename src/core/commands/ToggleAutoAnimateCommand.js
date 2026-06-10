import { Command } from "./Command.js";

export class ToggleAutoAnimateCommand extends Command {
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