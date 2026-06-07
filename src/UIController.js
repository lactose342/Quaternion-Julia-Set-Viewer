import { CONFIG } from './constants.js';
import { Downloader } from './Downloader.js';
import { ColorUtils } from './ColorUtils.js';

export class UIController {
    constructor(stateManager, renderer) {
        this.stateManager = stateManager;
        this.renderer = renderer;
        this.uiElements = {};
        this.downloader = new Downloader(this.renderer, this.stateManager, this.showToast.bind(this));
    }

    getParamCategory(id) {
        if (CONFIG.SCHEMAS.fractal.includes(id)) return 'fractal';
        if (CONFIG.SCHEMAS.material.includes(id)) return 'material';
        if (CONFIG.SCHEMAS.animation.includes(id)) return 'animation';
        return null;
    }

    getAllParamIds() {
        return [...CONFIG.SCHEMAS.fractal, ...CONFIG.SCHEMAS.material, ...CONFIG.SCHEMAS.animation];
    }

    setParamValue(id, value) {
        const category = this.getParamCategory(id);
        if (category) {
            this.stateManager.updateParamsState(category, { [id]: value });
        }
    }

    getParamValue(id, stateParams = null) {
        const params = stateParams || this.stateManager.getState().domain.params;
        const category = this.getParamCategory(id);
        return category ? params[category][id] : undefined;
    }

    getStateKey(domId) {
        const mapping = CONFIG.ANIM_UI_IDS.find(m => m.id === domId);
        return mapping ? mapping.key : domId;
    }

    getDomId(stateKey) {
        const mapping = CONFIG.ANIM_UI_IDS.find(m => m.key === stateKey);
        return mapping ? mapping.id : stateKey;
    }

    init() {
        const domIds = [
            ...CONFIG.SCHEMAS.fractal,
            ...CONFIG.SCHEMAS.material,
            ...CONFIG.ANIM_UI_IDS.map(m => m.id),
            'custom-ui'
        ];
        domIds.forEach(domId => {
            const el = document.getElementById(domId);
            if (el) this.uiElements[domId] = el;
            const valLabel = document.getElementById(`val-${domId}`);
            if (valLabel) this.uiElements[`val-${domId}`] = valLabel;
        });

        this.bindEvents();
        this.loadFromURL();
        
        this.renderer.camera.fov = this.getParamValue('fov');
        this.renderer.camera.updateProjectionMatrix();

        this.stateManager.updateCameraState('position', {
            x: this.renderer.camera.position.x, y: this.renderer.camera.position.y, z: this.renderer.camera.position.z
        });
        this.stateManager.updateCameraState('target', {
            x: this.renderer.controls.target.x, y: this.renderer.controls.target.y, z: this.renderer.controls.target.z
        });

        this.updateHistoryButtons();
    }

