export class ActionController {
  constructor(signal, eventBus = window) {
    this.signal = signal;
    this.eventBus = eventBus;
  }

  #dispatch(type, payload = {}) {
    this.eventBus.dispatchEvent(
      new CustomEvent("app-command", { detail: { type, ...payload } })
    );
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

    bindClick("download-btn", () => {
      const formatEl = document.getElementById("dl-format");
      const scaleEl = document.getElementById("dl-scale");
      this.#dispatch("DOWNLOAD_HIGH_RES", {
        format: formatEl ? formatEl.value : "jpeg",
        scale: scaleEl ? parseFloat(scaleEl.value) : 1.0
      });
    });
    bindClick("share-btn", () => this.#dispatch("SHARE_URL"));

    // UIの開閉
    bindClick("toggle-ui-btn", () => this.#dispatch("TOGGLE_MENU_UI"));
  }
}