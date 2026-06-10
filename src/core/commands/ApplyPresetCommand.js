import { Command } from "./Command.js";

export class ApplyPresetCommand extends Command {
  // ★修正: カメラ位置を復元するため renderer を新しく注入
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
    this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });

    // ★追加: プリセット専用のカメラ位置に物理移動させる
    if (presetData.camera && this.renderer) {
       this.renderer.restoreCameraFromSnapshot(presetData.camera);
       this.domainStore.updateCamera("position", presetData.camera.position);
       this.domainStore.updateCamera("target", presetData.camera.target);
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