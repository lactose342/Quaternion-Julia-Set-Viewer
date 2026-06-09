import { Command } from "./Command.js";

export class ToggleMenuCommand extends Command {
  constructor(mainMenuView) {
    super();
    this.mainMenuView = mainMenuView;
  }

  execute() {
    this.mainMenuView.toggleMenu(); 
  }
}