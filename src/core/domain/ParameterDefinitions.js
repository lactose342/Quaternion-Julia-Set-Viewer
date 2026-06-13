/**
 * アプリケーション内の全パラメータのメタデータ定義（Single Source of Truth）
 */
export const PARAMETER_DEFINITIONS = {
  // --- Camera Parameters ---
  fov: { category: "camera", domId: "fov", type: "degree", min: 15, max: 120, step: 1, default: 45.0, precision: 1, label: "視野の広さ", tooltip: "空間の広がりを調整します。数値を上げると遠近感が強調され、よりダイナミックな構図になります。", group: "camera" },
  zoom: { category: "camera", domId: "zoom", type: "number", min: 0.1, max: 10.0, step: 0.05, default: 1.0, precision: 2, label: "ズーム倍率", tooltip: "オブジェクトへの距離を調整します。細部を観察したいときに近づきます。", group: "camera" },

  // --- Fractal Parameters ---
  cx: { category: "fractal", domId: "cx", type: "number", min: -1.0, max: 1.0, step: 0.001, default: -0.517, precision: 3, label: "形の広がり(実数X)", tooltip: "左右の構造や、枝分かれするフラクタルパターンの根本的な形を変化させます。", group: "shape" },
  cy: { category: "fractal", domId: "cy", type: "number", min: -1.0, max: 1.0, step: 0.001, default: -0.341, precision: 3, label: "形の伸び(虚数Y)", tooltip: "縦方向の構造や、全体のプロポーションが伸び縮みするような変化を与えます。", group: "shape" },
  cz: { category: "fractal", domId: "cz", type: "number", min: -1.0, max: 1.0, step: 0.001, default: -0.407, precision: 3, label: "形の複雑さ(虚数Z)", tooltip: "全体的な形をゆがませ、複雑なディテールを生み出します。", group: "shape" },
  cw: { category: "fractal", domId: "cw", type: "number", min: -1.0, max: 1.0, step: 0.001, default: -0.071, precision: 3, label: "4次元変形(虚数W)", tooltip: "内側から外側へ湧き出したり溶けたりするような、4次元特有の不思議な変形をさせます。", group: "shape" },
  rotX: { category: "fractal", domId: "rotX", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "上下回転(X軸)", tooltip: "オブジェクトを縦方向に回転させ、見下ろしたり見上げたりします。", group: "rotation" },
  rotY: { category: "fractal", domId: "rotY", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "左右回転(Y軸)", tooltip: "オブジェクトを横方向に回転させ、側面や裏側を観察します。", group: "rotation" },
  rotZ: { category: "fractal", domId: "rotZ", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "傾き(Z軸)", tooltip: "画面に対して、オブジェクトを時計回り・反時計回りに傾けます。", group: "rotation" },
  rotXW: { category: "fractal", domId: "rotXW", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "4次元回転(XW)", tooltip: "4次元空間での回転です。物体が自分自身の内側を通って裏返るような不思議な動きをします。", group: "rotation", hideSlider: true },
  rotYW: { category: "fractal", domId: "rotYW", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "4次元回転(YW)", tooltip: "4次元空間での回転です。空間そのものがねじ曲がるような変形を伴って回転します。", group: "rotation", hideSlider: true },
  rotZW: { category: "fractal", domId: "rotZW", type: "radian", min: 0, max: 360, step: 0.01, default: 0.0, precision: 1, label: "4次元回転(ZW)", tooltip: "4次元空間での回転です。見えない4つ目の次元に向かって物体が沈み込んだり現れたりします。", group: "rotation", hideSlider: true },

  // --- Material Parameters ---
  hue: { category: "material", domId: "hue", type: "number", min: 0.0, max: 1.0, step: 0.001, default: 0.586, precision: 3, label: "色相", tooltip: "赤や青、緑など、ベースとなる色合いを変更します。", group: "style", hideSlider: true },
  saturation: { category: "material", domId: "saturation", type: "number", min: 0.0, max: 1.0, step: 0.001, default: 1.0, precision: 3, label: "彩度", tooltip: "色がどれだけ鮮やかか（または白黒に近いか）を調整します。", group: "style", hideSlider: true },
  value: { category: "material", domId: "value", type: "number", min: 0.0, max: 1.0, step: 0.01, default: 1.0, precision: 2, label: "明度", tooltip: "ベースカラーの明るさを調整します。", group: "style", hideSlider: true },
  brightness: { category: "material", domId: "brightness", type: "number", min: 0.5, max: 3.0, step: 0.1, default: 2.3, precision: 2, label: "光の強さ", tooltip: "画面全体の明るさを調整します。", group: "style" },
  aoPower: { category: "material", domId: "aoPower", type: "number", min: 0.1, max: 3.0, step: 0.1, default: 1.0, precision: 2, label: "影の深さ", tooltip: "くぼんだ部分の影を濃くして、立体的な形をはっきり見せます。", group: "style" },
  specular: { category: "material", domId: "specular", type: "number", min: 2.0, max: 64.0, step: 1.0, default: 10.0, precision: 2, label: "表面の光沢感", tooltip: "光の反射具合を調整します。数値を上げると、金属のようなツヤとハイライトが出ます。", group: "style" },
  baseColorPicker: { category: "material", domId: "baseColorPicker", type: "color", default: "#0055ff", label: "ベースカラー", tooltip: "オブジェクトの基本となる色を指定します。", group: "style", isPseudo: true },
  bgColor: { category: "material", domId: "bgColor", type: "color", default: "#0a0c1a", label: "背景色", tooltip: "空間の背景となる色を指定します。", group: "style" },
  bgAlpha: { category: "material", domId: "bgAlpha", type: "number", min: 0.0, max: 1.0, step: 0.05, default: 1.0, precision: 2, label: "背景の透き通り", tooltip: "背景をどれくらい透けさせるかを調整します。", group: "style", hideSlider: true },

  // --- Animation Parameters ---
  speed: { category: "animation", domId: "anim-speed", type: "number", min: 0.1, max: 2.0, step: 0.1, default: 0.8, precision: 2, label: "再生速度", tooltip: "アニメーションが進行する基本のスピードを調整します。", group: "animation" },
  amp: { category: "animation", domId: "anim-amp", type: "number", min: 0.0, max: 0.5, step: 0.05, default: 0.45, precision: 2, label: "動きの大きさ", tooltip: "アニメーションによる形状変化の大きさ(振幅)を一括で調整します。", group: "animation" },
  sx: { category: "animation", domId: "speed-x", type: "number", min: 0.0, max: 2.0, step: 0.05, default: 1.0, precision: 2, label: "X 変化の速さ", tooltip: "この成分が変化する速さを個別に調整します。", group: "animation_details" },
  ax: { category: "animation", domId: "amp-x", type: "number", min: 0.0, max: 1.0, step: 0.05, default: 1.0, precision: 2, label: "X 変化の幅", tooltip: "この成分が変化する範囲の大きさを個別に調整します。", group: "animation_details" },
  px: { category: "animation", domId: "phase-x", type: "radian", min: 0, max: 360, step: 0.1, default: 0.0, precision: 1, label: "X 変化のズレ", tooltip: "波の開始位置をずらします。他の成分と動きのタイミングを同期させたり、あえてずらしたりできます。", group: "animation_details" },
  sy: { category: "animation", domId: "speed-y", type: "number", min: 0.0, max: 2.0, step: 0.05, default: 0.75, precision: 2, label: "Y 変化の速さ", tooltip: "この成分が変化する速さを個別に調整します。", group: "animation_details" },
  ay: { category: "animation", domId: "amp-y", type: "number", min: 0.0, max: 1.0, step: 0.05, default: 1.0, precision: 2, label: "Y 変化の幅", tooltip: "この成分が変化する範囲の大きさを個別に調整します。", group: "animation_details" },
  py: { category: "animation", domId: "phase-y", type: "radian", min: 0, max: 360, step: 0.1, default: 0.0, precision: 1, label: "Y 変化のズレ", tooltip: "波の開始位置をずらします。他の成分と動きのタイミングを同期させたり、あえてずらしたりできます。", group: "animation_details" },
  sz: { category: "animation", domId: "speed-z", type: "number", min: 0.0, max: 2.0, step: 0.05, default: 0.5, precision: 2, label: "Z 変化の速さ", tooltip: "この成分が変化する速さを個別に調整します。", group: "animation_details" },
  az: { category: "animation", domId: "amp-z", type: "number", min: 0.0, max: 1.0, step: 0.05, default: 1.0, precision: 2, label: "Z 変化の幅", tooltip: "この成分が変化する範囲の大きさを個別に調整します。", group: "animation_details" },
  pz: { category: "animation", domId: "phase-z", type: "radian", min: 0, max: 360, step: 0.1, default: 0.0, precision: 1, label: "Z 変化のズレ", tooltip: "波の開始位置をずらします。他の成分と動きのタイミングを同期させたり、あえてずらしたりできます。", group: "animation_details" },
  sw: { category: "animation", domId: "speed-w", type: "number", min: 0.0, max: 2.0, step: 0.05, default: 0.25, precision: 2, label: "W 変化の速さ", tooltip: "この成分が変化する速さを個別に調整します。", group: "animation_details" },
  aw: { category: "animation", domId: "amp-w", type: "number", min: 0.0, max: 1.0, step: 0.05, default: 1.0, precision: 2, label: "W 変化の幅", tooltip: "この成分が変化する範囲の大きさを個別に調整します。", group: "animation_details" },
  pw: { category: "animation", domId: "phase-w", type: "radian", min: 0, max: 360, step: 0.1, default: 0.0, precision: 1, label: "W 変化のズレ", tooltip: "波の開始位置をずらします。他の成分と動きのタイミングを同期させたり、あえてずらしたりできます。", group: "animation_details" }
};

export const PARAMETER_SCHEMAS = {
  camera: Object.entries(PARAMETER_DEFINITIONS)
    .filter(([_, d]) => d.category === "camera" && !d.isPseudo)
    .map(([k]) => k),
  fractal: Object.entries(PARAMETER_DEFINITIONS)
    .filter(([_, d]) => d.category === "fractal" && !d.isPseudo)
    .map(([k]) => k),
  material: Object.entries(PARAMETER_DEFINITIONS)
    .filter(([_, d]) => d.category === "material" && !d.isPseudo)
    .map(([k]) => k),
  animation: Object.entries(PARAMETER_DEFINITIONS)
    .filter(([_, d]) => d.category === "animation" && !d.isPseudo)
    .map(([k]) => k)
};
