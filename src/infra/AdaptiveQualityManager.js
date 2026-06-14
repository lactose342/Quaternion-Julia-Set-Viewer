export class AdaptiveQualityManager {
  constructor(config) {
    this.config = config;
    this.fpsFrames = 0;
    this.fpsLastTime = performance.now();
    this.lastFps = 60;
    this.wasActive = false;
    this.lastChangeTime = 0;
    this.healthyCount = 0;
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
    const { isDownloading, isAutoAnimating, isInteracting, isVR } = appState;
    const isActive = isAutoAnimating || isInteracting || isVR;

    // VR時は動的解像度変更（Adaptive Quality）をスキップし、固定ピクセル比（0.55など）を維持する
    if (isVR) {
      const elapsed = now - this.fpsLastTime;
      if (elapsed >= 300) {
        const fps = Math.round((this.fpsFrames * 1000) / elapsed);
        this.lastFps = fps;
        this.fpsFrames = 0;
        this.fpsLastTime = now;
        if (onFpsCalculated) {
          onFpsCalculated(fps);
        }
      }
      return null;
    }

    // 1. アクティブ移行時（静止から操作・アニメーション開始）は基準値 1.0 に即リセット
    if (isActive && !this.wasActive) {
      this.wasActive = true;
      this.healthyCount = 0;
      this.lastChangeTime = now;
      this.fpsFrames = 0;
      this.fpsLastTime = now;
      if (currentPixelRatio !== 1.0) {
        console.log(`[Adaptive Quality] Interaction started. Resetting pixel ratio to 1.0`);
        return 1.0;
      }
    }

    if (!isActive) {
      this.wasActive = false;
      this.healthyCount = 0;
      return null; // 静止時は Renderer 側で maxPixelRatio (2.0) に戻すため、ここでは何も返さない
    }

    // 2. FPS算出インターバルチェック（300ms毎）
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

    if (isDownloading) {
      return null;
    }

    // 3. 画質の変更判断
    const DYNAMIC_MIN_LIMIT = 0.75; // 操作中の見栄えを保つための最小ピクセル比
    const DYNAMIC_MAX_LIMIT = isVR ? 0.55 : 1.5;  // 動的時の上限を1.5に抑えてチャタリングを防止

    // A. 下げる判断：カクツキ防止のためクールダウンを無視して即座に適用
    if (fps < 48) {
      const step = (fps < 32 || currentPixelRatio > 1.0) ? 0.25 : 0.12;
      const nextRatio = Math.max(DYNAMIC_MIN_LIMIT, currentPixelRatio - step);
      if (nextRatio !== currentPixelRatio) {
        console.log(`[Adaptive Quality] FPS dropped to ${fps}. Reducing pixel ratio to ${nextRatio.toFixed(2)}`);
        this.lastChangeTime = now;
        this.healthyCount = 0;
        return nextRatio;
      }
    }

    // B. 上げる判断：1.2秒以上の安定（約4回連続）と、前回の画質変更から1.5秒のクールダウン経過を要求
    if (fps >= 58) {
      this.healthyCount++;
    } else {
      this.healthyCount = 0; // 余裕状態が途切れたら即座にリセット
    }

    const cooldownPeriod = 1500;    // 画質変更後のクールダウン (1.5秒)
    const healthyThreshold = 4;    // FPS安定継続判定の閾値 (300ms * 4回 = 1.2秒)

    if (this.healthyCount >= healthyThreshold && (now - this.lastChangeTime) >= cooldownPeriod) {
      const nextRatio = Math.min(DYNAMIC_MAX_LIMIT, currentPixelRatio + 0.1);
      if (nextRatio !== currentPixelRatio) {
        console.log(`[Adaptive Quality] FPS is consistently healthy (${fps} for ~3s). Increasing pixel ratio to ${nextRatio.toFixed(2)}`);
        this.lastChangeTime = now;
        this.healthyCount = 0;
        return nextRatio;
      }
    }

    return null;
  }

  getFps(isIdle) {
    return isIdle ? 0 : this.lastFps;
  }
}
