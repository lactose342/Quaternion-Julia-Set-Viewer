import { UI_IDS } from "@/ui/uiConstants.js";

export class ExportView {
  constructor(uiElements) {
    this.uiElements = uiElements;
  }

  update(uiState) {
    const customUi = this.uiElements[UI_IDS.EXPORT.CUSTOM_UI];
    const modal = this.uiElements[UI_IDS.EXPORT.MODAL];
    const progressBar = this.uiElements[UI_IDS.EXPORT.PROGRESS_BAR];
    const progressText = this.uiElements[UI_IDS.EXPORT.PROGRESS_TEXT];

    if (uiState.isDownloading) {
      if (customUi) customUi.classList.add("is-visible");
      if (modal) modal.classList.remove("hidden");
      if (progressBar) progressBar.style.width = `${uiState.downloadProgress}%`;
      if (progressText) progressText.textContent = uiState.downloadMessage;
    } else {
      if (customUi) customUi.classList.remove("is-visible");
      if (modal) modal.classList.add("hidden");
    }
  }
}