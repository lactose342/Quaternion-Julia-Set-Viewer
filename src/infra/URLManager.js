import { CONFIG } from "@/config/config.js";

export class URLManager {
  constructor(stateManager, renderer) {
    this.stateManager = stateManager;
    this.renderer = renderer;
  }

  loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (Array.from(params.keys()).length === 0) return;

    this.stateManager.updateUiState({ isInteracting: true });

    const hasCustomParams = params.has('cx') || params.has('hue');
    const presetVal = params.get('preset') || (hasCustomParams ? "custom" : "preset1");
    const animPresetVal = params.get('anim_preset') || (hasCustomParams ? "custom" : "preset1");

    this.stateManager.updateUiState({ 
      activePreset: presetVal,
      activeAnimPreset: animPresetVal
    });

    CONFIG.SCHEMAS.fractal.forEach(id => {
      if (params.has(id)) this.stateManager.updateParamsState('fractal', { [id]: parseFloat(params.get(id)) });
    });
    CONFIG.SCHEMAS.material.forEach(id => {
      if (params.has(id)) {
        const val = params.get(id);
        const parsedVal = id === 'bgColor' ? `#${val}` : parseFloat(val);
        this.stateManager.updateParamsState('material', { [id]: parsedVal });
      }
    });
    CONFIG.SCHEMAS.animation.forEach(id => {
      if (params.has(id)) this.stateManager.updateParamsState('animation', { [id]: parseFloat(params.get(id)) });
    });

    if (params.has('ph_x')) {
      this.stateManager.setAnimPhases({
        x: parseFloat(params.get('ph_x')),
        y: parseFloat(params.get('ph_y')),
        z: parseFloat(params.get('ph_z')),
        w: parseFloat(params.get('ph_w'))
      });
    }

    const camPos = {
      x: params.has('cam_px') ? parseFloat(params.get('cam_px')) : this.renderer.camera.position.x,
      y: params.has('cam_py') ? parseFloat(params.get('cam_py')) : this.renderer.camera.position.y,
      z: params.has('cam_pz') ? parseFloat(params.get('cam_pz')) : this.renderer.camera.position.z
    };
    const camTarget = {
      x: params.has('cam_tx') ? parseFloat(params.get('cam_tx')) : this.renderer.controls.target.x,
      y: params.has('cam_ty') ? parseFloat(params.get('cam_ty')) : this.renderer.controls.target.y,
      z: params.has('cam_tz') ? parseFloat(params.get('cam_tz')) : this.renderer.controls.target.z
    };

    this.stateManager.updateCameraState('position', camPos);
    this.stateManager.updateCameraState('target', camTarget);

    this.renderer.camera.position.copy(camPos);
    this.renderer.controls.target.copy(camTarget);
    this.renderer.controls.update();

    this.stateManager.updateUiState({ isInteracting: false });
  }

  generateShareURL() {
    this.stateManager.updateCameraState("position", {
      x: this.renderer.camera.position.x,
      y: this.renderer.camera.position.y,
      z: this.renderer.camera.position.z,
    });
    this.stateManager.updateCameraState("target", {
      x: this.renderer.controls.target.x,
      y: this.renderer.controls.target.y,
      z: this.renderer.controls.target.z,
    });

    const state = this.stateManager.getState();
    const targetParams = state.domain.params;
    const params = new URLSearchParams();
    const phases = this.stateManager.getRawAnimPhases();
    
    if (state.ui.activePreset) params.set('preset', state.ui.activePreset);
    if (state.ui.activeAnimPreset) params.set('anim_preset', state.ui.activeAnimPreset);

    params.set('ph_x', phases.x.toFixed(3));
    params.set('ph_y', phases.y.toFixed(3));
    params.set('ph_z', phases.z.toFixed(3));
    params.set('ph_w', phases.w.toFixed(3));
        
    const allIds = [...CONFIG.SCHEMAS.fractal, ...CONFIG.SCHEMAS.material, ...CONFIG.SCHEMAS.animation];
    allIds.forEach(id => {
      const category = CONFIG.SCHEMAS.fractal.includes(id) ? 'fractal' : CONFIG.SCHEMAS.material.includes(id) ? 'material' : 'animation';
      const val = targetParams[category][id];
      if (val !== undefined) {
        params.set(id, id === 'bgColor' ? val.replace('#', '') : val);
      }
    });

    const cam = state.domain.camera;
    params.set('cam_px', cam.position.x.toFixed(3));
    params.set('cam_py', cam.position.y.toFixed(3));
    params.set('cam_pz', cam.position.z.toFixed(3));
    params.set('cam_tx', cam.target.x.toFixed(3));
    params.set('cam_ty', cam.target.y.toFixed(3));
    params.set('cam_tz', cam.target.z.toFixed(3));
    
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }
}