import { Command } from "./Command.js";

export class ApplyPresetCommand extends Command {
  constructor(domainStore, uiStore, presetManager) {
    super();
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.presetManager = presetManager;
  }

  execute({ value: presetName }) {
    this.uiStore.update({ isInteracting: true, activePreset: presetName });
    
    if (this.presetManager.applyPreset(presetName)) {
      this.domainStore.setAnimPhases({ x: 0, y: 0, z: 0, w: 0 });
      
      // 正しいグローバルイベント名とペイロード形式でCOMMIT_HISTORYを叩く
      window.dispatchEvent(new CustomEvent("app-command", { 
        detail: { type: "COMMIT_HISTORY" } 
      }));
    }
    
    this.uiStore.update({ isInteracting: false });
  }
}