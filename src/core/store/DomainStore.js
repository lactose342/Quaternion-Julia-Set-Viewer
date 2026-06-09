export class DomainStore extends EventTarget {
  #params;
  #camera;
  #animPhases;
  #schemas;

  constructor(schemas) {
    super();
    this.#schemas = schemas; // CONFIG.SCHEMAS を注入
    this.#camera = { position: { x: 0, y: 0, z: 2 }, target: { x: 0, y: 0, z: 0 } };
    this.#animPhases = { x: 0, y: 0, z: 0, w: 0 };
    this.#params = { fractal: {}, material: {}, animation: {} };
  }

  init(initialParams) {
    this.#params = structuredClone(initialParams);
    this.dispatchEvent(new CustomEvent("domain-updated", { detail: { type: "ALL" } }));
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