export class StateManager {
    constructor() {
        this.current = {
            isAutoAnimating: false,
            isInteracting: false,
            isDownloading: false,
            camera: {
                position: { x: 0, y: 0, z: 2 },
                target: { x: 0, y: 0, z: 0 }
            },
            params: {
                fractal: {
                    baseCx: -0.517,
                    baseCy: -0.341,
                    baseCz: -0.407,
                    baseCw: -0.071
                },
                material: {},
                animation: {}
            }
        };

        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 30;
    }

    pushHistory() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        const snapshot = {
            params: structuredClone(this.current.params),
            camera: structuredClone(this.current.camera)
        };

        this.history.push(snapshot);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        this.historyIndex = this.history.length - 1;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            return structuredClone(this.history[this.historyIndex]);
        }
        return null;
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            return structuredClone(this.history[this.historyIndex]);
        }
        return null;
    }

    getHistoryStatus() {
        return {
            canUndo: this.historyIndex > 0,
            canRedo: this.historyIndex < this.history.length - 1
        };
    }
}