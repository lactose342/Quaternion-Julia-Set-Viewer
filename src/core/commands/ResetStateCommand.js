import { Command } from "./Command.js";
import { CONFIG } from "@/config/config.js";

export class ResetStateCommand extends Command {
  constructor(domainStore, uiStore, renderer, historyManager) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.renderer = renderer;
    this.historyManager = historyManager;
  }

  execute() {
    const defaultParams = { fractal: {}, material: {}, animation: {} };
    const srcPreset = CONFIG.PRESETS.preset1;
    const srcAnimPreset = CONFIG.ANIM_PRESETS.preset1;

    CONFIG.SCHEMAS.fractal.forEach(key => defaultParams.fractal[key] = srcPreset[key] !== undefined ? srcPreset[key] : 0);
    CONFIG.SCHEMAS.material.forEach(key => defaultParams.material[key] = srcPreset[key] !== undefined ? srcPreset[key] : (key === 'bgColor' ? '#000000' : 1.0));
    CONFIG.SCHEMAS.animation.forEach(key => defaultParams.animation[key] = srcAnimPreset[key] !== undefined ? srcAnimPreset[key] : 0);

    this.domainStore.init(defaultParams);
    this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });

    this.renderer.restoreCameraFromSnapshot({ 
      position: { x: 0, y: 0, z: 2 }, 
      target: { x: 0, y: 0, z: 0 } 
    });

    this.uiStore.update({
      activePreset: "preset1",
      activeAnimPreset: "preset1",
      isAutoAnimating: false,
      isInteracting: false
    });

    const fullSnapshot = {
      params: defaultParams,
      camera: { position: { x: 0, y: 0, z: 2 }, target: { x: 0, y: 0, z: 0 } },
      animPhases: { x: 0, y: 0, z: 0, w: 0 },
      presets: {
        activePreset: "preset1",
        activeAnimPreset: "preset1"
      }
    };
    
    this.historyManager.pushHistory(fullSnapshot); 
  }
}