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

  async downloadArScreenshot() {
    if (this.uiStore.isDownloading) return;

    this.uiStore.update({ isDownloading: true });

    try {
      const blob = await this.renderer.captureNextFrame();
      if (!blob) {
        throw new Error("AR撮影のキャプチャに失敗しました");
      }

      const now = new Date();
      const timestamp = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0') + '_' +
        String(now.getMilliseconds()).padStart(3, '0');

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `4d_julia_ar_${timestamp}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      this.dispatchEvent(new CustomEvent("toast", { detail: { message: "AR撮影を保存しました", type: "success" } }));

    } catch (error) {
      console.error(error);
      this.dispatchEvent(new CustomEvent("toast", { detail: { message: "撮影に失敗しました", type: "error" } }));
    } finally {
      this.uiStore.update({ isDownloading: false });
    }
  }

  async downloadHighRes(format, scale) {
    if (document.activeElement) document.activeElement.blur();

    if (this.uiStore.isDownloading) return;

    const originalQuality = this.uiStore.getState().renderQuality;
    const originalAspect = this.renderer.camera.aspect;

    try {
      const dims = this.#calculateDimensions(scale);
      await this.#startDownloadState(dims);

      await this.#flushDOM();
      await this.#sleep(150);

      const { canvas, ctx } = this.#createCanvas(dims.targetWidth, dims.targetHeight);

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
      this.#endDownloadState(originalQuality, originalAspect);
    }
  }

  async #startDownloadState(dims) {
    this.uiStore.update({
      isDownloading: true,
      downloadProgress: 0,
      downloadMessage: "0%"
    });
    this.renderer.startExportMode(
      dims.targetWidth / dims.targetHeight,
      dims.tileW,
      dims.tileH
    );

    await this.#flushDOM();
    await this.#sleep(50);
  }

  #endDownloadState(originalQuality, originalAspect) {
    this.uiStore.update({ isDownloading: false });
    this.renderer.endExportMode(originalQuality, originalAspect);
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

    const TILE_MAX = this.config.RENDER_SETTINGS.TILE_MAX || 256;

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

  async #renderTiles(ctx, dims, isTransparent, renderParams) {
    const { targetWidth, targetHeight, tilesX, tilesY, tileW, tileH } = dims;
    const totalTiles = tilesX * tilesY;

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

        // 同期的にCanvasに転送（次の描画フレームを待つ必要はありません）
        ctx.drawImage(this.renderer.renderer.domElement, sx, sy, tileW, tileH);

        const currentTileIndex = ty * tilesX + tx + 1;
        const progress = Math.round((currentTileIndex / totalTiles) * 100);

        this.uiStore.update({
          downloadProgress: progress,
          downloadMessage: `${progress}%`
        });

        // 毎タイルごとに待機(sleep)するのではなく、3タイル描画するごとに1回だけ
        // メインスレッドを開放してUI表示を更新します。これにより無駄なフレーム待ち時間を排除し高速化します。
        if (currentTileIndex % 3 === 0 || currentTileIndex === totalTiles) {
          await this.#flushDOM();
          await this.#sleep(10);
        }
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
          const now = new Date();
          const timestamp = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0') + '_' +
            String(now.getMilliseconds()).padStart(3, '0');

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `4d_julia_${timestamp}_${width}x${height}.${ext}`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          resolve();
        },
        mimeType,
        quality,
      );
    });
  }
}