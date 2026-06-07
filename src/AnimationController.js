export class AnimationController {
    constructor(stateManager, renderer) {
        this.stateManager = stateManager;
        this.renderer = renderer;
        this.onUpdate = null;
    }

    update(delta) {
        // 状態を前に進める命令
        this.stateManager.advanceAnimPhases(delta);
        
        // 描画およびUI同期要求（getState()内で最新の計算値が自動導出される）
        this.renderer.requestRender();
        if (this.onUpdate) this.onUpdate();
    }

    resetPhases() {
        this.stateManager.resetAnimPhases();
    }
}