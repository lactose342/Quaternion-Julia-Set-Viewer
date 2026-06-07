import * as THREE from 'three';
import { CONFIG } from './constants.js';

export class Downloader {
    constructor(rendererInstance, stateManager, showToast) {
        this.ren = rendererInstance;
        this.state = stateManager.current;
        this.showToast = showToast;
    }

    start() {
        if (document.activeElement) document.activeElement.blur();

        this.state.ui.isDownloading = true;
        this.ren.controls.enabled = false;
        
        const customUi = document.getElementById('custom-ui');
        const dlModal = document.getElementById('dl-modal');
        const progressBar = document.getElementById('dl-progress-bar');
        const progressText = document.getElementById('dl-progress-text');
        
        customUi.classList.add('is-interacting');
        progressBar.style.width = '0%';
        progressText.innerText = '0%';
        dlModal.classList.remove('hidden');

        const format = document.getElementById('dl-format').value;
        const isTransparent = format === 'transparent_png';
        const isPng = format === 'png' || format === 'transparent_png';
        const isWebp = format === 'webp';
        const scale = parseFloat(document.getElementById('dl-scale').value);

        // CSS Transition (0.3s) の完了を安全に待つ
        setTimeout(() => {
            requestAnimationFrame(() => {
                this._processRender(format, isTransparent, isPng, isWebp, scale, dlModal, progressBar, progressText, customUi);
            });
        }, 350);
    }

    _processRender(format, isTransparent, isPng, isWebp, scale, dlModal, progressBar, progressText, customUi) {
        // メッシュのマテリアルをエクスポート用に差し替え（初回のみ遅延コンパイルが発生）
        this.ren.mesh.material = this.ren.createExportMaterial();
        const u = this.ren.mesh.material.uniforms;
        
        // 通常マテリアル側の現在の設定値を退避（修復用）
        const normalU = this.ren.material.uniforms;
        const origSteps = normalU.u_maxSteps.value;
        const origIter = normalU.u_maxIter.value;
        const origAlpha = normalU.u_bgAlpha.value;

        // エクスポート用マテリアルのUniformを高画質設定に書き換え
        u.u_maxSteps.value = CONFIG.QUALITY.EXPORT.steps;
        u.u_maxIter.value = CONFIG.QUALITY.EXPORT.iter;
        u.u_bgAlpha.value = isTransparent ? 0.0 : 1.0;

        const dpr = window.devicePixelRatio || 1;
        let targetWidth = Math.floor(window.innerWidth * dpr * scale);
        let targetHeight = Math.floor(window.innerHeight * dpr * scale);

        const MAX_CANVAS_SIZE = 4096;
        if (Math.max(targetWidth, targetHeight) > MAX_CANVAS_SIZE) {
            const safeScale = MAX_CANVAS_SIZE / Math.max(targetWidth, targetHeight);
            targetWidth = Math.floor(targetWidth * safeScale);
            targetHeight = Math.floor(targetHeight * safeScale);
        }

        const TILE_MAX = 250;
        const tilesX = Math.ceil(targetWidth / TILE_MAX);
        const tilesY = Math.ceil(targetHeight / TILE_MAX);
        const tileW = Math.ceil(targetWidth / tilesX);
        const tileH = Math.ceil(targetHeight / tilesY);

        const composeCanvas = document.createElement('canvas');
        composeCanvas.width = targetWidth;
        composeCanvas.height = targetHeight;
        const ctx = composeCanvas.getContext('2d');

        const originalAspect = this.ren.camera.aspect;
        this.ren.camera.aspect = targetWidth / targetHeight;
        this.ren.camera.updateProjectionMatrix();
        
        this.ren.renderer.setSize(tileW, tileH, false);
        u.u_resolution.value.set(tileW, tileH);

        let tx = 0; let ty = 0;

        const renderNextTile = () => {
            this.ren.camera.setViewOffset(targetWidth, targetHeight, tx * tileW, ty * tileH, tileW, tileH);
            this.ren.updateUniforms(); 
            
            this.ren.renderer.render(this.ren.scene, this.ren.camera);
            ctx.drawImage(this.ren.renderer.domElement, tx * tileW, ty * tileH, tileW, tileH);

            tx++;
            if (tx >= tilesX) { tx = 0; ty++; }

            const progress = Math.round(((ty * tilesX + tx) / (tilesX * tilesY)) * 100);
            
            if (ty < tilesY) {
                progressBar.style.width = `${progress}%`;
                progressText.innerText = `${progress}%`;
                requestAnimationFrame(renderNextTile);
            } else {
                progressBar.style.width = `100%`;
                setTimeout(() => finishDownload(), 100);
            }
        };

        const finishDownload = () => {
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

            progressText.innerText = "画像エンコード中...\n\nしばらくお待ちください";
            
            composeCanvas.toBlob((blob) => {
                if (!blob) {
                    restoreState();
                    setTimeout(() => this.showToast("画像の書き出しに失敗しました", "error"), 350);
                    return;
                }
                
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `4d_julia_wallpaper_${targetWidth}x${targetHeight}.${ext}`;
                link.href = url;
                
                restoreState();
                
                setTimeout(() => {
                    this.showToast(`画像の書き出しが完了しました`, 'success', 5000);
                    requestAnimationFrame(() => {
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(url), 2000);
                    });
                }, 350);
            }, mimeType, quality);
        };

        const restoreState = () => {
            this.ren.camera.clearViewOffset();
            this.ren.camera.aspect = originalAspect;
            this.ren.camera.updateProjectionMatrix();
            
            // 通常用マテリアルに参照を差し戻す（再コンパイルの発生なし）
            this.ren.mesh.material = this.ren.material;
            
            // 通常マテリアルの値を確実に復元
            normalU.u_maxSteps.value = origSteps;
            normalU.u_maxIter.value = origIter;
            normalU.u_bgAlpha.value = origAlpha;
            
            this.ren.updateResolution();
            this.ren.setQuality('HIGH'); 

            dlModal.classList.add('hidden');
            this.ren.controls.enabled = true;
            customUi.classList.remove('is-interacting');

            this.state.ui.isDownloading = false;
            this.ren.renderState.needsRender = true;
        };
        
        // 描画バッファのフラッシュと Paint タイミングを完全に確保するため、2フレーム待ってから回す
        requestAnimationFrame(() => {
            requestAnimationFrame(renderNextTile);
        });
    }
}