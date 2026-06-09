import { Command } from "./Command.js";

export class UndoCommand extends Command {
  constructor(domainStore, uiStore, historyManager, renderer) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.historyManager = historyManager;
    this.renderer = renderer;
  }

  execute() {
    const state = this.historyManager.undo();
    if (!state) return;

    // stateがそのまま渡されて階層がズレるのを防ぐ
    const targetParams = state.params ? state.params : state;
    this.domainStore.init(targetParams);

    if (state.animPhases) {
      this.domainStore.setAnimPhases(state.animPhases);
    }
    if (state.camera && state.camera.position && state.camera.position.x !== undefined) {
      this.renderer.restoreCameraFromSnapshot(state.camera);
    }
    if (state.presets) {
      this.uiStore.update({
        activePreset: state.presets.activePreset,
        activeAnimPreset: state.presets.activeAnimPreset
      });
    }
    window.dispatchEvent(new CustomEvent("history-updated"));
  }
}