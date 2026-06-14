import { CONFIG } from "@/config/config.js";

export class OnboardingView {
  constructor() {
    this.currentStep = 0;
    this.steps = [
      {
        targetId: "preset-select",
        title: "デザインを選ぶ",
        body: "まずは一覧から好みの形を選んでみてください。ワンタップで世界観がガラッと変わります。"
      },
      {
        targetId: "auto-animate-btn",
        title: "動きをつける",
        body: "再生ボタンを押すと、立体が生き物のように変化し始めます。4次元特有の不思議な動きを楽しめます。"
      },
      {
        targetId: "random-btn",
        title: "偶然に任せる",
        body: "「おまかせ作成」ボタンを押すと、パラメータがランダムに変化し、思わぬデザインを発見できます。"
      },
      {
        targetId: "parameter-sections-container",
        targetIdMobile: "mobile-tabs-container",
        title: "理想の形を探す",
        body: "スライダーで形や色、質感などのパラメータを調整して、自分だけのデザインを作りだせます。",
      },
      {
        targetId: "download-and-share",
        title: "作品を残す",
        body: "お気に入りの瞬間が見つかったら「撮影モード」で高画質な壁紙画像として保存したり、SNSで共有したりできます。"
      }
    ];

    this.onResize = this.#handleResize.bind(this);
  }

  init(onCompleteCallback) {
    this.onComplete = onCompleteCallback;

    // DOM要素のバインド (init時に実行することでロードタイミングの問題を回避)
    this.overlay = document.getElementById("onboarding-overlay");
    this.card = document.getElementById("onboarding-card");
    this.titleEl = document.getElementById("onboarding-title");
    this.bodyEl = document.getElementById("onboarding-body");
    this.stepIndicator = document.getElementById("onboarding-step-indicator");
    this.nextBtn = document.getElementById("onboarding-next-btn");
    this.skipBtn = document.getElementById("onboarding-skip-btn");
    this.spotlightRect = document.getElementById("spotlight-rect");

    if (this.nextBtn) {
      this.nextBtn.addEventListener("click", () => this.nextStep());
    }
    if (this.skipBtn) {
      this.skipBtn.addEventListener("click", () => this.endTour());
    }

    // 初回訪問のチェック
    const hasSeenTour = localStorage.getItem("has_seen_onboarding_tour");
    if (!hasSeenTour) {
      // 少しディレイを置いて起動（レンダリングの安定を待つ）
      setTimeout(() => this.startTour(), 800);
    }
  }

  startTour() {
    if (!this.overlay) return;
    this.currentStep = 0;
    this.overlay.classList.remove("hidden");

    // ツアー中は設定パネルを開き、共通タブを表示することを保証する
    this.#ensureUIState();

    this.#showStep(this.currentStep);
    window.addEventListener("resize", this.onResize);
  }

  nextStep() {
    this.currentStep++;
    if (this.currentStep >= this.steps.length) {
      this.endTour();
    } else {
      this.#showStep(this.currentStep);
    }
  }

  endTour() {
    if (this.overlay) {
      this.overlay.classList.add("hidden");
    }
    this.#clearHighlight();
    localStorage.setItem("has_seen_onboarding_tour", "true");
    window.removeEventListener("resize", this.onResize);

    if (this.onComplete) {
      this.onComplete();
    }
  }

  #showStep(stepIdx) {
    const step = this.steps[stepIdx];
    if (!step) return;

    // テキスト更新
    if (this.titleEl) this.titleEl.textContent = step.title;
    if (this.bodyEl) this.bodyEl.textContent = step.body;
    if (this.stepIndicator) this.stepIndicator.textContent = `${stepIdx + 1}/${this.steps.length}`;

    if (this.nextBtn) {
      this.nextBtn.textContent = stepIdx === this.steps.length - 1 ? "スタート！" : "次へ";
    }

    this.#highlightElement(step);
  }

  #highlightElement(step) {
    this.#clearHighlight();

    if (!step) return;

    const isMobile = window.innerWidth <= CONFIG.SYSTEM.BREAKPOINT;
    const targetId = (isMobile && step.targetIdMobile) ? step.targetIdMobile : step.targetId;
    const target = document.getElementById(targetId);

    if (!target) {
      // 対象が見つからない場合は中央にマスク配置
      this.#setSpotlight(0, 0, 0, 0);
      this.#positionCardCenter();
      return;
    }

    this.currentTargetId = targetId;
    target.classList.add("onboarding-target-highlight");

    const rect = target.getBoundingClientRect();
    const padding = 6;

    // スポットライトマスクの更新
    this.#setSpotlight(
      rect.left - padding,
      rect.top - padding,
      rect.width + padding * 2,
      rect.height + padding * 2
    );

    // カード位置の更新
    this.#positionCard(rect);
  }

  #clearHighlight() {
    if (this.currentTargetId) {
      const prevTarget = document.getElementById(this.currentTargetId);
      if (prevTarget) {
        prevTarget.classList.remove("onboarding-target-highlight");
      }
      this.currentTargetId = null;
    }
  }

  #setSpotlight(x, y, w, h) {
    if (!this.spotlightRect) return;
    this.spotlightRect.setAttribute("x", String(x));
    this.spotlightRect.setAttribute("y", String(y));
    this.spotlightRect.setAttribute("width", String(w));
    this.spotlightRect.setAttribute("height", String(h));
  }

  #positionCard(targetRect) {
    if (!this.card) return;

    const isMobile = window.innerWidth <= CONFIG.SYSTEM.BREAKPOINT;
    if (isMobile) {
      // モバイル時はCSSメディアクエリで中央配置にするためJS位置指定はパス
      this.card.style.top = "";
      this.card.style.left = "";
      this.card.style.transform = "";
      return;
    }

    const cardWidth = 300;
    const cardHeight = this.card.offsetHeight || 180;
    const gap = 15;

    let top = targetRect.top + (targetRect.height / 2) - (cardHeight / 2);
    let left = targetRect.left - cardWidth - gap;

    // 左側にスペースがない場合は右側に配置
    if (left < 20) {
      left = targetRect.right + gap;
    }

    // 上下の画面はみ出し防止
    top = Math.max(20, Math.min(top, window.innerHeight - cardHeight - 20));
    left = Math.max(20, Math.min(left, window.innerWidth - cardWidth - 20));

    this.card.style.top = `${top}px`;
    this.card.style.left = `${left}px`;
    this.card.style.transform = "none";
  }

  #positionCardCenter() {
    if (!this.card) return;
    this.card.style.top = "50%";
    this.card.style.left = "50%";
    this.card.style.transform = "translate(-50%, -50%)";
  }

  #handleResize() {
    if (this.overlay && !this.overlay.classList.contains("hidden") && this.currentStep !== undefined) {
      // リサイズ時に対象要素の位置に合わせてスポットライトとカードを再計算
      this.#highlightElement(this.steps[this.currentStep]);
    }
  }

  #ensureUIState() {
    // A. 設定UIが閉じている場合は開く
    const customUi = document.getElementById("custom-ui");
    const toggleBtn = document.getElementById("toggle-ui-btn");
    if (customUi && customUi.classList.contains("hidden") && toggleBtn) {
      toggleBtn.click();
    }

    // B. モバイル時は「共通設定」タブを表示する
    const commonTabBtn = document.querySelector('.tab-btn[data-tab="tab-common"]');
    if (commonTabBtn && !commonTabBtn.classList.contains("active")) {
      commonTabBtn.click();
    }
  }
}
