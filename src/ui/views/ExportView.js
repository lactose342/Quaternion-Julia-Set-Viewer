import { UI_IDS } from "@/ui/uiConstants.js";

export class ExportView {
  constructor() {
    this.customUi = document.getElementById(UI_IDS.EXPORT.CUSTOM_UI);
    this.modal = document.getElementById(UI_IDS.EXPORT.MODAL);
    this.progressBar = document.getElementById(UI_IDS.EXPORT.PROGRESS_BAR);
    this.progressText = document.getElementById(UI_IDS.EXPORT.PROGRESS_TEXT);
  }

  update(uiState) {
    if (uiState.isDownloading) {
      if (this.customUi) this.customUi.classList.add("is-visible");
      if (this.modal) this.modal.classList.remove("hidden");
      if (this.progressBar) this.progressBar.style.width = `${uiState.downloadProgress}%`;
      if (this.progressText) this.progressText.textContent = uiState.downloadMessage;
    } else {
      if (this.customUi) this.customUi.classList.remove("is-visible");
      if (this.modal) this.modal.classList.add("hidden");
    }
  }
}