export class HistoryManager extends EventTarget {
  constructor(maxHistory = 30) {
    super();
    this.history = [];
    this.currentIndex = -1;
    this.maxHistory = maxHistory;
  }

  pushHistory(snapshot) {
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push(snapshot);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.currentIndex = this.history.length - 1;
    } else {
      this.currentIndex++;
    }

    // ★追加: 履歴が追加されたことを通知
    this.dispatchEvent(new CustomEvent("history-updated"));
  }

  replaceInitialHistory(snapshot) {
    this.history = [snapshot];
    this.currentIndex = 0;
    // 初期化完了の通知
    this.dispatchEvent(new CustomEvent("history-updated"));
  }

  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      // Undo実行の通知
      this.dispatchEvent(new CustomEvent("history-updated"));
      return this.history[this.currentIndex];
    }
    return null;
  }

  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      // Redo実行の通知
      this.dispatchEvent(new CustomEvent("history-updated"));
      return this.history[this.currentIndex];
    }
    return null;
  }

  getStatus() {
    return {
      canUndo: this.currentIndex > 0,
      canRedo: this.currentIndex < this.history.length - 1
    };
  }
}