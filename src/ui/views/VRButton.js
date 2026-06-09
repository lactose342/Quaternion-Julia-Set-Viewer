export const VRButton = {
  createButton: function (renderer) {
    const button = document.createElement("button");
    button.id = "VRButton";

    function showEnterVR() {
      let currentSession = null;

      async function onSessionStarted(session) {
        session.addEventListener("end", onSessionEnded);

        await renderer.xr.setSession(session);

        button.title = "VRモードを終了する";
        currentSession = session;
      }

      function onSessionEnded() {
        currentSession.removeEventListener("end", onSessionEnded);
        button.title = "VRモードを開始する";
        currentSession = null;
      }

      button.title = "VRモードを開始する";
      button.onclick = function () {
        if (currentSession === null) {
          // エラーの温床となる layers などの不要なオプションを削除し安定化
          const sessionInit = { optionalFeatures: ["local-floor", "hand-tracking"] };
          navigator.xr.requestSession("immersive-vr", sessionInit).then(onSessionStarted);
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
      button.title = "VR対応を確認中...";
      navigator.xr.isSessionSupported("immersive-vr").then((supported) => {
        if (supported) {
          showEnterVR();
        } else {
          disableButton("このデバイスでVRモードはサポートされていません");
        }
      });
    } else {
      disableButton(
        window.isSecureContext === false
          ? "HTTPS環境が必要です"
          : "このブラウザはVRモードをサポートしていません"
      );
    }

    return button;
  },
};