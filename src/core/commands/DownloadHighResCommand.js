import { Command } from "./Command.js";

export class DownloadHighResCommand extends Command {
  constructor(exportManager) {
    super();
    this.exportManager = exportManager;
  }

  async execute({ format, scale }) {
    await this.exportManager.downloadHighRes(format, scale);
  }
}