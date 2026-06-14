import * as THREE from "three";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/examples/jsm/webxr/XRHandModelFactory.js";

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
  }

  init() {
    this.threeRenderer.xr.addEventListener("sessionstart", () => {
      this.activeSession = this.threeRenderer.xr.getSession();

      // セッション開始時のフラクタルパラメータをディープコピーして保存
      const currentParams = this.domainStore.getParams("fractal");
      this.initialFractalParams = currentParams ? { ...currentParams } : null;

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
    const session = this.threeRenderer.xr.getSession();
    if (!session) return;

    // 1. 直接掴み（グラブ＆ドラッグ）および両手拡大縮小の更新処理
    this.updateDragInteraction();

    // 2. アナログスティック入力の更新処理 (補助操作用として維持)
    this.updateJoystickInput(session, delta);
  }

  updateDragInteraction() {
    const isScreenTouch0 = this.dragging[0] && this.threeRenderer.xr.getController(0).inputSource && this.threeRenderer.xr.getController(0).inputSource.targetRayMode === 'screen';
    const isScreenTouch1 = this.dragging[1] && this.threeRenderer.xr.getController(1).inputSource && this.threeRenderer.xr.getController(1).inputSource.targetRayMode === 'screen';
    const isScreenTouch = isScreenTouch0 || isScreenTouch1;

    if (isScreenTouch) {
      const activeTouchCount = (this.dragging[0] ? 1 : 0) + (this.dragging[1] ? 1 : 0);
      
      if (this.lastActiveTouchCount === undefined) {
        this.lastActiveTouchCount = 0;
      }
      const touchCountChanged = activeTouchCount !== this.lastActiveTouchCount;
      this.lastActiveTouchCount = activeTouchCount;

      // スマホAR（画面タッチ）のインタラクション
      if (activeTouchCount === 2) {
        // 2本指タッチ：ピンチズーム（拡大縮小）
        const c0 = this.threeRenderer.xr.getController(0);
        const c1 = this.threeRenderer.xr.getController(1);
        const dir0 = this.getControllerDirection(c0);
        const dir1 = this.getControllerDirection(c1);
        const currentDist = dir0.distanceTo(dir1);

        if (touchCountChanged) {
          // タッチ数が2に変化した瞬間、基準距離と基準スケールをリセット
          this.initialTwoHandDist = currentDist;
          this.startVrScale = this.vrScale;
        }

        if (this.initialTwoHandDist && this.initialTwoHandDist > 0.001) {
          const ratio = currentDist / this.initialTwoHandDist;
          this.vrScale = Math.max(0.05, Math.min(this.maxVrScale, this.startVrScale * ratio));
        }
        if (this.onInteraction) this.onInteraction();
      } else if (activeTouchCount === 1) {
        // 1本指タッチ：スワイプ回転
        const id = this.dragging[0] ? 0 : 1;
        const c = this.threeRenderer.xr.getController(id);
        const currentDirection = this.getControllerDirection(c);

        // タッチ数が変化した直後のフレームは、前の指の方向からのジャンプを防ぐため
        // 回転量の計算は行わず、lastDirection の同期のみ行う
        if (!touchCountChanged && this.lastDirection) {
          const diff = new THREE.Vector3().subVectors(currentDirection, this.lastDirection);
          
          // カメラの右・上ベクトルを基準にしてドラッグ方向を求める
          const xrCamera = this.threeRenderer.xr.getCamera();
          const right = new THREE.Vector3(1, 0, 0);
          const up = new THREE.Vector3(0, 1, 0);
          
          if (xrCamera) {
            const tempCamMatrix = new THREE.Matrix4();
            tempCamMatrix.extractRotation(xrCamera.matrixWorld);
            right.applyMatrix4(tempCamMatrix).normalize();
            up.applyMatrix4(tempCamMatrix).normalize();
          }

          const diffX = diff.dot(right);
          const diffY = diff.dot(up);

          const sensitivity = 5.0;
          const params = this.domainStore.getParams("fractal");
          const nextRotX = params.rotX - diffY * sensitivity;
          const nextRotY = params.rotY + diffX * sensitivity;

          this.domainStore.updateParams("fractal", {
            rotX: nextRotX,
            rotY: nextRotY
          });
        }
        this.lastDirection = currentDirection.clone();
        if (this.onInteraction) this.onInteraction();
      }
      return;
    }

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

      const hasChangedX = xVal !== 0.0;
      const hasChangedY = yVal !== 0.0;
      const side = source.handedness === "right" ? 0 : 1;

      if (hasChangedX || hasChangedY) {
        this.isJoystickOperating[side] = true;
        const morphSpeed = 0.8 * delta;
        const params = this.domainStore.getParams("fractal");

        if (source.handedness === "right") {
          if (hasChangedX) {
            const nextCx = Math.max(-2.0, Math.min(2.0, params.cx + xVal * morphSpeed));
            if (this.dispatcher) {
              this.dispatcher.dispatch("UPDATE_PARAM_INPUT", { category: "fractal", key: "cx", value: nextCx });
            }
          }
          if (hasChangedY) {
            const nextCy = Math.max(-2.0, Math.min(2.0, params.cy - yVal * morphSpeed));
            if (this.dispatcher) {
              this.dispatcher.dispatch("UPDATE_PARAM_INPUT", { category: "fractal", key: "cy", value: nextCy });
            }
          }
        } else if (source.handedness === "left") {
          if (hasChangedX) {
            const nextCz = Math.max(-2.0, Math.min(2.0, params.cz + xVal * morphSpeed));
            if (this.dispatcher) {
              this.dispatcher.dispatch("UPDATE_PARAM_INPUT", { category: "fractal", key: "cz", value: nextCz });
            }
          }
          if (hasChangedY) {
            const nextCw = Math.max(-2.0, Math.min(2.0, params.cw - yVal * morphSpeed));
            if (this.dispatcher) {
              this.dispatcher.dispatch("UPDATE_PARAM_INPUT", { category: "fractal", key: "cw", value: nextCw });
            }
          }
        }
      } else {
        if (this.isJoystickOperating[side]) {
          this.isJoystickOperating[side] = false;
          if (this.dispatcher) {
            this.dispatcher.dispatch("COMMIT_HISTORY");
          }
        }
      }

      // A/X ボタン (Index 4) と B/Y ボタン (Index 5) の検知
      const buttons = source.gamepad.buttons;
      
      // A/Xボタン (Index 4) - 押されている間はリセットを実行（クールダウンは関数側で制御）
      if (buttons.length > 4 && buttons[4] && buttons[4].pressed) {
        this.resetFractalPosition();
      }

      // B/Yボタン (Index 5) - 押されている間はランダム化を実行（クールダウンは関数側で制御）
      if (buttons.length > 5 && buttons[5] && buttons[5].pressed) {
        this.randomizeFractal();
      }
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
