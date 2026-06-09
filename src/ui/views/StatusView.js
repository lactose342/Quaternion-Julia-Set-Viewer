export class StatusView {
  constructor(uiElements) {
    this.uiElements = uiElements;
  }

  /**
   * 計測されたFPS数値を基に、DOMの表示を更新する（表示ロジックの局所化）
   * @param {number} fps 
   * @param {boolean} isIdle 
   */
  updateFps(fps, isIdle) {
    const fpsCounterEl = this.uiElements["fps-counter"];
    if (!fpsCounterEl) return;

    // 文字列の組み立て（プレゼンテーションの関心事）をViewで完結させる
    fpsCounterEl.textContent = isIdle ? `${fps} FPS (Idle)` : `${fps} FPS`;
  }
}