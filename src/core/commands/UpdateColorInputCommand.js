import { Command } from "./Command.js";

export class UpdateColorInputCommand extends Command {
  constructor(domainStore, uiStore) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
  }

  execute({ hue, saturation }) {
    this.domainStore.updateParams("material", { hue, saturation });
    this.uiStore.update({ 
      activePreset: "custom",
      isInteracting: true 
    });
  }
}