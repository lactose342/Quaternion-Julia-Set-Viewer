import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import vertexShader from './shaders/julia.vert?raw';
import fragmentShader from './shaders/julia.frag?raw';
import { CONFIG } from './constants.js';
import { VRButton } from './VRButton.js';

export class Renderer {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.appState = stateManager.getRawState(); 
        
        this.renderState = {
            needsRender: true,
            renderTimer: null,
            fpsFrames: 0,
            fpsLastTime: performance.now()
        };

        this.timer = new THREE.Timer();
        this.uiElements = { fpsCounter: document.getElementById('fps-counter') };

        this.tempEuler = new THREE.Euler(0, 0, 0, 'XYZ');
        this.mXW = new THREE.Matrix4();
        this.mYW = new THREE.Matrix4();
        this.mZW = new THREE.Matrix4();
        this.m4D = new THREE.Matrix4();

        this.materialPool = {};
    }

    init() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, 0, 2);
        
        this.renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: false, alpha: true });
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
            const rawState = this.stateManager.getRawState();
            if (!rawState.ui.isInteracting && !rawState.ui.isAutoAnimating) {
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

        this.setQuality('HIGH');
        
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.scene.add(this.mesh);

        this.updateResolution();
        
        this.controls.addEventListener('change', () => { this.renderState.needsRender = true; });
        this._boundOnResize = this.onResize.bind(this);
        window.addEventListener('resize', this._boundOnResize);
    }

    getOrCreateMaterial(qualityLevel) {
        if (this.materialPool[qualityLevel]) {
            return this.materialPool[qualityLevel];
        }

        const config = CONFIG.QUALITY[qualityLevel];
        const isExport = qualityLevel === 'EXPORT';
        const isLow = qualityLevel === 'LOW';
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader: `#define MAX_STEPS ${config.steps}\n#define MAX_ITER ${config.iter}\n` + fragmentShader,
            defines: isExport ? { IS_EXPORTING: '1' } : (isLow ? { IS_LOW_QUALITY: '1' } : {}),
            uniforms: {
                u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                u_c: { value: new THREE.Vector4() },
                u_cameraPos: { value: new THREE.Vector3() }, 
                u_cameraWorldMatrix: { value: new THREE.Matrix4() },
                u_cameraProjectionMatrixInverse: { value: new THREE.Matrix4() },
                u_brightness: { value: 0.0 }, 
                u_hsvColor: { value: new THREE.Vector3() }, 
                u_aoPower: { value: 0.0 }, 
                u_specular: { value: 0.0 }, 
                u_bgColor: { value: new THREE.Color(0x000000) }, 
                u_bgAlpha: { value: 1.0 },
                u_rotMatrix_3D: { value: new THREE.Matrix4() },
                u_rotMatrix_4D: { value: new THREE.Matrix4() },
            }
        });

        this.materialPool[qualityLevel] = material;
        return material;
    }

    createExportMaterial() {
        return this.getOrCreateMaterial('EXPORT');
    }

    setQuality(qualityLevel) {
        const oldMaterial = this.material;
        this.material = this.getOrCreateMaterial(qualityLevel);
        
        if (oldMaterial && this.material !== oldMaterial) {
            this.material.uniforms.u_resolution.value.copy(oldMaterial.uniforms.u_resolution.value);
            if (this.mesh) {
                this.mesh.material = this.material;
            }
        }
        
        this.stateManager.updateState('ui', { renderQuality: qualityLevel });
        this.renderState.needsRender = true;
    }

    onResize() {
        const rawState = this.stateManager.getRawState();
        if (rawState.ui.isDownloading) return;
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
        if (this.material) {
            this.material.uniforms.u_resolution.value.set(w, h);
        }
        this.renderState.needsRender = true;
    }

    updateUniforms() {
        const u = this.mesh.material.uniforms;
        const state = this.stateManager.getRawState(); 
        const frac = state.domain.params.fractal;
        const mat = state.domain.params.material;
        
        u.u_c.value.set(frac.cx, frac.cy, frac.cz, frac.cw);
        u.u_brightness.value = mat.brightness;
        u.u_aoPower.value = mat.aoPower;
        u.u_specular.value = mat.specular;
        u.u_bgColor.value.set(mat.bgColor);
        u.u_hsvColor.value.set(mat.hue, mat.saturation, 1.0);

        this.tempEuler.set(frac.rotX, frac.rotY, frac.rotZ, 'XYZ');
        u.u_rotMatrix_3D.value.makeRotationFromEuler(this.tempEuler);

        const cxw = Math.cos(frac.rotXW), sxw = Math.sin(frac.rotXW);
        const cyw = Math.cos(frac.rotYW), syw = Math.sin(frac.rotYW);
        const czw = Math.cos(frac.rotZW), szw = Math.sin(frac.rotZW);

        this.mXW.set(cxw, 0, 0, -sxw,  0, 1, 0, 0,  0, 0, 1, 0,  sxw, 0, 0, cxw);
        this.mYW.set(1, 0, 0, 0,  0, cyw, 0, -syw,  0, 0, 1, 0,  0, syw, 0, cyw);
        this.mZW.set(1, 0, 0, 0,  0, 1, 0, 0,  0, 0, czw, -szw,  0, 0, szw, czw);

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

            if (this.animationController) {
                this.animationController.update(delta);
            }

            const state = this.stateManager.getRawState();
            const isVR = this.renderer.xr.isPresenting;
            
            if (state.ui.isDownloading || (!state.ui.isAutoAnimating && !this.renderState.needsRender && !isVR)) return;

            if (isVR) {
                this.renderState.needsRender = true; 
            } else {
                const maxPanRadius = 2.0;
                const targetLen = this.controls.target.length();
                if (targetLen > maxPanRadius) {
                    this.controls.target.setLength(maxPanRadius);
                }
                this.controls.update();
            }

            if (state.ui.isInteracting || isVR) {
                this.stateManager.updateCameraState('position', {
                    x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z
                });
                this.stateManager.updateCameraState('target', {
                    x: this.controls.target.x, y: this.controls.target.y, z: this.controls.target.z
                });
            }

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
        Object.keys(this.materialPool).forEach(key => {
            this.materialPool[key].dispose();
        });
        
        this.renderer.dispose();
    }
}