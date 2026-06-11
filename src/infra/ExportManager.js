export class ExportManager extends EventTarget {
  constructor(renderer, domainStore, uiStore, config) {
    super();
    this.renderer = renderer;
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.config = config;
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

    if (this.uiStore.isDownloading) return;

    const originalQuality = this.uiStore.getState().renderQuality;
    const originalAspect = this.renderer.camera.aspect;

    try {
      await this.#startDownloadState();

      await this.#flushDOM();
      await this.#sleep(150);

      const dims = this.#calculateDimensions(scale);
      const { canvas, ctx } = this.#createCanvas(dims.targetWidth, dims.targetHeight);

      this.#setupRendererForExport(dims);

      const isTransparent = format === "transparent_png";

      const renderParams = {
        animatedC: this.domainStore.getAnimatedC(),
        fractalParams: this.domainStore.getParams("fractal"),
        materialParams: this.domainStore.getParams("material"),
        cameraParams: this.domainStore.getParams("camera")
      };

      await this.#renderTiles(ctx, dims, isTransparent, renderParams);
      await this.#encodeAndDownload(canvas, format, dims.targetWidth, dims.targetHeight);

    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.renderer.resetViewOffset(originalAspect);
      this.#endDownloadState(originalQuality);
    }
  }

  async #startDownloadState() {
    this.uiStore.update({
      isDownloading: true,
      downloadProgress: 0,
      downloadMessage: "0%"
    });
    this.renderer.controls.enabled = false;
    this.renderer.stopLoop();

    await this.#flushDOM();
    await this.#sleep(50);
  }

  #endDownloadState(originalQuality) {
    this.uiStore.update({ isDownloading: false });

    this.renderer.setQuality(originalQuality);
    this.renderer.controls.enabled = true;
    this.renderer.renderState.needsRender = true;
    this.renderer.startLoop();
  }

  #calculateDimensions(scale) {
    const dpr = window.devicePixelRatio || 1;
    let targetWidth = Math.floor(window.innerWidth * dpr * scale);
    let targetHeight = Math.floor(window.innerHeight * dpr * scale);

    const MAX_CANVAS_SIZE = this.config.RENDER_SETTINGS.MAX_CANVAS_SIZE;
    if (Math.max(targetWidth, targetHeight) > MAX_CANVAS_SIZE) {
      const safeScale = MAX_CANVAS_SIZE / Math.max(targetWidth, targetHeight);
      targetWidth = Math.floor(targetWidth * safeScale);
      targetHeight = Math.floor(targetHeight * safeScale);
    }

    // デバイス環境に応じてタイル最大サイズを動的に決定 (モバイル=512, デスクトップ=1024)
    const isMobile = /Mobi|Android|iPhone|iPad|Macintosh/i.test(navigator.userAgent) && 
                     ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const tileMaxLimit = isMobile ? 512 : 1024;

    const tilesX = Math.ceil(targetWidth / tileMaxLimit);
    const tilesY = Math.ceil(targetHeight / tileMaxLimit);
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
  }

  async #renderTiles(ctx, dims, isTransparent, renderParams) {
    const { targetWidth, targetHeight, tilesX, tilesY, tileW, tileH } = dims;

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const sx = tx * tileW;
        const sy = ty * tileH;

        this.renderer.renderTile({
          totalWidth: targetWidth,
          totalHeight: targetHeight,
          offsetX: sx,
          offsetY: sy,
          tileWidth: tileW,
          tileHeight: tileH,
          alpha: isTransparent ? 0.0 : 1.0,
          animatedC: renderParams.animatedC,
          fractalParams: renderParams.fractalParams,
          materialParams: renderParams.materialParams,
          cameraParams: renderParams.cameraParams
        });

        await this.#nextFrame();
        ctx.drawImage(this.renderer.renderer.domElement, sx, sy, tileW, tileH);

        const progress = Math.round(((ty * tilesX + tx + 1) / (tilesX * tilesY)) * 100);

        this.uiStore.update({
          downloadProgress: progress,
          downloadMessage: `${progress}%`
        });

        await this.#sleep(10);
      }
    }
  }

  async #encodeAndDownload(canvas, format, width, height) {
    this.uiStore.update({
      downloadProgress: 100,
      downloadMessage: "画像エンコード中...\n\nしばらくお待ちください"
    });
    await this.#flushDOM();
    await this.#sleep(150);

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
}