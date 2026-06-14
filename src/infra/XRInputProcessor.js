import * as THREE from "three";

export class XRInputProcessor {
  constructor(xrManager) {
    this.xrManager = xrManager;
    this.lastDirection = null;
    this.initialTwoHandDist = null;
    this.lastActiveTouchCount = 0;
  }

  update(delta) {
    const session = this.xrManager.threeRenderer.xr.getSession();
    if (!session) return;

    this.updateDragInteraction();
    this.updateJoystickInput(session, delta);
  }

  updateDragInteraction() {
    const getControllerSafe = (id) => this.xrManager.threeRenderer.xr.getController(id);
    
    const isScreenTouch = (id) => {
      if (!this.xrManager.dragging[id]) return false;
      const c = getControllerSafe(id);
      return c && c.inputSource && c.inputSource.targetRayMode === "screen";
    };

    const screenTouch0 = isScreenTouch(0);
    const screenTouch1 = isScreenTouch(1);
    const isMobileAR = screenTouch0 || screenTouch1;

    if (isMobileAR) {
      const activeTouchCount = (this.xrManager.dragging[0] ? 1 : 0) + (this.xrManager.dragging[1] ? 1 : 0);
      const touchCountChanged = activeTouchCount !== this.lastActiveTouchCount;
      this.lastActiveTouchCount = activeTouchCount;

      // スマホAR（画面タッチ）のインタラクション
      if (activeTouchCount === 2) {
        // 2本指タッチ：3D回転 (rotX, rotY)
        // c0 を代表として回転量を計算
        const c = getControllerSafe(0);
        if (c) {
          const currentDirection = this.xrManager.getControllerDirection(c);

          if (touchCountChanged) {
            // タッチ数が変化した瞬間は基準方向をリセット
            this.lastDirection = currentDirection.clone();
          }

          if (!touchCountChanged && this.lastDirection) {
            const diff = new THREE.Vector3().subVectors(currentDirection, this.lastDirection);
            
            // カメラの右・上ベクトルを基準にしてドラッグ方向を求める
            const xrCamera = this.xrManager.threeRenderer.xr.getCamera();
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
            const params = this.xrManager.domainStore.getParams("fractal");
            const nextRotX = params.rotX - diffY * sensitivity;
            const nextRotY = params.rotY + diffX * sensitivity;

            this.xrManager.domainStore.updateParams("fractal", {
              rotX: nextRotX,
              rotY: nextRotY
            });
          }
          this.lastDirection = currentDirection.clone();
        }
        if (this.xrManager.onInteraction) this.xrManager.onInteraction();

      } else if (activeTouchCount === 1) {
        // 1本指タッチ：平行移動 (vrOffset.x, vrOffset.y)
        const id = this.xrManager.dragging[0] ? 0 : 1;
        const c = getControllerSafe(id);
        if (c) {
          const currentDirection = this.xrManager.getControllerDirection(c);

          if (touchCountChanged) {
            this.lastDirection = currentDirection.clone();
          }

          if (!touchCountChanged && this.lastDirection) {
            const diff = new THREE.Vector3().subVectors(currentDirection, this.lastDirection);
            
            // カメラの右・上ベクトルを基準にして移動方向を求める
            const xrCamera = this.xrManager.threeRenderer.xr.getCamera();
            const right = new THREE.Vector3(1, 0, 0);
            const up = new THREE.Vector3(0, 1, 0);
            
            if (xrCamera) {
              const tempCamMatrix = new THREE.Matrix4();
              tempCamMatrix.extractRotation(xrCamera.matrixWorld);
              right.applyMatrix4(tempCamMatrix).normalize();
              up.applyMatrix4(tempCamMatrix).normalize();
            }

            // カメラからの距離を考慮して平行移動の感度を掛ける
            const sensitivityMove = 2.0; 
            this.xrManager.vrOffset.x += (diff.dot(right) * sensitivityMove);
            this.xrManager.vrOffset.y += (diff.dot(up) * sensitivityMove);
          }
          this.lastDirection = currentDirection.clone();
        }
        if (this.xrManager.onInteraction) this.xrManager.onInteraction();
      }
      return;
    }

    // VR等の通常の 6-DoF 操作
    // 【両手でのピンチ / 拡大縮小 ＆ 位置調整】
    if (this.xrManager.dragging[0] && this.xrManager.dragging[1]) {
      const c0 = getControllerSafe(0);
      const c1 = getControllerSafe(1);
      if (c0 && c1) {
        const currentDist = c0.position.distanceTo(c1.position);

        if (this.xrManager.initialTwoHandDist && this.xrManager.initialTwoHandDist > 0.01) {
          const ratio = currentDist / this.xrManager.initialTwoHandDist;
          this.xrManager.vrScale = Math.max(0.05, Math.min(this.xrManager.maxVrScale, this.xrManager.startVrScale * ratio));
        }

        // 位置は両手の中間点に配置する
        const midpoint = new THREE.Vector3().addVectors(c0.position, c1.position).multiplyScalar(0.5);
        this.xrManager.vrOffset.x = midpoint.x;
        this.xrManager.vrOffset.y = midpoint.y;
        this.xrManager.vrOffset.z = midpoint.z;
      }

      if (this.xrManager.onInteraction) this.xrManager.onInteraction();
      return;
    }

    // 【片手でのグラブ・直接操作 (6-DoFトランスフォーム追従)】
    for (let id = 0; id < 2; id++) {
      if (!this.xrManager.dragging[id]) continue;

      const c = getControllerSafe(id);
      const relativeMatrix = this.xrManager.grabRelativeMatrix[id];
      if (!c || !relativeMatrix) continue;

      // コントローラーの現在の位置・回転をフラクタルの行列に掛け合わせて新しいワールド行列を計算
      c.updateMatrixWorld(true);
      const newFractalMatrix = c.matrixWorld.clone().multiply(relativeMatrix);

      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      newFractalMatrix.decompose(position, rotation, scale);

      // ワールド位置（Offset）の更新
      this.xrManager.vrOffset.x = position.x;
      this.xrManager.vrOffset.y = position.y;
      this.xrManager.vrOffset.z = position.z;

      // クォータニオンからオイラー角を復元し、ドメインストア（3D回転）を更新
      const euler = new THREE.Euler().setFromQuaternion(rotation, "XYZ");
      this.xrManager.domainStore.updateParams("fractal", {
        rotX: euler.x,
        rotY: euler.y,
        rotZ: euler.z
      });

      if (this.xrManager.onInteraction) this.xrManager.onInteraction();
    }
  }

