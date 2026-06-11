export class ActionController {
  constructor(dispatcher, signal) {
    this.dispatcher = dispatcher;
    this.signal = signal;
  }

  #dispatch(type, payload = {}) {
    if (this.dispatcher) {
      this.dispatcher.dispatch(type, payload);
    }
  }

  bindEvents() {
    const bindSelect = (id, handler) => document.getElementById(id)?.addEventListener("change", handler, { signal: this.signal });
    const bindClick = (id, handler) => document.getElementById(id)?.addEventListener("click", handler, { signal: this.signal });

    // プリセット選択
    bindSelect("preset-select", (e) => this.#dispatch("APPLY_PRESET", { value: e.target.value }));
    bindSelect("anim-preset-select", (e) => this.#dispatch("APPLY_ANIM_PRESET", { value: e.target.value }));

    // 各種アクションボタン
    bindClick("auto-animate-btn", () => this.#dispatch("TOGGLE_AUTO_ANIMATE"));
    bindClick("reset-btn", () => this.#dispatch("RESET_STATE"));
    bindClick("random-btn", () => this.#dispatch("RANDOMIZE"));
    bindClick("undo-btn", () => this.#dispatch("UNDO"));
    bindClick("redo-btn", () => this.#dispatch("REDO"));

    // フルスクリーンボタンのクリック
    bindClick("fullscreen-btn", () => {
      this.#dispatch("TOGGLE_FULLSCREEN", {});
    });

    // DOMイベントの監視
    document.addEventListener("fullscreenchange", () => {
      const isFullscreen = !!document.fullscreenElement;
      this.#dispatch("TOGGLE_FULLSCREEN", { isFullscreen });
    }, { signal: this.signal });

    const formatEl = document.getElementById("dl-format");
    const scaleEl = document.getElementById("dl-scale");
    const cameraFormatEl = document.getElementById("camera-dl-format");
    const cameraScaleEl = document.getElementById("camera-dl-scale");

    // 通常UI -> カメラUI への同期
    formatEl?.addEventListener("change", (e) => {
      if (cameraFormatEl) cameraFormatEl.value = e.target.value;
    }, { signal: this.signal });
    scaleEl?.addEventListener("change", (e) => {
      if (cameraScaleEl) cameraScaleEl.value = e.target.value;
    }, { signal: this.signal });

    // カメラUI -> 通常UI への同期
    cameraFormatEl?.addEventListener("change", (e) => {
      if (formatEl) formatEl.value = e.target.value;
    }, { signal: this.signal });
    cameraScaleEl?.addEventListener("change", (e) => {
      if (scaleEl) scaleEl.value = e.target.value;
    }, { signal: this.signal });

    bindClick("download-btn", () => {
      // カメラモードに入る際に最新の設定値をコピー
      if (formatEl && cameraFormatEl) cameraFormatEl.value = formatEl.value;
      if (scaleEl && cameraScaleEl) cameraScaleEl.value = scaleEl.value;
      this.#dispatch("ENTER_CAMERA_MODE", {});
    });

    bindClick("camera-shutter-btn", () => {
      const format = cameraFormatEl ? cameraFormatEl.value : (formatEl ? formatEl.value : "jpeg");
      const scale = cameraScaleEl ? parseFloat(cameraScaleEl.value) : (scaleEl ? parseFloat(scaleEl.value) : 1.0);
      this.#dispatch("DOWNLOAD_HIGH_RES", { format, scale });
    });

    bindClick("camera-back-btn", () => {
      this.#dispatch("EXIT_CAMERA_MODE", {});
    });
    bindClick("share-btn", () => this.#dispatch("SHARE_URL"));

    // UIの開閉
    bindClick("toggle-ui-btn", () => this.#dispatch("TOGGLE_MENU_UI"));
  }
}