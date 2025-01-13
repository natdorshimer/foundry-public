/**
 * An AmbientLight is an implementation of PlaceableObject which represents a dynamic light source within the Scene.
 * @category - Canvas
 * @see {@link AmbientLightDocument}
 * @see {@link LightingLayer}
 */
class AmbientLight extends PlaceableObject {
  /**
   * The area that is affected by this light.
   * @type {PIXI.Graphics}
   */
  field;

  /**
   * A reference to the PointSource object which defines this light or darkness area of effect.
   * This is undefined if the AmbientLight does not provide an active source of light.
   * @type {PointDarknessSource|PointLightSource}
   */
  lightSource;

  /* -------------------------------------------- */

  /** @inheritdoc */
  static embeddedName = "AmbientLight";

  /** @override */
  static RENDER_FLAGS = {
    redraw: {propagate: ["refresh"]},
    refresh: {propagate: ["refreshState", "refreshField", "refreshElevation"], alias: true},
    refreshField: {propagate: ["refreshPosition"]},
    refreshPosition: {},
    refreshState: {},
    refreshElevation: {}
  };

  /* -------------------------------------------- */

  /** @inheritdoc */
  get bounds() {
    const {x, y} = this.document;
    const r = Math.max(this.dimRadius, this.brightRadius);
    return new PIXI.Rectangle(x-r, y-r, 2*r, 2*r);
  }

  /* -------------------------------------------- */

  /** @override */
  get sourceId() {
    let id = `${this.document.documentName}.${this.document.id}`;
    if ( this.isPreview ) id += ".preview";
    return id;
  }

  /* -------------------------------------------- */

  /**
   * A convenience accessor to the LightData configuration object
   * @returns {LightData}
   */
  get config() {
    return this.document.config;
  }

  /* -------------------------------------------- */

  /**
   * Test whether a specific AmbientLight source provides global illumination
   * @type {boolean}
   */
  get global() {
    return this.document.isGlobal;
  }

  /* -------------------------------------------- */

  /**
   * The maximum radius in pixels of the light field
   * @type {number}
   */
  get radius() {
    return Math.max(Math.abs(this.dimRadius), Math.abs(this.brightRadius));
  }

  /* -------------------------------------------- */

  /**
   * Get the pixel radius of dim light emitted by this light source
   * @type {number}
   */
  get dimRadius() {
    let d = canvas.dimensions;
    return ((this.config.dim / d.distance) * d.size);
  }

  /* -------------------------------------------- */

  /**
   * Get the pixel radius of bright light emitted by this light source
   * @type {number}
   */
  get brightRadius() {
    let d = canvas.dimensions;
    return ((this.config.bright / d.distance) * d.size);
  }

  /* -------------------------------------------- */

  /**
   * Is this Ambient Light currently visible? By default, true only if the source actively emits light or darkness.
   * @type {boolean}
   */
  get isVisible() {
    return !this._isLightSourceDisabled();
  }

  /* -------------------------------------------- */

  /**
   * Check if the point source is a LightSource instance
   * @type {boolean}
   */
  get isLightSource() {
    return this.lightSource instanceof CONFIG.Canvas.lightSourceClass;
  }

  /* -------------------------------------------- */

  /**
   * Check if the point source is a DarknessSource instance
   * @type {boolean}
   */
  get isDarknessSource() {
    return this.lightSource instanceof CONFIG.Canvas.darknessSourceClass;
  }

  /* -------------------------------------------- */

  /**
   * Is the source of this Ambient Light disabled?
   * @type {boolean}
   * @protected
   */
  _isLightSourceDisabled() {
    const {hidden, config} = this.document;

    // Hidden lights are disabled
    if ( hidden ) return true;

    // Lights with zero radius or angle are disabled
    if ( !(this.radius && config.angle) ) return true;

    // If the darkness level is outside of the darkness activation range, the light is disabled
    const darkness = canvas.darknessLevel;
    return !darkness.between(config.darkness.min, config.darkness.max);
  }

  /* -------------------------------------------- */

  /**
   * Does this Ambient Light actively emit darkness light given
   * its properties and the current darkness level of the Scene?
   * @type {boolean}
   */
  get emitsDarkness() {
    return this.document.config.negative && !this._isLightSourceDisabled();
  }

  /* -------------------------------------------- */

