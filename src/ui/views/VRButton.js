export const VRButton = {
  createButton: function (renderer) {
    const button = document.createElement("button");
    button.id = "VRButton";

    function showEnterXR(mode) {
      let currentSession = null;
      const isAR = mode === "immersive-ar";
      const startTitle = isAR ? "ARモードを開始する" : "VRモードを開始する";
      const endTitle = isAR ? "ARモードを終了する" : "VRモードを終了する";

      async function onSessionStarted(session) {
        session.addEventListener("end", onSessionEnded);

        await renderer.xr.setSession(session);

        button.title = endTitle;
        button.classList.add("xr-active");
        currentSession = session;
      }

      function onSessionEnded() {
        currentSession.removeEventListener("end", onSessionEnded);
        button.title = startTitle;
        button.classList.remove("xr-active");
        currentSession = null;
      }

      button.title = startTitle;
      button.onclick = function () {
        if (currentSession === null) {
          const sessionInit = { optionalFeatures: ["local-floor", "hand-tracking"] };
          navigator.xr.requestSession(mode, sessionInit).then(onSessionStarted);
        } else {
          currentSession.end();
        }
      };
    }

    function disableButton(text) {
      button.disabled = true;
      button.title = text;
    }

    if ("xr" in navigator) {
      button.title = "XR対応を確認中...";
      // 1. まずはパススルーAR (immersive-ar) が利用可能かチェック
      navigator.xr.isSessionSupported("immersive-ar").then((arSupported) => {
        if (arSupported) {
          showEnterXR("immersive-ar");
        } else {
          // 2. 利用不可なら没入型VR (immersive-vr) が利用可能かチェック
          navigator.xr.isSessionSupported("immersive-vr").then((vrSupported) => {
            if (vrSupported) {
              showEnterXR("immersive-vr");
            } else {
              disableButton("このデバイスでAR/VRモードはサポートされていません");
            }
          });
        }
      });
    } else {
      disableButton(
        window.isSecureContext === false
          ? "HTTPS環境が必要です"
          : "このブラウザはXRモードをサポートしていません"
      );
    }

    return button;
  },
};