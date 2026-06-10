export class URLManager {
  constructor(config) {
    this.config = config;
  }

  /**
   * 現在のURL文字列を解析し、Storeにそのまま流し込めるプレーンな状態オブジェクトを返す
   * @param {string} urlString 
   * @returns {Object|null} パースされた状態データ（クエリがない場合はnull）
   */
  parseURL(urlString) {
    const url = new URL(urlString);
    const params = url.searchParams;
    
    // アプリ固有の主要パラメータが1つも含まれていない場合は、無関係なクエリとみなしてデフォルト初期化へ誘導する
    const appKeys = ['preset', 'anim_preset', 'cx', 'hue', 'speed', 'cam_px'];
    const hasAppParams = appKeys.some(key => params.has(key));
    if (!hasAppParams) return null;

    const hasCustomParams = params.has('cx') || params.has('hue');
    
    // 復元用データ構造のひな形を作成
    const parsedData = {
      ui: {
        activePreset: params.get('preset') || (hasCustomParams ? "custom" : "preset1"),
        activeAnimPreset: params.get('anim_preset') || (hasCustomParams ? "custom" : "preset1"),
      },
      params: { fractal: {}, material: {}, animation: {} },
      camera: { position: {}, target: {} },
      animPhases: { x: 0, y: 0, z: 0, w: 0 }
    };

    // 安全な数値パース（NaNガード）のためのヘルパー
    const safeParse = (id, targetObj) => {
      if (params.has(id)) {
        const val = parseFloat(params.get(id));
        if (!Number.isNaN(val)) {
          targetObj[id] = val;
        } else {
          console.warn(`Invalid URL parameter ignored for key [${id}]: ${params.get(id)}`);
        }
      }
    };

    // 各スキーマの解析
    this.config.SCHEMAS.fractal.forEach(id => safeParse(id, parsedData.params.fractal));
    
    this.config.SCHEMAS.material.forEach(id => {
      if (params.has(id)) {
        const val = params.get(id);
        if (id === 'bgColor') {
          parsedData.params.material[id] = `#${val}`;
        } else {
          const numVal = parseFloat(val);
          if (!Number.isNaN(numVal)) {
            parsedData.params.material[id] = numVal;
          } else {
            console.warn(`Invalid URL parameter ignored for key [${id}]: ${val}`);
          }
        }
      }
    });
    
    this.config.SCHEMAS.animation.forEach(id => safeParse(id, parsedData.params.animation));

    // アニメーション位相の復元
    if (params.has('ph_x')) {
      parsedData.animPhases = {
        x: parseFloat(params.get('ph_x')) || 0,
        y: parseFloat(params.get('ph_y')) || 0,
        z: parseFloat(params.get('ph_z')) || 0,
        w: parseFloat(params.get('ph_w')) || 0
      };
    }

    // カメラ状態の復元（Rendererを直接触らず、データとして構築）
    if (params.has('cam_px')) {
      parsedData.camera.position = {
        x: parseFloat(params.get('cam_px')),
        y: parseFloat(params.get('cam_py')),
        z: parseFloat(params.get('cam_pz'))
      };
      parsedData.camera.target = {
        x: parseFloat(params.get('cam_tx')),
        y: parseFloat(params.get('cam_ty')),
        z: parseFloat(params.get('cam_tz'))
      };
    }

    return parsedData;
  }

  /**
   * 現在の各種Storeの状態を受け取り、共有用のURL文字列を生成する（副作用なし）
   * @param {Object} domainSnapshot domainStore.getSnapshot() の戻り値
   * @param {Object} uiState uiStore.getState() の戻り値
   * @returns {string} 共有URL
   */
  generateShareURL(domainSnapshot, uiState) {
    const params = new URLSearchParams();
    
    if (uiState.activePreset) params.set('preset', uiState.activePreset);
    if (uiState.activeAnimPreset) params.set('anim_preset', uiState.activeAnimPreset);

    const phases = domainSnapshot.animPhases;
    params.set('ph_x', phases.x.toFixed(3));
    params.set('ph_y', phases.y.toFixed(3));
    params.set('ph_z', phases.z.toFixed(3));
    params.set('ph_w', phases.w.toFixed(3));
        
    const allIds = [...this.config.SCHEMAS.fractal, ...this.config.SCHEMAS.material, ...this.config.SCHEMAS.animation];
    allIds.forEach(id => {
      const category = this.config.SCHEMAS.fractal.includes(id) ? 'fractal' : this.config.SCHEMAS.material.includes(id) ? 'material' : 'animation';
      const val = domainSnapshot.params[category][id];
      if (val !== undefined) {
        params.set(id, id === 'bgColor' ? val.replace('#', '') : val);
      }
    });

    const cam = domainSnapshot.camera;
    if (cam.position.x !== undefined) {
      params.set('cam_px', cam.position.x.toFixed(3));
      params.set('cam_py', cam.position.y.toFixed(3));
      params.set('cam_pz', cam.position.z.toFixed(3));
      params.set('cam_tx', cam.target.x.toFixed(3));
      params.set('cam_ty', cam.target.y.toFixed(3));
      params.set('cam_tz', cam.target.z.toFixed(3));
    }
    
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }
}