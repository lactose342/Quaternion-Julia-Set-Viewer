import { CONFIG } from "@/config/config.js";

export class HistoryManager {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
  }

  // 修正：特定のstate構造に依存せず、組み立て済みの完成されたsnapshotを受け取る
  pushHistory(snapshot) {
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }
    
    this.history.push(snapshot);
    
    if (this.history.length > CONFIG.SYSTEM.MAX_HISTORY) {
      this.history.shift();
      // 修正：配列の先頭が消えるため、カレントインデックスも追従させてバグを防ぐ
      this.currentIndex = this.history.length - 1; 
    } else {
      this.currentIndex++;
    }
  }

  // 修正：初期履歴の登録も、完成されたsnapshotをそのまま受け取る
  replaceInitialHistory(snapshot) {
    this.history = [snapshot];
    this.currentIndex = 0;
  }

  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return null;
  }

  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
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