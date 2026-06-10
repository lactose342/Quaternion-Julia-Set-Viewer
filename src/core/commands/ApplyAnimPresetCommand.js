import { Command } from "./Command.js";

export class ApplyAnimPresetCommand extends Command {
  constructor(domainStore, uiStore, animPresetsConfig) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.animPresetsConfig = animPresetsConfig;
  }

  execute({ value: presetName }) {
    const animPreset = this.animPresetsConfig[presetName];
    if (!animPreset) return;

    // 1. 再生中でない場合、現在の位相のアニメーション計算値をベース値に固定する
    if (!this.uiStore.isAutoAnimating) {
      // ★修正: インスタンス変数ではなく、ローカル変数として正しく取得
      const animatedC = this.domainStore.getAnimatedC();

      this.domainStore.updateParams("fractal", {
        cx: animatedC.cx, 
        cy: animatedC.cy, 
        cz: animatedC.cz, 
        cw: animatedC.cw
      });
    }

    // 2. 新しいアニメーションプリセットパラメータの適用と、位相（フェーズ）のリセット
    this.domainStore.updateParams("animation", animPreset);
    this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });

    // 3. UI状態の更新（インタラクション中の状態をクリーンに通知）
    this.uiStore.update({ 
      activeAnimPreset: presetName
    });
  }
}