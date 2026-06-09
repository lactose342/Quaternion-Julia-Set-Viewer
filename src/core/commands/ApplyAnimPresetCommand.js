import { Command } from "./Command.js";
import { JuliaAnimationService } from "@/core/domain/JuliaAnimationService.js";

export class ApplyAnimPresetCommand extends Command {
  constructor(domainStore, uiStore, animPresetsConfig) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.animPresetsConfig = animPresetsConfig;
  }

  execute({ value: presetName }) {
    this.uiStore.update({ isInteracting: true, activeAnimPreset: presetName });
    
    const animPreset = this.animPresetsConfig[presetName];
    if (animPreset) {
      // 再生中でない場合、現在の位相をBaseCへ固定するドメイン計算を実行
      if (!this.uiStore.isAutoAnimating) {
        const animatedCVec = { cx: 0, cy: 0, cz: 0, cw: 0 };
        const currentParams = {
          fractal: this.domainStore.getParams("fractal"),
          material: this.domainStore.getParams("material"),
          animation: this.domainStore.getParams("animation"),
        };

        JuliaAnimationService.calculateAnimatedC(
          currentParams, 
          this.domainStore.animPhases, 
          animatedCVec
        );

        this.domainStore.updateParams("fractal", {
          cx: animatedCVec.cx, cy: animatedCVec.cy, cz: animatedCVec.cz, cw: animatedCVec.cw
        });
      }

      // 新しいアニメーション設定の適用と、位相のリセット
      this.domainStore.updateParams("animation", animPreset);
      this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });
    }

    this.uiStore.update({ isInteracting: false });
  }
}