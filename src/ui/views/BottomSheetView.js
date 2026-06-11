import { DragGestureHandler } from "@/ui/utils/DragGestureHandler.js";

export class BottomSheetView {
  constructor() {
    this.customUi = document.getElementById("custom-ui");
    this.handle = this.customUi?.querySelector(".bottom-sheet-handle");
    this.tabsContainer = document.getElementById("mobile-tabs-container");
    this.handlers = [];
  }

  init() {
    if (!this.customUi) return;

    const onDragStart = () => {
      if (window.innerWidth > 768) return;
      this.customUi.style.transition = "none";
    };

    const onDrag = (deltaY) => {
      if (window.innerWidth > 768) return;
      
      if (deltaY > 0) {
        this.customUi.style.transform = `translateY(${deltaY}px)`;
        
        const toggleBtn = document.getElementById("toggle-ui-btn");
        if (toggleBtn) {
          toggleBtn.style.transition = "none";
          toggleBtn.style.bottom = `calc(55dvh + 15px - ${deltaY}px)`;
        }
      }
    };

    const onDragEnd = (deltaY) => {
      this.customUi.style.transition = "";
      const toggleBtn = document.getElementById("toggle-ui-btn");
      if (toggleBtn) {
        toggleBtn.style.transition = "";
        toggleBtn.style.bottom = "";
      }

      if (deltaY > 100 && window.innerWidth <= 768) {
        window.dispatchEvent(new CustomEvent("app-command", {
          detail: { type: "TOGGLE_MENU_UI" }
        }));
        
        setTimeout(() => {
          this.customUi.style.transform = "";
        }, 300);
      } else {
        this.customUi.style.transform = "";
      }
    };

    const dragCallbacks = { onDragStart, onDrag, onDragEnd };
    if (this.handle) {
      this.handlers.push(new DragGestureHandler(this.handle, dragCallbacks));
    }
    if (this.tabsContainer) {
      this.handlers.push(new DragGestureHandler(this.tabsContainer, dragCallbacks));
    }
  }

  dispose() {
    this.handlers.forEach(handler => handler.dispose());
    this.handlers = [];
  }
}
