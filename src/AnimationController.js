export class AnimationController {
    constructor(stateManager, renderer) {
        this.stateManager = stateManager;
        this.renderer = renderer;
        this.onUpdate = null;
    }

    update(delta) {
        this.stateManager.advanceAnimPhases(delta);
        
        this.renderer.requestRender();
        if (this.onUpdate) this.onUpdate();
    }

    stopAnimation() {
        this.stateManager.updateUiState({ isAutoAnimating: false });
        this.renderer.requestRender();
        if (this.onUpdate) this.onUpdate();
    }

    resetPhases() {
        this.stateManager.resetAnimPhases();
    }
}