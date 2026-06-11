import { Command } from "./Command.js";

export class RandomizeCommand extends Command {
  constructor(domainStore, uiStore, presetManager) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.presetManager = presetManager;
  }

  execute() {
    this.uiStore.update({ activePreset: "custom" });
    
    const randomParams = this.presetManager.generateRandomParams();
    this.domainStore.updateParams("fractal", randomParams.fractal);
    this.domainStore.updateParams("material", randomParams.material);
    this.domainStore.updateParams("camera", randomParams.camera);
    this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });
    
    window.dispatchEvent(new CustomEvent("app-command", { detail: { type: "COMMIT_HISTORY" } }));
  }
}