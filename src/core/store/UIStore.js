export class UIStore extends EventTarget {
  #state;

  constructor(defaultQuality) {
    super();
    this.#state = {
      isAutoAnimating: false,
      isInteracting: false,
      isDownloading: false,
      downloadProgress: 0,
      downloadMessage: "",
      renderQuality: defaultQuality,
      activePreset: "preset1",
      activeAnimPreset: "preset1",
    };
  }

  getState() {
    return { ...this.#state };
  }

  get isAutoAnimating() { return this.#state.isAutoAnimating; }
  get isDownloading() { return this.#state.isDownloading; }

  update(payload = {}) {
    let hasChanged = false;
    const changedKeys = [];

    Object.keys(payload).forEach((key) => {
      if (key in this.#state && this.#state[key] !== payload[key]) {
        this.#state[key] = payload[key];
        changedKeys.push(key);
        hasChanged = true;
      }
    });

    if (hasChanged) {
      this.dispatchEvent(new CustomEvent("ui-updated", { detail: { keys: changedKeys } }));
    }
  }
}