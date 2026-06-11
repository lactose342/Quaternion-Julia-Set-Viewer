import { Command } from "./Command.js";

export class ExitCameraModeCommand extends Command {
  constructor(uiStore) {
    super();
    this.uiStore = uiStore;
  }

  execute() {
    this.uiStore.update({ isCameraMode: false });
  }
}
