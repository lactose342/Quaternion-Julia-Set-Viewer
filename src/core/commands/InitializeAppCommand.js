import { PARAMETER_DEFINITIONS } from "@/core/domain/ParameterDefinitions.js";

export class InitializeAppCommand {
  constructor(domainStore, uiStore, urlManager, historyManager, uiController, renderer, config) {
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.urlManager = urlManager;
    this.historyManager = historyManager;
    this.uiController = uiController;
    this.renderer = renderer;
    this.config = config;
  }

  async execute(payload) {
    const { currentUrl } = payload;
    const parsedState = this.urlManager.parseURL(currentUrl);

    if (parsedState) {
      this.domainStore.init(parsedState.params);
      if (parsedState.animPhases) {
        this.domainStore.setAnimPhases(parsedState.animPhases);
      }
      if (parsedState.camera && parsedState.camera.position.x !== undefined) {
        this.renderer.restoreCameraFromSnapshot(parsedState.camera);
        this.domainStore.updateCamera("position", parsedState.camera.position);
        this.domainStore.updateCamera("target", parsedState.camera.target);
      }
      this.uiStore.update(parsedState.ui);
    } else {
      const defaultParams = {
        fractal: {},
        material: {},
        animation: {}
      };
      const srcPreset = this.config.PRESETS.preset1;
      const srcAnimPreset = this.config.ANIM_PRESETS.preset1;
      
      this.config.SCHEMAS.fractal.forEach(key => {
        defaultParams.fractal[key] = (srcPreset && srcPreset[key] !== undefined) ? srcPreset[key] : (PARAMETER_DEFINITIONS[key]?.default !== undefined ? PARAMETER_DEFINITIONS[key].default : 0);
      });
      this.config.SCHEMAS.material.forEach(key => {
        defaultParams.material[key] = (srcPreset && srcPreset[key] !== undefined) ? srcPreset[key] : (PARAMETER_DEFINITIONS[key]?.default !== undefined ? PARAMETER_DEFINITIONS[key].default : (key === 'bgColor' ? '#000000' : 1.0));
      });
      this.config.SCHEMAS.animation.forEach(key => {
        defaultParams.animation[key] = (srcAnimPreset && srcAnimPreset[key] !== undefined) ? srcAnimPreset[key] : (PARAMETER_DEFINITIONS[key]?.default !== undefined ? PARAMETER_DEFINITIONS[key].default : 0);
      });

      this.domainStore.init(defaultParams);
      this.uiStore.update({
        activePreset: "preset1",
        activeAnimPreset: "preset1"
      });
    }

    this.uiController.updateUIFromState();
    
    const domainSnapshot = this.domainStore.getSnapshot();
    const uiState = this.uiStore.getState();
    const fullSnapshot = {
      params: domainSnapshot.params,
      camera: domainSnapshot.camera,
      animPhases: domainSnapshot.animPhases,
      presets: {
        activePreset: uiState.activePreset || "preset1",
        activeAnimPreset: uiState.activeAnimPreset || "preset1"
      }
    };
    this.historyManager.replaceInitialHistory(fullSnapshot);
    this.uiController.updateHistoryButtons();
  }
}