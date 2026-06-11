export class StatusView {
  constructor() {
    this.fpsCounterEl = document.getElementById("fps-counter");
  }

  /**
   * 計測されたFPS数値を基に、DOMの表示を更新する
   * @param {number} fps 
   * @param {boolean} isIdle 
   */
  updateFps(fps, isIdle) {
    if (!this.fpsCounterEl) return;

    // 文字列の組み立て
    this.fpsCounterEl.textContent = isIdle ? `-- FPS (Idle)` : `${fps} FPS`;
  }
}