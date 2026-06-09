import { CONFIG } from "@/config/config.js";

export class ExportManager extends EventTarget {
  constructor(renderer, stateManager) {
    super();
    this.renderer = renderer;
    this.stateManager = stateManager;
  }

  #sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  #nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  #flushDOM() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async downloadHighRes(format, scale) {
    if (document.activeElement) document.activeElement.blur();

    const rawState = this.stateManager.getRawState();
    if (rawState.ui.isDownloading) return;

    const originalState = this.#captureOriginalState();

    try {
      await this.#startDownloadState();

      await this.#flushDOM();
      await this.#sleep(150);

      const dims = this.#calculateDimensions(scale);
      const { canvas, ctx } = this.#createCanvas(dims.targetWidth, dims.targetHeight);

      this.#setupRendererForExport(dims);

      const isTransparent = format === "transparent_png";
      await this.#renderTiles(ctx, dims, isTransparent);

      await this.#encodeAndDownload(canvas, format, dims.targetWidth, dims.targetHeight);

      // コールバックを排除し、Mediator(App.js)にイベントで成功を通知
      this.dispatchEvent(new CustomEvent('export-toast', { 
        detail: { message: "画像の書き出しが完了しました", type: "success", duration: 5000 } 
      }));
    } catch (error) {
      console.error(error);
      this.dispatchEvent(new CustomEvent('export-toast', { 
        detail: { message: "画像の書き出しに失敗しました", type: "error" } 
      }));
    } finally {
      this.#restoreOriginalState(originalState);
      this.#endDownloadState(originalState.quality);
    }
  }

  #captureOriginalState() {
    const rawState = this.stateManager.getRawState();
    return {
      quality: rawState.ui.renderQuality,
      aspect: this.renderer.camera.aspect,
      alpha: this.renderer.material ? this.renderer.material.uniforms.u_bgAlpha.value : 1.0,
    };
  }

  async #startDownloadState() {
    this.stateManager.updateUiState({ 
      isDownloading: true,
      downloadProgress: 0,
      downloadMessage: "0%"
    });
    this.renderer.controls.enabled = false;

    await this.#flushDOM();
    await this.#sleep(50);
  }

  #endDownloadState(originalQuality) {
    this.stateManager.updateUiState({ isDownloading: false });

    this.renderer.setQuality(originalQuality);
    this.renderer.controls.enabled = true;
    this.renderer.renderState.needsRender = true;
  }

  #calculateDimensions(scale) {
    const dpr = window.devicePixelRatio || 1;
    let targetWidth = Math.floor(window.innerWidth * dpr * scale);
    let targetHeight = Math.floor(window.innerHeight * dpr * scale);

    const MAX_CANVAS_SIZE = CONFIG.RENDER_SETTINGS.MAX_CANVAS_SIZE;
    if (Math.max(targetWidth, targetHeight) > MAX_CANVAS_SIZE) {
      const safeScale = MAX_CANVAS_SIZE / Math.max(targetWidth, targetHeight);
      targetWidth = Math.floor(targetWidth * safeScale);
      targetHeight = Math.floor(targetHeight * safeScale);
    }

    const TILE_MAX = CONFIG.RENDER_SETTINGS.TILE_MAX;
    const tilesX = Math.ceil(targetWidth / TILE_MAX);
    const tilesY = Math.ceil(targetHeight / TILE_MAX);
    const tileW = Math.ceil(targetWidth / tilesX);
    const tileH = Math.ceil(targetHeight / tilesY);

    return { targetWidth, targetHeight, tilesX, tilesY, tileW, tileH };
  }

  #createCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    return { canvas, ctx };
  }

  #setupRendererForExport(dims) {
    this.renderer.setQuality("EXPORT");
    this.renderer.camera.aspect = dims.targetWidth / dims.targetHeight;
    this.renderer.camera.updateProjectionMatrix();

    this.renderer.renderer.setSize(dims.tileW, dims.tileH, false);
    if (this.renderer.material) {
      this.renderer.material.uniforms.u_resolution.value.set(dims.tileW, dims.tileH);
    }
  }

  async #renderTiles(ctx, dims, isTransparent) {
    const { targetWidth, targetHeight, tilesX, tilesY, tileW, tileH } = dims;

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const sx = tx * tileW;
        const sy = ty * tileH;

        this.renderer.camera.setViewOffset(targetWidth, targetHeight, sx, sy, tileW, tileH);
        this.renderer.updateUniforms();

        if (this.renderer.material) {
          this.renderer.material.uniforms.u_bgAlpha.value = isTransparent ? 0.0 : 1.0;
        }

        await this.#nextFrame();
        this.renderer.renderer.render(this.renderer.scene, this.renderer.camera);
        ctx.drawImage(this.renderer.renderer.domElement, sx, sy, tileW, tileH);

        const progress = Math.round(((ty * tilesX + tx + 1) / (tilesX * tilesY)) * 100);
        
        this.stateManager.updateUiState({
          downloadProgress: progress,
          downloadMessage: `${progress}%`
        });

        await this.#sleep(10);
      }
    }
  }

  async #encodeAndDownload(canvas, format, width, height) {
    this.stateManager.updateUiState({
      downloadProgress: 100,
      downloadMessage: "画像エンコード中...\n\nしばらくお待ちください"
    });
    await this.#flushDOM();
    await this.#sleep(50);

    const isPng = format === "png" || format === "transparent_png";
    const isWebp = format === "webp";

    let mimeType = "image/jpeg";
    let ext = "jpg";
    let quality = 0.95;

    if (isPng) {
      mimeType = "image/png";
      ext = "png";
      quality = undefined;
    } else if (isWebp) {
      mimeType = "image/webp";
      ext = "webp";
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Blob生成に失敗しました"));
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `4d_julia_wallpaper_${width}x${height}.${ext}`;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          resolve();
        },
        mimeType,
        quality,
      );
    });
  }

  #restoreOriginalState(originalState) {
    this.renderer.camera.clearViewOffset();
    this.renderer.camera.aspect = originalState.aspect;
    this.renderer.camera.updateProjectionMatrix();

    if (this.renderer.material) {
      this.renderer.material.uniforms.u_bgAlpha.value = originalState.alpha;
    }
  }
}