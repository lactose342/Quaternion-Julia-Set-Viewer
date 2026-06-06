import './style.css';
import { StateManager } from './state.js';
import { Renderer } from './Renderer.js';
import { UIController } from './UIController.js';

class App {
    constructor() {
        this.stateManager = new StateManager();
        this.renderer = new Renderer(this.stateManager);
        this.uiController = new UIController(this.stateManager, this.renderer);
    }

    init() {
        // 各モジュールの初期化とイベントバインド
        this.renderer.init();
        this.uiController.init();
        
        // 描画ループの開始
        this.renderer.animate();
    }
}

// アプリを起動
const app = new App();
app.init();