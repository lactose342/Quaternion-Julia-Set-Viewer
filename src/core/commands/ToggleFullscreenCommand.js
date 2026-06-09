import { Command } from "./Command.js";

export class ToggleFullscreenCommand extends Command {
  constructor(mainMenuView, toastView) {
    super();
    this.mainMenuView = mainMenuView;
    this.toastView = toastView;
  }

  execute({ isFullscreen }) {
    // App.js の fullscreenchange イベントから確定値が届いた場合は見た目を同期するだけ
    if (isFullscreen !== undefined) {
      this.mainMenuView.updateFullscreen(isFullscreen);
      return;
    }

    if (!document.fullscreenElement) {
      // 物理的な画面サイズでF11/F12全画面を検知する
      const isNativeFullscreen = Math.abs(window.innerHeight - window.screen.height) <= 1;

      if (isNativeFullscreen) {
        // ネイティブ全画面の場合はAPIを叩かず、即座に警告トーストを出して処理を終わる
        this.toastView.show("ブラウザの設定で全画面化されています。解除するにはキーボードの対応キー（F11/Esc等）を押してください", "error");
        return;
      }

      document.documentElement.requestFullscreen().catch(() => {
        this.toastView.show("全画面表示の開始に失敗しました", "error");
      });
    } else {
      document.exitFullscreen().catch(() => {
        this.toastView.show("全画面表示の解除に失敗しました", "error");
      });
    }
  }
}