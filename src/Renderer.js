import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import vertexShader from './shaders/julia.vert?raw';
import fragmentShader from './shaders/julia.frag?raw';
import { CONFIG } from './constants.js';
import { VRButton } from './VRButton.js';

export class Renderer {
    constructor(stateManager) {
        this.appState = stateManager.current; 
        
        this.renderState = {
            needsRender: true,
            renderTimer: null,
            timeTarget: 1.0 / 30.0,
            timeAcc: 1.0 / 30.0,
            fpsFrames: 0,
            fpsLastTime: performance.now(),
            phases: { x: 0, y: 0, z: 0, w: 0 }
        };

        this.timer = new THREE.Timer();
        this.tintColor = new THREE.Color();
        this.uiElements = { fpsCounter: document.getElementById('fps-counter') };

        this.tempEuler = new THREE.Euler(0, 0, 0, 'XYZ');
        this.mXW = new THREE.Matrix4();
        this.mYW = new THREE.Matrix4();
        this.mZW = new THREE.Matrix4();
        this.m4D = new THREE.Matrix4();
    }

    init() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, 0, 2);
        
        this.renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: false, alpha: true }); // 軽量化のため false に変更
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
        THREE.ColorManagement.enabled = false;
        this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        
        this.renderer.xr.enabled = true;
        document.body.appendChild(VRButton.createButton(this.renderer));

        this.renderer.xr.addEventListener('sessionstart', () => {
            this.setQuality('LOW');
            this.renderer.setPixelRatio(0.7);
            this.renderState.needsRender = true;
        });
        
        this.renderer.xr.addEventListener('sessionend', () => {
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
            if (!this.appState.isInteracting && !this.appState.isAutoAnimating) {
                this.setQuality('HIGH');
            }
        });

        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableRotate = true;
        this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 6.0;

        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                u_c: { value: new THREE.Vector4() },
                u_maxIter: { value: CONFIG.QUALITY.HIGH.iter }, 
                u_maxSteps: { value: CONFIG.QUALITY.HIGH.steps },
                u_cameraPos: { value: new THREE.Vector3() }, 
                u_cameraWorldMatrix: { value: new THREE.Matrix4() },
                u_cameraProjectionMatrixInverse: { value: new THREE.Matrix4() },
                u_brightness: { value: 0.0 }, 
                u_tintColor: { value: new THREE.Color() }, 
                u_aoPower: { value: 0.0 }, 
                u_specular: { value: 0.0 }, 
                u_bgColor: { value: new THREE.Color(0x000000) }, 
                u_bgAlpha: { value: 1.0 },
                u_rotMatrix_3D: { value: new THREE.Matrix4() },
                u_rotMatrix_4D: { value: new THREE.Matrix4() },
            }
        });

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.scene.add(this.mesh);

        this.updateResolution();
        
        this.controls.addEventListener('change', () => { this.renderState.needsRender = true; });
        this._boundOnResize = this.onResize.bind(this);
        window.addEventListener('resize', this._boundOnResize);
    }

    setQuality(qualityLevel) {
        if (!this.material) return;
        this.material.uniforms.u_maxSteps.value = CONFIG.QUALITY[qualityLevel].steps;
        this.material.uniforms.u_maxIter.value = CONFIG.QUALITY[qualityLevel].iter;
    }

    onResize() {
        if (this.appState.isDownloading) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.updateResolution();
    }

    updateResolution() {
        let w = window.innerWidth; let h = window.innerHeight;
        if (Math.max(w, h) > CONFIG.MAX_RENDER_SIZE) {
            const scale = CONFIG.MAX_RENDER_SIZE / Math.max(w, h);
            w = Math.floor(w * scale); h = Math.floor(h * scale);
        }
        this.renderer.setSize(w, h, false);
        this.material.uniforms.u_resolution.value.set(w, h);
        this.renderState.needsRender = true;
    }

    hsvToRgb(h, s, v) {
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
        return { r, g, b };
    }

    updateUniforms() {
        const u = this.mesh.material.uniforms;
        // [変更] 階層化されたパラメータの取得
        const frac = this.appState.params.fractal;
        const mat = this.appState.params.material;
        
        u.u_c.value.set(frac['cx'], frac['cy'], frac['cz'], frac['cw']);
        u.u_brightness.value = mat['brightness'];
        u.u_aoPower.value = mat['aoPower'];
        u.u_specular.value = mat['specular'];
        u.u_bgColor.value.set(mat['bgColor']);

        const rgb = this.hsvToRgb(mat['hue'], mat['saturation'], 1.0);
        this.tintColor.setRGB(rgb.r, rgb.g, rgb.b);
        u.u_tintColor.value.copy(this.tintColor);

        // [変更] 毎フレームのインスタンス化を廃止し、既存オブジェクトを再利用
        this.tempEuler.set(frac['rotX'], frac['rotY'], frac['rotZ'], 'XYZ');
        u.u_rotMatrix_3D.value.makeRotationFromEuler(this.tempEuler);

        const cxw = Math.cos(frac['rotXW']), sxw = Math.sin(frac['rotXW']);
        const cyw = Math.cos(frac['rotYW']), syw = Math.sin(frac['rotYW']);
        const czw = Math.cos(frac['rotZW']), szw = Math.sin(frac['rotZW']);

        this.mXW.set(
            cxw, 0, 0, -sxw,  0, 1, 0, 0,  0, 0, 1, 0,  sxw, 0, 0, cxw
        );
        this.mYW.set(
            1, 0, 0, 0,  0, cyw, 0, -syw,  0, 0, 1, 0,  0, syw, 0, cyw
        );
        this.mZW.set(
            1, 0, 0, 0,  0, 1, 0, 0,  0, 0, czw, -szw,  0, 0, szw, czw
        );

        this.m4D.copy(this.mZW).multiply(this.mYW).multiply(this.mXW);
        u.u_rotMatrix_4D.value.copy(this.m4D);
        
        u.u_cameraPos.value.copy(this.camera.position);
        u.u_cameraWorldMatrix.value.copy(this.camera.matrixWorld);
        u.u_cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);
    }

    requestRender() {
        this.renderState.needsRender = true;
    }

    animate() {
        this.renderer.setAnimationLoop(() => {
            this.renderState.fpsFrames++;
            const now = performance.now();
            if (now >= this.renderState.fpsLastTime + 1000) {
                const fps = Math.round((this.renderState.fpsFrames * 1000) / (now - this.renderState.fpsLastTime));
                if (this.uiElements.fpsCounter) this.uiElements.fpsCounter.innerText = `${fps} FPS`;
                this.renderState.fpsFrames = 0;
                this.renderState.fpsLastTime = now;
            }
            
            this.timer.update();
            const delta = this.timer.getDelta();
            this.renderState.timeAcc += delta;

            if (this.appState.isAutoAnimating) {
                const frac = this.appState.params.fractal;
                const anim = this.appState.params.animation;
                const mSpeed = anim['anim-speed'];
                const mAmp = anim['anim-amp'];
                const getAmp = (base, ratio) => Math.min(mAmp * ratio, 1.2 - Math.abs(base));

                this.renderState.phases.x += delta * (mSpeed * anim['speed-x']);
                this.renderState.phases.y += delta * (mSpeed * anim['speed-y']);
                this.renderState.phases.z += delta * (mSpeed * anim['speed-z']);
                this.renderState.phases.w += delta * (mSpeed * anim['speed-w']);

                frac['cx'] = frac.baseCx + (Math.sin(this.renderState.phases.x + anim['phase-x']) - Math.sin(anim['phase-x'])) * getAmp(frac.baseCx, anim['amp-x']);
                frac['cy'] = frac.baseCy + (Math.sin(this.renderState.phases.y + anim['phase-y']) - Math.sin(anim['phase-y'])) * getAmp(frac.baseCy, anim['amp-y']);
                frac['cz'] = frac.baseCz + (Math.sin(this.renderState.phases.z + anim['phase-z']) - Math.sin(anim['phase-z'])) * getAmp(frac.baseCz, anim['amp-z']);
                frac['cw'] = frac.baseCw + (Math.sin(this.renderState.phases.w + anim['phase-w']) - Math.sin(anim['phase-w'])) * getAmp(frac.baseCw, anim['amp-w']);    
                
                this.requestRender();
                if (this.onAutoAnimateUpdate) this.onAutoAnimateUpdate(this.appState.params); 
            }

            if (this.appState.isDownloading || (!this.appState.isAutoAnimating && !this.renderState.needsRender && !this.renderer.xr.isPresenting)) return;
            if (!this.renderer.xr.isPresenting && this.renderState.timeAcc < this.renderState.timeTarget) return; 
            
            this.renderState.timeAcc = this.renderState.timeAcc % this.renderState.timeTarget; 

            const maxPanRadius = 2.0;
            const targetLen = this.controls.target.length();
            if (targetLen > maxPanRadius) {
                this.controls.target.setLength(maxPanRadius);
            }

            this.controls.update();

            this.appState.camera.position.x = this.camera.position.x;
            this.appState.camera.position.y = this.camera.position.y;
            this.appState.camera.position.z = this.camera.position.z;
            this.appState.camera.target.x = this.controls.target.x;
            this.appState.camera.target.y = this.controls.target.y;
            this.appState.camera.target.z = this.controls.target.z;

            this.updateUniforms(); 
            this.renderer.render(this.scene, this.camera);
            this.renderState.needsRender = false;
        });
    }

    dispose() {
        this.renderer.setAnimationLoop(null);
        window.removeEventListener('resize', this._boundOnResize);
        this.controls.dispose();
        if (this.mesh && this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.material) this.material.dispose();
        this.renderer.dispose();
    }
}