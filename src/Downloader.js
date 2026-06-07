import * as THREE from 'three';
import { CONFIG } from './constants.js';

export class Downloader {
    constructor(renderer, stateManager, showToastFn) {
        this.renderer = renderer;
        this.stateManager = stateManager;
        this.showToast = showToastFn;
    }

    #sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    #nextFrame() { return new Promise(resolve => requestAnimationFrame(resolve)); }

    async downloadHighRes(format, scale) {
        if (document.activeElement) document.activeElement.blur();

        const rawState = this.stateManager.getRawState();
        if (rawState.ui.isDownloading) return;

        const originalQuality = rawState.ui.renderQuality;

        // UIをロック
        this.stateManager.updateUiState({ isDownloading: true });
        this.renderer.controls.enabled = false;

        // DOM要素の取得
        const customUi = document.getElementById('custom-ui');
        const dlModal = document.getElementById('dl-modal');
        const progressBar = document.getElementById('dl-progress-bar');
        const progressText = document.getElementById('dl-progress-text');

        // モーダルと進捗表示の初期化
        if (customUi) customUi.classList.add('is-interacting');
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.innerText = '0%';
        if (dlModal) dlModal.classList.remove('hidden');

        // モーダルの表示（DOM変更）をブラウザの画面に確実に反映させるための待機
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await this.#sleep(50); 

        const isTransparent = format === 'transparent_png';
        const isPng = format === 'png' || format === 'transparent_png';
        const isWebp = format === 'webp';

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

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = targetWidth;
        exportCanvas.height = targetHeight;
        const ctx = exportCanvas.getContext('2d');

        // EXPORTマテリアルへの切り替え
        this.renderer.setQuality('EXPORT');
        const originalAspect = this.renderer.camera.aspect;
        this.renderer.camera.aspect = targetWidth / targetHeight;
        this.renderer.camera.updateProjectionMatrix();

        this.renderer.renderer.setSize(tileW, tileH, false);
        if (this.renderer.material) {
            this.renderer.material.uniforms.u_resolution.value.set(tileW, tileH);
        }

        let origAlpha = 1.0;
        if (this.renderer.material) {
            origAlpha = this.renderer.material.uniforms.u_bgAlpha.value;
        }

        try {
            // タイルレンダリングループ
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

                    // 進捗率の計算とUI反映
                    const progress = Math.round(((ty * tilesX + tx + 1) / (tilesX * tilesY)) * 100);
                    if (progressBar) progressBar.style.width = `${progress}%`;
                    if (progressText) progressText.innerText = `${progress}%`;
                    
                    await this.#sleep(10);
                }
            }

            // エンコード処理への移行表示
            if (progressText) {
                progressText.innerText = "画像エンコード中...\n\nしばらくお待ちください";
            }
            // テキスト変更を画面に反映させるための待機
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await this.#sleep(50);

            let mimeType = 'image/jpeg';
            let ext = 'jpg';
            let quality = 0.95;

            if (isPng) {
                mimeType = 'image/png';
                ext = 'png';
                quality = undefined;
            } else if (isWebp) {
                mimeType = 'image/webp';
                ext = 'webp';
            }

            // Blob生成とダウンロード実行
            await new Promise((resolve, reject) => {
                exportCanvas.toBlob((blob) => {
                    if (!blob) { reject(new Error("Blob生成に失敗しました")); return; }
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `4d_julia_wallpaper_${targetWidth}x${targetHeight}.${ext}`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 2000);
                    resolve();
                }, mimeType, quality);
            });

            // 成功トーストの表示
            if (this.showToast) this.showToast(`画像の書き出しが完了しました`, 'success', 5000);

        } catch (error) {
            console.error(error);
            // 失敗トーストの表示
            if (this.showToast) this.showToast("画像の書き出しに失敗しました", "error");
        } finally {
            // ロック解除とUI・カメラ状態の復元
            if (dlModal) dlModal.classList.add('hidden');
            if (customUi) customUi.classList.remove('is-interacting');

            this.renderer.camera.clearViewOffset();
            this.renderer.camera.aspect = originalAspect;
            this.renderer.camera.updateProjectionMatrix();

            if (this.renderer.material) {
                this.renderer.material.uniforms.u_bgAlpha.value = origAlpha;
            }

            this.stateManager.updateUiState({ isDownloading: false });
            this.renderer.controls.enabled = true;
            this.renderer.setQuality(originalQuality); 
            this.renderer.renderState.needsRender = true;
        }
    }
}