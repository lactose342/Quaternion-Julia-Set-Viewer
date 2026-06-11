import { Command } from "./Command.js";

export class UpdateColorInputCommand extends Command {
  constructor(domainStore, uiStore) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
  }

  execute({ hue, saturation, value }) {
    const payload = { hue, saturation };
    if (value !== undefined) {
      payload.value = value;
    }
    this.domainStore.updateParams("material", payload);
    this.uiStore.update({ 
      activePreset: "custom",
      isInteracting: true 
    });
  }
}