import { Command } from "./Command.js";

export class ApplyAnimPresetCommand extends Command {
  constructor(domainStore, uiStore, config) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.config = config;
  }

  execute({ value: presetName }) {
    const preset = this.config.ANIM_PRESETS[presetName];
    if (!preset) return;

    const animParams = this.domainStore.fillDefaults("animation", preset);

    // 1. 再生中でない場合、現在の位相のアニメーション計算値をベース値に固定する
    if (!this.uiStore.isAutoAnimating) {
      const animatedC = this.domainStore.getAnimatedC();

      this.domainStore.updateParams("fractal", {
        cx: animatedC.cx,
        cy: animatedC.cy,
        cz: animatedC.cz,
        cw: animatedC.cw
      });
    }

    // 2. 新しいアニメーションプリセットパラメータの適用と、位相（フェーズ）のリセット
    this.domainStore.updateParams("animation", animParams);
    this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });

    // 3. UI状態の更新（インタラクション中の状態をクリーンに通知）
    this.uiStore.update({
      activeAnimPreset: presetName
    });
  }
}