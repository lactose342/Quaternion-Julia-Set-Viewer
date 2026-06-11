export class AnimationController {
  constructor(domainStore, uiStore) {
    this.domainStore = domainStore;
    this.uiStore = uiStore;
  }

  update(delta) {
    if (!this.uiStore.isAutoAnimating) return;
    this.domainStore.updateAnimPhases(delta);
  }

  stopAnimation() {
    this.uiStore.update({ isAutoAnimating: false });
  }
}