import { Command } from "./Command.js";

export class RandomizeCommand extends Command {
  constructor(domainStore, uiStore, presetManager) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.presetManager = presetManager;
  }

  execute() {
    this.uiStore.update({ isInteracting: true, activePreset: "custom" });
    
    const randomParams = this.presetManager.generateRandomParams();
    this.domainStore.updateParams("fractal", randomParams.fractal);
    this.domainStore.updateParams("material", randomParams.material);
    
    window.dispatchEvent(new CustomEvent("app-command", { detail: { type: "COMMIT_HISTORY" } }));
    this.uiStore.update({ isInteracting: false });
  }
}