import { Command } from "./Command.js";

export class ApplyPresetCommand extends Command {
  constructor(domainStore, uiStore, presetManager, historyManager, renderer) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.presetManager = presetManager;
    this.historyManager = historyManager;
    this.renderer = renderer;
  }

  execute({ value: presetName }) {
    const presetData = this.presetManager.getPresetData(presetName);
    if (!presetData) return;

    this.domainStore.updateParams('fractal', presetData.fractal);
    this.domainStore.updateParams('material', presetData.material);
    this.domainStore.updateParams('camera', presetData.camera);
    this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });

    if (presetData.cameraPose && this.renderer) {
      this.renderer.restoreCameraFromSnapshot(presetData.cameraPose);
      this.domainStore.updateCamera("position", presetData.cameraPose.position);
      this.domainStore.updateCamera("target", presetData.cameraPose.target);
    }

    this.uiStore.update({
      activePreset: presetName,
      isInteracting: true
    });

    const domainSnapshot = this.domainStore.getSnapshot();
    const uiState = this.uiStore.getState();

    const fullSnapshot = {
      params: domainSnapshot.params,
      camera: domainSnapshot.camera,
      animPhases: domainSnapshot.animPhases,
      presets: {
        activePreset: presetName,
        activeAnimPreset: uiState.activeAnimPreset || "preset1"
      }
    };

    this.historyManager.pushHistory(fullSnapshot);
    this.uiStore.update({ isInteracting: false });
  }
}