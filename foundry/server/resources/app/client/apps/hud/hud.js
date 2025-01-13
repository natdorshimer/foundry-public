/**
 * An abstract base class for displaying a heads-up-display interface bound to a Placeable Object on the canvas
 * @interface
 * @template {PlaceableObject} ActiveHUDObject
 * @template {CanvasDocument} ActiveHUDDocument
 * @template {PlaceablesLayer} ActiveHUDLayer
 */
class BasePlaceableHUD extends Application {

  /**
   * Reference a PlaceableObject this HUD is currently bound to.
   * @type {ActiveHUDObject}
   */
  object;

  /**
   * Track whether a control icon is hovered or not
   * @type {boolean}
   */
  #hoverControlIcon = false;

  /* -------------------------------------------- */

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["placeable-hud"],
      popOut: false
    });
  }

  /* -------------------------------------------- */

  /**
   * Convenience access to the Document which this HUD modifies.
   * @returns {ActiveHUDDocument}
   */
  get document() {
    return this.object?.document;
  }

  /* -------------------------------------------- */

  /**
   * Convenience access for the canvas layer which this HUD modifies
   * @type {ActiveHUDLayer}
   */
  get layer() {
    return this.object?.layer;
  }

  /* -------------------------------------------- */
  /*  Methods
  /* -------------------------------------------- */

  /**
   * Bind the HUD to a new PlaceableObject and display it
   * @param {PlaceableObject} object    A PlaceableObject instance to which the HUD should be bound
   */
  bind(object) {
    const states = this.constructor.RENDER_STATES;
    if ( [states.CLOSING, states.RENDERING].includes(this._state) ) return;
    if ( this.object ) this.clear();

    // Record the new object
    if ( !(object instanceof PlaceableObject) || (object.scene !== canvas.scene) ) {
      throw new Error("You may only bind a HUD instance to a PlaceableObject in the currently viewed Scene.");
    }
    this.object = object;

    // Render the HUD
    this.render(true);
    this.element.hide().fadeIn(200);
  }

  /* -------------------------------------------- */

  /**
   * Clear the HUD by fading out it's active HTML and recording the new display state
   */
  clear() {
    let states = this.constructor.RENDER_STATES;
    if ( this._state <= states.NONE ) return;
    this._state = states.CLOSING;

    // Unbind
    this.object = null;
    this.element.hide();
    this._element = null;
    this._state = states.NONE;
  }

  /* -------------------------------------------- */

  /** @override */
  async _render(...args) {
    await super._render(...args);
    this.setPosition();
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options = {}) {
    const data = this.object.document.toObject();
    return foundry.utils.mergeObject(data, {
      id: this.id,
      classes: this.options.classes.join(" "),
      appId: this.appId,
      isGM: game.user.isGM,
      isGamePaused: game.paused,
      icons: CONFIG.controlIcons
    });
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition({left, top, width, height, scale} = {}) {
    const position = {
      width: width || this.object.width,
      height: height || this.object.height,
      left: left ?? this.object.x,
      top: top ?? this.object.y
    };
    this.element.css(position);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    // Attribute Bars
    html.find(".attribute input")
      .click(this._onAttributeClick)
      .keydown(this._onAttributeKeydown.bind(this))
      .focusout(this._onAttributeUpdate.bind(this));

    // Control icons hover detection
    html.find(".control-icon")
      .mouseleave(() => this.#hoverControlIcon = false)
      .mouseenter(() => this.#hoverControlIcon = true)
      .click(this._onClickControl.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle mouse clicks to control a HUD control button
   * @param {PointerEvent} event    The originating click event
   * @protected
   */
  _onClickControl(event) {
    const button = event.currentTarget;
    switch ( button.dataset.action ) {
      case "visibility":
        return this._onToggleVisibility(event);
      case "locked":
        return this._onToggleLocked(event);
      case "sort-up":
        return this._onSort(event, true);
      case "sort-down":
        return this._onSort(event, false);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle initial click to focus an attribute update field
   * @param {MouseEvent} event        The mouse click event
   * @protected
   */
  _onAttributeClick(event) {
    event.currentTarget.select();
  }

  /* -------------------------------------------- */

  /**
   * Force field handling on an Enter keypress even if the value of the field did not change.
   * This is important to suppose use cases with negative number values.
   * @param {KeyboardEvent} event     The originating keydown event
   * @protected
   */
  _onAttributeKeydown(event) {
    if ( (event.code === "Enter") || (event.code === "NumpadEnter") ) event.currentTarget.blur();
  }

  /* -------------------------------------------- */

  /**
   * Handle attribute updates
   * @param {FocusEvent} event        The originating focusout event
   */
  _onAttributeUpdate(event) {
    event.preventDefault();
    if ( !this.object ) return;
    const input = event.currentTarget;
    this._updateAttribute(input.name, event.currentTarget.value.trim());
    if ( !this.#hoverControlIcon ) this.clear();
  }

  /* -------------------------------------------- */

  /**
   * Handle attribute bar update
   * @param {string} name           The name of the attribute
   * @param {string} input          The raw string input value for the update
   * @returns {Promise<void>}
   * @protected
   */
  async _updateAttribute(name, input) {
    const current = foundry.utils.getProperty(this.object.document, name);
    const {value} = this._parseAttributeInput(name, current, input);
    await this.object.document.update({[name]: value});
  }

  /* -------------------------------------------- */

  /**
   * Parse an attribute bar input string into a new value for the attribute field.
   * @param {string} name           The name of the attribute
   * @param {object|number} attr    The current value of the attribute
   * @param {string} input          The raw string input value
   * @returns {{value: number, [delta]: number, isDelta: boolean, isBar: boolean}} The parsed input value
   * @protected
   */
  _parseAttributeInput(name, attr, input) {
    const isBar = (typeof attr === "object") && ("max" in attr);
    const isEqual = input.startsWith("=");
    const isDelta = input.startsWith("+") || input.startsWith("-");
    const current = isBar ? attr.value : attr;
    let v;

    // Explicit equality
    if ( isEqual ) input = input.slice(1);

    // Percentage change
    if ( input.endsWith("%") ) {
      const p = Number(input.slice(0, -1)) / 100;
      if ( isBar ) v = attr.max * p;
      else v = Math.abs(current) * p;
    }

    // Additive delta
    else v = Number(input);

    // Return parsed input
    const value = isDelta ? current + v : v;
    const delta = isDelta ? v : undefined;
    return {value, delta, isDelta, isBar};
  }

  /* -------------------------------------------- */

  /**
   * Toggle the visible state of all controlled objects in the Layer
   * @param {PointerEvent} event    The originating click event
   * @private
   */
  async _onToggleVisibility(event) {
    event.preventDefault();

    // Toggle the visible state
    const isHidden = this.object.document.hidden;
    const updates = this.layer.controlled.map(o => {
      return {_id: o.id, hidden: !isHidden};
    });

    // Update all objects
    return canvas.scene.updateEmbeddedDocuments(this.object.document.documentName, updates);
  }

  /* -------------------------------------------- */

  /**
   * Toggle locked state of all controlled objects in the Layer
   * @param {PointerEvent} event    The originating click event
   * @private
   */
  async _onToggleLocked(event) {
    event.preventDefault();

    // Toggle the visible state
    const isLocked = this.object.document.locked;
    const updates = this.layer.controlled.map(o => {
      return {_id: o.id, locked: !isLocked};
    });

    // Update all objects
    event.currentTarget.classList.toggle("active", !isLocked);
    return canvas.scene.updateEmbeddedDocuments(this.object.document.documentName, updates);
  }

  /* -------------------------------------------- */

  /**
   * Handle sorting the z-order of the object
   * @param {PointerEvent} event    The originating mouse click event
   * @param {boolean} up            Move the object upwards in the vertical stack?
   *                                If false, the object is moved downwards.
   * @returns {Promise<void>}
   * @protected
   */
  async _onSort(event, up) {
    event.preventDefault();
    this.layer._sendToBackOrBringToFront(up);
  }
}