  /**
   * Does this Ambient Light actively emit positive light given
   * its properties and the current darkness level of the Scene?
   * @type {boolean}
   */
  get emitsLight() {
    return !this.document.config.negative && !this._isLightSourceDisabled();
  }

  /* -------------------------------------------- */
  /* Rendering
  /* -------------------------------------------- */

  /** @override */
  _destroy(options) {
    this.#destroyLightSource();
  }

  /* -------------------------------------------- */

  /** @override */
  async _draw(options) {
    this.field = this.addChild(new PIXI.Graphics());
    this.field.eventMode = "none";
    this.controlIcon = this.addChild(this.#drawControlIcon());
    this.initializeLightSource();
  }

  /* -------------------------------------------- */

  /**
   * Draw the ControlIcon for the AmbientLight
   * @returns {ControlIcon}
   */
  #drawControlIcon() {
    const size = Math.max(Math.round((canvas.dimensions.size * 0.5) / 20) * 20, 40);
    let icon = new ControlIcon({texture: CONFIG.controlIcons.light, size: size });
    icon.x -= (size * 0.5);
    icon.y -= (size * 0.5);
    return icon;
  }

  /* -------------------------------------------- */
  /*  Incremental Refresh                         */
  /* -------------------------------------------- */

  /** @override */
  _applyRenderFlags(flags) {
    if ( flags.refreshState ) this._refreshState();
    if ( flags.refreshPosition ) this._refreshPosition();
    if ( flags.refreshField ) this._refreshField();
    if ( flags.refreshElevation ) this._refreshElevation();
  }

  /* -------------------------------------------- */

  /**
   * Refresh the shape of the light field-of-effect. This is refreshed when the AmbientLight fov polygon changes.
   * @protected
   */
  _refreshField() {
    this.field.clear();
    if ( !this.lightSource?.shape ) return;
    this.field.lineStyle(2, 0xEEEEEE, 0.4).drawShape(this.lightSource.shape);
    this.field.position.set(-this.lightSource.x, -this.lightSource.y);
  }

  /* -------------------------------------------- */

  /**
   * Refresh the position of the AmbientLight. Called with the coordinates change.
   * @protected
   */
  _refreshPosition() {
    const {x, y} = this.document;
    if ( (this.position.x !== x) || (this.position.y !== y) ) MouseInteractionManager.emulateMoveEvent();
    this.position.set(x, y);
  }

  /* -------------------------------------------- */

  /**
   * Refresh the elevation of the control icon.
   * @protected
   */
  _refreshElevation() {
    this.controlIcon.elevation = this.document.elevation;
  }

  /* -------------------------------------------- */

  /**
   * Refresh the state of the light. Called when the disabled state or darkness conditions change.
   * @protected
   */
  _refreshState() {
    this.alpha = this._getTargetAlpha();
    this.zIndex = this.hover ? 1 : 0;
    this.refreshControl();
  }

  /* -------------------------------------------- */

  /**
   * Refresh the display of the ControlIcon for this AmbientLight source.
   */
  refreshControl() {
    const isHidden = this.id && this.document.hidden;
    this.controlIcon.texture = getTexture(this.isVisible ? CONFIG.controlIcons.light : CONFIG.controlIcons.lightOff);
    this.controlIcon.tintColor = isHidden ? 0xFF3300 : 0xFFFFFF;
    this.controlIcon.borderColor = isHidden ? 0xFF3300 : 0xFF5500;
    this.controlIcon.elevation = this.document.elevation;
    this.controlIcon.refresh({visible: this.layer.active, borderVisible: this.hover || this.layer.highlightObjects});
    this.controlIcon.draw();
  }

  /* -------------------------------------------- */
  /*  Light Source Management                     */
  /* -------------------------------------------- */

