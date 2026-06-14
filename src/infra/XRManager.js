import * as THREE from "three";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/examples/jsm/webxr/XRHandModelFactory.js";
import { XRInputProcessor } from "./XRInputProcessor.js";

/**
 * WebXR / AR セッションおよびインタラクションを統合管理するヘルパーサービス
 */
export class XRManager {
  constructor(threeRenderer, scene, domainStore, uiStore, config, dispatcher) {
    this.threeRenderer = threeRenderer;
    this.scene = scene;
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.config = config;
    this.dispatcher = dispatcher;

    // VR/AR用の初期設定 (高さをさらに引き上げ: y を -0.05 から 0.05 へ変更)
    this.vrScale = 0.3;
    this.maxVrScale = 1.0; // 拡大の上限値
    this.vrOffset = { x: 0.0, y: 1.0, z: -1.2 };

    this.activeSession = null;
    this.isAR = false;
    this.originalBgAlpha = 1.0;

    // AR/VRでのモデル表示制御用
    this.controllerGrips = [];
    this.handModels = [];

    // ドラッグ・掴み（グラブ）インタラクションの状態管理
    this.dragging = [false, false];
    this.startPos = [null, null];
    this.grabRelativeMatrix = [null, null]; // コントローラーとフラクタルの相対トランスフォーム行列
    this.startVrScale = 1.0;
    this.initialTwoHandDist = null;
    this.lastActiveTouchCount = 0;

    // ジョイスティック操作の状態管理
    this.isJoystickOperating = [false, false];

    // コールバック
    this.onSessionStart = null;
    this.onSessionEnd = null;
    this.onInteraction = null;

    // セッション開始時のフラクタルパラメータを保存する領域
    this.initialFractalParams = null;
    this.domTouchCount = 0;
    this.lastDomPinchDist = null;
    this.inputProcessor = new XRInputProcessor(this);

    // AR用オーバーレイコントロール
    this.arControls = null;
    this.arExitBtn = null;
  }

  init() {
    this.arControls = document.getElementById("ar-controls");
    this.arExitBtn = document.getElementById("ar-exit-btn");

    this.threeRenderer.xr.addEventListener("sessionstart", () => {
      this.activeSession = this.threeRenderer.xr.getSession();

      // セッション開始時のフラクタルパラメータをディープコピーして保存
      const currentParams = this.domainStore.getParams("fractal");
      this.initialFractalParams = currentParams ? { ...currentParams } : null;

      // ARパススルーセッションかどうかを判定（environmentBlendModeで確実に判定）
      this.isAR = this.activeSession.environmentBlendMode && this.activeSession.environmentBlendMode !== "opaque";

      // ARモードなら背景色を強制的に完全透過する
      if (this.isAR) {
        document.body.classList.add("xr-ar-mode");
        const materialParams = this.domainStore.getParams("material");
        this.originalBgAlpha = materialParams.bgAlpha !== undefined ? materialParams.bgAlpha : 1.0;
        this.domainStore.updateParams("material", { bgAlpha: 0.0 });

        // ARコントロールの表示とイベント設定
        if (this.arControls) {
          this.arControls.classList.remove("hidden");
        }
        if (this.arExitBtn) {
          this.arExitBtn.onclick = () => {
            if (this.activeSession) {
              this.activeSession.end();
            }
          };
        }

        // スマホAR用：標準のDOMタッチイベント（マルチタッチ・ピンチ）をハンドリングして奥行き移動
        this.domTouchCount = 0;
        this.lastDomPinchDist = null;

        this._onTouchStart = (e) => {
          this.domTouchCount = e.touches.length;
          if (this.domTouchCount === 2) {
            const t0 = e.touches[0];
            const t1 = e.touches[1];
            this.lastDomPinchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
          } else {
            this.lastDomPinchDist = null;
          }
        };

        this._onTouchMove = (e) => {
          this.domTouchCount = e.touches.length;
          if (this.domTouchCount === 2 && this.lastDomPinchDist !== null) {
            const t0 = e.touches[0];
            const t1 = e.touches[1];
            const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);

            const deltaPixels = dist - this.lastDomPinchDist;
            // 2本指のピンチ感度（1ピクセルあたりの奥行き移動量）
            const sensitivity = 0.005;
            const targetZ = this.vrOffset.z + deltaPixels * sensitivity;
            // 手前は -0.15, 奥は -10.0 をリミットとする
            this.vrOffset.z = Math.max(-10.0, Math.min(-0.15, targetZ));

            this.lastDomPinchDist = dist;
            if (this.onInteraction) this.onInteraction();

            if (e.cancelable) {
              e.preventDefault();
            }
          }
        };

        this._onTouchEnd = (e) => {
          this.domTouchCount = e.touches.length;
          if (this.domTouchCount === 2) {
            const t0 = e.touches[0];
            const t1 = e.touches[1];
            this.lastDomPinchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
          } else {
            this.lastDomPinchDist = null;
          }
        };

        window.addEventListener("touchstart", this._onTouchStart, { passive: false });
        window.addEventListener("touchmove", this._onTouchMove, { passive: false });
        window.addEventListener("touchend", this._onTouchEnd, { passive: false });
        window.addEventListener("touchcancel", this._onTouchEnd, { passive: false });
      }

      // ARとVRでの表示設定（ARではコントローラー・手モデルを非表示にし、ポインター線のみにする）
      // ※ 親要素（Grip/Hand自体）のvisibleはThree.js of WebXR更新ループにより毎フレーム自動上書きされるため、
      // 　独自に追加した子オブジェクト（モデルの実体）のvisibleを直接切り替えます。
      const showModels = !this.isAR;
      this.controllerGrips.forEach((model) => {
        model.visible = showModels;
      });
      this.handModels.forEach((handModel) => {
        handModel.visible = showModels;
      });

      // コールバック
      if (this.onSessionStart) {
        this.onSessionStart();
      }

      if (this.onInteraction) {
        this.onInteraction();
      }
    });

