export function formatParamForUI(key, value) {
  let uiValue = value;
  const radianKeys = ["rotX", "rotY", "rotZ", "rotXW", "rotYW", "rotZW", "px", "py", "pz", "pw"];

  if (radianKeys.includes(key)) {
    uiValue = value * (180 / Math.PI);
    if (Math.abs(uiValue) < 1e-7) uiValue = 0;
    return { numericValue: uiValue, displayString: uiValue.toFixed(1) + "°" };
  }

  // 視野角 (fov) は既に度数だが、UI表示には「°」を付与する
  if (key === "fov") {
    return { numericValue: uiValue, displayString: parseFloat(uiValue).toFixed(1) + "°" };
  }

  // 小数点以下3桁に揃えるパラメータ
  if (["cx", "cy", "cz", "cw", "hue", "saturation"].includes(key)) {
    return { numericValue: uiValue, displayString: uiValue.toFixed(3) };
  }

  // 小数点以下2桁に揃えるパラメータ
  if (["zoom", "brightness", "aoPower", "specular"].includes(key)) {
    return { numericValue: uiValue, displayString: uiValue.toFixed(2) };
  }

  return { numericValue: uiValue, displayString: String(uiValue) };
}

/**
 * UIの入力値（度数など）を、ドメイン内部の計算用形式（ラジアンなど）に逆変換します。
 */
export function parseParamFromUI(key, rawValue, inputType) {
  if (inputType === "color") return rawValue;
  let val = parseFloat(rawValue);
  if (Number.isNaN(val)) return 0;
  
  const radianKeys = ["rotX", "rotY", "rotZ", "rotXW", "rotYW", "rotZW", "px", "py", "pz", "pw"];
  if (radianKeys.includes(key)) {
    val = val * (Math.PI / 180);
  }
  return val;
}