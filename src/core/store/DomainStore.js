import { JuliaAnimationService } from "@/core/domain/JuliaAnimationService.js";

export class DomainStore extends EventTarget {
  #params;
  #camera;
  #animPhases;
  #schemas;
  #animatedCCache;

  constructor(config) {
    super();
    this.config = config;
    this.#schemas = config.SCHEMAS;
    this.#camera = { position: { x: 0, y: 0, z: 2 }, target: { x: 0, y: 0, z: 0 } };
    this.#animPhases = { x: 0, y: 0, z: 0, w: 0 };
    this.#params = { fractal: {}, material: {}, animation: {} };
    this.#animatedCCache = { cx: 0, cy: 0, cz: 0, cw: 0 };

    this.animPhasesEvent = new CustomEvent("domain-updated", { detail: { type: "ANIM_PHASES" } });
  }

  fillDefaults(category, srcData = {}) {
    const defaultData = {};
    const schemaKeys = this.#schemas[category];
    const definitions = this.config.definitions;

    if (!schemaKeys) return defaultData;

    schemaKeys.forEach((key) => {
      if (srcData && srcData[key] !== undefined) {
        defaultData[key] = srcData[key];
      } else {
        const def = definitions ? definitions[key] : null;
        if (def && def.default !== undefined) {
          defaultData[key] = def.default;
        } else {
          if (category === "material" && key === "bgColor") {
            defaultData[key] = "#000000";
          } else if (category === "material") {
            defaultData[key] = 1.0;
          } else {
            defaultData[key] = 0;
          }
        }
      }
    });
    return defaultData;
  }

  init(initialParams) {
    const src = initialParams || {};
    this.#params = {
      fractal: this.fillDefaults("fractal", src.fractal),
      material: this.fillDefaults("material", src.material),
      animation: this.fillDefaults("animation", src.animation)
    };
    this.dispatchEvent(new CustomEvent("domain-updated", { detail: { type: "ALL" } }));
  }

  getAnimatedC() {
    if (this.#params.fractal && this.#params.material && this.#params.animation) {
      JuliaAnimationService.calculateAnimatedC(
        this.#params,
        this.#animPhases,
        this.#animatedCCache,
        this.config.SYSTEM.AMP_LIMIT
      );
    }
    return this.#animatedCCache;
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
    return this.#params[category] || null;
  }

  get cameraPosition() { return { ...this.#camera.position }; }
  get animPhases() { return this.#animPhases; }

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
    this.dispatchEvent(this.animPhasesEvent);
  }

  updateAnimPhases(delta) {
    JuliaAnimationService.updatePhasesInPlace(this.#animPhases, this.#params.animation, delta);
    this.dispatchEvent(this.animPhasesEvent);
  }
}