export function createParameterElement(key, def) {
  const sliderGroup = document.createElement("div");
  sliderGroup.className = "slider-group";

  const label = document.createElement("label");
  label.setAttribute("for", def.domId);
  if (def.tooltip) {
    label.setAttribute("title", def.tooltip);
  }

  const labelText = document.createTextNode(def.label + " ");
  label.appendChild(labelText);

  if (def.type !== "color") {
    const span = document.createElement("span");
    span.id = `val-${def.domId}`;
    span.className = "val-label";
    label.appendChild(span);
  }

  sliderGroup.appendChild(label);

  const input = document.createElement("input");
  input.id = def.domId;
  input.setAttribute("data-parameter", key);
  input.type = def.type === "color" ? "color" : "range";
  input.value = def.default;

  if (def.type !== "color") {
    input.setAttribute("min", def.min);
    input.setAttribute("max", def.max);
    input.setAttribute("step", def.step);
  }

  sliderGroup.appendChild(input);
  return sliderGroup;
}

export function createColorPickerElement(key, def) {
  const container = document.createElement("div");
  container.className = "color-picker-group";
  container.id = `group-${def.domId}`;

  const label = document.createElement("label");
  if (def.tooltip) {
    label.setAttribute("title", def.tooltip);
  }

  // Left label text
  const labelText = document.createElement("span");
  labelText.textContent = def.label;
  label.appendChild(labelText);

  // Right side container (hex code and colored swatch)
  const rightContainer = document.createElement("div");
  rightContainer.style.display = "flex";
  rightContainer.style.alignItems = "center";
  rightContainer.style.gap = "8px";

  const valText = document.createElement("span");
  valText.className = "val-label";
  valText.textContent = def.default.toUpperCase();
  rightContainer.appendChild(valText);

  const preview = document.createElement("div");
  preview.className = "color-preview-swatch";
  preview.style.backgroundColor = def.default;
  rightContainer.appendChild(preview);

  label.style.display = "flex";
  label.style.justifyContent = "space-between";
  label.style.alignItems = "center";
  label.style.width = "100%";
  label.appendChild(rightContainer);

  container.appendChild(label);

  const svContainer = document.createElement("div");
  svContainer.className = "sv-container";

  const canvas = document.createElement("canvas");
  canvas.id = `canvas-${def.domId}`;
  canvas.className = "sv-canvas";
  canvas.height = 120;
  svContainer.appendChild(canvas);

  const cursor = document.createElement("div");
  cursor.id = `cursor-${def.domId}`;
  cursor.className = "sv-cursor";
  svContainer.appendChild(cursor);

  container.appendChild(svContainer);

  const hueContainer = document.createElement("div");
  hueContainer.className = "hue-container";

  const hueSlider = document.createElement("input");
  hueSlider.type = "range";
  hueSlider.id = `hue-${def.domId}`;
  hueSlider.className = "hue-slider";
  hueSlider.min = "0";
  hueSlider.max = "360";
  hueSlider.value = "0";
  hueContainer.appendChild(hueSlider);

  container.appendChild(hueContainer);

  const hiddenInput = document.createElement("input");
  hiddenInput.type = "hidden";
  hiddenInput.id = def.domId;
  hiddenInput.setAttribute("data-parameter", key);
  hiddenInput.value = def.default;
  container.appendChild(hiddenInput);

  return container;
}
