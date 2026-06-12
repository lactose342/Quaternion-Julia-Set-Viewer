import * as THREE from "three";
import vertexShader from "@/shaders/julia.vert?raw";
import fragmentShader from "@/shaders/julia.frag?raw";

/**
 * 4次元ジュリア集合用のWebGLシェーダーマテリアルを生成するファクトリクラス
 */
export class JuliaMaterialFactory {
  
  /**
   * 指定された品質レベルに応じたShaderMaterialを生成して返す
   * @param {string} qualityLevel - "HIGH", "LOW", "EXPORT" などの品質識別子
   * @param {Object} config - アプリ設定オブジェクト
   * @returns {THREE.ShaderMaterial}
   */
  static create(qualityLevel, config) {
    const qualityConfig = config.QUALITY[qualityLevel];
    const isExport = qualityLevel === "EXPORT";
    const isLow = qualityLevel === "LOW";

    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: `#define MAX_STEPS ${qualityConfig.steps}\n#define MAX_ITER ${qualityConfig.iter}\n` + fragmentShader,
      defines: {
        ...(isExport ? { IS_EXPORTING: "1" } : {}),
        ...(isLow ? { IS_LOW_QUALITY: "1" } : {}),
        ...(qualityLevel === "XR" ? { LIMIT_NORMAL_ITER: "1" } : {})
      },
      glslVersion: THREE.GLSL3,
      depthWrite: false, // デプスの書き込みを無効化し、手やコントローラーが遮られるのを防ぐ
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
        u_bgAlpha: { value: 0.0 },
        u_rotMatrix_3D: { value: new THREE.Matrix4() },
        u_rotMatrix_4D: { value: new THREE.Matrix4() },
        u_rotMatrix_Combined: { value: new THREE.Matrix4() },
        // WebXR/AR用のスケールと位置オフセット
        u_vrScale: { value: 1.0 },
        u_vrOffset: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
      },
    });
  }
}
