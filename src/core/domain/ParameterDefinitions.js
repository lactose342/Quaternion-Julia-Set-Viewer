/**
 * アプリケーション内の全パラメータのメタデータ定義（Single Source of Truth）
 */
export const PARAMETER_DEFINITIONS = {
  // --- Camera Parameters ---
  fov: { category: "camera", domId: "fov", type: "degree", min: 15, max: 120, step: 1, default: 45.0, precision: 1, label: "視野角 (FoV)", tooltip: "カメラのレンズの広さ。値を大きくすると遠近感が強くなり、小さくすると望遠レンズのようになります。", group: "camera" },
  zoom: { category: "camera", domId: "zoom", type: "number", min: 0.1, max: 10.0, step: 0.05, default: 1.0, precision: 2, label: "ズーム", tooltip: "カメラのズーム倍率を設定します。", group: "camera" },

  // --- Fractal Parameters ---
  cx: { category: "fractal", domId: "cx", type: "number", min: -1.0, max: 1.0, step: 0.001, default: -0.517, precision: 3, label: "C.x", tooltip: "形状の基本的な骨格を変化させます。（4D複素定数 実数X）", group: "shape" },
  cy: { category: "fractal", domId: "cy", type: "number", min: -1.0, max: 1.0, step: 0.001, default: -0.341, precision: 3, label: "C.y", tooltip: "形状の肉付きや、左右の対称性に影響を与えます。（4D複素定数 虚数Y）", group: "shape" },
  cz: { category: "fractal", domId: "cz", type: "number", min: -1.0, max: 1.0, step: 0.001, default: -0.407, precision: 3, label: "C.z", tooltip: "空間をねじ曲げ、複雑な凹凸や穴を作り出します。（4D複素定数 虚数Z）", group: "shape" },
  cw: { category: "fractal", domId: "cw", type: "number", min: -1.0, max: 1.0, step: 0.001, default: -0.071, precision: 3, label: "C.w", tooltip: "形状を内側から裏返すように、異次元的な変形をさせます。（4D複素定数 虚数W）", group: "shape" },
  rotX: { category: "fractal", domId: "rotX", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "X軸回転 (Pitch)", tooltip: "通常の3次元空間におけるX軸周りの回転です。（仰俯角）", group: "rotation" },
  rotY: { category: "fractal", domId: "rotY", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "Y軸回転 (Yaw)", tooltip: "通常の3次元空間におけるY軸周りの回転です。（左右方位角）", group: "rotation" },
  rotZ: { category: "fractal", domId: "rotZ", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "Z軸回転 (Roll)", tooltip: "通常の3次元空間におけるZ軸周りの回転です。（傾き）", group: "rotation" },
  rotXW: { category: "fractal", domId: "rotXW", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "XW平面回転 (4D)", tooltip: "第4の軸を使った回転。物体が内側から裏返るように見えます。", group: "rotation" },
  rotYW: { category: "fractal", domId: "rotYW", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "YW平面回転 (4D)", tooltip: "第4の軸を使った回転。空間が歪むような変化をします。", group: "rotation" },
  rotZW: { category: "fractal", domId: "rotZW", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "ZW平面回転 (4D)", tooltip: "第4の軸を使った回転。内部と外部が反転します。", group: "rotation" },

  // --- Material Parameters ---
  hue: { category: "material", domId: "hue", type: "number", min: 0.0, max: 1.0, step: 0.001, default: 0.586, precision: 3, label: "色相 (Hue)", tooltip: "物体の色合いを調整します。", group: "style", hideSlider: true },
  saturation: { category: "material", domId: "saturation", type: "number", min: 0.0, max: 1.0, step: 0.001, default: 1.0, precision: 3, label: "彩度 (Saturation)", tooltip: "色の鮮やかさを調整します。", group: "style", hideSlider: true },
  value: { category: "material", domId: "value", type: "number", min: 0.0, max: 1.0, step: 0.01, default: 1.0, precision: 2, label: "明度 (Value)", tooltip: "ベースカラーの明度を調整します。", group: "style", hideSlider: true },
  brightness: { category: "material", domId: "brightness", type: "number", min: 0.5, max: 3.0, step: 0.1, default: 2.3, precision: 2, label: "明るさ", tooltip: "全体的な光の強さを調整します", group: "style" },
  aoPower: { category: "material", domId: "aoPower", type: "number", min: 0.1, max: 3.0, step: 0.1, default: 1.0, precision: 2, label: "影の濃さ", tooltip: "立体感を強調するため、くぼみ部分の影の濃さを調整します。", group: "style" },
  specular: { category: "material", domId: "specular", type: "number", min: 2.0, max: 64.0, step: 1.0, default: 10.0, precision: 2, label: "光沢感", tooltip: "表面のツヤを調整します。値を上げると金属のような鋭い光沢になります。", group: "style" },
  bgColor: { category: "material", domId: "bgColor", type: "color", default: "#0a0c1a", label: "背景色", tooltip: "空間全体の背景色を設定します。", group: "style" },
  bgAlpha: { category: "material", domId: "bgAlpha", type: "number", min: 0.0, max: 1.0, step: 0.05, default: 1.0, precision: 2, label: "背景不透明度", tooltip: "背景の不透明度を設定します（透過モードで機能します）。", group: "style", hideSlider: true },

  // --- Pseudo Material Parameters (For UI Rendering only, not mapped to direct state key) ---
  baseColorPicker: { category: "material", domId: "baseColorPicker", type: "color", default: "#0055ff", label: "ベースカラー", tooltip: "物体の基準となる色をカラーピッカーで指定します（色相・彩度へ自動反映）。", group: "style", isPseudo: true },

  // --- Animation Parameters ---
  speed: { category: "animation", domId: "anim-speed", type: "number", min: 0.1, max: 2.0, step: 0.1, default: 0.8, precision: 2, label: "全体の速度", tooltip: "自動アニメーション全体の動く速さを調整します。", group: "animation" },
  amp: { category: "animation", domId: "anim-amp", type: "number", min: 0.0, max: 0.5, step: 0.05, default: 0.45, precision: 2, label: "変形の大きさ (振幅)", tooltip: "自動アニメーションで変形する大きさ（振れ幅）を調整します。", group: "animation" },
  sx: { category: "animation", domId: "speed-x", type: "number", min: 0.0, max: 2.0, step: 0.05, default: 1.0, precision: 2, label: "C.x 速度比", tooltip: "C.xが変化する速さの比率。", group: "animation_details" },
  ax: { category: "animation", domId: "amp-x", type: "number", min: 0.0, max: 1.0, step: 0.05, default: 1.0, precision: 2, label: "C.x 振幅比", tooltip: "C.xが変化する大きさの比率。", group: "animation_details" },
  px: { category: "animation", domId: "phase-x", type: "radian", min: 0, max: 360, step: 0.1, default: 0.0, precision: 1, label: "C.x 初期位相", tooltip: "C.xの動きが始まるタイミングのズレ。", group: "animation_details" },
  sy: { category: "animation", domId: "speed-y", type: "number", min: 0.0, max: 2.0, step: 0.05, default: 0.75, precision: 2, label: "C.y 速度比", tooltip: "C.yが変化する速さの比率。", group: "animation_details" },
  ay: { category: "animation", domId: "amp-y", type: "number", min: 0.0, max: 1.0, step: 0.05, default: 1.0, precision: 2, label: "C.y 振幅比", tooltip: "C.yが変化する大きさの比率。", group: "animation_details" },
  py: { category: "animation", domId: "phase-y", type: "radian", min: 0, max: 360, step: 0.1, default: 0.0, precision: 1, label: "C.y 初期位相", tooltip: "C.yの動きが始まるタイミングのズレ。", group: "animation_details" },
  sz: { category: "animation", domId: "speed-z", type: "number", min: 0.0, max: 2.0, step: 0.05, default: 0.5, precision: 2, label: "C.z 速度比", tooltip: "C.zが変化する速さの比率。", group: "animation_details" },
  az: { category: "animation", domId: "amp-z", type: "number", min: 0.0, max: 1.0, step: 0.05, default: 1.0, precision: 2, label: "C.z 振幅比", tooltip: "C.zが変化する大きさの比率。", group: "animation_details" },
  pz: { category: "animation", domId: "phase-z", type: "radian", min: 0, max: 360, step: 0.1, default: 0.0, precision: 1, label: "C.z 初期位相", tooltip: "C.zの動きが始まるタイミングのズレ。", group: "animation_details" },
  sw: { category: "animation", domId: "speed-w", type: "number", min: 0.0, max: 2.0, step: 0.05, default: 0.25, precision: 2, label: "C.w 速度比", tooltip: "C.wが変化する速さの比率。", group: "animation_details" },
  aw: { category: "animation", domId: "amp-w", type: "number", min: 0.0, max: 1.0, step: 0.05, default: 1.0, precision: 2, label: "C.w 振幅比", tooltip: "C.wが変化する大きさの比率。", group: "animation_details" },
  pw: { category: "animation", domId: "phase-w", type: "radian", min: 0, max: 360, step: 0.1, default: 0.0, precision: 1, label: "C.w 初期位相", tooltip: "C.wの動きが始まるタイミングのズレ。", group: "animation_details" }
};
