import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VRButton } from "@/ui/views/VRButton.js";
import { JuliaMaterialFactory } from "@/infra/factories/JuliaMaterialFactory.js";
import { XRManager } from "@/infra/XRManager.js";

export class Renderer {
  constructor(domainStore, uiStore, config) {
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.config = config;
    this.xrManager = new XRManager(this, domainStore, uiStore, config);

    this.renderState = {
      needsRender: true,
      renderTimer: null,
      fpsFrames: 0,
      fpsLastTime: performance.now(),
    };

    this.timer = new THREE.Timer();
    this.uiElements = { fpsCounter: null };

    this.tempEuler = new THREE.Euler(0, 0, 0, "XYZ");
    this.matRot3D = new THREE.Matrix4();
    this.matRot4D_XW = new THREE.Matrix4();
    this.matRot4D_YW = new THREE.Matrix4();
    this.matRot4D_ZW = new THREE.Matrix4();

    this.cameraWorldPos = new THREE.Vector3();
    this.animatedC = { cx: 0, cy: 0, cz: 0, cw: 0 };
    this.materialPool = {};

    this.onCameraChange = null;
    this.onFpsUpdate = null;
    this.isDownloading = false;

    this.maxPixelRatio = Math.min(window.devicePixelRatio, 1.0);
    this.currentPixelRatio = this.maxPixelRatio;
  }

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 0, 2);

    const _xrWebGLBinding = window.XRWebGLBinding;
    window.XRWebGLBinding = undefined;
    this.renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: false, alpha: true });
    window.XRWebGLBinding = _xrWebGLBinding;

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(this.currentPixelRatio);
    THREE.ColorManagement.enabled = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setFoveation(1.0);

    document.body.appendChild(VRButton.createButton(this.renderer));

    if (this.xrManager) {
      this.xrManager.init();
    }

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
        if (u.u_cameraWorldMatrix && u.u_cameraWorldMatrix.value) u.u_cameraWorldMatrix.value.copy(camera.matrixWorld);
        if (u.u_cameraProjectionMatrixInverse && u.u_cameraProjectionMatrixInverse.value) u.u_cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
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

    this.controls.addEventListener("start", () => {
      this.uiStore.update({ isInteracting: true });
    });

    this.controls.addEventListener("end", () => {
      if (this.onCameraChange) {
        this.onCameraChange({
          position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
          target: { x: this.controls.target.x, y: this.controls.target.y, z: this.controls.target.z }
        });
      }
      this.uiStore.update({ isInteracting: false });
    });

    this._boundOnResize = this.onResize.bind(this);
    window.addEventListener("resize", this._boundOnResize);
  }

  renderTile({ totalWidth, totalHeight, offsetX, offsetY, tileWidth, tileHeight, alpha, animatedC, fractalParams, materialParams }) {
    this.camera.setViewOffset(totalWidth, totalHeight, offsetX, offsetY, tileWidth, tileHeight);
    this.updateUniforms(animatedC, fractalParams, materialParams);
    if (this.material) {
      this.material.uniforms.u_bgAlpha.value = alpha;
    }
    this.renderer.render(this.scene, this.camera);
  }

  resetViewOffset(originalAspect) {
    this.camera.clearViewOffset();
    this.camera.aspect = originalAspect;
    this.camera.updateProjectionMatrix();
  }

  restoreCameraFromSnapshot(cameraSnapshot) {
    const { position, target } = cameraSnapshot;
    this.camera.position.set(position.x, position.y, position.z);
    this.controls.target.set(target.x, target.y, target.z);
    this.controls.update();
    this.renderState.needsRender = true;
  }

  getOrCreateMaterial(qualityLevel) {
    if (this.materialPool[qualityLevel]) return this.materialPool[qualityLevel];
    const material = JuliaMaterialFactory.create(qualityLevel, this.config);
    this.materialPool[qualityLevel] = material;
    return material;
  }

  setPixelRatio(ratio) {
    this.currentPixelRatio = Math.max(0.35, Math.min(ratio, this.maxPixelRatio));
    if (this.renderer) {
      this.renderer.setPixelRatio(this.currentPixelRatio);
      this.updateResolution();
    }
  }

  setQuality(qualityLevel) {
    const oldMaterial = this.material;
    this.material = this.getOrCreateMaterial(qualityLevel);

    if (this.material !== oldMaterial && this.mesh) {
      this.mesh.material = this.material;
    }

    if (qualityLevel === "HIGH" || qualityLevel === "EXPORT") {
      this.setPixelRatio(this.maxPixelRatio);
    } else if (qualityLevel === "XR") {
      this.setPixelRatio(0.55);
    }

    this.renderState.needsRender = true;
    this.updateResolution();
  }

  onResize() {
    if (this.isDownloading) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.updateResolution();
  }

  updateResolution() {
    if (this.isDownloading) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    if (Math.max(w, h) > this.config.MAX_RENDER_SIZE) {
      const scale = this.config.MAX_RENDER_SIZE / Math.max(w, h);
      w = Math.floor(w * scale);
      h = Math.floor(h * scale);
    }
    this.renderer.setSize(w, h, false);
    if (this.material) {
      this.material.uniforms.u_resolution.value.set(w, h);
    }
    this.renderState.needsRender = true;
  }

  updateUniforms(animatedC, fractalParams, materialParams) {
    const u = this.mesh.material.uniforms;

    u.u_c.value.set(animatedC.cx, animatedC.cy, animatedC.cz, animatedC.cw);
    u.u_brightness.value = materialParams.brightness;
    u.u_aoPower.value = materialParams.aoPower;
    u.u_specular.value = materialParams.specular;
    u.u_bgColor.value.set(materialParams.bgColor);
    u.u_bgAlpha.value = materialParams.bgAlpha !== undefined ? materialParams.bgAlpha : 1.0;
    u.u_hsvColor.value.set(materialParams.hue, materialParams.saturation, 1.0);

    // fovをfractalParamsから正しく取得し、物理カメラに反映
    if (fractalParams.fov !== undefined && this.camera.fov !== fractalParams.fov) {
      this.camera.fov = fractalParams.fov;
      this.camera.updateProjectionMatrix();
    }
    if (materialParams.zoom !== undefined && this.camera.zoom !== materialParams.zoom) {
      this.camera.zoom = materialParams.zoom;
      this.camera.updateProjectionMatrix();
    }

    this.tempEuler.set(fractalParams.rotX, fractalParams.rotY, fractalParams.rotZ, "XYZ");
    this.matRot3D.makeRotationFromEuler(this.tempEuler);

    const cxw = Math.cos(fractalParams.rotXW), sxw = Math.sin(fractalParams.rotXW);
    const cyw = Math.cos(fractalParams.rotYW), syw = Math.sin(fractalParams.rotYW);
    const czw = Math.cos(fractalParams.rotZW), szw = Math.sin(fractalParams.rotZW);

    this.matRot4D_XW.set(cxw, 0, 0, -sxw, 0, 1, 0, 0, 0, 0, 1, 0, sxw, 0, 0, cxw);
    this.matRot4D_YW.set(1, 0, 0, 0, 0, cyw, 0, -syw, 0, 0, 1, 0, 0, syw, 0, cyw);
    this.matRot4D_ZW.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, czw, -szw, 0, 0, szw, czw);
    this.matRot4D_ZW.multiply(this.matRot4D_YW).multiply(this.matRot4D_XW);

    u.u_rotMatrix_3D.value.copy(this.matRot3D);
    u.u_rotMatrix_4D.value.copy(this.matRot4D_ZW);

    u.u_cameraPos.value.copy(this.camera.position);
    u.u_cameraWorldMatrix.value.copy(this.camera.matrixWorld);
    u.u_cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);

    if (this.xrManager) {
      this.xrManager.updateUniforms(u);
    }
  }

  requestRender() {
    this.renderState.needsRender = true;
  }

  animate(getAppState) {
    this.renderer.setAnimationLoop(() => {
      this.timer.update();
      const delta = this.timer.getDelta();

      if (this.xrManager) {
        this.xrManager.update(delta);
      }

      if (this.onTick) this.onTick(delta);

      const isVR = this.renderer.xr.isPresenting;
      const { isDownloading, isAutoAnimating } = getAppState();

      this.renderState.fpsFrames++;
      const now = performance.now();
      if (now >= this.renderState.fpsLastTime + 1000) {
        const fps = Math.round((this.renderState.fpsFrames * 1000) / (now - this.renderState.fpsLastTime));

        // --- Adaptive Quality (P1) ---
        const isVR = this.renderer.xr.isPresenting;
        const { isDownloading, isAutoAnimating } = getAppState();

        if (!isDownloading && (isAutoAnimating || this.renderState.needsRender || isVR)) {
          if (fps < 30) {
            const nextRatio = Math.max(0.35, this.currentPixelRatio - 0.15);
            if (nextRatio !== this.currentPixelRatio) {
              this.setPixelRatio(nextRatio);
              console.log(`[Adaptive Quality] FPS dropped to ${fps}. Reducing pixel ratio to ${this.currentPixelRatio.toFixed(2)}`);
            }
          } else if (fps > 55) {
            const targetMax = isVR ? 0.55 : this.maxPixelRatio;
            const nextRatio = Math.min(targetMax, this.currentPixelRatio + 0.05);
            if (nextRatio !== this.currentPixelRatio) {
              this.setPixelRatio(nextRatio);
              console.log(`[Adaptive Quality] FPS is healthy (${fps}). Increasing pixel ratio to ${this.currentPixelRatio.toFixed(2)}`);
            }
          }
        }
        // ------------------------------

        if (this.onFpsUpdate) {
          const isIdle = !isDownloading && !isAutoAnimating && !this.renderState.needsRender && !isVR;
          this.onFpsUpdate(fps, isIdle);
        }
        this.renderState.fpsFrames = 0;
        this.renderState.fpsLastTime = now;
      }

      if (isDownloading || (!isAutoAnimating && !this.renderState.needsRender && !isVR)) return;

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

      if (this.onBeforeUpdateUniforms) {
        this.onBeforeUpdateUniforms(this);
      }
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