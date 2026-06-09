import { CONFIG } from "@/config/config.js";

export class PresetManager {
  constructor(domainStore) {
    this.domainStore = domainStore;
  }

  applyPreset(presetName) {
    const preset = CONFIG.PRESETS[presetName];
    if (!preset) return false;

    const newFractal = {};
    const newMaterial = {};

    Object.keys(preset).forEach(id => {
      if (CONFIG.SCHEMAS.fractal.includes(id)) newFractal[id] = preset[id];
      if (CONFIG.SCHEMAS.material.includes(id)) newMaterial[id] = preset[id];
    });

    this.domainStore.updateParams('fractal', newFractal);
    this.domainStore.updateParams('material', newMaterial);
    return true;
  }

  generateRandomParams() {
    const randRange = (min, max) => Math.random() * (max - min) + min;
    const toHex = x => Math.floor(x * 40).toString(16).padStart(2, '0');

    return {
      fractal: {
        cx: parseFloat(randRange(-0.5, 1.0).toFixed(3)),
        cy: parseFloat(randRange(-0.8, 0.8).toFixed(3)),
        cz: parseFloat(randRange(-0.8, 0.8).toFixed(3)),
        cw: parseFloat(randRange(-1.0, 1.0).toFixed(3)),
        rotX: parseFloat(randRange(0, 6.283).toFixed(2)),
        rotY: parseFloat(randRange(0, 6.283).toFixed(2)),
        rotZ: parseFloat(randRange(0, 6.283).toFixed(2)),
        rotXW: parseFloat(randRange(0, 6.283).toFixed(2)),
        rotYW: parseFloat(randRange(0, 6.283).toFixed(2)),
        rotZW: parseFloat(randRange(0, 6.283).toFixed(2)),
      },
      material: {
        hue: parseFloat(Math.random().toFixed(3)),
        saturation: parseFloat(randRange(0.4, 1.0).toFixed(3)),
        brightness: parseFloat(randRange(1.0, 2.5).toFixed(1)),
        aoPower: parseFloat(randRange(0.5, 2.2).toFixed(1)),
        specular: parseFloat(Math.pow(2, Math.floor(randRange(2, 6))).toFixed(1)),
        bgColor: `#${toHex(Math.random())}${toHex(Math.random())}${toHex(Math.random())}`
      }
    };
  }
}