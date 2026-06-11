import { Command } from "./Command.js";

export class EnterCameraModeCommand extends Command {
  constructor(uiStore) {
    super();
    this.uiStore = uiStore;
  }

  execute() {
    this.uiStore.update({ isCameraMode: true });
  }
}
