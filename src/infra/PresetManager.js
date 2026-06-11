import { hsvToHex } from "./ColorUtils.js";

export class PresetManager {
  constructor(config, domainStore) {
    this.config = config;
    this.domainStore = domainStore;
  }

  getPresetData(presetName) {
    const preset = this.config.PRESETS[presetName];
    if (!preset) return null;

    const newFractal = this.domainStore.fillDefaults("fractal", preset);
    const newMaterial = this.domainStore.fillDefaults("material", preset);
    const newCamera = this.domainStore.fillDefaults("camera", preset);

    const cameraPose = preset.camera || { position: { x: 0, y: 0, z: 2 }, target: { x: 0, y: 0, z: 0 } };

    return { fractal: newFractal, material: newMaterial, camera: newCamera, cameraPose };
  }

  generateRandomParams() {
    const randRange = (min, max) => Math.random() * (max - min) + min;

    return {
      fractal: {
        cx: parseFloat(randRange(-0.5, 0.8).toFixed(3)),
        cy: parseFloat(randRange(-0.7, 0.7).toFixed(3)),
        cz: parseFloat(randRange(-0.7, 0.7).toFixed(3)),
        cw: parseFloat(randRange(-0.6, 0.6).toFixed(3)),
        rotX: parseFloat(randRange(0, 6.283).toFixed(2)),
        rotY: parseFloat(randRange(0, 6.283).toFixed(2)),
        rotZ: parseFloat(randRange(0, 6.283).toFixed(2)),
        rotXW: parseFloat(randRange(0, 6.283).toFixed(2)),
        rotYW: parseFloat(randRange(0, 6.283).toFixed(2)),
        rotZW: parseFloat(randRange(0, 6.283).toFixed(2))
      },
      material: {
        hue: parseFloat(Math.random().toFixed(3)),
        saturation: parseFloat(randRange(0.4, 1.0).toFixed(3)),
        value: 1.0,
        brightness: parseFloat(randRange(1.0, 2.5).toFixed(1)),
        aoPower: parseFloat(randRange(0.5, 2.2).toFixed(1)),
        specular: parseFloat(Math.pow(2, Math.floor(randRange(2, 6))).toFixed(1)),
        bgColor: hsvToHex(Math.random(), randRange(0.0, 0.4), Math.random())
      },
      camera: {
        fov: 45.0,
        zoom: 1.0
      }
    };
  }
}