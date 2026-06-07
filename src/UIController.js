import { CONFIG } from './constants.js';
import { Downloader } from './Downloader.js';

export class UIController {
    static ANIM_UI_IDS = [
        { id: 'anim-speed', key: 'speed' }, { id: 'anim-amp', key: 'amp' },
        { id: 'speed-x', key: 'sx' }, { id: 'amp-x', key: 'ax' }, { id: 'phase-x', key: 'px' },
        { id: 'speed-y', key: 'sy' }, { id: 'amp-y', key: 'ay' }, { id: 'phase-y', key: 'py' },
        { id: 'speed-z', key: 'sz' }, { id: 'amp-z', key: 'az' }, { id: 'phase-z', key: 'pz' },
        { id: 'speed-w', key: 'sw' }, { id: 'amp-w', key: 'aw' }, { id: 'phase-w', key: 'pw' }
    ];

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

    init() {
        const ids = [...this.getAllParamIds(), 'custom-ui'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.uiElements[id] = el;
            const valLabel = document.getElementById(`val-${id}`);
            if (valLabel) this.uiElements[`val-${id}`] = valLabel;
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
        
        this.pushHistory();
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
        
        this.getAllParamIds().forEach(id => {
            const el = this.uiElements[id];
            if (!el) return;
            
            el.addEventListener('touchstart', stopPropagation, { passive: true });
            el.addEventListener('pointerdown', stopPropagation);

            el.addEventListener('input', () => {
                const val = el.type === 'color' ? el.value : parseFloat(el.value);
                this.setParamValue(id, val);
                
                if (id === 'hue' || id === 'saturation') this.updatePickerFromSliders();
                if (cParams.includes(id)) this.updateBaseC();
                if (id === 'fov') {
                    this.renderer.camera.fov = this.getParamValue('fov');
                    this.renderer.camera.updateProjectionMatrix();
                }

                this.onInteractStart();
                this.updateSingleValueLabel(id);
                this.renderer.requestRender();
                
                const state = this.stateManager.getState();
                if (!state.ui.isAutoAnimating) {
                    if (!CONFIG.ANIM_PRESETS[document.getElementById('anim-preset-select').value]) {
                        if(!UIController.ANIM_UI_IDS.map(a=>a.id).includes(id)) {
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
                UIController.ANIM_UI_IDS.forEach(item => { 
                    this.setParamValue(item.id, CONFIG.ANIM_PRESETS[val][item.key]); 
                });
                this.updateUIFromState();
                this.pushHistory();
            }
        });

        const baseColorPicker = document.getElementById('baseColorPicker');
        baseColorPicker.addEventListener('input', (e) => {
            const hsvVals = this.hexToHsv(e.target.value);
            this.setParamValue('hue', hsvVals.h);
            this.setParamValue('saturation', hsvVals.s);
            this.onInteractStart();
            document.getElementById('preset-select').value = 'custom';
            this.updateSingleValueLabel('hue');
            this.updateSingleValueLabel('saturation');
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
        document.getElementById('download-btn').addEventListener('click', () => {
            this.downloader.start();
        });
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
        this.getAllParamIds().forEach(id => {
            const el = this.uiElements[id];
            if (el) el.value = this.getParamValue(id, targetParams);
            this.updateSingleValueLabel(id);
        });
        
        const picker = document.getElementById('baseColorPicker');
        const hue = this.getParamValue('hue', targetParams);
        const sat = this.getParamValue('saturation', targetParams);
        if (picker && hue !== undefined && sat !== undefined) {
            picker.value = this.hsvToHex(hue, sat, 1.0);
        }
    }

    updateSingleValueLabel(id) {
        const labelEl = this.uiElements[`val-${id}`];
        const val = this.getParamValue(id);
        if (labelEl && val !== undefined) {
            if (id.startsWith('rot') || id.startsWith('phase-')) {
                labelEl.innerText = `${(val * 180 / Math.PI).toFixed(1)}°`;
            } else if (id === 'fov') {
                labelEl.innerText = `${val}°`;
            } else if (typeof val === 'number') {
                labelEl.innerText = val.toFixed(3).replace(/\.?0+$/, '');
            }
        }
    }

    updatePickerFromSliders() {
        const picker = document.getElementById('baseColorPicker');
        picker.value = this.hsvToHex(this.getParamValue('hue'), this.getParamValue('saturation'), 1.0);
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
        document.getElementById('undo-btn').disabled = !status.canUndo;
        document.getElementById('redo-btn').disabled = !status.canRedo;
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
            
            // プリセット展開時のバッファ構築
            const newFractal = {};
            const newMaterial = {};
            
            this.getAllParamIds().forEach(id => { 
                if (CONFIG.PRESETS[val][id] !== undefined) {
                    if (CONFIG.SCHEMAS.fractal.includes(id)) newFractal[id] = CONFIG.PRESETS[val][id];
                    if (CONFIG.SCHEMAS.material.includes(id)) newMaterial[id] = CONFIG.PRESETS[val][id];
                }
            });
            
            this.stateManager.updateFractalCurrent(newFractal);
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
        const allIds = this.getAllParamIds();

        if (params.has('p') && params.has('v')) { 
            const version = params.get('v');
            const values = params.get('p').split(',');
            
            if (version === '1' && values.length === allIds.length + 6) {
                let isValid = true;
                const parsedValues = [];
                
                allIds.forEach((id, index) => {
                    if (this.uiElements[id] && this.uiElements[id].type === 'color') {
                        parsedValues.push('#' + values[index]);
                    } else {
                        const val = parseFloat(values[index]);
                        if (Number.isNaN(val)) isValid = false;
                        parsedValues.push(val);
                    }
                });
                
                const camIdx = allIds.length;
                const camVals = values.slice(camIdx, camIdx + 6).map(parseFloat);
                if (camVals.some(Number.isNaN)) isValid = false;

                if (isValid) {
                    allIds.forEach((id, index) => { this.setParamValue(id, parsedValues[index]); });
                    
                    this.stateManager.updateState('domain.camera.position', { x: camVals[0], y: camVals[1], z: camVals[2] });
                    this.stateManager.updateState('domain.camera.target', { x: camVals[3], y: camVals[4], z: camVals[5] });           

                    this.renderer.camera.position.set(camVals[0], camVals[1], camVals[2]);
                    this.renderer.controls.target.set(camVals[3], camVals[4], camVals[5]);
                    
                    this.renderer.camera.fov = this.getParamValue('fov');
                    this.renderer.camera.updateProjectionMatrix();
                    this.renderer.controls.update();
                    
                    document.getElementById('preset-select').value = 'custom';
                    document.getElementById('anim-preset-select').value = 'custom';
                    
                    this.updateUIFromState();
                    this.updateBaseC();
                    return; 
                }
            }
        }
        
        this.updateUIFromState();
        this.updateBaseC();
    }

    shareURL() {
        const state = this.stateManager.getState();
        const targetParams = state.domain.params;
        
        const values = this.getAllParamIds().map(id => {
            const val = this.getParamValue(id, targetParams);
            return id === 'bgColor' ? val.replace('#', '') : val;
        });
 
        const cam = state.domain.camera;
        values.push(cam.position.x.toFixed(3), cam.position.y.toFixed(3), cam.position.z.toFixed(3));
        values.push(cam.target.x.toFixed(3), cam.target.y.toFixed(3), cam.target.z.toFixed(3));
        
        const url = `${window.location.origin}${window.location.pathname}?v=1&p=${values.join(',')}`;
        
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

    hsvToHex(h, s, v) {
        let r, g, b;
        let i = Math.floor(h * 6);
        let f = h * 6 - i;
        let p = v * (1 - s);
        let q = v * (1 - f * s);
        let t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    hexToHsv(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;
        let d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) h = 0; 
        else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h, s, v };
    }
}