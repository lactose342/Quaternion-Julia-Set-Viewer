import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VRButton } from "@/ui/views/VRButton.js";
import { JuliaMaterialFactory } from "@/infra/factories/JuliaMaterialFactory.js";
import { XRManager } from "@/infra/XRManager.js";
import { AdaptiveQualityManager } from "@/infra/AdaptiveQualityManager.js";

export class Renderer {
  constructor(domainStore, uiStore, config, dispatcher) {
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.config = config;
    this.dispatcher = dispatcher;
    this.xrManager = null;

    this.renderState = {
      needsRender: true,
      renderTimer: null,
      lastRenderTime: 0,
    };

    this.timer = new THREE.Timer();
    this.uiElements = { fpsCounter: null };

    this.tempEuler = new THREE.Euler(0, 0, 0, "XYZ");
    this.matRot3D = new THREE.Matrix4();
    this.matRot4D_XW = new THREE.Matrix4();
    this.matRot4D_YW = new THREE.Matrix4();
    this.matRot4D_ZW = new THREE.Matrix4();
    this.matRotCombined = new THREE.Matrix4();

    this.cameraWorldPos = new THREE.Vector3();
    this.animatedC = { cx: 0, cy: 0, cz: 0, cw: 0 };
    this.materialPool = {};

    this.onCameraChange = null;
    this.onFpsUpdate = null;
    this.onFirstRender = null;
    this.captureCallback = null;
    this.isDownloading = false;

    this.maxPixelRatio = 2.0;
    this.currentPixelRatio = this.maxPixelRatio;
    this.qualityManager = new AdaptiveQualityManager(this.config);

    this.isLoopRunning = false;
    this.getAppState = null;
    this.loopCallback = this.tick.bind(this);
  }

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 0, 2);

    const _xrWebGLBinding = window.XRWebGLBinding;
    window.XRWebGLBinding = undefined;
    this.renderer = new THREE.WebGLRenderer({
      preserveDrawingBuffer: false,
      alpha: true,
      powerPreference: "high-performance"
    });
    window.XRWebGLBinding = _xrWebGLBinding;

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(this.currentPixelRatio);
    THREE.ColorManagement.enabled = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setFoveation(1.0);

    document.body.appendChild(VRButton.createButton(this.renderer));

    this.xrManager = new XRManager(this.renderer, this.scene, this.domainStore, this.uiStore, this.config, this.dispatcher);
    this.xrManager.onSessionStart = () => {
      this.setQuality("XR");
      this.setPixelRatio(0.55);
      this.renderer.xr.setFoveation(1.0);
    };
    this.xrManager.onSessionEnd = () => {
      this.setPixelRatio(this.maxPixelRatio);
      this.setQuality("HIGH");
    };
    this.xrManager.onInteraction = () => {
      this.renderState.needsRender = true;
      this.startLoop();
    };
    this.xrManager.init();

    document.body.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = true;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 6.0;

    this.setQuality("HIGH");

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;

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
      this.startLoop();
    });

    this.controls.addEventListener("start", () => {
      if (this._dollyTimeout) {
        clearTimeout(this._dollyTimeout);
        this._dollyTimeout = null;
      }
      this.uiStore.update({ isInteracting: true });
      this.startLoop();
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

    this._boundOnWheel = () => {
      if (this.uiStore.getState().isInteracting) {
        if (this._dollyTimeout) {
          clearTimeout(this._dollyTimeout);
          this._dollyTimeout = null;
        }
        return;
      }
      this.uiStore.update({ isInteracting: true });
      this.startLoop();

      if (this._dollyTimeout) {
        clearTimeout(this._dollyTimeout);
      }
      this._dollyTimeout = setTimeout(() => {
        this.uiStore.update({ isInteracting: false });
        this._dollyTimeout = null;
      }, 500);
    };

    this.renderer.domElement.addEventListener("wheel", this._boundOnWheel, { passive: true });

    this._boundOnResize = this.onResize.bind(this);
    window.addEventListener("resize", this._boundOnResize);
  }

  renderTile({ totalWidth, totalHeight, offsetX, offsetY, tileWidth, tileHeight, alpha, animatedC, fractalParams, materialParams, cameraParams }) {
    this.camera.setViewOffset(totalWidth, totalHeight, offsetX, offsetY, tileWidth, tileHeight);
    this.updateUniforms(animatedC, fractalParams, materialParams, cameraParams);
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

  captureNextFrame() {
    this.renderState.needsRender = true;
    this.startLoop();
    return new Promise((resolve) => {
      this.captureCallback = (blob) => {
        resolve(blob);
      };
    });
  }

  startExportMode(aspect, tileW, tileH) {
    this.isDownloading = true;
    this.controls.enabled = false;
    this.stopLoop();
    this.setQuality("EXPORT");
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(tileW, tileH, false);
  }

  endExportMode(originalQuality, originalAspect) {
    this.resetViewOffset(originalAspect);
    this.isDownloading = false;
    this.setQuality(originalQuality);
    this.controls.enabled = true;
    this.renderState.needsRender = true;
    this.startLoop();
  }

  restoreCameraFromSnapshot(cameraSnapshot) {
    const { position, target } = cameraSnapshot;
    this.camera.position.set(position.x, position.y, position.z);
    this.controls.target.set(target.x, target.y, target.z);
    this.controls.update();
    this.renderState.needsRender = true;
    this.startLoop();
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

    // ループが走っていない静止時、かつメッシュ初期化後は品質切り替え後に1回だけ同期的に再描画する
    if (this.mesh && !this.isLoopRunning && this.renderer && !this.renderer.xr.isPresenting) {
      if (this.onBeforeUpdateUniforms) {
        this.onBeforeUpdateUniforms(this);
      }
      this.renderer.render(this.scene, this.camera);
      this.renderState.needsRender = false;
    }
  }

  onResize() {
    if (this.isDownloading) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.updateResolution();
    this.startLoop();
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

  updateUniforms(animatedC, fractalParams, materialParams, cameraParams) {
    const u = this.mesh.material.uniforms;

    u.u_c.value.set(animatedC.cx, animatedC.cy, animatedC.cz, animatedC.cw);
    u.u_brightness.value = materialParams.brightness;
    u.u_aoPower.value = materialParams.aoPower;
    u.u_specular.value = materialParams.specular;
    u.u_bgColor.value.set(materialParams.bgColor);
    u.u_bgAlpha.value = materialParams.bgAlpha !== undefined ? materialParams.bgAlpha : 1.0;
    const val = materialParams.value !== undefined ? materialParams.value : 1.0;
    u.u_hsvColor.value.set(materialParams.hue, materialParams.saturation, val);

    // fovとzoomをcameraParamsから正しく取得し、物理カメラに反映
    if (cameraParams) {
      if (cameraParams.fov !== undefined && this.camera.fov !== cameraParams.fov) {
        this.camera.fov = cameraParams.fov;
        this.camera.updateProjectionMatrix();
      }
      if (cameraParams.zoom !== undefined && this.camera.zoom !== cameraParams.zoom) {
        this.camera.zoom = cameraParams.zoom;
        this.camera.updateProjectionMatrix();
      }
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
    this.matRotCombined.multiplyMatrices(this.matRot4D_ZW, this.matRot3D);
    u.u_rotMatrix_Combined.value.copy(this.matRotCombined);

    u.u_cameraPos.value.copy(this.camera.position);
    u.u_cameraWorldMatrix.value.copy(this.camera.matrixWorld);
    u.u_cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);

    if (this.xrManager) {
      this.xrManager.updateUniforms(u);
    }
  }

  requestRender() {
    this.renderState.needsRender = true;
    this.startLoop();
  }

  startLoop() {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    // Reset FPS counter tracking to ignore the idle sleep time
    if (this.qualityManager) {
      this.qualityManager.fpsFrames = 0;
      this.qualityManager.fpsLastTime = performance.now();
    }
    this.renderState.lastRenderTime = 0;

    // Reset the timer's previous timestamp to prevent delta spike upon resuming
    if (this.timer) {
      this.timer.update();
    }

    if (this.onFpsUpdate) {
      const currentFps = this.qualityManager ? this.qualityManager.getFps(false) : 60;
      this.onFpsUpdate(currentFps || 60, false);
    }

    this.renderer.setAnimationLoop(this.loopCallback);
  }

  stopLoop() {
    if (!this.isLoopRunning) return;
    this.isLoopRunning = false;
    this.renderer.setAnimationLoop(null);
    if (this.onFpsUpdate) {
      this.onFpsUpdate(0, true);
    }
  }

  tick() {
    const isVR = this.renderer.xr.isPresenting;
    const { isDownloading, isAutoAnimating } = this.getAppState ? this.getAppState() : { isDownloading: false, isAutoAnimating: false };
    const isInteracting = this.uiStore.getState().isInteracting;
    const isActive = isAutoAnimating || isInteracting;
    const now = performance.now();

    // Cap normal screen rendering at 60 FPS (approx 16ms per frame) to prevent GPU queue clogging on high-refresh monitors
    if (!isVR && isActive && this.renderState.lastRenderTime) {
      const elapsed = now - this.renderState.lastRenderTime;
      if (elapsed < 15.0) {
        return;
      }
    }

    this.timer.update();
    const delta = this.timer.getDelta();

    if (this.xrManager) {
      this.xrManager.update(delta);
    }

    if (this.onTick) this.onTick(delta);

    // 静止時（操作もアニメーションもしていない、かつ非VR）は、最高画質(maxPixelRatio)に復帰させて描画する
    if (!isActive && !isVR && !isDownloading) {
      if (this.currentPixelRatio !== this.maxPixelRatio) {
        this.setPixelRatio(this.maxPixelRatio);
        this.renderState.needsRender = true;
      }
    }

    // Adaptive Quality & FPS update delegated to AdaptiveQualityManager
    if (this.qualityManager) {
      const nextRatio = this.qualityManager.update(
        this.currentPixelRatio,
        this.maxPixelRatio,
        { isDownloading, isAutoAnimating, isInteracting, isVR },
        (fps) => {
          if (this.onFpsUpdate) {
            this.onFpsUpdate(fps, false);
          }
        }
      );

      if (nextRatio !== null) {
        this.setPixelRatio(nextRatio);
      }
    }

    const needsRenderThisFrame = !isDownloading && (isAutoAnimating || this.renderState.needsRender || isInteracting || isVR);

    if (needsRenderThisFrame) {
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
      if (this.captureCallback) {
        const cb = this.captureCallback;
        this.captureCallback = null;
        this.renderer.domElement.toBlob((blob) => {
          cb(blob);
        }, "image/png");
      }
      if (this.onFirstRender) {
        this.onFirstRender();
        this.onFirstRender = null;
      }
      if (this.qualityManager) {
        this.qualityManager.fpsFrames++;
      }
      this.renderState.needsRender = false;
      this.renderState.lastRenderTime = now;
    }

    const needsLoopNextFrame = isVR || isAutoAnimating || this.renderState.needsRender || isInteracting;
    if (!needsLoopNextFrame) {
      this.stopLoop();
    }
  }

  animate(getAppState) {
    this.getAppState = getAppState;
    this.startLoop();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("resize", this._boundOnResize);
    if (this._boundOnWheel && this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener("wheel", this._boundOnWheel);
    }
    if (this._dollyTimeout) {
      clearTimeout(this._dollyTimeout);
    }
    this.controls.dispose();
    if (this.mesh && this.mesh.geometry) this.mesh.geometry.dispose();
    Object.keys(this.materialPool).forEach((key) => {
      this.materialPool[key].dispose();
    });
    this.renderer.dispose();
  }
}