  /**
   * Update the LightSource associated with this AmbientLight object.
   * @param {object} [options={}]               Options which modify how the source is updated
   * @param {boolean} [options.deleted=false]   Indicate that this light source has been deleted
   */
  initializeLightSource({deleted=false}={}) {
    const sourceId = this.sourceId;
    const wasLight = canvas.effects.lightSources.has(sourceId);
    const wasDarkness = canvas.effects.darknessSources.has(sourceId);
    const isDarkness = this.document.config.negative;
    const perceptionFlags = {
      refreshEdges: wasDarkness || isDarkness,
      initializeVision: wasDarkness || isDarkness,
      initializeLighting: wasDarkness || isDarkness,
      refreshLighting: true,
      refreshVision: true
    };

    // Remove the light source from the active collection
    if ( deleted ) {
      if ( !this.lightSource?.active ) return;
      this.#destroyLightSource();
      canvas.perception.update(perceptionFlags);
      return;
    }

    // Re-create source if it switches darkness state
    if ( (wasLight && isDarkness) || (wasDarkness && !isDarkness) ) this.#destroyLightSource();

    // Create the light source if necessary
    this.lightSource ??= this.#createLightSource();

    // Re-initialize source data and add to the active collection
    this.lightSource.initialize(this._getLightSourceData());
    this.lightSource.add();

    // Assign perception and render flags
    canvas.perception.update(perceptionFlags);
    if ( this.layer.active ) this.renderFlags.set({refreshField: true});
  }

  /* -------------------------------------------- */

  /**
   * Get the light source data.
   * @returns {LightSourceData}
   * @protected
   */
  _getLightSourceData() {
    const {x, y, elevation, rotation, walls, vision} = this.document;
    const d = canvas.dimensions;
    return foundry.utils.mergeObject(this.config.toObject(false), {
      x, y, elevation, rotation, walls, vision,
      dim: Math.clamp(this.dimRadius, 0, d.maxR),
      bright: Math.clamp(this.brightRadius, 0, d.maxR),
      seed: this.document.getFlag("core", "animationSeed"),
      disabled: this._isLightSourceDisabled(),
      preview: this.isPreview
    });
  }

  /* -------------------------------------------- */

  /**
   * Returns a new point source: DarknessSource or LightSource, depending on the config data.
   * @returns {foundry.canvas.sources.PointLightSource|foundry.canvas.sources.PointDarknessSource} The created source
   */
  #createLightSource() {
    const sourceClass = this.config.negative ? CONFIG.Canvas.darknessSourceClass : CONFIG.Canvas.lightSourceClass;
    const sourceId = this.sourceId;
    return new sourceClass({sourceId, object: this});
  }

  /* -------------------------------------------- */

  /**
   * Destroy the existing BaseEffectSource instance for this AmbientLight.
   */
  #destroyLightSource() {
    this.lightSource?.destroy();
    this.lightSource = undefined;
  }

  /* -------------------------------------------- */
  /*  Document Event Handlers                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    this.initializeLightSource();
  }

  /* -------------------------------------------- */

  /** @override */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    this.initializeLightSource();
    this.renderFlags.set({
      refreshState: ("hidden" in changed) || (("config" in changed)
        && ["dim", "bright", "angle", "darkness"].some(k => k in changed.config)),
      refreshElevation: "elevation" in changed
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    this.initializeLightSource({deleted: true});
    super._onDelete(options, userId);
  }

  /* -------------------------------------------- */
  /*  Interactivity                               */
  /* -------------------------------------------- */

  /** @inheritdoc */
  _canHUD(user, event) {
    return user.isGM; // Allow GMs to single right-click
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _canConfigure(user, event) {
    return false; // Double-right does nothing
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _canDragLeftStart(user, event) {
    // Prevent dragging another light if currently previewing one.
    if ( this.layer?.preview?.children.length ) {
      ui.notifications.warn("CONTROLS.ObjectConfigured", { localize: true });
      return false;
    }
    return super._canDragLeftStart(user, event);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onClickRight(event) {
    this.document.update({hidden: !this.document.hidden});
    if ( !this._propagateRightClick(event) ) event.stopPropagation();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onDragLeftMove(event) {
    super._onDragLeftMove(event);
    this.initializeLightSource({deleted: true});
    const clones = event.interactionData.clones || [];
    for ( const c of clones ) c.initializeLightSource();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onDragEnd() {
    this.initializeLightSource({deleted: true});
    this._original?.initializeLightSource();
    super._onDragEnd();
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  updateSource({deleted=false}={}) {
    const msg = "AmbientLight#updateSource has been deprecated in favor of AmbientLight#initializeLightSource";
    foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    this.initializeLightSource({deleted});
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get source() {
    const msg = "AmbientLight#source has been deprecated in favor of AmbientLight#lightSource";
    foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return this.lightSource;
  }
}
