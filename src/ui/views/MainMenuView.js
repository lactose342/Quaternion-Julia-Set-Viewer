export class MainMenuView {
  constructor(uiElements) {
    this.uiElements = uiElements;
  }

  toggleMenu() {
    const customUi = this.uiElements["custom-ui"];
    const toggleBtn = this.uiElements["toggle-ui-btn"];
    
    if (!customUi || !toggleBtn) return;

    customUi.classList.toggle("hidden");
    const isOpen = !customUi.classList.contains("hidden");
    
    if (isOpen) {
      toggleBtn.classList.remove("is-close");
      toggleBtn.classList.add("is-open");
      toggleBtn.textContent = "閉じる";
    } else {
      toggleBtn.classList.remove("is-open");
      toggleBtn.classList.add("is-close");
      toggleBtn.textContent = "設定";
    }
  }

  updateFullscreen(isFullscreen) {
    const fullscreenBtn = this.uiElements["fullscreen-btn"];
    if (fullscreenBtn) {
      fullscreenBtn.classList.toggle("is-fullscreen", isFullscreen);
    }
  }

  updatePresets(activePreset, activeAnimPreset) {
    const presetSelect = this.uiElements["preset-select"];
    const animPresetSelect = this.uiElements["anim-preset-select"];

    if (presetSelect && activePreset && presetSelect.value !== activePreset) {
      presetSelect.value = activePreset;
    }
    if (animPresetSelect && activeAnimPreset && animPresetSelect.value !== activeAnimPreset) {
      animPresetSelect.value = activeAnimPreset;
    }
  }
}