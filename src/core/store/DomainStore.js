import { JuliaAnimationService } from "@/core/domain/JuliaAnimationService.js";

export class DomainStore extends EventTarget {
  #params;
  #camera;
  #animPhases;
  #schemas;
  #animatedCCache;

  constructor(schemas) {
    super();
    this.#schemas = schemas;
    this.#camera = { position: { x: 0, y: 0, z: 2 }, target: { x: 0, y: 0, z: 0 } };
    this.#animPhases = { x: 0, y: 0, z: 0, w: 0 };
    this.#params = { fractal: {}, material: {}, animation: {} };
    this.#animatedCCache = { cx: 0, cy: 0, cz: 0, cw: 0 };
  }

  init(initialParams) {
    this.#params = structuredClone(initialParams);
    this.dispatchEvent(new CustomEvent("domain-updated", { detail: { type: "ALL" } }));
  }

  getAnimatedC() {
    if (this.#params.fractal && this.#params.material && this.#params.animation) {
      JuliaAnimationService.calculateAnimatedC(
        {
          fractal: this.#params.fractal,
          material: this.#params.material,
          animation: this.#params.animation
        },
        this.#animPhases,
        this.#animatedCCache
      );
    }
    // 呼び出し側での誤変換や意図せぬ書き換えを防ぐためシャローコピーを返す
    return { ...this.#animatedCCache };
  }

  // 構造全体が必要な履歴保存時などでのみ使用（負荷高）
  getSnapshot() {
    return {
      params: structuredClone(this.#params),
      camera: structuredClone(this.#camera),
      animPhases: { ...this.#animPhases }
    };
  }

  // レンダリングループ等で高頻度に呼ばれるゲッター（負荷低）
  getParams(category) {
    return this.#params[category] ? { ...this.#params[category] } : null;
  }

  get cameraPosition() { return { ...this.#camera.position }; }
  get animPhases() { return { ...this.#animPhases }; }

  updateParams(category, payload) {
    if (!this.#params[category]) return;

    let hasChanged = false;
    const changedKeys = [];
    const allowedKeys = this.#schemas[category];

    Object.keys(payload).forEach((key) => {
      if (allowedKeys.includes(key) && this.#params[category][key] !== payload[key]) {
        this.#params[category][key] = payload[key];
        changedKeys.push(key);
        hasChanged = true;
      }
    });

    if (hasChanged) {
      this.dispatchEvent(new CustomEvent("domain-updated", {
        detail: { type: "PARAMS", category, keys: changedKeys }
      }));
    }
  }

  updateCamera(type, payload) {
    if (!this.#camera[type]) return;
    Object.assign(this.#camera[type], payload);
    this.dispatchEvent(new CustomEvent("domain-updated", { detail: { type: "CAMERA" } }));
  }

  setAnimPhases(phases) {
    Object.assign(this.#animPhases, phases);
    this.dispatchEvent(new CustomEvent("domain-updated", { detail: { type: "ANIM_PHASES" } }));
  }
}