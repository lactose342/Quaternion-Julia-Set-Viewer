import { App } from "@/App.js";
import { CONFIG } from "@/config/config.js";
import { PARAMETER_DEFINITIONS } from "@/core/domain/ParameterDefinitions.js";

document.addEventListener("DOMContentLoaded", () => {
  const fractalKeys = Object.entries(PARAMETER_DEFINITIONS)
    .filter(([_, d]) => d.category === "fractal" && !d.isPseudo)
    .map(([k]) => k);

  const materialKeys = Object.entries(PARAMETER_DEFINITIONS)
    .filter(([_, d]) => d.category === "material" && !d.isPseudo)
    .map(([k]) => k);

  const animationKeys = Object.entries(PARAMETER_DEFINITIONS)
    .filter(([_, d]) => d.category === "animation" && !d.isPseudo)
    .map(([k]) => k);

  const cameraKeys = Object.entries(PARAMETER_DEFINITIONS)
    .filter(([_, d]) => d.category === "camera" && !d.isPseudo)
    .map(([k]) => k);

  const mergedConfig = {
    ...CONFIG,
    SCHEMAS: {
      ...CONFIG.SCHEMAS,
      fractal: fractalKeys,
      material: materialKeys,
      animation: animationKeys,
      camera: cameraKeys
    },
    definitions: PARAMETER_DEFINITIONS
  };

  const app = new App(mergedConfig);
  app.init();
});