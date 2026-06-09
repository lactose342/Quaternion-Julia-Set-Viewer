import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CONFIG } from "@/config/config.js";
// 古い仕様のVRButtonをインポート
import { VRButton } from "@/ui/views/VRButton.js";
import { JuliaAnimationService } from "@/core/domain/JuliaAnimationService.js";
import { JuliaMaterialFactory } from "@/core/factories/JuliaMaterialFactory.js";

export class Renderer {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.appState = stateManager.getRawState();

    this.renderState = {
      needsRender: true,
      renderTimer: null,
      fpsFrames: 0,
      fpsLastTime: performance.now(),
    };

    this.timer = new THREE.Timer();
    this.uiElements = { fpsCounter: document.getElementById("fps-counter") };

    this.tempEuler = new THREE.Euler(0, 0, 0, "XYZ");

    this.matRot3D = new THREE.Matrix4();
    this.matRot4D_XW = new THREE.Matrix4();
    this.matRot4D_YW = new THREE.Matrix4();
    this.matRot4D_ZW = new THREE.Matrix4();
    this.matCombinedRot = new THREE.Matrix4();

    this.cameraWorldPos = new THREE.Vector3();
    this.animatedC = { cx: 0, cy: 0, cz: 0, cw: 0 };
    this.materialPool = {};
  }

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 0, 2);

    // 【重要ハック】webxr-polyfill と Three.js r184 の互換性問題を修正
    // WebXRManager のコンストラクタ（= new WebGLRenderer() 内部）は
    //   const supportsGlBinding = typeof XRWebGLBinding !== 'undefined';
    // を一度だけ評価する。polyfill が本物でない XRWebGLBinding を注入している場合、
    // setSession() 内の `'createProjectionLayer' in XRWebGLBinding.prototype` で
    // prototype が undefined になりクラッシュする。
    // そのため new WebGLRenderer() の呼び出し前に XRWebGLBinding を隠蔽し、
    // supportsGlBinding を強制的に false にすることで
    // Three.js を安全な XRWebGLLayer ベースのレンダリングパスへ誘導する。
    const _xrWebGLBinding = window.XRWebGLBinding;
    window.XRWebGLBinding = undefined;
    this.renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: false, alpha: true });
    window.XRWebGLBinding = _xrWebGLBinding;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
    THREE.ColorManagement.enabled = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    this.renderer.xr.enabled = true;
    this.renderer.xr.setFoveation(1.0);

    // 【重要】VRButtonを直接DOMへ追加（Three.jsが要求するユーザー操作のコンテキストを維持）
    document.body.appendChild(VRButton.createButton(this.renderer));

    this.renderer.xr.addEventListener("sessionstart", () => {
      this.setQuality("LOW");
      this.renderer.setPixelRatio(0.7);
      this.renderState.needsRender = true;
    });

    this.renderer.xr.addEventListener("sessionend", () => {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
      const rawState = this.stateManager.getRawState();
      if (!rawState.ui.isInteracting && !rawState.ui.isAutoAnimating) {
        this.setQuality("HIGH");
      }
    });

    document.body.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = true;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 6.0;

    this.setQuality("HIGH");

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);

    this.mesh.onBeforeRender = (renderer, scene, camera) => {
      if (!this.material || !this.material.uniforms) return;
      const u = this.material.uniforms;

      if (this.renderer.xr.isPresenting) {
        if (u.u_cameraWorldMatrix && u.u_cameraWorldMatrix.value) {
          u.u_cameraWorldMatrix.value.copy(camera.matrixWorld);
        }
        if (u.u_cameraProjectionMatrixInverse && u.u_cameraProjectionMatrixInverse.value) {
          u.u_cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
        }
        if (u.u_cameraPos && u.u_cameraPos.value) {
          camera.getWorldPosition(this.cameraWorldPos);
          u.u_cameraPos.value.copy(this.cameraWorldPos);
        }
      }
    };

    this.scene.add(this.mesh);

    this.updateResolution();

    this.controls.addEventListener("change", () => {
      this.renderState.needsRender = true;
    });
    this._boundOnResize = this.onResize.bind(this);
    window.addEventListener("resize", this._boundOnResize);
  }

  getOrCreateMaterial(qualityLevel) {
    if (this.materialPool[qualityLevel]) {
      return this.materialPool[qualityLevel];
    }
    const material = JuliaMaterialFactory.create(qualityLevel);
    this.materialPool[qualityLevel] = material;
    return material;
  }

  createExportMaterial() {
    return this.getOrCreateMaterial("EXPORT");
  }

  setQuality(qualityLevel) {
    const oldMaterial = this.material;
    this.material = this.getOrCreateMaterial(qualityLevel);

    if (this.material !== oldMaterial && this.mesh) {
      this.mesh.material = this.material;
    }

    this.stateManager.updateUiState({ renderQuality: qualityLevel });
    this.renderState.needsRender = true;
    this.updateResolution();
  }

  onResize() {
    const rawState = this.stateManager.getRawState();
    if (rawState.ui.isDownloading) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.updateResolution();
  }

  updateResolution() {
    const rawState = this.stateManager.getRawState();
    if (rawState.ui.isDownloading) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    if (Math.max(w, h) > CONFIG.MAX_RENDER_SIZE) {
      const scale = CONFIG.MAX_RENDER_SIZE / Math.max(w, h);
      w = Math.floor(w * scale);
      h = Math.floor(h * scale);
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

    JuliaAnimationService.calculateAnimatedC(state.domain.params, this.stateManager.getRawAnimPhases(), this.animatedC);
    u.u_c.value.set(this.animatedC.cx, this.animatedC.cy, this.animatedC.cz, this.animatedC.cw);

    u.u_brightness.value = mat.brightness;
    u.u_aoPower.value = mat.aoPower;
    u.u_specular.value = mat.specular;
    u.u_bgColor.value.set(mat.bgColor);
    u.u_bgAlpha.value = mat.bgAlpha !== undefined ? mat.bgAlpha : 1.0;
    u.u_hsvColor.value.set(mat.hue, mat.saturation, 1.0);

    this.tempEuler.set(frac.rotX, frac.rotY, frac.rotZ, "XYZ");
    this.matRot3D.makeRotationFromEuler(this.tempEuler);

    const cxw = Math.cos(frac.rotXW), sxw = Math.sin(frac.rotXW);
    const cyw = Math.cos(frac.rotYW), syw = Math.sin(frac.rotYW);
    const czw = Math.cos(frac.rotZW), szw = Math.sin(frac.rotZW);

    this.matRot4D_XW.set(cxw, 0, 0, -sxw, 0, 1, 0, 0, 0, 0, 1, 0, sxw, 0, 0, cxw);
    this.matRot4D_YW.set(1, 0, 0, 0, 0, cyw, 0, -syw, 0, 0, 1, 0, 0, syw, 0, cyw);
    this.matRot4D_ZW.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, czw, -szw, 0, 0, szw, czw);

    this.matRot4D_ZW.multiply(this.matRot4D_YW).multiply(this.matRot4D_XW);

    u.u_rotMatrix_3D.value.copy(this.matRot3D);
    u.u_rotMatrix_4D.value.copy(this.matRot4D_ZW);

    u.u_cameraPos.value.copy(this.camera.position);
    u.u_cameraWorldMatrix.value.copy(this.camera.matrixWorld);
    u.u_cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);
  }

  requestRender() {
    this.renderState.needsRender = true;
  }

  animate() {
    this.renderer.setAnimationLoop(() => {
      this.timer.update();
      const delta = this.timer.getDelta();

      if (this.onTick) this.onTick(delta);

      const state = this.stateManager.getRawState();
      const isVR = this.renderer.xr.isPresenting;

      this.renderState.fpsFrames++;
      const now = performance.now();
      if (now >= this.renderState.fpsLastTime + 1000) {
        const fps = Math.round((this.renderState.fpsFrames * 1000) / (now - this.renderState.fpsLastTime));
        if (this.uiElements.fpsCounter) {
          const isIdle = !state.ui.isDownloading && !state.ui.isAutoAnimating && !this.renderState.needsRender && !isVR;
          this.uiElements.fpsCounter.innerText = isIdle ? `${fps} FPS (Idle)` : `${fps} FPS`;
        }
        this.renderState.fpsFrames = 0;
        this.renderState.fpsLastTime = now;
      }

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
        this.stateManager.updateCameraState("position", {
          x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z,
        });
        this.stateManager.updateCameraState("target", {
          x: this.controls.target.x, y: this.controls.target.y, z: this.controls.target.z,
        });
      }

      this.updateUniforms();

      this.renderer.render(this.scene, this.camera);
      this.renderState.needsRender = false;
    });
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("resize", this._boundOnResize);
    this.controls.dispose();
    if (this.mesh && this.mesh.geometry) this.mesh.geometry.dispose();
    Object.keys(this.materialPool).forEach((key) => {
      this.materialPool[key].dispose();
    });
    this.renderer.dispose();
  }
}