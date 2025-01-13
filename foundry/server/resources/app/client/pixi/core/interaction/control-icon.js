/**
 * A generic helper for drawing a standard Control Icon
 * @type {PIXI.Container}
 */
class ControlIcon extends PIXI.Container {
  constructor({texture, size=40, borderColor=0xFF5500, tint=null, elevation=0}={}, ...args) {
    super(...args);

    // Define arguments
    this.iconSrc = texture;
    this.size = size;
    this.rect = [-2, -2, size+4, size+4];
    this.borderColor = borderColor;

    /**
     * The color of the icon tint, if any
     * @type {number|null}
     */
    this.tintColor = tint;

    // Define hit area
    this.eventMode = "static";
    this.interactiveChildren = false;
    this.hitArea = new PIXI.Rectangle(...this.rect);
    this.cursor = "pointer";

    // Background
    this.bg = this.addChild(new PIXI.Graphics());
    this.bg.clear().beginFill(0x000000, 0.4).lineStyle(2, 0x000000, 1.0).drawRoundedRect(...this.rect, 5).endFill();

    // Icon
    this.icon = this.addChild(new PIXI.Sprite());

    // Border
    this.border = this.addChild(new PIXI.Graphics());
    this.border.visible = false;

    // Elevation
    this.tooltip = this.addChild(new PreciseText());
    this.tooltip.visible = false;

    // Set the initial elevation
    this.elevation = elevation;

    // Draw asynchronously
    this.draw();
  }

  /* -------------------------------------------- */

  /**
   * The elevation of the ControlIcon, which is displayed in its tooltip text.
   * @type {number}
   */
  get elevation() {
    return this.#elevation;
  }

  set elevation(value) {
    if ( (typeof value !== "number") || !Number.isFinite(value) ) {
      throw new Error("ControlIcon#elevation must be a finite numeric value.");
    }
    if ( value === this.#elevation ) return;
    this.#elevation = value;
    this.tooltip.text = `${value > 0 ? "+" : ""}${value} ${canvas.grid.units}`.trim();
    this.tooltip.visible = value !== 0;
  }

  #elevation = 0;

  /* -------------------------------------------- */

  /**
   * Initial drawing of the ControlIcon
   * @returns {Promise<ControlIcon>}
   */
  async draw() {
    if ( this.destroyed ) return this;
    this.texture = this.texture ?? await loadTexture(this.iconSrc);
    this.icon.texture = this.texture;
    this.icon.width = this.icon.height = this.size;
    this.tooltip.style = CONFIG.canvasTextStyle;
    this.tooltip.anchor.set(0.5, 1);
    this.tooltip.position.set(this.size / 2, -12);
    return this.refresh();
  }

  /* -------------------------------------------- */

  /**
   * Incremental refresh for ControlIcon appearance.
   */
  refresh({visible, iconColor, borderColor, borderVisible}={}) {
    if ( iconColor !== undefined ) this.tintColor = iconColor;
    this.icon.tint = this.tintColor ?? 0xFFFFFF;
    if ( borderColor !== undefined ) this.borderColor = borderColor;
    this.border.clear().lineStyle(2, this.borderColor, 1.0).drawRoundedRect(...this.rect, 5).endFill();
    if ( borderVisible !== undefined ) this.border.visible = borderVisible;
    if ( visible !== undefined && (this.visible !== visible) ) {
      this.visible = visible;
      MouseInteractionManager.emulateMoveEvent();
    }
    return this;
  }
}
