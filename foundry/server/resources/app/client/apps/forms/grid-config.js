/**
 * A tool for fine-tuning the grid in a Scene
 * @param {Scene} scene                       The scene whose grid is being configured.
 * @param {SceneConfig} sheet                 The Scene Configuration sheet that spawned this dialog.
 * @param {FormApplicationOptions} [options]  Application configuration options.
 */
class GridConfig extends FormApplication {
  constructor(scene, sheet, ...args) {
    super(scene, ...args);

    /**
     * Track the Scene Configuration sheet reference
     * @type {SceneConfig}
     */
    this.sheet = sheet;
  }

  /**
   * A reference to the bound key handler function
   * @type {Function}
   */
  #keyHandler;

  /**
   * A reference to the bound mousewheel handler function
   * @type {Function}
   */
  #wheelHandler;

  /**
   * The preview scene
   * @type {Scene}
   */
  #scene = null;

  /**
   * The container containing the preview background image and grid
   * @type {PIXI.Container|null}
   */
  #preview = null;

  /**
   * The background preview
   * @type {PIXI.Sprite|null}
   */
  #background = null;

  /**
   * The grid preview
   * @type {GridMesh|null}
   */
  #grid = null;

  /* -------------------------------------------- */

  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "grid-config",
      template: "templates/scene/grid-config.html",
      title: game.i18n.localize("SCENES.GridConfigTool"),
      width: 480,
      height: "auto",
      closeOnSubmit: true
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _render(force, options) {
    const states = Application.RENDER_STATES;
    if ( force && [states.CLOSED, states.NONE].includes(this._state) ) {
      if ( !this.object.background.src ) {
        ui.notifications.warn("WARNING.GridConfigNoBG", {localize: true});
      }
      this.#scene = this.object.clone();
    }
    await super._render(force, options);
    await this.#createPreview();
  }


  /* -------------------------------------------- */

