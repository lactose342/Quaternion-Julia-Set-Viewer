export class AdaptiveQualityManager {
  constructor(config) {
    this.config = config;
    this.fpsFrames = 0;
    this.fpsLastTime = performance.now();
    this.lastFps = 60;
  }

  /**
   * フレーム描画のタイミングで呼び出し、FPS計算・画質調整の更新判断を行う
   * @param {number} currentPixelRatio 現在のピクセル比
   * @param {number} maxPixelRatio 最大許容ピクセル比
   * @param {Object} appState { isDownloading, isAutoAnimating, isInteracting, isVR }
   * @param {Function} onFpsCalculated FPSが再計算されたときに呼び出されるコールバック
   * @returns {number|null} 変更が必要な場合は新しい pixelRatio、不要な場合は null
   */
  update(currentPixelRatio, maxPixelRatio, appState, onFpsCalculated) {
    const now = performance.now();
    const elapsed = now - this.fpsLastTime;

    if (elapsed < 300) {
      return null;
    }

    const fps = Math.round((this.fpsFrames * 1000) / elapsed);
    this.lastFps = fps;
    this.fpsFrames = 0;
    this.fpsLastTime = now;

    if (onFpsCalculated) {
      onFpsCalculated(fps);
    }

    const { isDownloading, isAutoAnimating, isInteracting, isVR } = appState;
    const isActive = isAutoAnimating || isInteracting || isVR;

    if (isDownloading || !isActive) {
      return null;
    }

    if (fps < 48) {
      // FPSが48未満の場合に画質を下げる
      // 32FPS未満の大幅な低下、またはピクセル比が1.0より大きい場合は急激に下げる
      const step = (fps < 32 || currentPixelRatio > 1.0) ? 0.25 : 0.12;
      const nextRatio = Math.max(0.35, currentPixelRatio - step);
      if (nextRatio !== currentPixelRatio) {
        console.log(`[Adaptive Quality] FPS dropped to ${fps}. Reducing pixel ratio to ${nextRatio.toFixed(2)}`);
        return nextRatio;
      }
    } else if (fps > 55) {
      const targetMax = isVR ? 0.55 : maxPixelRatio;
      const nextRatio = Math.min(targetMax, currentPixelRatio + 0.04);
      if (nextRatio !== currentPixelRatio) {
        console.log(`[Adaptive Quality] FPS is healthy (${fps}). Increasing pixel ratio to ${nextRatio.toFixed(2)}`);
        return nextRatio;
      }
    }

    return null;
  }

  getFps(isIdle) {
    return isIdle ? 0 : this.lastFps;
  }
}