    bindEvents() {
        const customUi = this.uiElements['custom-ui'];
        const stopPropagation = (e) => e.stopPropagation();
        
        ['pointerdown', 'touchstart', 'touchmove', 'wheel'].forEach(evt => {
            customUi.addEventListener(evt, stopPropagation);
        });

        this.renderer.controls.addEventListener('start', this.onInteractStart.bind(this));
        this.renderer.controls.addEventListener('end', this.onInteractEnd.bind(this));
        
        const cParams = ['cx', 'cy', 'cz', 'cw'];
        
        const domIdsToBind = [
            ...CONFIG.SCHEMAS.fractal,
            ...CONFIG.SCHEMAS.material,
            ...CONFIG.ANIM_UI_IDS.map(m => m.id)
        ];
        
        domIdsToBind.forEach(domId => {
            const el = this.uiElements[domId];
            if (!el) return;
            
            const stateKey = this.getStateKey(domId);

            el.addEventListener('touchstart', stopPropagation, { passive: true });
            el.addEventListener('pointerdown', stopPropagation);

            el.addEventListener('input', () => {
                const state = this.stateManager.getState();
                const isAnimParam = CONFIG.SCHEMAS.animation.includes(stateKey);

                // 停止中にアニメーション設定が変更された場合、その瞬間の形をBaseCに更新し、位相を0に戻す
                if (isAnimParam && !state.ui.isAutoAnimating) {
                    this.stateManager.commitAnimatedC();
                    this.stateManager.resetAnimPhases();
                    
                    // BaseCのUIスライダー（cx, cy, cz, cw）のみを新しい値に同期（操作中のスライダーの干渉を防ぐため）
                    ['cx', 'cy', 'cz', 'cw'].forEach(id => {
                        const baseDomId = this.getDomId(id);
                        if (this.uiElements[baseDomId]) {
                            this.uiElements[baseDomId].value = this.getParamValue(id);
                            this.updateSingleValueLabel(baseDomId, id);
                        }
                    });
                }

                // 既存のパラメータ更新処理
                const val = el.type === 'color' ? el.value : parseFloat(el.value);
                this.setParamValue(stateKey, val);
                
                if (stateKey === 'hue' || stateKey === 'saturation') this.updatePickerFromSliders();
                if (cParams.includes(stateKey)) this.updateBaseC();
                if (stateKey === 'fov') {
                    this.renderer.camera.fov = this.getParamValue('fov');
                    this.renderer.camera.updateProjectionMatrix();
                }

                this.onInteractStart();
                this.updateSingleValueLabel(domId, stateKey);
                this.renderer.requestRender();
                
                if (!state.ui.isAutoAnimating) {
                    if (!CONFIG.ANIM_PRESETS[document.getElementById('anim-preset-select').value]) {
                        if(!CONFIG.ANIM_UI_IDS.map(a=>a.key).includes(stateKey)) {
                            document.getElementById('preset-select').value = 'custom';
                        }
                    }
                }
            });
            
            el.addEventListener('change', () => {
                this.pushHistory();
                this.onInteractEnd();
            });
        });

        const animPresetSelect = document.getElementById('anim-preset-select');
        animPresetSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (CONFIG.ANIM_PRESETS[val]) {
                CONFIG.ANIM_UI_IDS.forEach(item => {
                    this.setParamValue(item.key, CONFIG.ANIM_PRESETS[val][item.key]); 
                });
                this.updateUIFromState();
                this.pushHistory();
            }
        });

        const baseColorPicker = document.getElementById('baseColorPicker');
        baseColorPicker.addEventListener('input', (e) => {
            const hsvVals = ColorUtils.hexToHsv(e.target.value);
            this.setParamValue('hue', hsvVals.h);
            this.setParamValue('saturation', hsvVals.s);
            this.onInteractStart();
            document.getElementById('preset-select').value = 'custom';
            this.updateSingleValueLabel('hue', 'hue');
            this.updateSingleValueLabel('saturation', 'saturation');
            this.renderer.requestRender();
        });
        baseColorPicker.addEventListener('change', () => {
            this.pushHistory();
            this.onInteractEnd();
        });

        document.getElementById('preset-select').addEventListener('change', this.applyPreset.bind(this));
        document.getElementById('reset-btn').addEventListener('click', this.resetAll.bind(this));
        document.getElementById('auto-animate-btn').addEventListener('click', this.toggleAutoAnimate.bind(this));
        document.getElementById('share-btn').addEventListener('click', this.shareURL.bind(this));
        
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                const format = document.getElementById('dl-format').value;
                const scale = parseFloat(document.getElementById('dl-scale').value);
                await this.downloader.downloadHighRes(format, scale); 
            });
        }
        
        document.getElementById('random-btn').addEventListener('click', this.randomizeAll.bind(this));
        document.getElementById('undo-btn').addEventListener('click', this.undo.bind(this));
        document.getElementById('redo-btn').addEventListener('click', this.redo.bind(this));
        
        const toggleBtn = document.getElementById('toggle-ui-btn');
        toggleBtn.addEventListener('click', () => {
            customUi.classList.toggle('hidden');
            const isOpen = !customUi.classList.contains('hidden');
            toggleBtn.innerText = isOpen ? '閉じる' : '設定';
            toggleBtn.classList.toggle('is-open', isOpen);
            toggleBtn.classList.toggle('is-close', !isOpen);
        });

        document.getElementById('fullscreen-btn').addEventListener('click', this.toggleFullscreen.bind(this));
        document.addEventListener('fullscreenchange', this.updateFullscreenIcon.bind(this));
    }

    onInteractStart() {
        this.stateManager.updateUiState({ isInteracting: true });
        this.uiElements['custom-ui'].classList.add('is-interacting');
        this.renderer.setQuality('LOW'); 
        this.renderer.requestRender();
    }

    onInteractEnd() {
        this.stateManager.updateUiState({ isInteracting: false });
        this.uiElements['custom-ui'].classList.remove('is-interacting');

        const state = this.stateManager.getState();
        if (!state.ui.isInteracting && !state.ui.isAutoAnimating) {
            this.renderer.setQuality('HIGH'); 
            this.renderer.requestRender();
        }
    }

    updateBaseC() {
        if (this.animationController) {
            this.animationController.resetPhases();
        }
    }

    updateUIFromState(stateParams = null) {
        const targetParams = stateParams || this.stateManager.getState().domain.params;
        this.getAllParamIds().forEach(stateKey => {
            const domId = this.getDomId(stateKey);
            const el = this.uiElements[domId];
            if (el) el.value = this.getParamValue(stateKey, targetParams);
            this.updateSingleValueLabel(domId, stateKey);
        });
        
        const picker = document.getElementById('baseColorPicker');
        const hue = this.getParamValue('hue', targetParams);
        const sat = this.getParamValue('saturation', targetParams);
        if (picker && hue !== undefined && sat !== undefined) {
            picker.value = ColorUtils.hsvToHex(hue, sat, 1.0);
        }
    }

    updateSingleValueLabel(domId, stateKey) {
        const labelEl = this.uiElements[`val-${domId}`];
        const val = this.getParamValue(stateKey);
        if (labelEl && val !== undefined) {
            if (stateKey.startsWith('rot') || stateKey.startsWith('p')) {
                labelEl.innerText = `${(val * 180 / Math.PI).toFixed(1)}°`;
            } else if (stateKey === 'fov') {
                labelEl.innerText = `${val}°`;
            } else if (typeof val === 'number') {
                labelEl.innerText = val.toFixed(3).replace(/\.?0+$/, '');
            }
        }
    }

    updatePickerFromSliders() {
        const hue = parseFloat(this.uiElements['hue'].value);
        const sat = parseFloat(this.uiElements['saturation'].value);
        const picker = document.getElementById('baseColorPicker');
        if (picker) picker.value = ColorUtils.hsvToHex(hue, sat, 1.0);
    }

    pushHistory() {
        this.stateManager.pushHistory();
        this.updateHistoryButtons();
    }

    undo() {
        if (this.stateManager.undo()) {
            this.#applyRestoredState();
        }
    }

    redo() {
        if (this.stateManager.redo()) {
            this.#applyRestoredState();
        }
    }

    #applyRestoredState() {
        const state = this.stateManager.getState();
        const cam = state.domain.camera;
        this.renderer.camera.position.copy(cam.position);
        this.renderer.controls.target.copy(cam.target);
        this.renderer.controls.update();
        
        this.updateUIFromState(state.domain.params);
        this.updateHistoryButtons();
        this.renderer.requestRender();
    }

    updateHistoryButtons() {
        const status = this.stateManager.getHistoryStatus();
        // アニメーション中かどうかの状態を取得
        const isAutoAnimating = this.stateManager.getState().ui.isAutoAnimating;
        
        // 履歴がない、またはアニメーション中の場合はボタンを無効化
        document.getElementById('undo-btn').disabled = !status.canUndo || isAutoAnimating;
        document.getElementById('redo-btn').disabled = !status.canRedo || isAutoAnimating;
    }

    toggleAutoAnimate() {
        const state = this.stateManager.getState();
        const nextAnimState = !state.ui.isAutoAnimating;
        this.stateManager.updateUiState({ isAutoAnimating: nextAnimState });
        
        const btn = document.getElementById('auto-animate-btn');
        const cSliderIds = ['cx', 'cy', 'cz', 'cw'];

        if (nextAnimState) {
            document.getElementById('undo-btn').disabled = true;
            document.getElementById('redo-btn').disabled = true;
            document.getElementById('preset-select').disabled = true;
            this.renderer.setQuality('LOW');
            cSliderIds.forEach(id => { if(this.uiElements[id]) this.uiElements[id].disabled = true; });
            btn.classList.add('is-playing');
        } else {
            this.updateUIFromState(); 
            this.updateHistoryButtons();
            document.getElementById('preset-select').disabled = false;
            
            if (!state.ui.isInteracting) {
                this.renderer.setQuality('HIGH');
                this.renderer.requestRender();
                this.pushHistory(); 
            }
            this.renderer.timer.update();
            cSliderIds.forEach(id => { if(this.uiElements[id]) this.uiElements[id].disabled = false; });
            btn.classList.remove('is-playing');
        }
    }

    applyPreset(e) {
        const val = e.target.value;
        if (CONFIG.PRESETS[val]) {
            this.onInteractStart();
            
            const newFractal = {};
            const newMaterial = {};
            
            this.getAllParamIds().forEach(id => { 
                if (CONFIG.PRESETS[val][id] !== undefined) {
                    if (CONFIG.SCHEMAS.fractal.includes(id)) newFractal[id] = CONFIG.PRESETS[val][id];
                    if (CONFIG.SCHEMAS.material.includes(id)) newMaterial[id] = CONFIG.PRESETS[val][id];
                }
            });

            this.stateManager.updateParamsState('fractal', newFractal);
            this.stateManager.updateParamsState('material', newMaterial);
            
            this.updateUIFromState();
            this.updateBaseC();
            this.pushHistory();
            this.onInteractEnd();
        }
    }

    resetAll() {
        this.onInteractStart();
        this.stateManager.resetToFactoryDefaults();
        
        document.getElementById('preset-select').value = 'preset1';
        document.getElementById('anim-preset-select').value = 'preset1'; 

        this.renderer.setQuality('HIGH');
        this.renderer.camera.position.set(0, 0, 2);
        this.renderer.controls.target.set(0, 0, 0);
        this.renderer.controls.update();

        this.updateUIFromState();
        this.pushHistory();
        this.onInteractEnd();
    }

    randomizeAll() {
        this.onInteractStart();
        const randRange = (min, max) => Math.random() * (max - min) + min;
        
        this.setParamValue('cx', parseFloat(randRange(-0.5, 1.0).toFixed(3)));
        this.setParamValue('cy', parseFloat(randRange(-0.8, 0.8).toFixed(3)));
        this.setParamValue('cz', parseFloat(randRange(-0.8, 0.8).toFixed(3)));
        this.setParamValue('cw', parseFloat(randRange(-1.0, 1.0).toFixed(3)));
        
        this.setParamValue('rotX', parseFloat(randRange(0, 6.283).toFixed(2)));
        this.setParamValue('rotY', parseFloat(randRange(0, 6.283).toFixed(2)));
        this.setParamValue('rotZ', parseFloat(randRange(0, 6.283).toFixed(2)));
        this.setParamValue('rotXW', parseFloat(randRange(0, 6.283).toFixed(2)));
        this.setParamValue('rotYW', parseFloat(randRange(0, 6.283).toFixed(2)));
        this.setParamValue('rotZW', parseFloat(randRange(0, 6.283).toFixed(2)));
        
        this.setParamValue('hue', parseFloat(Math.random().toFixed(3)));
        this.setParamValue('saturation', parseFloat(randRange(0.4, 1.0).toFixed(3)));
        this.setParamValue('brightness', parseFloat(randRange(1.0, 2.5).toFixed(1)));
        this.setParamValue('aoPower', parseFloat(randRange(0.5, 2.2).toFixed(1)));
        this.setParamValue('specular', parseFloat(Math.pow(2, Math.floor(randRange(2, 6))).toFixed(1)));
        
        const toHex = x => Math.floor(x * 40).toString(16).padStart(2, '0');
        this.setParamValue('bgColor', `#${toHex(Math.random())}${toHex(Math.random())}${toHex(Math.random())}`);

        document.getElementById('preset-select').value = 'custom';
        
        this.updateUIFromState();
        this.updateBaseC();
        this.pushHistory();
        this.onInteractEnd();
    }

    loadFromURL() {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('cx') && !params.has('hue')) return; 

        this.stateManager.updateUiState({ isInteracting: true });

        CONFIG.SCHEMAS.fractal.forEach(id => {
            if (params.has(id)) this.setParamValue(id, parseFloat(params.get(id)));
        });
        CONFIG.SCHEMAS.material.forEach(id => {
            if (params.has(id)) {
                const val = params.get(id);
                this.setParamValue(id, id === 'bgColor' ? `#${val}` : parseFloat(val));
            }
        });
        CONFIG.SCHEMAS.animation.forEach(id => {
            if (params.has(id)) this.setParamValue(id, parseFloat(params.get(id)));
        });

        if (params.has('ph_x')) {
            this.stateManager.setAnimPhases({
                x: parseFloat(params.get('ph_x')),
                y: parseFloat(params.get('ph_y')),
                z: parseFloat(params.get('ph_z')),
                w: parseFloat(params.get('ph_w'))
            });
        }

        const camPos = {
            x: params.has('cam_px') ? parseFloat(params.get('cam_px')) : this.renderer.camera.position.x,
            y: params.has('cam_py') ? parseFloat(params.get('cam_py')) : this.renderer.camera.position.y,
            z: params.has('cam_pz') ? parseFloat(params.get('cam_pz')) : this.renderer.camera.position.z
        };
        const camTarget = {
            x: params.has('cam_tx') ? parseFloat(params.get('cam_tx')) : this.renderer.controls.target.x,
            y: params.has('cam_ty') ? parseFloat(params.get('cam_ty')) : this.renderer.controls.target.y,
            z: params.has('cam_tz') ? parseFloat(params.get('cam_tz')) : this.renderer.controls.target.z
        };

        this.stateManager.updateCameraState('position', camPos);
        this.stateManager.updateCameraState('target', camTarget);

        this.renderer.camera.position.copy(camPos);
        this.renderer.controls.target.copy(camTarget);
        this.renderer.controls.update();

        const presetSelect = document.getElementById('preset-select');
        const animPresetSelect = document.getElementById('anim-preset-select');
        if (presetSelect) presetSelect.value = 'custom';
        if (animPresetSelect) animPresetSelect.value = 'custom';

        this.updateUIFromState();
        this.stateManager.updateUiState({ isInteracting: false });
        this.renderer.requestRender();

        this.stateManager.replaceInitialHistory();
        this.updateHistoryButtons();
    }

    shareURL() {
        const state = this.stateManager.getState();
        const targetParams = state.domain.params;
        const params = new URLSearchParams();
        const phases = this.stateManager.getRawAnimPhases(); 
        params.set('ph_x', phases.x.toFixed(3));
        params.set('ph_y', phases.y.toFixed(3));
        params.set('ph_z', phases.z.toFixed(3));
        params.set('ph_w', phases.w.toFixed(3));
            
        this.getAllParamIds().forEach(stateKey => {
            const val = this.getParamValue(stateKey, targetParams);
            params.set(stateKey, stateKey === 'bgColor' ? val.replace('#', '') : val);
        });
 
        const cam = state.domain.camera;
        params.set('cam_px', cam.position.x.toFixed(3));
        params.set('cam_py', cam.position.y.toFixed(3));
        params.set('cam_pz', cam.position.z.toFixed(3));
        params.set('cam_tx', cam.target.x.toFixed(3));
        params.set('cam_ty', cam.target.y.toFixed(3));
        params.set('cam_tz', cam.target.z.toFixed(3));
        
        const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        
        navigator.clipboard.writeText(url).then(() => {
            this.showToast("共有URLをクリップボードにコピーしました");
        }).catch(() => {
            this.showToast("URLのコピーに失敗しました", "error");
        });
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
        } else if (window.innerHeight === screen.height) {
            alert("ブラウザ機能の全画面表示を解除してください。");
        } else {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn(`フルスクリーン化に失敗しました: ${err.message}`);
            });
        }
    }

    updateFullscreenIcon() {
        const isFullscreen = document.fullscreenElement || (window.innerHeight === screen.height);
        const btn = document.getElementById('fullscreen-btn');
        btn.classList.toggle('is-fullscreen', isFullscreen);
        btn.title = isFullscreen ? "全画面表示を終了" : "全画面表示";
        btn.setAttribute('aria-label', btn.title);
    }

    showToast(message, type = 'success', duration = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const activeToasts = Array.from(container.children).filter(t => !t.classList.contains('is-removing'));
        if (activeToasts.length >= 3) {
            const oldestToast = activeToasts[0];
            oldestToast.classList.remove('show');
            oldestToast.classList.add('is-removing');
            oldestToast.addEventListener('transitionend', () => oldestToast.remove());
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        container.appendChild(toast);

        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

        const dismiss = () => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        };

        if (duration > 0) {
            setTimeout(dismiss, duration);
        } else {
            const clickToDismiss = () => { dismiss(); window.removeEventListener('pointerdown', clickToDismiss); };
            setTimeout(() => window.addEventListener('pointerdown', clickToDismiss), 1000);
        }
    }
}