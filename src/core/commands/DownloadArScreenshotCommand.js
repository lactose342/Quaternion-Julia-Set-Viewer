import { Command } from "./Command.js";

export class DownloadArScreenshotCommand extends Command {
  constructor(exportManager) {
    super();
    this.exportManager = exportManager;
  }

  execute() {
    if (this.exportManager) {
      this.exportManager.downloadArScreenshot();
    }
  }
}
