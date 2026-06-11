import { Command } from "./Command.js";

export class UpdateParamInputCommand extends Command {
  constructor(domainStore, uiStore) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
  }

  execute({ category, key, value }) {
    if (!this.uiStore.isAutoAnimating && category === "fractal" && ["cx", "cy", "cz", "cw"].includes(key)) {
      const phases = this.domainStore.animPhases;
      if (phases.x !== 0 || phases.y !== 0 || phases.z !== 0 || phases.w !== 0) {
        const animatedC = this.domainStore.getAnimatedC();

        // 現在のアニメーション計算途中の値をベースの骨格としてストアに焼き付ける
        this.domainStore.updateParams("fractal", {
          cx: animatedC.cx,
          cy: animatedC.cy,
          cz: animatedC.cz,
          cw: animatedC.cw
        });
        this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });
      }
    }

    this.domainStore.updateParams(category, { [key]: value });

    const uiPayload = { isInteracting: true };
    if (category === "fractal" || category === "material" || category === "camera") {
      uiPayload.activePreset = "custom";
    } else if (category === "animation") {
      uiPayload.activeAnimPreset = "custom";
    }
    this.uiStore.update(uiPayload);
  }
}