  /** @override */
  getData(options={}) {
    const bg = getTexture(this.#scene.background.src);
    return {
      gridTypes: SceneConfig._getGridTypes(),
      scale: this.#scene.background.src ? this.object.width / bg.width : 1,
      scene: this.#scene
    };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getSubmitData(updateData) {
    const formData = super._getSubmitData(updateData);
    const bg = getTexture(this.#scene.background.src);
    const tex = bg ? bg : {width: this.object.width, height: this.object.height};
    formData.width = tex.width * formData.scale;
    formData.height = tex.height * formData.scale;
    delete formData.scale;
    return formData;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async close(options={}) {
    document.removeEventListener("keydown", this.#keyHandler);
    document.removeEventListener("wheel", this.#wheelHandler);
    this.#keyHandler = this.#wheelHandler = undefined;
    await this.sheet.maximize();

    const states = Application.RENDER_STATES;
    if ( options.force || [states.RENDERED, states.ERROR].includes(this._state) ) {
      this.#scene = null;
      this.#destroyPreview();
    }

    return super.close(options);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  activateListeners(html) {
    super.activateListeners(html);
    this.#keyHandler ||= this.#onKeyDown.bind(this);
    document.addEventListener("keydown", this.#keyHandler);
    this.#wheelHandler ||= this.#onWheel.bind(this);
    document.addEventListener("wheel", this.#wheelHandler, {passive: false});
    html.find('button[name="reset"]').click(this.#onReset.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle keyboard events.
   * @param {KeyboardEvent} event    The original keydown event
   */
  #onKeyDown(event) {
    const key = event.code;
    const up = ["KeyW", "ArrowUp"];
    const down = ["KeyS", "ArrowDown"];
    const left = ["KeyA", "ArrowLeft"];
    const right = ["KeyD", "ArrowRight"];
    const moveKeys = up.concat(down).concat(left).concat(right);
    if ( !moveKeys.includes(key) ) return;

    // Increase the Scene scale on shift + up or down
    if ( event.shiftKey ) {
      event.preventDefault();
      event.stopPropagation();
      const delta = up.includes(key) ? 1 : (down.includes(key) ? -1 : 0);
      this.#scaleBackgroundSize(delta);
    }

    // Resize grid size on ALT
    else if ( event.altKey ) {
      event.preventDefault();
      event.stopPropagation();
      const delta = up.includes(key) ? 1 : (down.includes(key) ? -1 : 0);
      this.#scaleGridSize(delta);
    }

    // Shift grid position
    else if ( !game.keyboard.hasFocus ) {
      event.preventDefault();
      event.stopPropagation();
      if ( up.includes(key) ) this.#shiftBackground({deltaY: -1});
      else if ( down.includes(key) ) this.#shiftBackground({deltaY: 1});
      else if ( left.includes(key) ) this.#shiftBackground({deltaX: -1});
      else if ( right.includes(key) ) this.#shiftBackground({deltaX: 1});
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle mousewheel events.
   * @param {WheelEvent} event    The original wheel event
   */
  #onWheel(event) {
    if ( event.deltaY === 0 ) return;
    const normalizedDelta = -Math.sign(event.deltaY);
    const activeElement = document.activeElement;
    const noShiftAndAlt = !(event.shiftKey || event.altKey);
    const focus = game.keyboard.hasFocus && document.hasFocus;

    // Increase/Decrease the Scene scale
    if ( event.shiftKey || (!event.altKey && focus && activeElement.name === "scale") ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.#scaleBackgroundSize(normalizedDelta);
    }

    // Increase/Decrease the Grid scale
    else if ( event.altKey || (focus && activeElement.name === "grid.size") ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.#scaleGridSize(normalizedDelta);
    }

    // If no shift or alt key are pressed
    else if ( noShiftAndAlt && focus ) {
      // Increase/Decrease the background x offset
      if ( activeElement.name === "background.offsetX" ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.#shiftBackground({deltaX: normalizedDelta});
      }
      // Increase/Decrease the background y offset
      else if ( activeElement.name === "background.offsetY" ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.#shiftBackground({deltaY: normalizedDelta});
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle reset.
   */
  #onReset() {
    if ( !this.#scene ) return;
    this.#scene = this.object.clone();
    this.render();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onChangeInput(event) {
    await super._onChangeInput(event);
    const previewData = this._getSubmitData();
    this.#previewChanges(previewData);
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    const changes = foundry.utils.flattenObject(
      foundry.utils.diffObject(this.object.toObject(), foundry.utils.expandObject(formData)));
    if ( ["width", "height", "padding", "background.offsetX", "background.offsetY", "grid.size", "grid.type"].some(k => k in changes) ) {
      const confirm = await Dialog.confirm({
        title: game.i18n.localize("SCENES.DimensionChangeTitle"),
        content: `<p>${game.i18n.localize("SCENES.DimensionChangeWarning")}</p>`
      });
      // Update only if the dialog is confirmed
      if ( confirm ) return this.object.update(formData, {fromSheet: true});
    }
  }

  /* -------------------------------------------- */
  /*  Previewing and Updating Functions           */
  /* -------------------------------------------- */

  /**
   * Create preview
   */
  async #createPreview() {
    if ( !this.#scene ) return;
    if ( this.#preview ) this.#destroyPreview();
    this.#preview = canvas.stage.addChild(new PIXI.Container());
    this.#preview.eventMode = "none";
    const fill = this.#preview.addChild(new PIXI.Sprite(PIXI.Texture.WHITE));
    fill.tint = 0x000000;
    fill.eventMode = "static";
    fill.hitArea = canvas.app.screen;
    // Patching updateTransform to render the fill in screen space
    fill.updateTransform = function() {
      const screen = canvas.app.screen;
      this.width = screen.width;
      this.height = screen.height;
      this._boundsID++;
      this.transform.updateTransform(PIXI.Transform.IDENTITY);
      this.worldAlpha = this.alpha;
    };
    this.#background = this.#preview.addChild(new PIXI.Sprite());
    this.#background.eventMode = "none";
    if ( this.#scene.background.src ) {
      try {
        this.#background.texture = await loadTexture(this.#scene.background.src);
      } catch(e) {
        this.#background.texture = PIXI.Texture.WHITE;
        console.error(e);
      }
    } else {
      this.#background.texture = PIXI.Texture.WHITE;
    }
    this.#grid = this.#preview.addChild(new GridMesh().initialize({color: 0xFF0000}));
    this.#refreshPreview();
  }

  /* -------------------------------------------- */

  /**
   * Preview changes to the Scene document as if they were true document updates.
   * @param {object} [change]  A change to preview.
   */
  #previewChanges(change) {
    if ( !this.#scene ) return;
    if ( change ) this.#scene.updateSource(change);
    this.#refreshPreview();
  }

  /* -------------------------------------------- */

  /**
   * Refresh the preview
   */
  #refreshPreview() {
    if ( !this.#scene || (this.#preview?.destroyed !== false) ) return;

    // Update the background image
    const d = this.#scene.dimensions;
    this.#background.position.set(d.sceneX, d.sceneY);
    this.#background.width = d.sceneWidth;
    this.#background.height = d.sceneHeight;

    // Update the grid
    this.#grid.initialize({
      type: this.#scene.grid.type,
      width: d.width,
      height: d.height,
      size: d.size
    });
  }

  /* -------------------------------------------- */

  /**
   * Destroy the preview
   */
  #destroyPreview() {
    if ( this.#preview?.destroyed === false ) this.#preview.destroy({children: true});
    this.#preview = null;
    this.#background = null;
    this.#grid = null;
  }

  /* -------------------------------------------- */

  /**
   * Scale the background size relative to the grid size
   * @param {number} delta          The directional change in background size
   */
  #scaleBackgroundSize(delta) {
    const scale = (parseFloat(this.form.scale.value) + (delta * 0.001)).toNearest(0.001);
    this.form.scale.value = Math.clamp(scale, 0.25, 10.0);
    this.form.scale.dispatchEvent(new Event("change", {bubbles: true}));
  }

  /* -------------------------------------------- */

  /**
   * Scale the grid size relative to the background image.
   * When scaling the grid size in this way, constrain the allowed values between 50px and 300px.
   * @param {number} delta          The grid size in pixels
   */
  #scaleGridSize(delta) {
    const gridSize = this.form.elements["grid.size"];
    gridSize.value = Math.clamp(gridSize.valueAsNumber + delta, 50, 300);
    gridSize.dispatchEvent(new Event("change", {bubbles: true}));
  }

  /* -------------------------------------------- */

  /**
   * Shift the background image relative to the grid layer
   * @param {object} position               The position configuration to preview
   * @param {number} [position.deltaX=0]    The number of pixels to shift in the x-direction
   * @param {number} [position.deltaY=0]    The number of pixels to shift in the y-direction
   */
  #shiftBackground({deltaX=0, deltaY=0}) {
    const ox = this.form["background.offsetX"];
    ox.value = parseInt(this.form["background.offsetX"].value) + deltaX;
    this.form["background.offsetY"].value = parseInt(this.form["background.offsetY"].value) + deltaY;
    ox.dispatchEvent(new Event("change", {bubbles: true}));
  }
}
