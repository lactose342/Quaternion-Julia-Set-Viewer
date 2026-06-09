import { CONFIG } from "@/config/config.js";
import { ANIM_UI_MAPPING } from "@/ui/uiConstants.js";
import { ColorUtils } from "@/infra/ColorUtils.js";

export class ParameterController {
  constructor(domainStore, uiStore, uiElements, signal) {
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.uiElements = uiElements;
    this.signal = signal;
    this.isTickPending = new Map(); // 要素ごとのrAFフラグ管理
  }

  bindEvents() {
    const stopPropagation = (e) => e.stopPropagation();
    const domIdsToBind = [
      ...CONFIG.SCHEMAS.fractal,
      ...CONFIG.SCHEMAS.material,
      ...ANIM_UI_MAPPING.map((m) => m.id),
    ];

    domIdsToBind.forEach((domId) => {
      const el = this.uiElements[domId];
      if (!el) return;

      const stateKey = this._getStateKey(domId);
      this.isTickPending.set(domId, false);

      el.addEventListener("touchstart", stopPropagation, { passive: true, signal: this.signal });
      el.addEventListener("pointerdown", stopPropagation, { signal: this.signal });

      el.addEventListener("input", () => {
        this.uiStore.update({ isInteracting: true });
        // 1. レースコンディションを防ぐため、イベント発火瞬間の生値を即座にキャプチャ
        const currentRawValue = el.value;
        const inputType = el.type;

        if (this.isTickPending.get(domId)) return; // すでにフレーム内で待機中なら弾く
        this.isTickPending.set(domId, true);

        requestAnimationFrame(() => {
          this.isTickPending.set(domId, false);

          let val = inputType === "color" ? currentRawValue : parseFloat(currentRawValue);
          const isAngleParam = stateKey.startsWith("rot") || ["px", "py", "pz", "pw"].includes(stateKey);
          
          if (typeof val === "number" && isAngleParam) {
            val = (val * Math.PI) / 180; // ラジアン変換
          }

          const category = CONFIG.SCHEMAS.fractal.includes(stateKey) ? "fractal" 
                         : CONFIG.SCHEMAS.material.includes(stateKey) ? "material" 
                         : "animation";

          // コマンドを経由して各Storeへ安全に入力値をコミット
          window.dispatchEvent(new CustomEvent("app-command", {
            detail: { type: "UPDATE_PARAM_INPUT", category, key: stateKey, value: val }
          }));
        });
      }, { signal: this.signal });

      el.addEventListener("change", () => {
        window.dispatchEvent(new CustomEvent("app-command", { detail: { type: "COMMIT_HISTORY" } }));
        this.uiStore.update({ isInteracting: false });
      }, { signal: this.signal });
    });

    // カラーピッカー要素への document 直接アクセスを廃止し、注入オブジェクトから安全に取得
    const baseColorPicker = this.uiElements["baseColorPicker"];
    if (baseColorPicker) {
      baseColorPicker.addEventListener("input", (e) => {
        this.uiStore.update({ isInteracting: true });
        const hsvVals = ColorUtils.hexToHsv(e.target.value);
        window.dispatchEvent(new CustomEvent("app-command", {
          detail: { type: "UPDATE_COLOR_INPUT", hue: hsvVals.h, saturation: hsvVals.s }
        }));
      }, { signal: this.signal });
      
      baseColorPicker.addEventListener("change", () => {
        window.dispatchEvent(new CustomEvent("app-command", { detail: { type: "COMMIT_HISTORY" } }));
        this.uiStore.update({ isInteracting: false });
      }, { signal: this.signal });
    }
  }

  _getStateKey(domId) {
    const mapping = ANIM_UI_MAPPING.find((m) => m.id === domId);
    return mapping ? mapping.key : domId;
  }
}