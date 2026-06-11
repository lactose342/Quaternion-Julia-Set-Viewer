import { Command } from "./Command.js";

export class ResetStateCommand extends Command {
  constructor(domainStore, uiStore, renderer, historyManager, config) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.renderer = renderer;
    this.historyManager = historyManager;
    this.config = config;
  }

  execute() {
    const srcPreset = this.config.PRESETS.preset1;
    const srcAnimPreset = this.config.ANIM_PRESETS.preset1;

    const defaultParams = {
      fractal: this.domainStore.fillDefaults("fractal", srcPreset),
      material: this.domainStore.fillDefaults("material", srcPreset),
      animation: this.domainStore.fillDefaults("animation", srcAnimPreset)
    };

    this.domainStore.init(defaultParams);
    this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });

    const defaultCamera = (srcPreset && srcPreset.camera) ? srcPreset.camera : { 
      position: { x: 0, y: 0, z: 2 }, 
      target: { x: 0, y: 0, z: 0 } 
    };

    this.renderer.restoreCameraFromSnapshot(defaultCamera);
    this.domainStore.updateCamera("position", defaultCamera.position);
    this.domainStore.updateCamera("target", defaultCamera.target);

    this.uiStore.update({
      activePreset: "preset1",
      activeAnimPreset: "preset1",
      isAutoAnimating: false,
      isInteracting: false
    });

    const fullSnapshot = {
      params: defaultParams,
      camera: defaultCamera,
      animPhases: { x: 0, y: 0, z: 0, w: 0 },
      presets: {
        activePreset: "preset1",
        activeAnimPreset: "preset1"
      }
    };

    this.historyManager.pushHistory(fullSnapshot);
  }
}