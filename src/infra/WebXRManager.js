export class WebXRManager extends EventTarget {
  constructor(rendererWrapper) {
    super();
    this.rendererWrapper = rendererWrapper; // Rendererクラスのラッパー
    this.currentSession = null;
    this.isSupported = false;
  }

  async checkSupport() {
    if ('xr' in navigator) {
      this.isSupported = await navigator.xr.isSessionSupported('immersive-vr');
      const error = this.isSupported ? null : 'このデバイスでVRモードはサポートされていません';
      this.dispatchEvent(new CustomEvent('support-checked', { detail: { supported: this.isSupported, error } }));
    } else {
      const error = window.isSecureContext === false ? 'HTTPS環境が必要です' : 'このブラウザはVRモードをサポートしていません';
      this.dispatchEvent(new CustomEvent('support-checked', { detail: { supported: false, error } }));
    }
  }

  async toggleSession() {
    if (!this.isSupported) return;

    // 1. VRモードを開始する
    if (this.currentSession === null) {
      // Three.js r184環境でエラーの原因となる不要な拡張を排除
      const sessionInit = { optionalFeatures: ['local-floor', 'hand-tracking'] };
      
      try {
        const session = await navigator.xr.requestSession('immersive-vr', sessionInit);
        
        // クリーンアップイベント
        session.addEventListener('end', () => {
          this.currentSession = null;
          this.dispatchEvent(new CustomEvent('session-ended'));
        });

        // 【最重要】Three.js r184 の WebXRManager に対し、
        // セッションを適用する前に、内部コンテキストの整合性を強制的に合わせる
        const glRenderer = this.rendererWrapper.renderer;
        
        // 先に Three.js 側のコンテキスト状態をXR用に更新させ、その後にSessionをセットする
        if (glRenderer.xr.setReferenceSpaceType) {
          glRenderer.xr.setReferenceSpaceType('local-floor');
        }
        
        // 生の XRSession を流し込む
        await glRenderer.xr.setSession(session);

        // 完全にThree.js内の XRWebGLBinding が成功した後にフラグを確定する
        this.currentSession = session;
        
        this.dispatchEvent(new CustomEvent('session-started'));
      } catch (e) {
        console.error("VR Session failed", e);
        this.currentSession = null;
      }
    } 
    // 2. VRモードを終了する
    else {
      try {
        await this.currentSession.end();
      } catch (e) {
        console.error("VR Session end failed", e);
      } finally {
        this.currentSession = null;
        this.dispatchEvent(new CustomEvent('session-ended'));
      }
    }
  }
}