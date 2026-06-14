import { bootstrap } from "@/bootstrap.js";
import { CONFIG } from "@/config/config.js";

document.addEventListener("DOMContentLoaded", () => {
  const app = bootstrap(CONFIG);
  app.init();
});