  updateJoystickInput(session, delta) {
    if (!this._lastLogTime || performance.now() - this._lastLogTime > 2000) {
      console.log(`[XRInputProcessor] 接続デバイス数: ${session.inputSources.length}`);
      this._lastLogTime = performance.now();
    }

    for (const source of session.inputSources) {
      if (!source.gamepad) continue;

      const axes = source.gamepad.axes;
      if (axes.length < 2) continue;

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
        this.xrManager.isJoystickOperating[side] = true;
        const morphSpeed = 0.8 * delta;
        const params = this.xrManager.domainStore.getParams("fractal");

        if (source.handedness === "right") {
          if (hasChangedX) {
            const nextCx = Math.max(-2.0, Math.min(2.0, params.cx + xVal * morphSpeed));
            if (this.xrManager.dispatcher) {
              this.xrManager.dispatcher.dispatch("UPDATE_PARAM_INPUT", { category: "fractal", key: "cx", value: nextCx });
            }
          }
          if (hasChangedY) {
            const nextCy = Math.max(-2.0, Math.min(2.0, params.cy - yVal * morphSpeed));
            if (this.xrManager.dispatcher) {
              this.xrManager.dispatcher.dispatch("UPDATE_PARAM_INPUT", { category: "fractal", key: "cy", value: nextCy });
            }
          }
        } else if (source.handedness === "left") {
          if (hasChangedX) {
            const nextCz = Math.max(-2.0, Math.min(2.0, params.cz + xVal * morphSpeed));
            if (this.xrManager.dispatcher) {
              this.xrManager.dispatcher.dispatch("UPDATE_PARAM_INPUT", { category: "fractal", key: "cz", value: nextCz });
            }
          }
          if (hasChangedY) {
            const nextCw = Math.max(-2.0, Math.min(2.0, params.cw - yVal * morphSpeed));
            if (this.xrManager.dispatcher) {
              this.xrManager.dispatcher.dispatch("UPDATE_PARAM_INPUT", { category: "fractal", key: "cw", value: nextCw });
            }
          }
        }
      } else {
        if (this.xrManager.isJoystickOperating[side]) {
          this.xrManager.isJoystickOperating[side] = false;
          if (this.xrManager.dispatcher) {
            this.xrManager.dispatcher.dispatch("COMMIT_HISTORY");
          }
        }
      }

      const buttons = source.gamepad.buttons;
      
      if (buttons.length > 4 && buttons[4] && buttons[4].pressed) {
        this.xrManager.resetFractalPosition();
      }

      if (buttons.length > 5 && buttons[5] && buttons[5].pressed) {
        this.xrManager.randomizeFractal();
      }
    }
  }
}
