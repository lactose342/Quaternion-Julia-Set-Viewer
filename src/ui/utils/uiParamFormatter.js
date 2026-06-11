let definitions = null;

export function initFormatter(defs) {
  definitions = defs;
}

/**
 * ストアの数値をUI表示用の文字列および数値オブジェクトに変換します。
 * @param {string} key - パラメータのキー名
 * @param {number} value - パラメータの値
 * @returns {Object} { numericValue, displayString }
 */
export function formatParamForUI(key, value) {
  const def = definitions ? definitions[key] : null;
  if (!def) {
    return { numericValue: value, displayString: String(value) };
  }

  let uiValue = value;

  // ラジアン型の場合：度数法に変換し、末尾に「°」を付与
  if (def.type === "radian") {
    uiValue = value * (180 / Math.PI);
    if (Math.abs(uiValue) < 1e-7) uiValue = 0;
    return { 
      numericValue: uiValue, 
      displayString: uiValue.toFixed(def.precision !== undefined ? def.precision : 1) + "°" 
    };
  }

  // 度数法型の場合（既に度数法だが「°」を付与する）
  if (def.type === "degree") {
    return { 
      numericValue: uiValue, 
      displayString: parseFloat(uiValue).toFixed(def.precision !== undefined ? def.precision : 1) + "°" 
    };
  }

  // 小数点の精度指定がある場合
  if (def.precision !== undefined) {
    return { 
      numericValue: uiValue, 
      displayString: uiValue.toFixed(def.precision) 
    };
  }

  return { numericValue: uiValue, displayString: String(uiValue) };
}

/**
 * UIの入力値（度数など）を、ドメイン内部の計算用形式（ラジアンなど）に逆変換します。
 */
export function parseParamFromUI(key, rawValue, inputType) {
  const def = definitions ? definitions[key] : null;
  if (inputType === "color" || (def && def.type === "color")) return rawValue;
  let val = parseFloat(rawValue);
  if (Number.isNaN(val)) return 0;
  
  if (def && def.type === "radian") {
    val = val * (Math.PI / 180);
  }
  return val;
}