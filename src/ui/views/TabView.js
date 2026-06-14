import { CONFIG } from "@/config/config.js";

export class TabView extends EventTarget {
  constructor() {
    super();
    this.tabsContainer = document.getElementById("mobile-tabs-container");
  }

  init() {
    if (!this.tabsContainer) return;

    const tabButtons = this.tabsContainer.querySelectorAll(".tab-btn");
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

        // タブ切り替えイベントを通知
        this.dispatchEvent(new CustomEvent("tab-changed", { detail: { tabId: targetTabId } }));
      });
    });

    // モバイル幅の時はdetailsを最初からopenにして、コンテンツが非表示にならないようにする
    const ensureMobileDetailsOpen = () => {
      if (window.innerWidth <= CONFIG.SYSTEM.BREAKPOINT) {
        document.querySelectorAll("#parameter-sections-container > details").forEach(details => {
          details.setAttribute("open", "");
        });
      }
    };

    ensureMobileDetailsOpen();
    window.addEventListener("resize", ensureMobileDetailsOpen);
  }
}
