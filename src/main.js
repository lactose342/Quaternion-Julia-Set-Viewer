import './style.css';
import { StateManager } from './state.js';
import { Renderer } from './Renderer.js';
import { UIController } from './UIController.js';
import { AnimationController } from './AnimationController.js';

class App {
constructor() {
        this.stateManager = new StateManager();
        this.renderer = new Renderer(this.stateManager);
        this.uiController = new UIController(this.stateManager, this.renderer);
        this.animationController = new AnimationController(this.stateManager, this.renderer);

        // クラス間の配線（依存注入とシグナル結合）
        this.renderer.animationController = this.animationController;
        this.uiController.animationController = this.animationController;
        this.animationController.onUpdate = () => this.uiController.updateUIFromState();
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