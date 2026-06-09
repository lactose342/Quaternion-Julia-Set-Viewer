import { CONFIG } from "@/config/config.js";

export class HistoryManager {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
  }

  pushHistory(state, animPhases) {
    const snapshot = {
      params: structuredClone(state.domain.params),
      camera: structuredClone(state.domain.camera),
      animPhases: structuredClone(animPhases),
      presets: {
        activePreset: state.ui.activePreset || "custom",
        activeAnimPreset: state.ui.activeAnimPreset || "custom"
      }
    };

    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }
    this.history.push(snapshot);
    if (this.history.length > CONFIG.SYSTEM.MAX_HISTORY) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  replaceInitialHistory(state, animPhases) {
    const snapshot = {
      params: structuredClone(state.domain.params),
      camera: structuredClone(state.domain.camera),
      animPhases: structuredClone(animPhases),
      presets: {
        activePreset: state.ui.activePreset || "custom",
        activeAnimPreset: state.ui.activeAnimPreset || "custom"
      }
    };
    this.history = [snapshot];
    this.currentIndex = 0;
  }

  undo() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return null;
  }

  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    }
    return null;
  }

  getStatus() {
    return {
      canUndo: this.currentIndex > 0,
      canRedo: this.currentIndex < this.history.length - 1
    };
  }
}