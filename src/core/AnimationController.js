import { JuliaAnimationService } from "@/core/domain/JuliaAnimationService.js";

export class AnimationController {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  update(delta) {
    const state = this.stateManager.getRawState();
    if (!state.ui.isAutoAnimating) return;

    const currentPhases = this.stateManager.getRawAnimPhases();
    const animParams = state.domain.params.animation;

    // ドメインサービスで計算
    const nextPhases = JuliaAnimationService.calculateNextPhases(currentPhases, animParams, delta);

    // 結果をストアに保存
    this.stateManager.setAnimPhases(nextPhases);
  }

  stopAnimation() {
    this.stateManager.updateUiState({ isAutoAnimating: false });
  }
}
