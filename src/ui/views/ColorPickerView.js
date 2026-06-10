import { ColorUtils } from "@/infra/ColorUtils.js";

export class ColorPickerView {
  constructor() {
    this.pickers = [];
  }

  init() {
    const pickerGroups = document.querySelectorAll(".color-picker-group");
    pickerGroups.forEach(group => {
      const hiddenInput = group.querySelector("input[type='hidden']");
      const canvas = group.querySelector(".sv-canvas");
      const cursor = group.querySelector(".sv-cursor");
      const hueSlider = group.querySelector(".hue-slider");
      const preview = group.querySelector(".color-preview-swatch");
      const valText = group.querySelector(".val-label");

      if (!hiddenInput || !canvas || !cursor || !hueSlider) return;

      const id = hiddenInput.id;
      const state = {
        id,
        hiddenInput,
        canvas,
        cursor,
        hueSlider,
        preview,
        valText,
        hue: 0,
        sat: 1.0,
        val: 1.0,
        draggingSV: false,
        draggingHue: false
      };

      this.pickers.push(state);

      // Bind slider event
      hueSlider.addEventListener("input", () => {
        state.hue = parseFloat(hueSlider.value);
        this.updatePicker(state, true);
      });

      // Maintain dragging state during slider operations
      hueSlider.addEventListener("pointerdown", () => {
        state.draggingHue = true;
      });
      hueSlider.addEventListener("pointerup", () => {
        state.draggingHue = false;
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
      hueSlider.addEventListener("pointercancel", () => {
        state.draggingHue = false;
      });

      // Bind canvas events
      const getSVFromEvent = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        state.sat = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        state.val = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
      };

      const handleStart = (e) => {
        if (e.touches) {
          e.preventDefault();
        }
        state.draggingSV = true;
        getSVFromEvent(e);

        hiddenInput.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        this.updatePicker(state, true);
      };

      const handleMove = (e) => {
        if (!state.draggingSV) return;
        if (e.touches) {
          e.preventDefault();
        }
        getSVFromEvent(e);
        this.updatePicker(state, true);
      };

      const handleEnd = () => {
        if (!state.draggingSV) return;
        state.draggingSV = false;

        hiddenInput.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      };

      canvas.addEventListener("mousedown", handleStart);
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleEnd);

      canvas.addEventListener("touchstart", handleStart, { passive: false });
      document.addEventListener("touchmove", handleMove, { passive: false });
      document.addEventListener("touchend", handleEnd);

      this.syncFromInput(state);
    });

    window.addEventListener("resize", () => {
      this.syncAll();
    });
  }

  updatePicker(state, shouldDispatch = false) {
    const canvas = state.canvas;
    const ctx = canvas.getContext("2d");
    const w = canvas.clientWidth;
    const h = 120;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // Draw SV Canvas
    const hex = ColorUtils.hsvToHex(state.hue / 360, 1.0, 1.0);
    const gradH = ctx.createLinearGradient(0, 0, w, 0);
    gradH.addColorStop(0, "#ffffff");
    gradH.addColorStop(1, hex);
    ctx.fillStyle = gradH;
    ctx.fillRect(0, 0, w, h);

    const gradV = ctx.createLinearGradient(0, 0, 0, h);
    gradV.addColorStop(0, "rgba(0,0,0,0)");
    gradV.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = gradV;
    ctx.fillRect(0, 0, w, h);

    // Position cursor
    state.cursor.style.left = (state.sat * w) + "px";
    state.cursor.style.top = ((1 - state.val) * h) + "px";

    // Set slider value
    state.hueSlider.value = state.hue;

    // Calculate current selected hex color
    const currentHex = ColorUtils.hsvToHex(state.hue / 360, state.sat, state.val);

    // Update preview element & text in the UI
    if (state.preview) {
      state.preview.style.backgroundColor = currentHex;
    }
    if (state.valText) {
      state.valText.textContent = currentHex.toUpperCase();
    }

    // Dispatch update if interactive
    if (shouldDispatch) {
      state.hiddenInput.value = currentHex;
      state.hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  syncFromInput(state) {
    const hex = state.hiddenInput.value;
    const hsv = ColorUtils.hexToHsv(hex);
    state.hue = hsv.h * 360;
    state.sat = hsv.s;
    state.val = hsv.v;
    this.updatePicker(state, false);
  }

  syncAll() {
    this.pickers.forEach(state => {
      if (state.draggingSV || state.draggingHue) return;
      this.syncFromInput(state);
    });
  }
}