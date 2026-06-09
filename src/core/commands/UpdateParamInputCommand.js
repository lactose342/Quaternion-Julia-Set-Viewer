import { Command } from "./Command.js";

export class UpdateParamInputCommand extends Command {
  constructor(domainStore, uiStore) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
  }

  execute({ category, key, value }) {
    this.domainStore.updateParams(category, { [key]: value });

    // 現在の選択プリセットをカスタムへ強制変更
    if (category === "fractal" || category === "material") {
      this.uiStore.update({ activePreset: "custom" });
    } else if (category === "animation") {
      this.uiStore.update({ activeAnimPreset: "custom" });
    }
  }
}