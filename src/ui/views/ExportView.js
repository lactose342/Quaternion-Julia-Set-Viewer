import { UI_IDS } from "@/ui/uiConstants.js";

/**
 * 画像書き出し時のプログレスモーダル等のUI制御を担うViewクラス
 */
export class ExportView {
  constructor(uiElements) {
    this.customUi = uiElements[UI_IDS.EXPORT.CUSTOM_UI];
    this.modal = document.getElementById(UI_IDS.EXPORT.MODAL);
    this.progressBar = document.getElementById("dl-progress-bar");
    this.progressText = document.getElementById("dl-progress-text");
  }

  update(uiState) {
    if (uiState.isDownloading) {
      if (this.customUi) this.customUi.classList.add("is-visible");
      if (this.modal) this.modal.classList.remove("hidden");
      
      if (this.progressBar) this.progressBar.style.width = `${uiState.downloadProgress}%`;
      if (this.progressText) this.progressText.innerText = uiState.downloadMessage;
    } else {
      if (this.customUi) this.customUi.classList.remove("is-visible");
      if (this.modal) this.modal.classList.add("hidden");
    }
  }
}