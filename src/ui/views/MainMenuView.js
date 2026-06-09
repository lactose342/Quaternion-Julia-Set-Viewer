export class MainMenuView {
  constructor() {
    this.customUi = document.getElementById("custom-ui");
    this.toggleBtn = document.getElementById("toggle-ui-btn");
    this.fullscreenBtn = document.getElementById("fullscreen-btn");
    this.presetSelect = document.getElementById("preset-select");
    this.animPresetSelect = document.getElementById("anim-preset-select");
  }

  toggleMenu() {
    if (!this.customUi || !this.toggleBtn) return;
    this.customUi.classList.toggle("hidden");
    const isOpen = !this.customUi.classList.contains("hidden");
    if (isOpen) {
      this.toggleBtn.classList.remove("is-close");
      this.toggleBtn.classList.add("is-open");
      this.toggleBtn.innerText = "閉じる";
    } else {
      this.toggleBtn.classList.remove("is-open");
      this.toggleBtn.classList.add("is-close");
      this.toggleBtn.innerText = "設定";
    }
  }

  updateFullscreen(isFullscreen) {
    if (this.fullscreenBtn) {
      if (isFullscreen) {
        this.fullscreenBtn.classList.add("is-fullscreen");
      } else {
        this.fullscreenBtn.classList.remove("is-fullscreen");
      }
    }
  }

  // プリセット名をDOMに適用する
  updatePresets(activePreset, activeAnimPreset) {
    if (this.presetSelect && activePreset && this.presetSelect.value !== activePreset) {
      this.presetSelect.value = activePreset;
    }
    if (this.animPresetSelect && activeAnimPreset && this.animPresetSelect.value !== activeAnimPreset) {
      this.animPresetSelect.value = activeAnimPreset;
    }
  }
}