    this.threeRenderer.xr.addEventListener("sessionend", () => {
      document.body.classList.remove("xr-ar-mode");

      // touchイベントリスナーの解除
      if (this._onTouchStart) {
        window.removeEventListener("touchstart", this._onTouchStart);
        window.removeEventListener("touchmove", this._onTouchMove);
        window.removeEventListener("touchend", this._onTouchEnd);
        window.removeEventListener("touchcancel", this._onTouchEnd);
        this._onTouchStart = null;
        this._onTouchMove = null;
        this._onTouchEnd = null;
      }
      this.domTouchCount = 0;

      this.activeSession = null;
      if (this.isAR) {
        // 背景透過度を元の状態に復元
        this.domainStore.updateParams("material", { bgAlpha: this.originalBgAlpha });
      }
      this.isAR = false;

      // ARコントロールの非表示化
      if (this.arControls) {
        this.arControls.classList.add("hidden");
      }

      // セッション終了時にモデルの表示をリセット
      this.controllerGrips.forEach((model) => {
        model.visible = true;
      });
      this.handModels.forEach((handModel) => {
        handModel.visible = true;
      });

      // コールバック
      if (this.onSessionEnd) {
        this.onSessionEnd();
      }

      // VRセッション終了時にデスクトップUIを最新状態に一括同期する
      this.domainStore.dispatchEvent(new CustomEvent("domain-updated", { detail: { type: "ALL" } }));
    });

    // コントローラーや手を表示するための光源を追加 (これらがないとモデルが真っ黒で不可視になります)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(2, 4, 3);
    this.scene.add(dirLight);

    // 1. コントローラーおよびハンドトラッキングモデルの追加
    const controllerModelFactory = new XRControllerModelFactory();
    const handModelFactory = new XRHandModelFactory();

