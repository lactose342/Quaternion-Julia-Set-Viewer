export class BottomSheetView {
  constructor() {
    this.customUi = document.getElementById("custom-ui");
    this.handle = this.customUi?.querySelector(".bottom-sheet-handle");
    this.tabsContainer = document.getElementById("mobile-tabs-container");

    this.startY = 0;
    this.currentY = 0;
    this.isDragging = false;
    this.hasCaptured = false;
  }

  init() {
    if (!this.customUi) return;

    const onPointerDown = (e) => {
      if (window.innerWidth > 768) return;
      
      this.startY = e.clientY;
      this.currentY = e.clientY;
      this.isDragging = true;
      this.hasCaptured = false;
      
      this.customUi.style.transition = "none";
    };

    const onPointerMove = (e) => {
      if (!this.isDragging || window.innerWidth > 768) return;

      this.currentY = e.clientY;
      const diffY = this.currentY - this.startY;

      if (diffY > 0) {
        if (diffY > 5 && !this.hasCaptured) {
          this.hasCaptured = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch (err) {}
        }

        this.customUi.style.transform = `translateY(${diffY}px)`;
        
        const toggleBtn = document.getElementById("toggle-ui-btn");
        if (toggleBtn) {
          toggleBtn.style.transition = "none";
          toggleBtn.style.bottom = `calc(55dvh + 15px - ${diffY}px)`;
        }
      }
    };

    const onPointerUp = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      if (this.hasCaptured) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }

      this.customUi.style.transition = "";
      const toggleBtn = document.getElementById("toggle-ui-btn");
      if (toggleBtn) {
        toggleBtn.style.transition = "";
        toggleBtn.style.bottom = "";
      }

      const diffY = this.currentY - this.startY;
      
      if (diffY > 100) {
        window.dispatchEvent(new CustomEvent("app-command", {
          detail: { type: "TOGGLE_MENU_UI" }
        }));
        
        setTimeout(() => {
          this.customUi.style.transform = "";
        }, 300);
      } else {
        this.customUi.style.transform = "";
      }
      
      this.startY = 0;
      this.currentY = 0;
    };

    if (this.handle) {
      this.handle.addEventListener("pointerdown", onPointerDown);
      this.handle.addEventListener("pointermove", onPointerMove);
      this.handle.addEventListener("pointerup", onPointerUp);
      this.handle.addEventListener("pointercancel", onPointerUp);
    }
    if (this.tabsContainer) {
      this.tabsContainer.addEventListener("pointerdown", onPointerDown);
      this.tabsContainer.addEventListener("pointermove", onPointerMove);
      this.tabsContainer.addEventListener("pointerup", onPointerUp);
      this.tabsContainer.addEventListener("pointercancel", onPointerUp);
    }
  }
}
