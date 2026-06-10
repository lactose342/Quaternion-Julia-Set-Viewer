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

    const targetParams = state.params ? state.params : state;
    this.domainStore.init(targetParams);

    if (state.animPhases) {
      this.domainStore.setAnimPhases(state.animPhases);
    }
    if (state.camera && state.camera.position && state.camera.position.x !== undefined) {
      this.renderer.restoreCameraFromSnapshot(state.camera);
      this.domainStore.updateCamera("position", state.camera.position);
      this.domainStore.updateCamera("target", state.camera.target);
    }
    if (state.presets) {
      this.uiStore.update({
        activePreset: state.presets.activePreset,
        activeAnimPreset: state.presets.activeAnimPreset
      });
    }
  }
}