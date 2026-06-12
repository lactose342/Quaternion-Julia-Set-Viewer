import * as THREE from "three";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/examples/jsm/webxr/XRHandModelFactory.js";

/**
 * WebXR / AR セッションおよびインタラクションを統合管理するヘルパーサービス
 */
export class XRManager {
  constructor(threeRenderer, scene, domainStore, uiStore, config) {
    this.threeRenderer = threeRenderer;
    this.scene = scene;
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.config = config;

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

    // コールバック
    this.onSessionStart = null;
    this.onSessionEnd = null;
    this.onInteraction = null;
  }

  init() {
    this.threeRenderer.xr.addEventListener("sessionstart", () => {
      this.activeSession = this.threeRenderer.xr.getSession();

      // ARパススルーセッションかどうかを判定（environmentBlendModeで確実に判定）
      this.isAR = this.activeSession.environmentBlendMode && this.activeSession.environmentBlendMode !== "opaque";

      // ARモードなら背景色を強制的に完全透過する
      if (this.isAR) {
        const materialParams = this.domainStore.getParams("material");
        this.originalBgAlpha = materialParams.bgAlpha !== undefined ? materialParams.bgAlpha : 1.0;
        this.domainStore.updateParams("material", { bgAlpha: 0.0 });
      }

      // ARとVRでの表示設定（ARではコントローラー・手モデルを非表示にし、ポインター線のみにする）
      // ※ 親要素（Grip/Hand自体）のvisibleはThree.jsのWebXR更新ループにより毎フレーム自動上書きされるため、
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
      this.activeSession = null;
      if (this.isAR) {
        // 背景透過度を元の状態に復元
        this.domainStore.updateParams("material", { bgAlpha: this.originalBgAlpha });
      }
      this.isAR = false;

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

  onSelectStart(id, controller) {
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

    this.dragging[id] = true;

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
    const session = this.threeRenderer.xr.getSession();
    if (!session) return;

    // 1. 直接掴み（グラブ＆ドラッグ）および両手拡大縮小の更新処理
    this.updateDragInteraction();

    // 2. アナログスティック入力の更新処理 (補助操作用として維持)
    this.updateJoystickInput(session, delta);
  }

  updateDragInteraction() {
    // 【両手でのピンチ / 拡大縮小 ＆ 位置調整】
    if (this.dragging[0] && this.dragging[1]) {
      const c0 = this.threeRenderer.xr.getController(0);
      const c1 = this.threeRenderer.xr.getController(1);
      const currentDist = c0.position.distanceTo(c1.position);

      if (this.initialTwoHandDist && this.initialTwoHandDist > 0.01) {
        const ratio = currentDist / this.initialTwoHandDist;
        this.vrScale = Math.max(0.05, Math.min(this.maxVrScale, this.startVrScale * ratio));
      }

      // 位置は両手の中間点に配置する
      const midpoint = new THREE.Vector3().addVectors(c0.position, c1.position).multiplyScalar(0.5);
      this.vrOffset.x = midpoint.x;
      this.vrOffset.y = midpoint.y;
      this.vrOffset.z = midpoint.z;

      if (this.onInteraction) this.onInteraction();
      return;
    }

    // 【片手でのグラブ・直接操作 (6-DoFトランスフォーム追従)】
    for (let id = 0; id < 2; id++) {
      if (!this.dragging[id]) continue;

      const c = this.threeRenderer.xr.getController(id);
      const relativeMatrix = this.grabRelativeMatrix[id];
      if (!relativeMatrix) continue;

      // コントローラーの現在の位置・回転をフラクタルの行列に掛け合わせて新しいワールド行列を計算
      c.updateMatrixWorld(true);
      const newFractalMatrix = c.matrixWorld.clone().multiply(relativeMatrix);

      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      newFractalMatrix.decompose(position, rotation, scale);

      // ワールド位置（Offset）の更新
      this.vrOffset.x = position.x;
      this.vrOffset.y = position.y;
      this.vrOffset.z = position.z;

      // クォータニオンからオイラー角を復元し、ドメインストア（3D回転）を更新
      const euler = new THREE.Euler().setFromQuaternion(rotation, "XYZ");
      this.domainStore.updateParams("fractal", {
        rotX: euler.x,
        rotY: euler.y,
        rotZ: euler.z
      });

      if (this.onInteraction) this.onInteraction();
    }
  }

  updateJoystickInput(session, delta) {
    const speed = 1.5 * delta;
    const scaleSpeed = 0.5 * delta;

    // デバッグ用のログ出力 (2秒おきに入力デバイス状況を出力)
    if (!this._lastLogTime || performance.now() - this._lastLogTime > 2000) {
      console.log(`[XRManager] 接続デバイス数: ${session.inputSources.length}`);
      for (const source of session.inputSources) {
        console.log(` - 手: ${source.handedness}, Gamepad: ${!!source.gamepad}, HandTracking: ${!!source.hand}`);
      }
      this._lastLogTime = performance.now();
    }

    for (const source of session.inputSources) {
      if (!source.gamepad) continue;

      const axes = source.gamepad.axes;
      if (axes.length < 2) continue;

      // Meta Quest 等の標準コントローラー（xr-standard）では、スティック入力は axes[2]/axes[3] に割り当てられます。
      // axes の数が4未満の場合はフォールバックとして axes[0]/axes[1] を使用します。
      const hasThumbstick = axes.length >= 4;
      const xIdx = hasThumbstick ? 2 : 0;
      const yIdx = hasThumbstick ? 3 : 1;

      const deadzone = 0.15;
      const xVal = Math.abs(axes[xIdx]) > deadzone ? axes[xIdx] : 0.0;
      const yVal = Math.abs(axes[yIdx]) > deadzone ? axes[yIdx] : 0.0;

      if (source.handedness === "right") {
        const params = this.domainStore.getParams("fractal");
        let hasChanged = false;
        const payload = {};

        if (xVal !== 0.0) {
          let rotY = params.rotY + xVal * speed;
          rotY = (rotY + Math.PI * 2) % (Math.PI * 2);
          payload.rotY = rotY;
          hasChanged = true;
        }
        if (yVal !== 0.0) {
          let rotX = params.rotX - yVal * speed;
          rotX = (rotX + Math.PI * 2) % (Math.PI * 2);
          payload.rotX = rotX;
          hasChanged = true;
        }

        if (hasChanged) {
          this.domainStore.updateParams("fractal", payload);
        }
      } else if (source.handedness === "left") {
        let hasFractalChanged = false;
        const fractalPayload = {};

        if (xVal !== 0.0) {
          const params = this.domainStore.getParams("fractal");
          let rotZW = params.rotZW + xVal * speed;
          rotZW = (rotZW + Math.PI * 2) % (Math.PI * 2);
          fractalPayload.rotZW = rotZW;
          hasFractalChanged = true;
        }

        if (hasFractalChanged) {
          this.domainStore.updateParams("fractal", fractalPayload);
        }

        if (yVal !== 0.0) {
          this.vrScale = Math.max(0.05, Math.min(this.maxVrScale, this.vrScale - yVal * scaleSpeed));
          if (this.onInteraction) this.onInteraction();
        }
      }
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
