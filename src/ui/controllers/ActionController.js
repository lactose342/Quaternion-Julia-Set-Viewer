/**
 * ユーザーのグローバルなUI操作（ボタンクリック等）を検知し、
 * アプリケーション全体へコマンド（CustomEvent）として通知する入力コントローラー
 */
export class ActionController {
  constructor(signal, eventBus = window) {
    this.signal = signal;
    this.eventBus = eventBus; // デフォルトはwindow（グローバルイベントバス）を使用
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

    // エクスポート・共有
    bindClick("download-btn", () => {
      const formatEl = document.getElementById("dl-format");
      const scaleEl = document.getElementById("dl-scale");
      this.#dispatch("DOWNLOAD_HIGH_RES", {
        format: formatEl ? formatEl.value : "jpeg",
        scale: scaleEl ? parseFloat(scaleEl.value) : 1.0
      });
    });
    bindClick("share-btn", () => this.#dispatch("SHARE_URL"));

    // ブラウザAPI（これらはUI層で完結するため直接実行）
    bindClick("fullscreen-btn", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.warn(err));
      } else {
        document.exitFullscreen();
      }
    });

    // UIの開閉
    bindClick("toggle-ui-btn", () => this.#dispatch("TOGGLE_MENU_UI"));
  }
}