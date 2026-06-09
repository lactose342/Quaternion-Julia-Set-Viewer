import { Command } from "./Command.js";

export class ShareUrlCommand extends Command {
  constructor(domainStore, uiStore, urlManager, toastView) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.urlManager = urlManager;
    this.toastView = toastView;
  }

  async execute() {
    try {
      // 状態をかき集めてURLManager（純粋関数）に丸投げする
      const domainSnapshot = this.domainStore.getSnapshot();
      const uiState = this.uiStore.getState();
      const shareUrl = this.urlManager.generateShareURL(domainSnapshot, uiState); 
      
      await navigator.clipboard.writeText(shareUrl);
      this.toastView.show("共有URLをクリップボードにコピーしました");
    } catch (err) {
      this.toastView.show("URLのコピーに失敗しました", "error");
    }
  }
}