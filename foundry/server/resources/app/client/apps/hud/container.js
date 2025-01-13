/**
 * The Heads-Up Display is a canvas-sized Application which renders HTML overtop of the game canvas.
 */
class HeadsUpDisplay extends Application {

  /**
   * Token HUD
   * @type {TokenHUD}
   */
  token = new CONFIG.Token.hudClass();

  /**
   * Tile HUD
   * @type {TileHUD}
   */
  tile = new CONFIG.Tile.hudClass();

  /**
   * Drawing HUD
   * @type {DrawingHUD}
   */
  drawing = new CONFIG.Drawing.hudClass();

  /**
   * Chat Bubbles
   * @type {ChatBubbles}
   */
  bubbles = new CONFIG.Canvas.chatBubblesClass();

  /* -------------------------------------------- */

  /** @inheritdoc */
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.id = "hud";
    options.template = "templates/hud/hud.html";
    options.popOut = false;
    return options;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getData(options={}) {
    if ( !canvas.ready ) return {};
    return {
      width: canvas.dimensions.width,
      height: canvas.dimensions.height
    };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _render(force, options) {
    await super._render(force, options);
    this.align();
  }

  /* -------------------------------------------- */

  /**
   * Align the position of the HUD layer to the current position of the canvas
   */
  align() {
    const hud = this.element[0];
    const {x, y} = canvas.primary.getGlobalPosition();
    const scale = canvas.stage.scale.x;
    hud.style.left = `${x}px`;
    hud.style.top = `${y}px`;
    hud.style.transform = `scale(${scale})`;
  }
}
