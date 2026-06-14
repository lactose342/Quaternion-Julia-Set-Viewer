import { Command } from "./Command.js";

export class ToggleFullscreenCommand extends Command {
  constructor(mainMenuView, toastView) {
    super();
    this.mainMenuView = mainMenuView;
    this.toastView = toastView;
  }

  execute({ isFullscreen }) {
    if (isFullscreen !== undefined) {
      this.mainMenuView.updateFullscreen(isFullscreen);
      return;
    }

    if (!document.fullscreenElement) {
      const isNativeFullscreen = Math.abs(window.innerHeight - window.screen.height) <= 1;

      if (isNativeFullscreen) {
        this.toastView.show("ブラウザの設定で全画面化されています。解除するにはキーボードの対応キー（F11/Esc等）を押してください", "error");
        return;
      }

      document.documentElement.requestFullscreen().catch(() => {
        this.mainMenuView.updateFullscreen(false);
        this.toastView.show("全画面表示の開始に失敗しました", "error");
      });
    } else {
      document.exitFullscreen().catch(() => {
        this.mainMenuView.updateFullscreen(false);
        this.toastView.show("全画面表示の解除に失敗しました", "error");
      });
    }
  }
}