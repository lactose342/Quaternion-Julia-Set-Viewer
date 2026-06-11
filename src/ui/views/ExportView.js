export class ExportView {
  constructor() {
    this.customUi = document.getElementById("custom-ui");
    this.modal = document.getElementById("dl-modal");
    this.progressBar = document.getElementById("dl-progress-bar");
    this.progressText = document.getElementById("dl-progress-text");
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