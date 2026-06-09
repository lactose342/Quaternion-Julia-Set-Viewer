import { JuliaAnimationService } from "@/core/domain/JuliaAnimationService.js";

export class AnimationController {
  constructor(domainStore, uiStore) {
    this.domainStore = domainStore;
    this.uiStore = uiStore;
  }

  update(delta) {
    if (!this.uiStore.isAutoAnimating) return;

    const currentPhases = this.domainStore.animPhases;
    const animParams = this.domainStore.getParams("animation");

    const nextPhases = JuliaAnimationService.calculateNextPhases(currentPhases, animParams, delta);

    this.domainStore.setAnimPhases(nextPhases);
  }

  stopAnimation() {
    this.uiStore.update({ isAutoAnimating: false });
  }
}