    // 左右のコントローラーと手のバインディング設定
    for (let id = 0; id < 2; id++) {
      const controller = this.threeRenderer.xr.getController(id);
      controller.addEventListener("selectstart", () => this.onSelectStart(id, controller));
      controller.addEventListener("selectend", () => this.onSelectEnd(id));
      controller.addEventListener("squeezestart", () => this.onSelectStart(id, controller));
      controller.addEventListener("squeezeend", () => this.onSelectEnd(id));
      this.scene.add(controller);

      // コントローラーに3Dシリンダー状のポインターレイ（ガイド光線）を追加
      const cylinderGeometry = new THREE.CylinderGeometry(0.002, 0.002, 1, 4);
      cylinderGeometry.rotateX(Math.PI / 2);
      cylinderGeometry.translate(0, 0, -0.5); // 基点がグリップ位置になるように調整
      const cylinderMaterial = new THREE.MeshBasicMaterial({
        color: 0x0055ff,
        transparent: true,
        opacity: 0.5
      });
      const ray = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
      ray.name = "pointer-ray";
      ray.scale.z = 2; // 2メートルのガイド線
      controller.add(ray);

      // コントローラーモデル（Grip）の追加
      const grip = this.threeRenderer.xr.getControllerGrip(id);
      const model = controllerModelFactory.createControllerModel(grip);
      grip.add(model);

      // オフライン・CDNエラー時のフォールバック用に簡易グリップモデルを追加
      const gripGeometry = new THREE.BoxGeometry(0.02, 0.02, 0.08);
      const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
      const gripMesh = new THREE.Mesh(gripGeometry, gripMaterial);
      grip.add(gripMesh);

      this.scene.add(grip);
      this.controllerGrips.push(model);     // 参照を保存（GLTFモデル）
      this.controllerGrips.push(gripMesh);  // 参照を保存（フォールバックボックス）

      // ハンドモデルの追加
      const hand = this.threeRenderer.xr.getHand(id);
      const handModel = handModelFactory.createHandModel(hand, "mesh");
      hand.add(handModel);
      this.scene.add(hand);
      this.handModels.push(handModel); // 参照を保存（子ハンドモデル）
    }
  }

  getControllerDirection(controller) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    return new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix).normalize();
  }

  onSelectStart(id, controller) {
    const isScreenTouch = controller.inputSource && controller.inputSource.targetRayMode === 'screen';

    // スマホARの画面タッチの場合は、球体交差チェックをバイパスする
    if (!isScreenTouch) {
      // コントローラーの光線がフラクタルのバウンディング球に交差しているかチェック
      const sphereCenter = new THREE.Vector3(this.vrOffset.x, this.vrOffset.y, this.vrOffset.z);
      const sphereRadius = 1.5 * this.vrScale;
      const sphere = new THREE.Sphere(sphereCenter, sphereRadius);

      const tempMatrix = new THREE.Matrix4();
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
      const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix).normalize();

      const ray = new THREE.Ray(origin, direction);
      const isIntersecting = ray.intersectsSphere(sphere);

      // 交差していない場合はドラッグ（グラブ）を開始しない
      if (!isIntersecting) {
        return;
      }
    }

    this.dragging[id] = true;

    // スマホARの場合
    if (isScreenTouch) {
      this.lastDirection = this.getControllerDirection(controller);
      this.lastPosition = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
      this.startVrScale = this.vrScale;
      
      // 2点タッチ（拡大縮小）のための初期方向ベクトル距離を記録
      if (this.dragging[0] && this.dragging[1]) {
        const c0 = this.threeRenderer.xr.getController(0);
        const c1 = this.threeRenderer.xr.getController(1);
        const dir0 = this.getControllerDirection(c0);
        const dir1 = this.getControllerDirection(c1);
        this.initialTwoHandDist = dir0.distanceTo(dir1);
      }
      return;
    }

    // 現在のフラクタルのワールドトランスフォーム行列を構築
    const fractalMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3(this.vrOffset.x, this.vrOffset.y, this.vrOffset.z);

    // ドメインストアから現在の3D回転情報を取得してクォータニオンを生成
    const params = this.domainStore.getParams("fractal");
    const euler = new THREE.Euler(params.rotX, params.rotY, params.rotZ, "XYZ");
    const rotation = new THREE.Quaternion().setFromEuler(euler);
    const scale = new THREE.Vector3(this.vrScale, this.vrScale, this.vrScale);

    fractalMatrix.compose(position, rotation, scale);

    // コントローラーの現在のワールド行列を強制更新し、その逆行列を掛けることで「相対位置・回転」を記録
    controller.updateMatrixWorld(true);
    const invControllerMatrix = controller.matrixWorld.clone().invert();
    this.grabRelativeMatrix[id] = invControllerMatrix.multiply(fractalMatrix);

    this.startVrScale = this.vrScale;

    // 両手でピンチ（トリガー引き）している場合、初期手間距離を記録 (拡大縮小用)
    if (this.dragging[0] && this.dragging[1]) {
      const c0 = this.threeRenderer.xr.getController(0);
      const c1 = this.threeRenderer.xr.getController(1);
      this.initialTwoHandDist = c0.position.distanceTo(c1.position);
    }
  }

  onSelectEnd(id) {
    this.dragging[id] = false;
    this.grabRelativeMatrix[id] = null;
    this.initialTwoHandDist = null;
  }

  /**
   * 毎フレームの描画前に呼ばれ、入力の追従を行う
   * @param {number} delta 経過時間 (秒)
   */
  update(delta) {
    if (this.inputProcessor) {
      this.inputProcessor.update(delta);
    }
  }

  resetFractalPosition() {
    // 500msのクールダウンで連続実行を防ぐ
    if (this._lastResetTime && performance.now() - this._lastResetTime < 500) {
      return;
    }
    this._lastResetTime = performance.now();

    this.vrScale = 0.3;
    this.vrOffset = { x: 0.0, y: 1.0, z: -1.2 };
    
    if (this.dispatcher) {
      this.dispatcher.dispatch("RESET_STATE");
    }
    if (this.onInteraction) this.onInteraction();
  }

  randomizeFractal() {
    // 500msのクールダウンで連続実行を防ぐ
    if (this._lastRandomTime && performance.now() - this._lastRandomTime < 500) {
      return;
    }
    this._lastRandomTime = performance.now();

    if (this.dispatcher) {
      this.dispatcher.dispatch("RANDOMIZE");
    }
  }



  /**
   * シェーダーマテリアルのユニフォームに WebXR 用のパラメータを同期させる
   * @param {Object} uniforms THREE.ShaderMaterial の uniforms オブジェクト
   */
  updateUniforms(uniforms) {
    const isPresenting = this.threeRenderer && this.threeRenderer.xr.isPresenting;
    if (uniforms.u_vrScale) {
      uniforms.u_vrScale.value = isPresenting ? this.vrScale : 1.0;
    }
    if (uniforms.u_vrOffset) {
      if (isPresenting) {
        uniforms.u_vrOffset.value.set(this.vrOffset.x, this.vrOffset.y, this.vrOffset.z);
      } else {
        uniforms.u_vrOffset.value.set(0.0, 0.0, 0.0);
      }
    }
  }
}
