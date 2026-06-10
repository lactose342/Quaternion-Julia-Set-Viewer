import { Command } from "./Command.js";

export class DownloadHighResCommand extends Command {
  constructor(exportManager, toastView) {
    super();
    this.exportManager = exportManager;
    this.toastView = toastView;
  }

  async execute({ format, scale }) {
    try {
      await this.exportManager.downloadHighRes(format, scale);
      if (this.toastView) {
        this.toastView.show("画像の書き出しが完了しました", "success", 5000);
      }
    } catch (error) {
      if (this.toastView) {
        this.toastView.show("画像の書き出しに失敗しました", "error");
      }
    }
  }
}