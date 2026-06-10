import { PARAMETER_DEFINITIONS } from "@/core/domain/ParameterDefinitions.js";
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

    const animParams = {};
    this.config.SCHEMAS.animation.forEach(key => {
      animParams[key] = preset[key] !== undefined ? preset[key] : (PARAMETER_DEFINITIONS[key]?.default !== undefined ? PARAMETER_DEFINITIONS[key].default : 0);
    });

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
    this.domainStore.updateParams("animation", animParams);
    this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });

    // 3. UI状態の更新（インタラクション中の状態をクリーンに通知）
    this.uiStore.update({ 
      activeAnimPreset: presetName
    });
  }
}