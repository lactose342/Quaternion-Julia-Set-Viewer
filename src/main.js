import { App } from "@/App.js";
import { CONFIG } from "@/config/config.js";

document.addEventListener("DOMContentLoaded", () => {
  const app = new App(CONFIG);
  app.init();
});