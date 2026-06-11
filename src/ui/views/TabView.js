export class TabView {
  constructor(colorPickerView) {
    this.colorPickerView = colorPickerView;
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

        // タブ切り替え後にカラーピッカーを強制再描画（表示後の寸法に合わせて解像度を再設定）
        if (this.colorPickerView) {
          this.colorPickerView.syncAll(true);
        }
      });
    });

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
}
