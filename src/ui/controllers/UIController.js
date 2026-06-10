import { UI_IDS } from "@/ui/uiConstants.js";
import { PARAMETER_DEFINITIONS } from "@/core/domain/ParameterDefinitions.js";
import { formatParamForUI } from "@/ui/utils/uiParamFormatter.js";
import { hsvToHex } from "@/infra/ColorUtils.js";

function createParameterElement(key, def) {
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

function createColorPickerElement(key, def) {
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
  hiddenInput.value = def.default;
  container.appendChild(hiddenInput);

  return container;
}

export class UIController {
  constructor(
    domainStore,
    uiStore,
    renderer,
    historyManager,
    exportManager,
    toastView,
    paramController,
    actionController,
    parameterView,
    exportView,
    mainMenuView,
    sharedUiElements,
    colorPickerView,
  ) {
    this.domainStore = domainStore;
    this.uiStore = uiStore;
    this.renderer = renderer;
    this.historyManager = historyManager;
    this.exportManager = exportManager;
    this.toastView = toastView;
    this.paramController = paramController;
    this.actionController = actionController;
    this.parameterView = parameterView;
    this.exportView = exportView;
    this.mainMenuView = mainMenuView;
    this.uiElements = sharedUiElements;
    this.colorPickerView = colorPickerView;
    this.abortController = new AbortController();
    this.qualityTimeoutId = null;
  }

  #generateUI() {
    const container = document.getElementById("parameter-sections-container");
    if (!container) return;

    const SECTION_CONFIGS = [
      {
        id: "section-shape",
        title: "基本形状の調整 (Cパラメータ)",
        open: true,
        groups: ["shape"]
      },
      {
        id: "section-rotation",
        title: "空間の回転 (3D/4D)",
        open: false,
        groups: ["rotation"]
      },
      {
        id: "section-camera",
        title: "カメラと視野角",
        open: false,
        groups: ["camera"]
      },
      {
        id: "section-style",
        title: "色と質感",
        open: false,
        groups: ["style"]
      },
      {
        id: "section-animation",
        title: "アニメーション設定",
        open: false,
        groups: ["animation"]
      }
    ];

    SECTION_CONFIGS.forEach(section => {
      const details = document.createElement("details");
      details.id = section.id;
      if (section.open) details.setAttribute("open", "");

      const summary = document.createElement("summary");
      summary.textContent = section.title;
      details.appendChild(summary);

      const allParams = Object.entries(PARAMETER_DEFINITIONS)
        .filter(([_, def]) => section.groups.includes(def.group) && !def.hideSlider);

      const sliderParams = allParams.filter(([_, def]) => def.type !== "color");
      const colorParams = allParams.filter(([_, def]) => def.type === "color");

      if (sliderParams.length > 0) {
        const sliderGrid = document.createElement("div");
        sliderGrid.className = "grid-container";
        sliderParams.forEach(([key, def]) => {
          sliderGrid.appendChild(createParameterElement(key, def));
        });
        details.appendChild(sliderGrid);
      }

      if (colorParams.length > 0) {
        const colorGrid = document.createElement("div");
        colorGrid.className = "color-picker-grid";
        colorParams.forEach(([key, def]) => {
          colorGrid.appendChild(createColorPickerElement(key, def));
        });
        details.appendChild(colorGrid);
      }

      if (section.id === "section-animation") {
        const nestedDetails = document.createElement("details");
        nestedDetails.id = "section-animation-details";
        nestedDetails.style.marginTop = "10px";
        nestedDetails.style.background = "rgba(255, 255, 255, 0.02)";

        const nestedSummary = document.createElement("summary");
        nestedSummary.textContent = "各パラメータの個別動作設定";
        nestedDetails.appendChild(nestedSummary);

        const nestedContainer = document.createElement("div");
        nestedContainer.style.display = "flex";
        nestedContainer.style.flexDirection = "column";
        nestedContainer.style.gap = "16px";
        nestedContainer.style.marginTop = "10px";

        const axes = ["x", "y", "z", "w"];
        axes.forEach(axis => {
          const axisGrid = document.createElement("div");
          axisGrid.className = "grid-3cols";

          const axisKeys = [`s${axis}`, `a${axis}`, `p${axis}`];
          axisKeys.forEach(key => {
            const def = PARAMETER_DEFINITIONS[key];
            if (def) {
              axisGrid.appendChild(createParameterElement(key, def));
            }
          });
          nestedContainer.appendChild(axisGrid);
        });

        nestedDetails.appendChild(nestedContainer);
        details.appendChild(nestedDetails);
      }

      container.appendChild(details);
    });
  }

  #setupTabs() {
    const tabsContainer = document.getElementById("mobile-tabs-container");
    if (!tabsContainer) return;

    const customUi = document.getElementById("custom-ui");
    const handle = customUi.querySelector(".bottom-sheet-handle");

    const tabButtons = tabsContainer.querySelectorAll(".tab-btn");
    const tabContents = [
      document.getElementById("tab-common"),
      ...Array.from(document.querySelectorAll("#parameter-sections-container > details"))
    ];

    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTabId = btn.getAttribute("data-tab");

        // 全タブボタンのアクティブクラスをリセット
        tabButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // 全コンテンツの表示クラスを切り替え
        tabContents.forEach(content => {
          if (!content) return;
          if (content.id === targetTabId) {
            content.classList.add("active-tab-content");
            if (content.tagName === "DETAILS") {
              content.setAttribute("open", "");
            }
          } else {
            content.classList.remove("active-tab-content");
          }
        });

        // タブ切り替え後にカラーピッカーを強制再描画（表示後の寸法に合わせて解像度を再設定）
        if (this.colorPickerView) {
          this.colorPickerView.syncAll(true);
        }
      });
    });

    // --- モバイルボトムシートのドラッグクローズ処理 ---
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    let hasCaptured = false;

    const onPointerDown = (e) => {
      if (window.innerWidth > 768) return;
      
      startY = e.clientY;
      currentY = e.clientY;
      isDragging = true;
      hasCaptured = false;
      
      // ドラッグ中の追従を良くするためトランジションを一時的にオフ
      customUi.style.transition = "none";
    };

    const onPointerMove = (e) => {
      if (!isDragging || window.innerWidth > 768) return;

      currentY = e.clientY;
      const diffY = currentY - startY;

      // 下方向へのドラッグのみ追従（上には引き上げられないように制限）
      if (diffY > 0) {
        // わずかに動いた（5px以上）時点でキャプチャを開始する（クリックとドラッグの判別）
        if (diffY > 5 && !hasCaptured) {
          hasCaptured = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch (err) {}
        }

        customUi.style.transform = `translateY(${diffY}px)`;
        
        // 設定ボタンの位置もボトムシートに追従させる
        const toggleBtn = document.getElementById("toggle-ui-btn");
        if (toggleBtn) {
          toggleBtn.style.transition = "none";
          toggleBtn.style.bottom = `calc(55dvh + 15px - ${diffY}px)`;
        }
      }
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;

      if (hasCaptured) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }

      // トランジション設定を戻す
      customUi.style.transition = "";
      const toggleBtn = document.getElementById("toggle-ui-btn");
      if (toggleBtn) {
        toggleBtn.style.transition = "";
        toggleBtn.style.bottom = ""; // CSS側の指定に戻す
      }

      const diffY = currentY - startY;
      
      // 100px以上下にドラッグした場合は閉じる
      if (diffY > 100) {
        // 設定を閉じるためにメニューUIトグルのコマンドを発行
        window.dispatchEvent(new CustomEvent("app-command", {
          detail: { type: "TOGGLE_MENU_UI" }
        }));
        
        // アニメーションが終わる頃にtransformスタイルをリセット
        setTimeout(() => {
          customUi.style.transform = "";
        }, 300);
      } else {
        // 元の位置に戻す
        customUi.style.transform = "";
      }
      
      startY = 0;
      currentY = 0;
    };

    // ハンドルとタブバー部分にポインターイベントを登録 (マウス・タッチの両対応)
    if (handle) {
      handle.addEventListener("pointerdown", onPointerDown);
      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", onPointerUp);
      handle.addEventListener("pointercancel", onPointerUp);
    }
    tabsContainer.addEventListener("pointerdown", onPointerDown);
    tabsContainer.addEventListener("pointermove", onPointerMove);
    tabsContainer.addEventListener("pointerup", onPointerUp);
    tabsContainer.addEventListener("pointercancel", onPointerUp);

    // モバイル幅の時はdetailsを最初からopenにして、コンテンツが非表示にならないようにする
    const ensureMobileDetailsOpen = () => {
      if (window.innerWidth <= 768) {
        document.querySelectorAll("#parameter-sections-container > details").forEach(details => {
          details.setAttribute("open", "");
        });
      }
    };

    ensureMobileDetailsOpen();
    window.addEventListener("resize", ensureMobileDetailsOpen);
  }

  init() {
    this.#generateUI();
    this.#setupTabs();

    // 定義スキーマから全スライダー用の DOM ID を動的に生成
    const parameterDomIds = Object.values(PARAMETER_DEFINITIONS).map(def => def.domId);

    const domIds = [
      ...parameterDomIds,
      UI_IDS.EXPORT.CUSTOM_UI,
      UI_IDS.EXPORT.MODAL,
      UI_IDS.EXPORT.PROGRESS_BAR,
      UI_IDS.EXPORT.PROGRESS_TEXT,
      "custom-ui",
      "toggle-ui-btn",
      "fullscreen-btn",
      "preset-select",
      "anim-preset-select",
      "fps-counter",
      "baseColorPicker"
    ];

    domIds.forEach((domId) => {
      const el = document.getElementById(domId);
      if (el) this.uiElements[domId] = el;

      const valLabel = document.getElementById(`val-${domId}`);
      if (valLabel) this.uiElements[`val-${domId}`] = valLabel;
    });

    Object.assign(this.exportView.uiElements, this.uiElements);
    Object.assign(this.mainMenuView.uiElements, this.uiElements);
    Object.assign(this.parameterView.uiElements, this.uiElements);

    this.updateHistoryButtons();
  }

  watchStores(domainStore, uiStore, historyManager) {
    const signal = this.abortController.signal;

    domainStore.addEventListener("domain-updated", (e) => {
      // VRプレゼンテーション中はデスクトップUIの更新をスキップ（VR内FPSの安定化）
      if (this.renderer.renderer && this.renderer.renderer.xr.isPresenting) {
        return;
      }

      const { type, category, keys } = e.detail;
      if (type === "PARAMS") {
        this.synchronizeParameterValues(category, keys);
      } else if (type === "ALL") {
        this.updateUIFromState();
      } else if (type === "ANIM_PHASES") {
        this.synchronizeParameterValues("fractal", ["cx", "cy", "cz", "cw"]);
      }
    }, { signal });

    uiStore.addEventListener("ui-updated", (e) => {
      const { keys } = e.detail;
      this.synchronizeUIState(keys);
    }, { signal });

    if (historyManager) {
      historyManager.addEventListener("history-updated", () => {
        this.updateHistoryButtons();
      }, { signal: this.abortController.signal });
    }
  }

  synchronizeParameterValues(category, changedKeys) {
    const isAutoAnimating = this.uiStore.isAutoAnimating;
    const activeElementId = document.activeElement ? document.activeElement.id : null;

    const displayParams = {};
    const animatedCVec = this.domainStore.getAnimatedC();

    let categoriesToSync = ["fractal", "material", "animation"];
    let keysToSync = null;

    if (category !== "ALL" && category) {
      categoriesToSync = [category];
      if (changedKeys && Array.isArray(changedKeys)) {
        keysToSync = changedKeys;
      }
    }

    categoriesToSync.forEach((cat) => {
      const catParams = this.domainStore.getParams(cat);
      if (!catParams) return;

      displayParams[cat] = {};
      const targetKeys = keysToSync || Object.keys(catParams);

      targetKeys.forEach((key) => {
        const value = catParams[key];
        if (value === undefined) return;

        let displayValue = value;
        if (cat === "fractal" && ["cx", "cy", "cz", "cw"].includes(key)) {
          displayValue = animatedCVec[key];
        }

        const { numericValue, displayString } = formatParamForUI(key, displayValue);
        displayParams[cat][key] = {
          value: numericValue,
          displayText: displayString,
        };
      });
    });

    const isAll = (category === "ALL" || !category);
    const hasColorChange = category === "material" && (changedKeys && (changedKeys.includes("hue") || changedKeys.includes("saturation")));

    if (isAll || hasColorChange) {
      const matParams = this.domainStore.getParams("material");
      if (matParams && matParams.hue !== undefined && matParams.saturation !== undefined) {
        const hexColor = hsvToHex(matParams.hue, matParams.saturation, 1.0);
        if (!displayParams.material) displayParams.material = {};
        displayParams.material["baseColorPicker"] = {
          value: hexColor,
          displayText: hexColor
        };
      }
    }

    this.parameterView.update(displayParams, isAutoAnimating, activeElementId);

    if (this.colorPickerView) {
      if (isAll || hasColorChange) {
        this.colorPickerView.syncAll();
      }
    }
  }

  synchronizeUIState(changedKeys) {
    const uiState = this.uiStore.getState();
    this.exportView.update(uiState);
    this.mainMenuView.updatePresets(uiState.activePreset, uiState.activeAnimPreset);

    const customUi = this.uiElements["custom-ui"];
    if (customUi) {
      customUi.classList.toggle("is-interacting", !!uiState.isInteracting);
    }

    if (changedKeys && (changedKeys.includes("isInteracting") || changedKeys.includes("isAutoAnimating"))) {
      this.updateRenderQuality();
    }

    if (changedKeys && (changedKeys.includes("isAutoAnimating") || changedKeys.includes("isDownloading"))) {
      this.updateHistoryButtons();
    }
  }

  updateUIFromState() {
    this.synchronizeParameterValues("ALL", null);
    this.synchronizeUIState(null);
    this.updateHistoryButtons();
  }

  updateHistoryButtons() {
    if (!this.historyManager) return;
    const status = this.historyManager.getStatus();
    const isAutoAnimating = this.uiStore.isAutoAnimating;

    const undoBtn = document.getElementById("undo-btn");
    const redoBtn = document.getElementById("redo-btn");
    const presetSelect = this.uiElements["preset-select"];
    const playBtn = document.getElementById("auto-animate-btn");

    if (undoBtn) undoBtn.disabled = !status.canUndo || isAutoAnimating;
    if (redoBtn) redoBtn.disabled = !status.canRedo || isAutoAnimating;
    if (presetSelect) presetSelect.disabled = isAutoAnimating;

    if (playBtn) {
      playBtn.classList.toggle("is-playing", isAutoAnimating);
    }

    ["cx", "cy", "cz", "cw"].forEach((id) => {
      const el = this.uiElements[id];
      if (el) el.disabled = isAutoAnimating;
    });
  }

  updateRenderQuality() {
    const uiState = this.uiStore.getState();
    if (uiState.isDownloading) return;

    if (uiState.isInteracting || uiState.isAutoAnimating) {
      if (this.qualityTimeoutId) {
        clearTimeout(this.qualityTimeoutId);
        this.qualityTimeoutId = null;
      }
      this.renderer.setQuality("LOW");
    } else {
      if (this.qualityTimeoutId) {
        clearTimeout(this.qualityTimeoutId);
      }
      this.qualityTimeoutId = setTimeout(() => {
        const currentUiState = this.uiStore.getState();
        if (!currentUiState.isInteracting && !currentUiState.isAutoAnimating) {
          this.renderer.setQuality(currentUiState.renderQuality || "HIGH");
        }
        this.qualityTimeoutId = null;
      }, 300);
    }
  }

  dispose() {
    this.abortController.abort();
    if (this.qualityTimeoutId) {
      clearTimeout(this.qualityTimeoutId);
    }
  }
}