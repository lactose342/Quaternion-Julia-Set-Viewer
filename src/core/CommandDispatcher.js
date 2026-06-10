export class CommandDispatcher {
  constructor() {
    this.commands = new Map();
    this.abortController = new AbortController();
  }

  register(type, command) {
    console.log(`[Dispatcher] コマンド登録: ${type}`);
    this.commands.set(type, command);
  }

  listen() {
    console.log("[Dispatcher] app-command イベントの監視を開始しました");
    window.addEventListener("app-command", async (e) => {
      const { type, ...payload } = e.detail;
      console.log(`[Dispatcher] コマンド受信: ${type}`);

      const command = this.commands.get(type);

      if (command) {
        console.log(`[Dispatcher] コマンド実行開始: ${type}`);
        try {
          await command.execute(payload);
          console.log(`[Dispatcher] 実行完了: ${type}`);
        } catch (error) {
          console.error(`[Dispatcher] 実行時エラー [${type}]:`, error);
        }
      } else {
        console.warn(`[Dispatcher] 未定義のコマンドです: ${type}`);
      }
    }, { signal: this.abortController.signal });
  }

  dispose() {
    this.abortController.abort();
  }
}