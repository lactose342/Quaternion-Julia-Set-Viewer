export class DragGestureHandler {
  constructor(element, callbacks = { onDragStart: null, onDrag: null, onDragEnd: null }) {
    this.element = element;
    this.callbacks = callbacks;
    this.startY = 0;
    this.currentY = 0;
    this.isDragging = false;
    this.ticking = false;

    this._boundDown = this.#onPointerDown.bind(this);
    this._boundMove = this.#onPointerMove.bind(this);
    this._boundUp = this.#onPointerUp.bind(this);

    this.#bindEvents();
  }

  #bindEvents() {
    this.element.addEventListener("pointerdown", this._boundDown);
    window.addEventListener("pointermove", this._boundMove);
    window.addEventListener("pointerup", this._boundUp);
    window.addEventListener("pointercancel", this._boundUp);
  }

  #onPointerDown(e) {
    this.startY = e.clientY;
    this.currentY = this.startY;
    this.isDragging = true;
    this.element.setPointerCapture(e.pointerId);

    if (this.callbacks.onDragStart) {
      this.callbacks.onDragStart(this.startY);
    }
  }

  #onPointerMove(e) {
    if (!this.isDragging) return;
    this.currentY = e.clientY;

    if (!this.ticking) {
      window.requestAnimationFrame(() => {
        if (this.isDragging) {
          const deltaY = this.currentY - this.startY;
          if (this.callbacks.onDrag) {
            this.callbacks.onDrag(deltaY, this.currentY);
          }
        }
        this.ticking = false;
      });
      this.ticking = true;
    }
  }

  #onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    try {
      this.element.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Safe guard
    }

    const deltaY = this.currentY - this.startY;
    if (this.callbacks.onDragEnd) {
      this.callbacks.onDragEnd(deltaY, this.currentY);
    }
  }

  dispose() {
    this.element.removeEventListener("pointerdown", this._boundDown);
    window.removeEventListener("pointermove", this._boundMove);
    window.removeEventListener("pointerup", this._boundUp);
    window.removeEventListener("pointercancel", this._boundUp);
  }
}
