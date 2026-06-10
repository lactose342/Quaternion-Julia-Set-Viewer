export class StatusView {
  constructor(uiElements) {
    this.uiElements = uiElements;
  }

  /**
   * 計測されたFPS数値を基に、DOMの表示を更新する
   * @param {number} fps 
   * @param {boolean} isIdle 
   */
  updateFps(fps, isIdle) {
    const fpsCounterEl = this.uiElements["fps-counter"];
    if (!fpsCounterEl) return;

    // 文字列の組み立て
    fpsCounterEl.textContent = isIdle ? `-- FPS (Idle)` : `${fps} FPS`;
  }
}