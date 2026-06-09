import { Command } from "./Command.js";
import { CONFIG } from "@/config/config.js";

export class ResetStateCommand extends Command {
  constructor(domainStore, uiStore, renderer) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.renderer = renderer;
  }

  execute() {
    this.uiStore.update({ isInteracting: true });

    // 初期状態の安全なマッピング構築
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
      isInteracting: false,
      isAutoAnimating: false
    });

    window.dispatchEvent(new CustomEvent("app-command", { detail: { type: "COMMIT_HISTORY" } }));
  }
}