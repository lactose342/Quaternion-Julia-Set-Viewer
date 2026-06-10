import { PARAMETER_DEFINITIONS } from "@/core/domain/ParameterDefinitions.js";
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
    const defaultParams = { fractal: {}, material: {}, animation: {} };
    const srcPreset = this.config.PRESETS.preset1;
    const srcAnimPreset = this.config.ANIM_PRESETS.preset1;

    this.config.SCHEMAS.fractal.forEach(key => {
      defaultParams.fractal[key] = (srcPreset && srcPreset[key] !== undefined) ? srcPreset[key] : (PARAMETER_DEFINITIONS[key]?.default !== undefined ? PARAMETER_DEFINITIONS[key].default : 0);
    });
    this.config.SCHEMAS.material.forEach(key => {
      defaultParams.material[key] = (srcPreset && srcPreset[key] !== undefined) ? srcPreset[key] : (PARAMETER_DEFINITIONS[key]?.default !== undefined ? PARAMETER_DEFINITIONS[key].default : (key === 'bgColor' ? '#000000' : 1.0));
    });
    this.config.SCHEMAS.animation.forEach(key => {
      defaultParams.animation[key] = (srcAnimPreset && srcAnimPreset[key] !== undefined) ? srcAnimPreset[key] : (PARAMETER_DEFINITIONS[key]?.default !== undefined ? PARAMETER_DEFINITIONS[key].default : 0);
    });

    this.domainStore.init(defaultParams);
    this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });

    const defaultCamera = { 
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