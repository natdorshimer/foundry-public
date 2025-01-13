/**
 * A Token is an implementation of PlaceableObject which represents an Actor within a viewed Scene on the game canvas.
 * @category - Canvas
 * @see {TokenDocument}
 * @see {TokenLayer}
 */
class Token extends PlaceableObject {
  constructor(document) {
    super(document);
    this.#initialize();
  }

  /** @inheritdoc */
  static embeddedName = "Token";

  /** @override */
  static RENDER_FLAGS = {
    redraw: {propagate: ["refresh"]},
    redrawEffects: {},
    refresh: {propagate: ["refreshState", "refreshTransform", "refreshMesh", "refreshNameplate", "refreshElevation", "refreshRingVisuals"], alias: true},
    refreshState: {propagate: ["refreshVisibility", "refreshTarget"]},
    refreshVisibility: {},
    refreshTransform: {propagate: ["refreshPosition", "refreshRotation", "refreshSize"], alias: true},
    refreshPosition: {},
    refreshRotation: {},
    refreshSize: {propagate: ["refreshPosition", "refreshShape", "refreshBars", "refreshEffects", "refreshNameplate", "refreshTarget", "refreshTooltip"]},
    refreshElevation: {propagate: ["refreshTooltip"]},
    refreshMesh: {propagate: ["refreshShader"]},
    refreshShader: {},
    refreshShape: {propagate: ["refreshVisibility", "refreshPosition", "refreshBorder", "refreshEffects"]},
    refreshBorder: {},
    refreshBars: {},
    refreshEffects: {},
    refreshNameplate: {},
    refreshTarget: {},
    refreshTooltip: {},
    refreshRingVisuals: {},
    /** @deprecated since v12 Stable 4 */
    recoverFromPreview: {deprecated: {since: 12, until: 14}}
  };

  /**
   * Used in {@link Token#_renderDetectionFilter}.
   * @type {[detectionFilter: PIXI.Filter|null]}
   */
  static #DETECTION_FILTER_ARRAY = [null];

  /**
   * The shape of this token.
   * @type {PIXI.Rectangle|PIXI.Polygon|PIXI.Circle}
   */
  shape;

  /**
   * Defines the filter to use for detection.
   * @param {PIXI.Filter|null} filter
   */
  detectionFilter = null;

  /**
   * A Graphics instance which renders the border frame for this Token inside the GridLayer.
   * @type {PIXI.Graphics}
   */
  border;

  /**
   * The effects icons of temporary ActiveEffects that are applied to the Actor of this Token.
   * @type {PIXI.Container}
   */
  effects;

  /**
   * The attribute bars of this Token.
   * @type {PIXI.Container}
   */
  bars;

  /**
   * The tooltip text of this Token, which contains its elevation.
   * @type {PreciseText}
   */
  tooltip;

  /**
   * The target marker, which indicates that this Token is targeted by this User or others.
   * @type {PIXI.Graphics}
   */
  target;

  /**
   * The nameplate of this Token, which displays its name.
   * @type {PreciseText}
   */
  nameplate;

  /**
   * Track the set of User documents which are currently targeting this Token
   * @type {Set<User>}
   */
  targeted = new Set([]);

  /**
   * A reference to the SpriteMesh which displays this Token in the PrimaryCanvasGroup.
   * @type {PrimarySpriteMesh}
   */
  mesh;

  /**
   * Renders the mesh of this Token with ERASE blending in the Token.
   * @type {PIXI.DisplayObject}
   */
  voidMesh;

  /**
   * Renders the mesh of with the detection filter.
   * @type {PIXI.DisplayObject}
   */
  detectionFilterMesh;

  /**
   * The texture of this Token, which is used by its mesh.
   * @type {PIXI.Texture}
   */
  texture;

  /**
   * A reference to the VisionSource object which defines this vision source area of effect.
   * This is undefined if the Token does not provide an active source of vision.
   * @type {PointVisionSource}
   */
  vision;

  /**
   * A reference to the LightSource object which defines this light source area of effect.
   * This is undefined if the Token does not provide an active source of light.
   * @type {PointLightSource}
   */
  light;

  /**
   * An Object which records the Token's prior velocity dx and dy.
   * This can be used to determine which direction a Token was previously moving.
   * @type {{dx: number, dy: number, ox: number, oy: number}}
   */
  #priorMovement;

  /**
   * The Token central coordinate, adjusted for its most recent movement vector.
   * @type {Point}
   */
  #adjustedCenter;

  /**
   * @typedef {Point} TokenPosition
   * @property {number} rotation  The token's last valid rotation.
   */

  /**
   * The Token's most recent valid position and rotation.
   * @type {TokenPosition}
   */
  #validPosition;

  /**
   * A flag to capture whether this Token has an unlinked video texture.
   * @type {boolean}
   */
  #unlinkedVideo = false;

  /**
   * @typedef {object} TokenAnimationData
   * @property {number} x                        The x position in pixels
   * @property {number} y                        The y position in pixels
   * @property {number} width                    The width in grid spaces
   * @property {number} height                   The height in grid spaces
   * @property {number} alpha                    The alpha value
   * @property {number} rotation                 The rotation in degrees
   * @property {object} texture                  The texture data
   * @property {string} texture.src              The texture file path
   * @property {number} texture.anchorX          The texture anchor X
   * @property {number} texture.anchorY          The texture anchor Y
   * @property {number} texture.scaleX           The texture scale X
   * @property {number} texture.scaleY           The texture scale Y
   * @property {Color} texture.tint              The texture tint
   * @property {object} ring                     The ring data
   * @property {object} ring.subject             The ring subject data
   * @property {string} ring.subject.texture     The ring subject texture
   * @property {number} ring.subject.scale       The ring subject scale
   */

  /**
   * The current animation data of this Token.
   * @type {TokenAnimationData}
   */
  #animationData;

  /**
   * The prior animation data of this Token.
   * @type {TokenAnimationData}
   */
  #priorAnimationData;

  /**
   * A map of effects id and their filters applied on this token placeable.
   * @type {Map<string: effectId, AbstractBaseFilter: filter>}
   */
  #filterEffects = new Map();

  /**
   * @typedef {object} TokenAnimationContext
   * @property {string|symbol} name              The name of the animation
   * @property {Partial<TokenAnimationData>} to  The final animation state
   * @property {number} duration                 The duration of the animation
   * @property {number} time                     The current time of the animation
   * @property {((context: TokenAnimationContext) => Promise<void>)[]} preAnimate
   *   Asynchronous functions that are executed before the animation starts
   * @property {((context: TokenAnimationContext) => void)[]} postAnimate
   *   Synchronous functions that are executed after the animation ended.
   *   They may be executed before the preAnimate functions have finished  if the animation is terminated.
   * @property {((context: TokenAnimationContext) => void)[]} onAnimate
   *   Synchronous functions that are executed each frame after `ontick` and before {@link Token#_onAnimationUpdate}.
   * @property {Promise<boolean>} [promise]
   *   The promise of the animation, which resolves to true if the animation
   *   completed, to false if it was terminated, and rejects if an error occurred.
   *   Undefined in the first frame (at time 0) of the animation.
   */

  /**
   * The current animations of this Token.
   * @type {Map<string, TokenAnimationContext>}
   */
  get animationContexts() {
    return this.#animationContexts;
  }

  #animationContexts = new Map();

  /**
   * A TokenRing instance which is used if this Token applies a dynamic ring.
   * This property is null if the Token does not use a dynamic ring.
   * @type {foundry.canvas.tokens.TokenRing|null}
   */
  get ring() {
    return this.#ring;
  }

  #ring;

  /**
   * A convenience boolean to test whether the Token is using a dynamic ring.
   * @type {boolean}
   */
  get hasDynamicRing() {
    return this.ring instanceof foundry.canvas.tokens.TokenRing;
  }

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /**
   * Establish an initial velocity of the token based on its direction of facing.
   * Assume the Token made some prior movement towards the direction that it is currently facing.
   */
  #initialize() {

    // Initialize prior movement
    const {x, y, rotation} = this.document;
    const r = Ray.fromAngle(x, y, Math.toRadians(rotation + 90), canvas.dimensions.size);

    // Initialize valid position
    this.#validPosition = {x, y, rotation};
    this.#priorMovement = {dx: r.dx, dy: r.dy, ox: Math.sign(r.dx), oy: Math.sign(r.dy)};
    this.#adjustedCenter = this.getMovementAdjustedPoint(this.center);

    // Initialize animation data
    this.#animationData = this._getAnimationData();
    this.#priorAnimationData = foundry.utils.deepClone(this.#animationData);
  }

  /* -------------------------------------------- */

  /**
   * Initialize a TokenRing instance for this Token, if a dynamic ring is enabled.
   */
  #initializeRing() {

    // Construct a TokenRing instance
    if ( this.document.ring.enabled ) {
      if ( !this.hasDynamicRing ) {
        const cls = CONFIG.Token.ring.ringClass;
        if ( !foundry.utils.isSubclass(cls, foundry.canvas.tokens.TokenRing) ) {
          throw new Error("The configured CONFIG.Token.ring.ringClass is not a TokenRing subclass.");
        }
        this.#ring = new cls(this);
      }
      this.#ring.configure(this.mesh);
      return;
    }

    // Deactivate a prior TokenRing instance
    if ( this.hasDynamicRing ) this.#ring.clear();
    this.#ring = null;
  }

  /* -------------------------------------------- */
  /*  Permission Attributes
  /* -------------------------------------------- */

  /**
   * A convenient reference to the Actor object associated with the Token embedded document.
   * @returns {Actor|null}
   */
  get actor() {
    return this.document.actor;
  }

  /* -------------------------------------------- */

  /**
   * A boolean flag for whether the current game User has observer permission for the Token
   * @type {boolean}
   */
  get observer() {
    return game.user.isGM || !!this.actor?.testUserPermission(game.user, "OBSERVER");
  }

  /* -------------------------------------------- */

  /**
   * Convenience access to the token's nameplate string
   * @type {string}
   */
  get name() {
    return this.document.name;
  }

  /* -------------------------------------------- */
  /*  Rendering Attributes
  /* -------------------------------------------- */

  /** @override */
  get bounds() {
    const {x, y} = this.document;
    const {width, height} = this.getSize();
    return new PIXI.Rectangle(x, y, width, height);
  }

  /* -------------------------------------------- */

  /**
   * Translate the token's grid width into a pixel width based on the canvas size
   * @type {number}
   */
  get w() {
    return this.getSize().width;
  }

  /* -------------------------------------------- */

  /**
   * Translate the token's grid height into a pixel height based on the canvas size
   * @type {number}
   */
  get h() {
    return this.getSize().height;
  }

  /* -------------------------------------------- */

  /**
   * The Token's current central position
   * @type {PIXI.Point}
   */
  get center() {
    const {x, y} = this.getCenterPoint();
    return new PIXI.Point(x, y);
  }

  /* -------------------------------------------- */

  /**
   * The Token's central position, adjusted in each direction by one or zero pixels to offset it relative to walls.
   * @type {Point}
   */
  getMovementAdjustedPoint(point, {offsetX, offsetY}={}) {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    const r = new PIXI.Rectangle(x, y, 0, 0);

    // Verify whether the current position overlaps an edge
    const edges = [];
    for ( const edge of canvas.edges.values() ) {
      if ( !edge.move ) continue; // Non-blocking movement
      if ( r.overlaps(edge.bounds) && (foundry.utils.orient2dFast(edge.a, edge.b, {x, y}) === 0) ) edges.push(edge);
    }
    if ( edges.length ) {
      const {ox, oy} = this.#priorMovement;
      return {x: x - (offsetX ?? ox), y: y - (offsetY ?? oy)};
    }
    return {x, y};
  }

  /* -------------------------------------------- */

  /**
   * The HTML source element for the primary Tile texture
   * @type {HTMLImageElement|HTMLVideoElement}
   */
  get sourceElement() {
    return this.texture?.baseTexture.resource.source;
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
   * Does this Tile depict an animated video texture?
   * @type {boolean}
   */
  get isVideo() {
    const source = this.sourceElement;
    return source?.tagName === "VIDEO";
  }

  /* -------------------------------------------- */
  /*  State Attributes
  /* -------------------------------------------- */

  /**
   * An indicator for whether or not this token is currently involved in the active combat encounter.
   * @type {boolean}
   */
  get inCombat() {
    return this.document.inCombat;
  }

  /* -------------------------------------------- */

  /**
   * Return a reference to a Combatant that represents this Token, if one is present in the current encounter.
   * @type {Combatant|null}
   */
  get combatant() {
    return this.document.combatant;
  }

  /* -------------------------------------------- */

  /**
   * An indicator for whether the Token is currently targeted by the active game User
   * @type {boolean}
   */
  get isTargeted() {
    return this.targeted.has(game.user);
  }

  /* -------------------------------------------- */

  /**
   * Return a reference to the detection modes array.
   * @type {[object]}
   */
  get detectionModes() {
    return this.document.detectionModes;
  }

  /* -------------------------------------------- */

  /**
   * Determine whether the Token is visible to the calling user's perspective.
   * Hidden Tokens are only displayed to GM Users.
   * Non-hidden Tokens are always visible if Token Vision is not required.
   * Controlled tokens are always visible.
   * All Tokens are visible to a GM user if no Token is controlled.
   *
   * @see {CanvasVisibility#testVisibility}
   * @type {boolean}
   */
  get isVisible() {
    // Clear the detection filter
    this.detectionFilter = null;

    // Only GM users can see hidden tokens
    const gm = game.user.isGM;
    if ( this.document.hidden && !gm ) return false;

    // Some tokens are always visible
    if ( !canvas.visibility.tokenVision ) return true;
    if ( this.controlled ) return true;

    // Otherwise, test visibility against current sight polygons
    if ( this.vision?.active ) return true;
    const {width, height} = this.getSize();
    const tolerance = Math.min(width, height) / 4;
    return canvas.visibility.testVisibility(this.center, {tolerance, object: this});
  }

  /* -------------------------------------------- */

  /**
   * The animation name used for Token movement
   * @type {string}
   */
  get animationName() {
    return `${this.objectId}.animate`;
  }

  /* -------------------------------------------- */
  /*  Lighting and Vision Attributes
  /* -------------------------------------------- */

  /**
   * Test whether the Token has sight (or blindness) at any radius
   * @type {boolean}
   */
  get hasSight() {
    return this.document.sight.enabled;
  }

  /* -------------------------------------------- */

  /**
   * Does this Token actively emit light given its properties and the current darkness level of the Scene?
   * @returns {boolean}
   * @protected
   */
  _isLightSource() {
    const {hidden, light} = this.document;
    if ( hidden ) return false;
    if ( !(light.dim || light.bright) ) return false;
    const darkness = canvas.darknessLevel;
    if ( !darkness.between(light.darkness.min, light.darkness.max)) return false;
    return !this.document.hasStatusEffect(CONFIG.specialStatusEffects.BURROW);
  }

  /* -------------------------------------------- */

  /**
   * Does this Ambient Light actively emit darkness given
   * its properties and the current darkness level of the Scene?
   * @type {boolean}
   */
  get emitsDarkness() {
    return this.document.light.negative && this._isLightSource();
  }

  /* -------------------------------------------- */

  /**
   * Does this Ambient Light actively emit light given
   * its properties and the current darkness level of the Scene?
   * @type {boolean}
   */
  get emitsLight() {
    return !this.document.light.negative && this._isLightSource();
  }

  /* -------------------------------------------- */

  /**
   * Test whether the Token uses a limited angle of vision or light emission.
   * @type {boolean}
   */
  get hasLimitedSourceAngle() {
    const doc = this.document;
    return (this.hasSight && (doc.sight.angle !== 360)) || (this._isLightSource() && (doc.light.angle !== 360));
  }

  /* -------------------------------------------- */

  /**
   * Translate the token's dim light distance in units into a radius in pixels.
   * @type {number}
   */
  get dimRadius() {
    return this.getLightRadius(this.document.light.dim);
  }

  /* -------------------------------------------- */

  /**
   * Translate the token's bright light distance in units into a radius in pixels.
   * @type {number}
   */
  get brightRadius() {
    return this.getLightRadius(this.document.light.bright);
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
   * The range of this token's light perception in pixels.
   * @type {number}
   */
  get lightPerceptionRange() {
    const mode = this.document.detectionModes.find(m => m.id === "lightPerception");
    return mode?.enabled ? this.getLightRadius(mode.range ?? Infinity) : 0;
  }

  /* -------------------------------------------- */

  /**
   * Translate the token's vision range in units into a radius in pixels.
   * @type {number}
   */
  get sightRange() {
    return this.getLightRadius(this.document.sight.range ?? Infinity);
  }

  /* -------------------------------------------- */

  /**
   * Translate the token's maximum vision range that takes into account lights.
   * @type {number}
   */
  get optimalSightRange() {
    let lightRadius = 0;
    const mode = this.document.detectionModes.find(m => m.id === "lightPerception");
    if ( mode?.enabled ) {
      lightRadius = Math.max(this.document.light.bright, this.document.light.dim);
      lightRadius = Math.min(lightRadius, mode.range ?? Infinity);
    }
    return this.getLightRadius(Math.max(this.document.sight.range ?? Infinity, lightRadius));
  }

  /* -------------------------------------------- */

  /**
   * Update the light and vision source objects associated with this Token.
   * @param {object} [options={}]       Options which configure how perception sources are updated
   * @param {boolean} [options.deleted=false]       Indicate that this light and vision source has been deleted
   */
  initializeSources({deleted=false}={}) {
    this.#adjustedCenter = this.getMovementAdjustedPoint(this.center);
    this.initializeLightSource({deleted});
    this.initializeVisionSource({deleted});
  }

  /* -------------------------------------------- */

  /**
   * Update an emitted light source associated with this Token.
   * @param {object} [options={}]
   * @param {boolean} [options.deleted]    Indicate that this light source has been deleted.
   */
  initializeLightSource({deleted=false}={}) {
    const sourceId = this.sourceId;
    const wasLight = canvas.effects.lightSources.has(sourceId);
    const wasDarkness = canvas.effects.darknessSources.has(sourceId);
    const isDarkness = this.document.light.negative;
    const perceptionFlags = {
      refreshEdges: wasDarkness || isDarkness,
      initializeVision: wasDarkness || isDarkness,
      initializeLighting: wasDarkness || isDarkness,
      refreshLighting: true,
      refreshVision: true
    };

    // Remove the light source from the active collection
    if ( deleted || !this._isLightSource() ) {
      if ( !this.light ) return;
      if ( this.light.active ) canvas.perception.update(perceptionFlags);
      this.#destroyLightSource();
      return;
    }

    // Re-create the source if it switches darkness state
    if ( (wasLight && isDarkness) || (wasDarkness && !isDarkness) ) this.#destroyLightSource();

    // Create a light source if necessary
    this.light ??= this.#createLightSource();

    // Re-initialize source data and add to the active collection
    this.light.initialize(this._getLightSourceData());
    this.light.add();
    canvas.perception.update(perceptionFlags);
  }

  /* -------------------------------------------- */

  /**
   * Get the light source data.
   * @returns {LightSourceData}
   * @protected
   */
  _getLightSourceData() {
    const {x, y} = this.#adjustedCenter;
    const {elevation, rotation} = this.document;
    const d = canvas.dimensions;
    const lightDoc = this.document.light;
    return foundry.utils.mergeObject(lightDoc.toObject(false), {
      x, y, elevation, rotation,
      dim: Math.clamp(this.getLightRadius(lightDoc.dim), 0, d.maxR),
      bright: Math.clamp(this.getLightRadius(lightDoc.bright), 0, d.maxR),
      externalRadius: this.externalRadius,
      seed: this.document.getFlag("core", "animationSeed"),
      preview: this.isPreview,
      disabled: !this._isLightSource()
    });
  }

  /* -------------------------------------------- */

  /**
   * Update the VisionSource instance associated with this Token.
   * @param {object} [options]        Options which affect how the vision source is updated
   * @param {boolean} [options.deleted]   Indicate that this vision source has been deleted.
   */
  initializeVisionSource({deleted=false}={}) {

    // Remove a deleted vision source from the active collection
    if ( deleted || !this._isVisionSource() ) {
      if ( !this.vision ) return;
      if ( this.vision.active ) canvas.perception.update({
        initializeVisionModes: true,
        refreshVision: true,
        refreshLighting: true
      });
      this.#destroyVisionSource();
      return;
    }

    // Create a vision source if necessary
    const wasVision = !!this.vision;
    this.vision ??= this.#createVisionSource();

    // Re-initialize source data
    const previousActive = this.vision.active;
    const previousVisionMode = this.vision.visionMode;
    const blindedStates = this._getVisionBlindedStates();
    for ( const state in blindedStates ) this.vision.blinded[state] = blindedStates[state];
    this.vision.initialize(this._getVisionSourceData());
    this.vision.add();
    canvas.perception.update({
      initializeVisionModes: !wasVision
        || (this.vision.active !== previousActive)
        || (this.vision.visionMode !== previousVisionMode),
      refreshVision: true,
      refreshLighting: true
    });
  }

  /* -------------------------------------------- */

  /**
   * Returns a record of blinding state.
   * @returns {Record<string, boolean>}
   * @protected
   */
  _getVisionBlindedStates() {
    return {
      blind: this.document.hasStatusEffect(CONFIG.specialStatusEffects.BLIND),
      burrow: this.document.hasStatusEffect(CONFIG.specialStatusEffects.BURROW)
    };
  }

  /* -------------------------------------------- */

  /**
   * Get the vision source data.
   * @returns {VisionSourceData}
   * @protected
   */
  _getVisionSourceData() {
    const d = canvas.dimensions;
    const {x, y} = this.#adjustedCenter;
    const {elevation, rotation} = this.document;
    const sight = this.document.sight;
    return {
      x, y, elevation, rotation,
      radius: Math.clamp(this.sightRange, 0, d.maxR),
      lightRadius: Math.clamp(this.lightPerceptionRange, 0, d.maxR),
      externalRadius: this.externalRadius,
      angle: sight.angle,
      contrast: sight.contrast,
      saturation: sight.saturation,
      brightness: sight.brightness,
      attenuation: sight.attenuation,
      visionMode: sight.visionMode,
      color: sight.color,
      preview: this.isPreview,
      disabled: false
    };
  }

  /* -------------------------------------------- */

  /**
   * Test whether this Token is a viable vision source for the current User.
   * @returns {boolean}
   * @protected
   */
  _isVisionSource() {
    if ( !canvas.visibility.tokenVision || !this.hasSight ) return false;

    // Only display hidden tokens for the GM
    const isGM = game.user.isGM;
    if ( this.document.hidden && !isGM ) return false;

    // Always display controlled tokens which have vision
    if ( this.controlled ) return true;

    // Otherwise, vision is ignored for GM users
    if ( isGM ) return false;

    // If a non-GM user controls no other tokens with sight, display sight
    const canObserve = this.actor?.testUserPermission(game.user, "OBSERVER") ?? false;
    if ( !canObserve ) return false;
    return !this.layer.controlled.some(t => !t.document.hidden && t.hasSight);
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Render the bound mesh detection filter.
   * Note: this method does not verify that the detection filter exists.
   * @param {PIXI.Renderer} renderer
   * @protected
   */
  _renderDetectionFilter(renderer) {
    if ( !this.mesh ) return;

    Token.#DETECTION_FILTER_ARRAY[0] = this.detectionFilter;

    // Rendering the mesh
    const originalFilters = this.mesh.filters;
    const originalTint = this.mesh.tint;
    const originalAlpha = this.mesh.worldAlpha;
    this.mesh.filters = Token.#DETECTION_FILTER_ARRAY;
    this.mesh.tint = 0xFFFFFF;
    this.mesh.worldAlpha = 1;
    this.mesh.pluginName = BaseSamplerShader.classPluginName;
    this.mesh.render(renderer);
    this.mesh.filters = originalFilters;
    this.mesh.tint = originalTint;
    this.mesh.worldAlpha = originalAlpha;
    this.mesh.pluginName = null;

    Token.#DETECTION_FILTER_ARRAY[0] = null;
  }

  /* -------------------------------------------- */

  /** @override */
  clear() {
    if ( this.mesh ) {
      this.mesh.texture = PIXI.Texture.EMPTY;
      this.mesh.visible = false;
    }
    if ( this.#unlinkedVideo ) this.texture?.baseTexture?.destroy(); // Destroy base texture if the token has an unlinked video
    this.#unlinkedVideo = false;
    if ( this.hasActiveHUD ) this.layer.hud.clear();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _destroy(options) {
    this._removeAllFilterEffects();
    this.stopAnimation();                       // Cancel movement animations
    canvas.primary.removeToken(this);           // Remove the TokenMesh from the PrimaryCanvasGroup
    this.#destroyLightSource();                 // Destroy the LightSource
    this.#destroyVisionSource();                // Destroy the VisionSource
    if ( this.#unlinkedVideo ) this.texture?.baseTexture?.destroy();  // Destroy base texture if the token has an unlinked video
    this.removeChildren().forEach(c => c.destroy({children: true}));
    this.texture = undefined;
    this.#unlinkedVideo = false;
  }

  /* -------------------------------------------- */

  /** @override */
  async _draw(options) {
    this.#cleanData();

    // Load token texture
    let texture;
    if ( this._original ) texture = this._original.texture?.clone();
    else texture = await loadTexture(this.document.texture.src, {fallback: CONST.DEFAULT_TOKEN});

    // Cache token ring subject texture if needed
    const ring = this.document.ring;
    if ( ring.enabled && ring.subject.texture ) await loadTexture(ring.subject.texture);

    // Manage video playback
    let video = game.video.getVideoSource(texture);
    this.#unlinkedVideo = !!video && !this._original;
    if ( this.#unlinkedVideo ) {
      texture = await game.video.cloneTexture(video);
      video = game.video.getVideoSource(texture);
      const playOptions = {volume: 0};
      if ( (this.document.getFlag("core", "randomizeVideo") !== false) && Number.isFinite(video.duration) ) {
        playOptions.offset = Math.random() * video.duration;
      }
      game.video.play(video, playOptions);
    }
    this.texture = texture;

    // Draw the TokenMesh in the PrimaryCanvasGroup
    this.mesh = canvas.primary.addToken(this);

    // Initialize token ring
    this.#initializeRing();

    // Draw the border
    this.border ||= this.addChild(new PIXI.Graphics());

    // Draw the void of the TokenMesh
    if ( !this.voidMesh ) {
      this.voidMesh = this.addChild(new PIXI.Container());
      this.voidMesh.updateTransform = () => {};
      this.voidMesh.render = renderer => this.mesh?._renderVoid(renderer);
    }

    // Draw the detection filter of the TokenMesh
    if ( !this.detectionFilterMesh ) {
      this.detectionFilterMesh = this.addChild(new PIXI.Container());
      this.detectionFilterMesh.updateTransform = () => {};
      this.detectionFilterMesh.render = renderer => {
        if ( this.detectionFilter ) this._renderDetectionFilter(renderer);
      };
    }

    // Draw Token interface components
    this.bars ||= this.addChild(this.#drawAttributeBars());
    this.tooltip ||= this.addChild(this.#drawTooltip());
    this.effects ||= this.addChild(new PIXI.Container());

    this.target ||= this.addChild(new PIXI.Graphics());
    this.nameplate ||= this.addChild(this.#drawNameplate());

    // Add filter effects
    this._updateSpecialStatusFilterEffects();

    // Draw elements
    await this._drawEffects();

    // Initialize sources
    if ( !this.isPreview ) this.initializeSources();
  }

  /* -------------------------------------------- */

  /**
   * Create a point light source according to token options.
   * @returns {PointDarknessSource|PointLightSource}
   */
  #createLightSource() {
    const lightSourceClass = this.document.light.negative
      ? CONFIG.Canvas.darknessSourceClass : CONFIG.Canvas.lightSourceClass;
    return new lightSourceClass({sourceId: this.sourceId, object: this});
  }

  /* -------------------------------------------- */

  /**
   * Destroy the PointLightSource or PointDarknessSource instance associated with this Token.
   */
  #destroyLightSource() {
    this.light?.destroy();
    this.light = undefined;
  }

  /* -------------------------------------------- */

  /**
   * Create a point vision source for the Token.
   * @returns {PointVisionSource}
   */
  #createVisionSource() {
    return new CONFIG.Canvas.visionSourceClass({sourceId: this.sourceId, object: this});
  }

  /* -------------------------------------------- */

  /**
   * Destroy the PointVisionSource instance associated with this Token.
   */
  #destroyVisionSource() {
    this.vision?.visionMode?.deactivate(this.vision);
    this.vision?.destroy();
    this.vision = undefined;
  }

  /* -------------------------------------------- */

  /**
   * Apply initial sanitizations to the provided input data to ensure that a Token has valid required attributes.
   * Constrain the Token position to remain within the Canvas rectangle.
   */
  #cleanData() {
    const d = this.scene.dimensions;
    const {x: cx, y: cy} = this.getCenterPoint({x: 0, y: 0});
    this.document.x = Math.clamp(this.document.x, -cx, d.width - cx);
    this.document.y = Math.clamp(this.document.y, -cy, d.height - cy);
  }

  /* -------------------------------------------- */

  /**
   * Draw resource bars for the Token
   * @returns {PIXI.Container}
   */
  #drawAttributeBars() {
    const bars = new PIXI.Container();
    bars.bar1 = bars.addChild(new PIXI.Graphics());
    bars.bar2 = bars.addChild(new PIXI.Graphics());
    return bars;
  }

  /* -------------------------------------------- */
  /*  Incremental Refresh                         */
  /* -------------------------------------------- */

  /** @override */
  _applyRenderFlags(flags) {
    if ( flags.refreshState ) this._refreshState();
    if ( flags.refreshVisibility ) this._refreshVisibility();
    if ( flags.refreshPosition ) this._refreshPosition();
    if ( flags.refreshRotation ) this._refreshRotation();
    if ( flags.refreshSize ) this._refreshSize();
    if ( flags.refreshElevation ) this._refreshElevation();
    if ( flags.refreshMesh ) this._refreshMesh();
    if ( flags.refreshShader ) this._refreshShader();
    if ( flags.refreshShape ) this._refreshShape();
    if ( flags.refreshBorder ) this._refreshBorder();
    if ( flags.refreshBars ) this.drawBars();
    if ( flags.refreshNameplate ) this._refreshNameplate();
    if ( flags.refreshTarget ) this._refreshTarget();
    if ( flags.refreshTooltip ) this._refreshTooltip();
    if ( flags.recoverFromPreview ) this._recoverFromPreview();
    if ( flags.refreshRingVisuals ) this._refreshRingVisuals();
    if ( flags.redrawEffects ) this.drawEffects();
    if ( flags.refreshEffects ) this._refreshEffects();
  }

  /* -------------------------------------------- */

  /**
   * Refresh the token ring visuals if necessary.
   * @protected
   */
  _refreshRingVisuals() {
    if ( this.hasDynamicRing ) this.ring.configureVisuals();
  }

  /* -------------------------------------------- */

  /**
   * Refresh the visibility.
   * @protected
   */
  _refreshVisibility() {
    const wasVisible = this.visible;
    this.visible = this.isVisible;
    if ( this.visible !== wasVisible ) MouseInteractionManager.emulateMoveEvent();
    this.mesh.visible = this.visible && this.renderable;
    if ( this.layer.occlusionMode === CONST.TOKEN_OCCLUSION_MODES.VISIBLE ) {
      canvas.perception.update({refreshOcclusion: true});
    }
  }

  /* -------------------------------------------- */

  /**
   * Refresh aspects of the user interaction state.
   * For example the border, nameplate, or bars may be shown on Hover or on Control.
   * @protected
   */
  _refreshState() {
    this.alpha = this._getTargetAlpha();
    this.border.tint = this.#getBorderColor();
    const isSecret = this.document.isSecret;
    const isHover = this.hover || this.layer.highlightObjects;
    this.removeChild(this.voidMesh);
    this.addChildAt(this.voidMesh, this.getChildIndex(this.border) + (isHover ? 0 : 1));
    this.border.visible = !isSecret && (this.controlled || isHover);
    this.nameplate.visible = !isSecret && this._canViewMode(this.document.displayName);
    this.bars.visible = !isSecret && (this.actor && this._canViewMode(this.document.displayBars));
    this.tooltip.visible = !isSecret;
    this.effects.visible = !isSecret;
    this.target.visible = !isSecret;
    this.cursor = !isSecret ? "pointer" : null;
    this.zIndex = this.mesh.zIndex = this.controlled ? 2 : this.hover ? 1 : 0;
    this.mesh.sort = this.document.sort;
    this.mesh.sortLayer = PrimaryCanvasGroup.SORT_LAYERS.TOKENS;
    this.mesh.alpha = this.alpha * this.document.alpha;
    this.mesh.hidden = this.document.hidden;
  }

  /* -------------------------------------------- */

  /**
   * Refresh the size.
   * @protected
   */
  _refreshSize() {
    const {width, height} = this.getSize();
    const {fit, scaleX, scaleY} = this.document.texture;
    let adjustedScaleX = scaleX;
    let adjustedScaleY = scaleY;
    if ( this.hasDynamicRing && CONFIG.Token.ring.isGridFitMode ) {
      adjustedScaleX *= this.ring.subjectScaleAdjustment;
      adjustedScaleY *= this.ring.subjectScaleAdjustment;
    }
    this.mesh.resize(width, height, {fit, scaleX: adjustedScaleX, scaleY: adjustedScaleY});
    this.nameplate.position.set(width / 2, height + 2);
    this.tooltip.position.set(width / 2, -2);
    if ( this.hasDynamicRing ) this.ring.configureSize();
  }

  /* -------------------------------------------- */

  /**
   * Refresh the shape.
   * @protected
   */
  _refreshShape() {
    this.shape = this.getShape();
    this.hitArea = this.shape;
    MouseInteractionManager.emulateMoveEvent();
  }

  /* -------------------------------------------- */

  /**
   * Refresh the rotation.
   * @protected
   */
  _refreshRotation() {
    this.mesh.angle = this.document.lockRotation ? 0 : this.document.rotation;
  }

  /* -------------------------------------------- */

  /**
   * Refresh the position.
   * @protected
   */
  _refreshPosition() {
    const {x, y} = this.document;
    if ( (this.position.x !== x) || (this.position.y !== y) ) MouseInteractionManager.emulateMoveEvent();
    this.position.set(x, y);
    this.mesh.position = this.center;
  }

  /* -------------------------------------------- */

  /**
   * Refresh the elevation
   * @protected
   */
  _refreshElevation() {
    this.mesh.elevation = this.document.elevation;
  }

  /* -------------------------------------------- */

  /**
   * Refresh the tooltip.
   * @protected
   */
  _refreshTooltip() {
    this.tooltip.text = this._getTooltipText();
    this.tooltip.style = this._getTextStyle();
  }

  /* -------------------------------------------- */

  /**
   * Refresh the text content, position, and visibility of the Token nameplate.
   * @protected
   */
  _refreshNameplate() {
    this.nameplate.text = this.document.name;
    this.nameplate.style = this._getTextStyle();
  }

  /* -------------------------------------------- */

  /**
   * Refresh the token mesh.
   * @protected
   */
  _refreshMesh() {
    const {alpha, texture: {anchorX, anchorY, fit, scaleX, scaleY, tint, alphaThreshold}} = this.document;
    const {width, height} = this.getSize();
    let adjustedScaleX = scaleX;
    let adjustedScaleY = scaleY;
    if ( this.hasDynamicRing && CONFIG.Token.ring.isGridFitMode ) {
      adjustedScaleX *= this.ring.subjectScaleAdjustment;
      adjustedScaleY *= this.ring.subjectScaleAdjustment;
    }
    this.mesh.resize(width, height, {fit, scaleX: adjustedScaleX, scaleY: adjustedScaleY});
    this.mesh.anchor.set(anchorX, anchorY);
    this.mesh.alpha = this.alpha * alpha;
    this.mesh.tint = tint;
    this.mesh.textureAlphaThreshold = alphaThreshold;
    this.mesh.occludedAlpha = 0.5;
  }

  /* -------------------------------------------- */

  /**
   * Refresh the token mesh shader.
   * @protected
   */
  _refreshShader() {
    if ( this.hasDynamicRing ) this.mesh.setShaderClass(CONFIG.Token.ring.shaderClass);
    else this.mesh.setShaderClass(PrimaryBaseSamplerShader);
  }

  /* -------------------------------------------- */

  /**
   * Refresh the border.
   * @protected
   */
  _refreshBorder() {
    const thickness = CONFIG.Canvas.objectBorderThickness;
    this.border.clear();
    this.border.lineStyle({width: thickness, color: 0x000000, alignment: 0.75, join: PIXI.LINE_JOIN.ROUND});
    this.border.drawShape(this.shape);
    this.border.lineStyle({width: thickness / 2, color: 0xFFFFFF, alignment: 1, join: PIXI.LINE_JOIN.ROUND});
    this.border.drawShape(this.shape);
  }

  /* -------------------------------------------- */

  /**
   * Get the hex color that should be used to render the Token border
   * @returns {number}    The hex color used to depict the border color
   * @protected
   */
  _getBorderColor() {
    const colors = CONFIG.Canvas.dispositionColors;
    if ( this.controlled || (this.isOwner && !game.user.isGM) ) return colors.CONTROLLED;
    const D = CONST.TOKEN_DISPOSITIONS;
    switch ( this.document.disposition ) {
      case D.SECRET: return colors.SECRET;
      case D.HOSTILE: return colors.HOSTILE;
      case D.NEUTRAL: return colors.NEUTRAL;
      case D.FRIENDLY: return this.actor?.hasPlayerOwner ? colors.PARTY : colors.FRIENDLY;
      default: throw new Error("Invalid disposition");
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the hex color that should be used to render the Token border
   * @returns {number}            The border color
   */
  #getBorderColor() {
    let color = this._getBorderColor();
    /** @deprecated since v12 */
    if ( typeof color !== "number" ) {
      color = CONFIG.Canvas.dispositionColors.INACTIVE;
      const msg = "Token#_getBorderColor returning null is deprecated.";
      foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    }
    return color;
  }

  /* -------------------------------------------- */

  /**
   * @typedef {object} ReticuleOptions
   * @property {number} [margin=0]        The amount of margin between the targeting arrows and the token's bounding
   *                                      box, expressed as a fraction of an arrow's size.
   * @property {number} [alpha=1]         The alpha value of the arrows.
   * @property {number} [size=0.15]       The size of the arrows as a proportion of grid size.
   * @property {number} [color=0xFF6400]  The color of the arrows.
   * @property {object} [border]          The arrows' border style configuration.
   * @property {number} [border.color=0]  The border color.
   * @property {number} [border.width=2]  The border width.
   */

  /**
   * Refresh the target indicators for the Token.
   * Draw both target arrows for the primary User and indicator pips for other Users targeting the same Token.
   * @param {ReticuleOptions} [reticule]  Additional parameters to configure how the targeting reticule is drawn.
   * @protected
   */
  _refreshTarget(reticule) {
    this.target.clear();

    // We don't show the target arrows for a secret token disposition and non-GM users
    if ( !this.targeted.size ) return;

    // Determine whether the current user has target and any other users
    const [others, user] = Array.from(this.targeted).partition(u => u === game.user);

    // For the current user, draw the target arrows
    if ( user.length ) this._drawTarget(reticule);

    // For other users, draw offset pips
    const hw = (this.w / 2) + (others.length % 2 === 0 ? 8 : 0);
    for ( let [i, u] of others.entries() ) {
      const offset = Math.floor((i+1) / 2) * 16;
      const sign = i % 2 === 0 ? 1 : -1;
      const x = hw + (sign * offset);
      this.target.beginFill(u.color, 1.0).lineStyle(2, 0x0000000).drawCircle(x, 0, 6);
    }
  }

  /* -------------------------------------------- */

  /**
   * Draw the targeting arrows around this token.
   * @param {ReticuleOptions} [reticule]  Additional parameters to configure how the targeting reticule is drawn.
   * @protected
   */
  _drawTarget({margin: m=0, alpha=1, size=.15, color, border: {width=2, color: lineColor=0}={}}={}) {
    const l = canvas.dimensions.size * size; // Side length.
    const {h, w} = this;
    const lineStyle = {color: lineColor, alpha, width, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.BEVEL};
    color ??= this.#getBorderColor();
    m *= l * -1;
    this.target.beginFill(color, alpha).lineStyle(lineStyle)
      .drawPolygon([-m, -m, -m-l, -m, -m, -m-l]) // Top left
      .drawPolygon([w+m, -m, w+m+l, -m, w+m, -m-l]) // Top right
      .drawPolygon([-m, h+m, -m-l, h+m, -m, h+m+l]) // Bottom left
      .drawPolygon([w+m, h+m, w+m+l, h+m, w+m, h+m+l]); // Bottom right
  }

  /* -------------------------------------------- */

  /**
   * Refresh the display of Token attribute bars, rendering its latest resource data.
   * If the bar attribute is valid (has a value and max), draw the bar. Otherwise hide it.
   */
  drawBars() {
    if ( !this.actor || (this.document.displayBars === CONST.TOKEN_DISPLAY_MODES.NONE) ) return;
    ["bar1", "bar2"].forEach((b, i) => {
      const bar = this.bars[b];
      const attr = this.document.getBarAttribute(b);
      if ( !attr || (attr.type !== "bar") || (attr.max === 0) ) return bar.visible = false;
      this._drawBar(i, bar, attr);
      bar.visible = true;
    });
  }

  /* -------------------------------------------- */

  /**
   * Draw a single resource bar, given provided data
   * @param {number} number       The Bar number
   * @param {PIXI.Graphics} bar   The Bar container
   * @param {Object} data         Resource data for this bar
   * @protected
   */
  _drawBar(number, bar, data) {
    const val = Number(data.value);
    const pct = Math.clamp(val, 0, data.max) / data.max;

    // Determine sizing
    const {width, height} = this.getSize();
    const bw = width;
    const bh = Math.max(canvas.dimensions.size / 12, 8) * (this.document.height >= 2 ? 1.6 : 1);
    const bs = Math.clamp(bh / 8, 1, 2);

    // Determine the color to use
    let color;
    if ( number === 0 ) color = Color.fromRGB([1 - (pct / 2), pct, 0]);
    else color = Color.fromRGB([0.5 * pct, 0.7 * pct, 0.5 + (pct / 2)]);

    // Draw the bar
    bar.clear();
    bar.lineStyle(bs, 0x000000, 1.0);
    bar.beginFill(0x000000, 0.5).drawRoundedRect(0, 0, bw, bh, 3);
    bar.beginFill(color, 1.0).drawRoundedRect(0, 0, pct * bw, bh, 2);

    // Set position
    const posY = number === 0 ? height - bh : 0;
    bar.position.set(0, posY);
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Draw the token's nameplate as a text object
   * @returns {PreciseText}    The Text object for the Token nameplate
   */
  #drawNameplate() {
    const nameplate = new PreciseText(this.document.name, this._getTextStyle());
    nameplate.anchor.set(0.5, 0);
    return nameplate;
  }

  /* -------------------------------------------- */

  /**
   * Draw a text tooltip for the token which can be used to display Elevation or a resource value
   * @returns {PreciseText}     The text object used to render the tooltip
   */
  #drawTooltip() {
    const tooltip = new PreciseText(this._getTooltipText(), this._getTextStyle());
    tooltip.anchor.set(0.5, 1);
    return tooltip;
  }

  /* -------------------------------------------- */

  /**
   * Return the text which should be displayed in a token's tooltip field
   * @returns {string}
   * @protected
   */
  _getTooltipText() {
    let elevation = this.document.elevation;
    if ( !Number.isFinite(elevation) || (elevation === 0) ) return "";
    let text = String(elevation);
    if ( elevation > 0 ) text = `+${text}`;
    const units = canvas.grid.units;
    if ( units ) text = `${text} ${units}`;
    return text;
  }

  /* -------------------------------------------- */

  /**
   * Get the text style that should be used for this Token's tooltip.
   * @returns {string}
   * @protected
   */
  _getTextStyle() {
    const style = CONFIG.canvasTextStyle.clone();
    style.fontSize = 24;
    if (canvas.dimensions.size >= 200) style.fontSize = 28;
    else if (canvas.dimensions.size < 50) style.fontSize = 20;
    style.wordWrapWidth = this.w * 2.5;
    return style;
  }

  /* -------------------------------------------- */

  /**
   * Draw the effect icons for ActiveEffect documents which apply to the Token's Actor.
   */
  async drawEffects() {
    return this._partialDraw(() => this._drawEffects());
  }

  /* -------------------------------------------- */

  /**
   * Draw the effect icons for ActiveEffect documents which apply to the Token's Actor.
   * Called by {@link Token#drawEffects}.
   * @protected
   */
  async _drawEffects() {
    this.effects.renderable = false;

    // Clear Effects Container
    this.effects.removeChildren().forEach(c => c.destroy());
    this.effects.bg = this.effects.addChild(new PIXI.Graphics());
    this.effects.bg.zIndex = -1;
    this.effects.overlay = null;

    // Categorize effects
    const activeEffects = this.actor?.temporaryEffects || [];
    const overlayEffect = activeEffects.findLast(e => e.img && e.getFlag("core", "overlay"));

    // Draw effects
    const promises = [];
    for ( const [i, effect] of activeEffects.entries() ) {
      if ( !effect.img ) continue;
      const promise = effect === overlayEffect
        ? this._drawOverlay(effect.img, effect.tint)
        : this._drawEffect(effect.img, effect.tint);
      promises.push(promise.then(e => {
        if ( e ) e.zIndex = i;
      }));
    }
    await Promise.allSettled(promises);

    this.effects.sortChildren();
    this.effects.renderable = true;
    this.renderFlags.set({refreshEffects: true});
  }

  /* -------------------------------------------- */

  /**
   * Draw a status effect icon
   * @param {string} src
   * @param {PIXI.ColorSource|null} tint
   * @returns {Promise<PIXI.Sprite|undefined>}
   * @protected
   */
  async _drawEffect(src, tint) {
    if ( !src ) return;
    const tex = await loadTexture(src, {fallback: "icons/svg/hazard.svg"});
    const icon = new PIXI.Sprite(tex);
    icon.tint = tint ?? 0xFFFFFF;
    return this.effects.addChild(icon);
  }

  /* -------------------------------------------- */

  /**
   * Draw the overlay effect icon
   * @param {string} src
   * @param {number|null} tint
   * @returns {Promise<PIXI.Sprite>}
   * @protected
   */
  async _drawOverlay(src, tint) {
    const icon = await this._drawEffect(src, tint);
    if ( icon ) icon.alpha = 0.8;
    this.effects.overlay = icon ?? null;
    return icon;
  }

  /* -------------------------------------------- */

  /**
   * Refresh the display of status effects, adjusting their position for the token width and height.
   * @protected
   */
  _refreshEffects() {
    let i = 0;
    const size = Math.round(canvas.dimensions.size / 10) * 2;
    const rows = Math.floor(this.document.height * 5);
    const bg = this.effects.bg.clear().beginFill(0x000000, 0.40).lineStyle(1.0, 0x000000);
    for ( const effect of this.effects.children ) {
      if ( effect === bg ) continue;

      // Overlay effect
      if ( effect === this.effects.overlay ) {
        const {width, height} = this.getSize();
        const size = Math.min(width * 0.6, height * 0.6);
        effect.width = effect.height = size;
        effect.position = this.getCenterPoint({x: 0, y: 0});
        effect.anchor.set(0.5, 0.5);
      }

      // Status effect
      else {
        effect.width = effect.height = size;
        effect.x = Math.floor(i / rows) * size;
        effect.y = (i % rows) * size;
        bg.drawRoundedRect(effect.x + 1, effect.y + 1, size - 2, size - 2, 2);
        i++;
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Helper method to determine whether a token attribute is viewable under a certain mode
   * @param {number} mode   The mode from CONST.TOKEN_DISPLAY_MODES
   * @returns {boolean}      Is the attribute viewable?
   * @protected
   */
  _canViewMode(mode) {
    if ( mode === CONST.TOKEN_DISPLAY_MODES.NONE ) return false;
    else if ( mode === CONST.TOKEN_DISPLAY_MODES.ALWAYS ) return true;
    else if ( mode === CONST.TOKEN_DISPLAY_MODES.CONTROL ) return this.controlled;
    else if ( mode === CONST.TOKEN_DISPLAY_MODES.HOVER ) return this.hover || this.layer.highlightObjects;
    else if ( mode === CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER ) return this.isOwner
      && (this.hover || this.layer.highlightObjects);
    else if ( mode === CONST.TOKEN_DISPLAY_MODES.OWNER ) return this.isOwner;
    return false;
  }

  /* -------------------------------------------- */
  /*  Token Ring                                  */
  /* -------------------------------------------- */

  /**
   * Override ring colors for this particular Token instance.
   * @returns {{[ring]: Color, [background]: Color}}
   */
  getRingColors() {
    return {};
  }

  /* -------------------------------------------- */

  /**
   * Apply additional ring effects for this particular Token instance.
   * Effects are returned as an array of integers in {@link foundry.canvas.tokens.TokenRing.effects}.
   * @returns {number[]}
   */
  getRingEffects() {
    return [];
  }

  /* -------------------------------------------- */
  /*  Token Animation                             */
  /* -------------------------------------------- */

  /**
   * Get the animation data for the current state of the document.
   * @returns {TokenAnimationData}         The target animation data object
   * @protected
   */
  _getAnimationData() {
    const doc = this.document;
    const {x, y, width, height, rotation, alpha} = doc;
    const {src, anchorX, anchorY, scaleX, scaleY, tint} = doc.texture;
    const texture = {src, anchorX, anchorY, scaleX, scaleY, tint};
    const subject = {
      texture: doc.ring.subject.texture,
      scale: doc.ring.subject.scale
    };
    return {x, y, width, height, rotation, alpha, texture, ring: {subject}};
  }

  /* -------------------------------------------- */

  /**
   * Animate from the old to the new state of this Token.
   * @param {Partial<TokenAnimationData>} to      The animation data to animate to
   * @param {object} [options]                    The options that configure the animation behavior.
   *                                              Passed to {@link Token#_getAnimationDuration}.
   * @param {number} [options.duration]           The duration of the animation in milliseconds
   * @param {number} [options.movementSpeed=6]    A desired token movement speed in grid spaces per second
   * @param {string} [options.transition]         The desired texture transition type
   * @param {Function|string} [options.easing]    The easing function of the animation
   * @param {string|symbol|null} [options.name]   The name of the animation, or null if nameless.
   *                                              The default is {@link Token#animationName}.
   * @param {Function} [options.ontick]           A on-tick callback
   * @returns {Promise<void>}                     A promise which resolves once the animation has finished or stopped
   */
  async animate(to, {duration, easing, movementSpeed, name, ontick, ...options}={}) {
    /** @deprecated since v12 */
    if ( "a0" in options ) {
      const msg = "Passing a0 to Token#animate is deprecated without replacement.";
      foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14});
    }

    // Get the name and the from and to animation data
    if ( name === undefined ) name = this.animationName;
    else name ||= Symbol(this.animationName);
    const from = this.#animationData;
    to = foundry.utils.filterObject(to, this.#animationData);
    let context = this.#animationContexts.get(name);
    if ( context ) to = foundry.utils.mergeObject(context.to, to, {inplace: false});

    // Conclude the current animation
    CanvasAnimation.terminateAnimation(name);
    if ( context ) this.#animationContexts.delete(name);

    // Get the animation duration and create the animation context
    duration ??= this._getAnimationDuration(from, to, {movementSpeed, ...options});
    context = {name, to, duration, time: 0, preAnimate: [], postAnimate: [], onAnimate: []};

    // Animate the first frame
    this.#animateFrame(context);

    // If the duration of animation is not positive, we can immediately conclude the animation
    if ( duration <= 0 ) return;

    // Set the animation context
    this.#animationContexts.set(name, context);

    // Prepare the animation data changes
    const changes = foundry.utils.diffObject(from, to);
    const attributes = this._prepareAnimation(from, changes, context, options);

    // Dispatch the animation
    context.promise = CanvasAnimation.animate(attributes, {
      name,
      context: this,
      duration,
      easing,
      priority: PIXI.UPDATE_PRIORITY.OBJECTS + 1, // Before perception updates and Token render flags
      wait: Promise.allSettled(context.preAnimate.map(fn => fn(context))),
      ontick: (dt, anim) => {
        context.time = anim.time;
        if ( ontick ) ontick(dt, anim, this.#animationData);
        this.#animateFrame(context);
      }
    });
    await context.promise.finally(() => {
      if ( this.#animationContexts.get(name) === context ) this.#animationContexts.delete(name);
      for ( const fn of context.postAnimate ) fn(context);
    });
  }

  /* -------------------------------------------- */

  /**
   * Get the duration of the animation.
   * @param {TokenAnimationData} from             The animation data to animate from
   * @param {Partial<TokenAnimationData>} to      The animation data to animate to
   * @param {object} [options]                    The options that configure the animation behavior
   * @param {number} [options.movementSpeed=6]    A desired token movement speed in grid spaces per second
   * @returns {number}                            The duration of the animation in milliseconds
   * @protected
   */
  _getAnimationDuration(from, to, {movementSpeed=6}={}) {
    let duration = 0;
    const dx = from.x - (to.x ?? from.x);
    const dy = from.y - (to.y ?? from.y);
    if ( dx || dy ) duration = Math.max(duration, Math.hypot(dx, dy) / canvas.dimensions.size / movementSpeed * 1000);
    const dr = ((Math.abs(from.rotation - (to.rotation ?? from.rotation)) + 180) % 360) - 180;
    if ( dr ) duration = Math.max(duration, Math.abs(dr) / (movementSpeed * 60) * 1000);
    if ( !duration ) duration = 1000; // The default animation duration is 1 second
    return duration;
  }

  /* -------------------------------------------- */

  /**
   * Handle a single frame of a token animation.
   * @param {TokenAnimationContext} context    The animation context
   */
  #animateFrame(context) {
    if ( context.time >= context.duration ) foundry.utils.mergeObject(this.#animationData, context.to);
    const changes = foundry.utils.diffObject(this.#priorAnimationData, this.#animationData);
    foundry.utils.mergeObject(this.#priorAnimationData, this.#animationData);
    foundry.utils.mergeObject(this.document, this.#animationData, {insertKeys: false});
    for ( const fn of context.onAnimate ) fn(context);
    this._onAnimationUpdate(changes, context);
  }

  /* -------------------------------------------- */

  /**
   * Called each animation frame.
   * @param {Partial<TokenAnimationData>} changed    The animation data that changed
   * @param {TokenAnimationContext} context          The animation context
   * @protected
   */
  _onAnimationUpdate(changed, context) {
    const positionChanged = ("x" in changed) || ("y" in changed);
    const rotationChanged = ("rotation" in changed);
    const sizeChanged = ("width" in changed) || ("height" in changed);
    const textureChanged = "texture" in changed;
    const ringEnabled = this.document.ring.enabled;
    const ringChanged = "ring" in changed;
    const ringSubjectChanged = ringEnabled && ringChanged && ("subject" in changed.ring);
    const ringSubjectTextureChanged = ringSubjectChanged && ("texture" in changed.ring.subject);
    const ringSubjectScaleChanged = ringSubjectChanged && ("scale" in changed.ring.subject);
    this.renderFlags.set({
      redraw: (textureChanged && ("src" in changed.texture)) || ringSubjectTextureChanged,
      refreshVisibility: positionChanged || sizeChanged,
      refreshPosition: positionChanged,
      refreshRotation: rotationChanged && !this.document.lockRotation,
      refreshSize: sizeChanged || ringSubjectScaleChanged,
      refreshMesh: textureChanged || ("alpha" in changed)
    });

    // Update occlusion and/or sounds and the HUD if necessary
    if ( positionChanged || sizeChanged ) {
      canvas.perception.update({refreshSounds: true, refreshOcclusionMask: true, refreshOcclusionStates: true});
      if ( this.hasActiveHUD ) this.layer.hud.clear();
    }

    // Update light and sight sources unless Vision Animation is disabled
    if ( (context.time < context.duration) && !game.settings.get("core", "visionAnimation") ) return;
    const perspectiveChanged = positionChanged || sizeChanged || (rotationChanged && this.hasLimitedSourceAngle);
    const visionChanged = perspectiveChanged && this.hasSight;
    const lightChanged = perspectiveChanged && this._isLightSource();
    if ( visionChanged || lightChanged ) this.initializeSources();
  }

  /* -------------------------------------------- */

  /**
   * Terminate the animations of this particular Token, if exists.
   * @param {object} [options]                Additional options.
   * @param {boolean} [options.reset=true]    Reset the TokenDocument?
   */
  stopAnimation({reset=true}={}) {
    if ( reset ) this.document.reset();
    for ( const name of this.#animationContexts.keys() ) CanvasAnimation.terminateAnimation(name);
    this.#animationContexts.clear();
    const to = this._getAnimationData();
    const changes = foundry.utils.diffObject(this.#animationData, to);
    foundry.utils.mergeObject(this.#animationData, to);
    foundry.utils.mergeObject(this.#priorAnimationData, this.#animationData);
    if ( foundry.utils.isEmpty(changes) ) return;
    const context = {name: Symbol(this.animationName), to, duration: 0, time: 0,
      preAnimate: [], postAnimate: [], onAnimate: []};
    this._onAnimationUpdate(changes, context);
  }

  /* -------------------------------------------- */
  /*  Animation Preparation Methods               */
  /* -------------------------------------------- */

  /**
   * Move the token immediately to the destination if it is teleported.
   * @param {Partial<TokenAnimationData>} to    The animation data to animate to
   */
  #handleTeleportAnimation(to) {
    const changes = {};
    if ( "x" in to ) this.#animationData.x = changes.x = to.x;
    if ( "y" in to ) this.#animationData.y = changes.y = to.y;
    if ( "elevation" in to ) this.#animationData.elevation = changes.elevation = to.elevation;
    if ( !foundry.utils.isEmpty(changes) ) {
      const context = {name: Symbol(this.animationName), to: changes, duration: 0, time: 0,
        preAnimate: [], postAnimate: [], onAnimate: []};
      this._onAnimationUpdate(changes, context);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle the rotation changes for the animation, ensuring the shortest rotation path.
   * @param {TokenAnimationData} from      The animation data to animate from
   * @param {Partial<TokenAnimationData>} changes  The animation data changes
   */
  static #handleRotationChanges(from, changes) {
    if ( "rotation" in changes ) {
      let dr = changes.rotation - from.rotation;
      while ( dr > 180 ) dr -= 360;
      while ( dr < -180 ) dr += 360;
      changes.rotation = from.rotation + dr;
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the padding for both the source and target tokens to ensure they are square.
   * @param {PrimarySpriteMesh} sourceMesh  The source mesh
   * @param {PrimarySpriteMesh} targetMesh  The target mesh
   */
  static #updatePadding(sourceMesh, targetMesh) {
    const calculatePadding = ({width, height}) => ({
      x: width > height ? 0 : (height - width) / 2,
      y: height > width ? 0 : (width - height) / 2
    });

    const paddingSource = calculatePadding(sourceMesh.texture);
    sourceMesh.paddingX = paddingSource.x;
    sourceMesh.paddingY = paddingSource.y;

    const paddingTarget = calculatePadding(targetMesh.texture);
    targetMesh.paddingX = paddingTarget.x;
    targetMesh.paddingY = paddingTarget.y;
  }

  /* -------------------------------------------- */

  /**
   * Create a texture transition filter with the given options.
   * @param {object} options  The options that configure the filter
   * @returns {TextureTransitionFilter}  The created filter
   */
  static #createTransitionFilter(options) {
    const filter = TextureTransitionFilter.create();
    filter.enabled = false;
    filter.type = options.transition ?? "fade";
    return filter;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the animation data changes: performs special handling required for animating rotation.
   * @param {TokenAnimationData} from                         The animation data to animate from
   * @param {Partial<TokenAnimationData>} changes             The animation data changes
   * @param {Omit<TokenAnimationContext, "promise">} context  The animation context
   * @param {object} [options]                                The options that configure the animation behavior
   * @param {string} [options.transition="fade"]              The desired texture transition type
   * @returns {CanvasAnimationAttribute[]}                    The animation attributes
   * @protected
   */
  _prepareAnimation(from, changes, context, options = {}) {
    const attributes = [];

    Token.#handleRotationChanges(from, changes);
    this.#handleTransitionChanges(changes, context, options, attributes);

    // Create animation attributes from the changes
    const recur = (changes, parent) => {
      for ( const [attribute, to] of Object.entries(changes) ) {
        const type = foundry.utils.getType(to);
        if ( type === "Object" ) recur(to, parent[attribute]);
        else if ( type === "number" || type === "Color" ) attributes.push({attribute, parent, to});
      }
    };
    recur(changes, this.#animationData);
    return attributes;
  }

  /* -------------------------------------------- */

  /**
   * Handle the transition changes, creating the necessary filter and preparing the textures.
   * @param {Partial<TokenAnimationData>} changed       The animation data that changed
   * @param {Omit<TokenAnimationContext, "promise">} context  The animation context
   * @param {object} options                            The options that configure the animation behavior
   * @param {CanvasAnimationAttribute[]} attributes     The array to push animation attributes to
   */
  #handleTransitionChanges(changed, context, options, attributes) {
    const textureChanged = ("texture" in changed) && ("src" in changed.texture);
    const ringEnabled = this.document.ring.enabled;
    const subjectTextureChanged = ringEnabled && ("ring" in changed) && ("subject" in changed.ring) && ("texture" in changed.ring.subject);

    // If no texture has changed, no need for a transition
    if ( !(textureChanged || subjectTextureChanged) ) return;

    const filter = Token.#createTransitionFilter(options);
    let renderTexture;
    let targetMesh;
    let targetToken;

    if ( this.mesh ) {
      this.mesh.filters ??= [];
      this.mesh.filters.unshift(filter);
    }

    context.preAnimate.push(async function() {
      const targetAsset = !ringEnabled ? changed.texture.src
        : (subjectTextureChanged ? changed.ring.subject.texture : this.document.ring.subject.texture);
      const targetTexture = await loadTexture(targetAsset, {fallback: CONST.DEFAULT_TOKEN});
      targetToken = this.#prepareTargetToken(targetTexture);

      // Create target primary sprite mesh and assign to the target token
      targetMesh = new PrimarySpriteMesh({object: targetToken});
      targetMesh.texture = targetTexture;
      targetToken.mesh = targetMesh;

      // Prepare source and target meshes and shader class
      if ( ringEnabled ) {
        targetToken.#ring = new CONFIG.Token.ring.ringClass(targetToken);
        targetToken.#ring.configure(targetMesh);
        targetMesh.setShaderClass(CONFIG.Token.ring.shaderClass);
      }
      else {
        Token.#updatePadding(this.mesh, targetMesh);
        targetMesh.setShaderClass(PrimaryBaseSamplerShader);
      }

      // Prepare mesh position for rendering
      targetMesh.position.set(targetMesh.paddingX, targetMesh.paddingY);

      // Configure render texture and render the target mesh into it
      const renderer = canvas.app.renderer;
      renderTexture = renderer.generateTexture(targetMesh, {resolution: targetMesh.texture.resolution});

      // Add animation function if ring effects are enabled
      if ( targetToken.hasDynamicRing && (this.document.ring.effects > CONFIG.Token.ring.ringClass.effects.ENABLED) ) {
        context.onAnimate.push(function() {
          canvas.app.renderer.render(targetMesh, {renderTexture});
        });
      }

      // Preparing the transition filter
      filter.targetTexture = renderTexture;
      filter.enabled = true;
    }.bind(this));

    context.postAnimate.push(function() {
      targetMesh?.destroy();
      renderTexture?.destroy(true);
      targetToken?.destroy({children: true});
      this.mesh?.filters?.findSplice(f => f === filter);
      if ( !this.hasDynamicRing && this.mesh ) this.mesh.padding = 0;
    }.bind(this));

    attributes.push({attribute: "progress", parent: filter.uniforms, to: 1});
  }

  /* -------------------------------------------- */

  /**
   * Prepare a target token by cloning the current token and setting its texture.
   * @param {PIXI.Texture} targetTexture  The texture to set on the target token
   * @returns {Token}  The prepared target token
   * @internal
   */
  #prepareTargetToken(targetTexture) {
    const cloneDoc = this.document.clone();
    const clone = cloneDoc.object;
    clone.texture = targetTexture;
    return clone;
  }

  /* -------------------------------------------- */
  /*  Methods
  /* -------------------------------------------- */

  /**
   * Check for collision when attempting a move to a new position
   * @param {Point} destination           The central destination point of the attempted movement
   * @param {object} [options={}]         Additional options forwarded to PointSourcePolygon.testCollision
   * @param {Point} [options.origin]      The origin to be used instead of the current origin
   * @param {PointSourcePolygonType} [options.type="move"]    The collision type
   * @param {"any"|"all"|"closest"} [options.mode="any"]      The collision mode to test: "any", "all", or "closest"
   * @returns {boolean|PolygonVertex|PolygonVertex[]|null}    The collision result depends on the mode of the test:
   *                                                * any: returns a boolean for whether any collision occurred
   *                                                * all: returns a sorted array of PolygonVertex instances
   *                                                * closest: returns a PolygonVertex instance or null
   */
  checkCollision(destination, {origin, type="move", mode="any"}={}) {

    // Round origin and destination such that the top-left point (i.e. the Token's position) is integer
    const {x: cx, y: cy} = this.getCenterPoint({x: 0, y: 0});
    if ( origin ) origin = {x: Math.round(origin.x - cx) + cx, y: Math.round(origin.y - cy) + cy};
    destination = {x: Math.round(destination.x - cx) + cx, y: Math.round(destination.y - cy) + cy};

    // The test origin is the last confirmed valid position of the Token
    const center = origin || this.getCenterPoint(this.#validPosition);
    origin = this.getMovementAdjustedPoint(center);

    // The test destination is the adjusted point based on the proposed movement vector
    const dx = destination.x - center.x;
    const dy = destination.y - center.y;
    const offsetX = dx === 0 ? this.#priorMovement.ox : Math.sign(dx);
    const offsetY = dy === 0 ? this.#priorMovement.oy : Math.sign(dy);
    destination = this.getMovementAdjustedPoint(destination, {offsetX, offsetY});

    // Reference the correct source object
    let source;
    switch ( type ) {
      case "move":
        source = this.#getMovementSource(origin); break;
      case "sight":
        source = this.vision; break;
      case "light":
        source = this.light; break;
      case "sound":
        throw new Error("Collision testing for Token sound sources is not supported at this time");
    }

    // Create a movement source passed to the polygon backend
    return CONFIG.Canvas.polygonBackends[type].testCollision(origin, destination, {type, mode, source});
  }

  /* -------------------------------------------- */

  /**
   * Prepare a PointMovementSource for the document
   * @param {Point} origin    The origin of the source
   * @returns {foundry.canvas.sources.PointMovementSource}
   */
  #getMovementSource(origin) {
    const movement = new foundry.canvas.sources.PointMovementSource({object: this});
    movement.initialize({x: origin.x, y: origin.y, elevation: this.document.elevation});
    return movement;
  }

  /* -------------------------------------------- */

  /**
   * Get the width and height of the Token in pixels.
   * @returns {{width: number, height: number}}    The size in pixels
   */
  getSize() {
    let {width, height} = this.document;
    const grid = this.scene.grid;
    if ( grid.isHexagonal ) {
      if ( grid.columns ) width = (0.75 * Math.floor(width)) + (0.5 * (width % 1)) + 0.25;
      else height = (0.75 * Math.floor(height)) + (0.5 * (height % 1)) + 0.25;
    }
    width *= grid.sizeX;
    height *= grid.sizeY;
    return {width, height};
  }

  /* -------------------------------------------- */

  /**
   * Get the shape of this Token.
   * @returns {PIXI.Rectangle|PIXI.Polygon|PIXI.Circle}
   */
  getShape() {
    const {width, height, hexagonalShape} = this.document;
    const grid = this.scene.grid;

    // Hexagonal shape
    if ( grid.isHexagonal ) {
      const shape = Token.#getHexagonalShape(grid.columns, hexagonalShape, width, height);
      if ( shape ) {
        const points = [];
        for ( let i = 0; i < shape.points.length; i += 2 ) {
          points.push(shape.points[i] * grid.sizeX, shape.points[i + 1] * grid.sizeY);
        }
        return new PIXI.Polygon(points);
      }

      // No hexagonal shape for this combination of shape type, width, and height.
      // Fallback to rectangular shape.
    }

    // Rectangular shape
    const size = this.getSize();
    return new PIXI.Rectangle(0, 0, size.width, size.height);
  }

  /* -------------------------------------------- */

  /**
   * Get the center point for a given position or the current position.
   * @param {Point} [position]    The position to be used instead of the current position
   * @returns {Point}             The center point
   */
  getCenterPoint(position) {
    const {x, y} = position ?? this.document;
    const {width, height, hexagonalShape} = this.document;
    const grid = this.scene.grid;

    // Hexagonal shape
    if ( grid.isHexagonal ) {
      const shape = Token.#getHexagonalShape(grid.columns, hexagonalShape, width, height);
      if ( shape ) {
        const center = shape.center;
        return {x: x + (center.x * grid.sizeX), y: y + (center.y * grid.sizeY)};
      }

      // No hexagonal shape for this combination of shape type, width, and height.
      // Fallback to the center of the rectangle.
    }

    // Rectangular shape
    const size = this.getSize();
    return {x: x + (size.width / 2), y: y + (size.height / 2)};
  }

  /* -------------------------------------------- */

  /** @override */
  getSnappedPosition(position) {
    position ??= this.document;
    const grid = this.scene.grid;
    if ( grid.isSquare ) return this.#snapToSquareGrid(position);
    if ( grid.isHexagonal ) return this.#snapToHexagonalGrid(position);
    return {x: position.x, y: position.y};
  }

  /* -------------------------------------------- */

  /**
   * Get the snapped position for a given position on a square grid.
   * @param {Point} position    The position that is snapped
   * @returns {Point}           The snapped position
   */
  #snapToSquareGrid(position) {
    const {width, height} = this.document;
    const grid = this.scene.grid;
    const M = CONST.GRID_SNAPPING_MODES;

    // Small tokens snap to any vertex of the subgrid with resolution 4
    // where the token is fully contained within the grid space
    if ( ((width === 0.5) && (height <= 1)) || ((width <= 1) && (height === 0.5)) ) {
      let x = position.x / grid.size;
      let y = position.y / grid.size;
      if ( width === 1 ) x = Math.round(x);
      else {
        x = Math.floor(x * 8);
        const k = ((x % 8) + 8) % 8;
        if ( k >= 6 ) x = Math.ceil(x / 8);
        else if ( k === 5 ) x = Math.floor(x / 8) + 0.5;
        else x = Math.round(x / 2) / 4;
      }
      if ( height === 1 ) y = Math.round(y);
      else {
        y = Math.floor(y * 8);
        const k = ((y % 8) + 8) % 8;
        if ( k >= 6 ) y = Math.ceil(y / 8);
        else if ( k === 5 ) y = Math.floor(y / 8) + 0.5;
        else y = Math.round(y / 2) / 4;
      }
      x *= grid.size;
      y *= grid.size;
      return {x, y};
    }

    const modeX = Number.isInteger(width) ? M.VERTEX : M.VERTEX | M.EDGE_MIDPOINT | M.CENTER;
    const modeY = Number.isInteger(height) ? M.VERTEX : M.VERTEX | M.EDGE_MIDPOINT | M.CENTER;
    if ( modeX === modeY ) return grid.getSnappedPoint(position, {mode: modeX});
    return {
      x: grid.getSnappedPoint(position, {mode: modeX}).x,
      y: grid.getSnappedPoint(position, {mode: modeY}).y
    };
  }

  /* -------------------------------------------- */

  /**
   * Get the snapped position for a given position on a hexagonal grid.
   * @param {Point} position    The position that is snapped
   * @returns {Point}           The snapped position
   */
  #snapToHexagonalGrid(position) {
    const {width, height, hexagonalShape} = this.document;
    const grid = this.scene.grid;
    const M = CONST.GRID_SNAPPING_MODES;

    // Hexagonal shape
    const shape = Token.#getHexagonalShape(grid.columns, hexagonalShape, width, height);
    if ( shape ) {
      const {behavior, anchor} = shape.snapping;
      const offsetX = anchor.x * grid.sizeX;
      const offsetY = anchor.y * grid.sizeY;
      position = grid.getSnappedPoint({x: position.x + offsetX, y: position.y + offsetY}, behavior);
      position.x -= offsetX;
      position.y -= offsetY;
      return position;
    }

    // Rectagular shape
    return grid.getSnappedPoint(position, {mode: M.CENTER | M.VERTEX | M.CORNER | M.SIDE_MIDPOINT});
  }

  /* -------------------------------------------- */

  /**
   * Test whether the Token is inside the Region.
   * This function determines the state of {@link TokenDocument#regions} and {@link RegionDocument#tokens}.
   *
   * Implementations of this function are restricted in the following ways:
   *   - If the bounds (given by {@link Token#getSize}) of the Token do not intersect the Region, then the Token is not
   *     contained within the Region.
   *   - If the Token is inside the Region a particular elevation, then the Token is inside the Region at any elevation
   *     within the elevation range of the Region.
   *
   * If this function is overridden, then {@link Token#segmentizeRegionMovement} must be overridden too.
   * @param {Region} region    The region.
   * @param {Point | (Point & {elevation: number}) | {elevation: number}} position
   *   The (x, y) and/or elevation to use instead of the current values.
   * @returns {boolean}        Is the Token inside the Region?
   */
  testInsideRegion(region, position) {
    return region.testPoint(this.getCenterPoint(position), position?.elevation ?? this.document.elevation);
  }

  /* -------------------------------------------- */

  /**
   * Split the Token movement through the waypoints into its segments.
   *
   * Implementations of this function are restricted in the following ways:
   *   - The segments must go through the waypoints.
   *   - The *from* position matches the *to* position of the succeeding segment.
   *   - The Token must be contained (w.r.t. {@link Token#testInsideRegion}) within the Region
   *     at the *from* and *to* of MOVE segments.
   *   - The Token must be contained (w.r.t. {@link Token#testInsideRegion}) within the Region
   *     at the *to* position of ENTER segments.
   *   - The Token must be contained (w.r.t. {@link Token#testInsideRegion}) within the Region
   *     at the *from* position of EXIT segments.
   *   - The Token must not be contained (w.r.t. {@link Token#testInsideRegion}) within the Region
   *     at the *from* position of ENTER segments.
   *   - The Token must not be contained (w.r.t. {@link Token#testInsideRegion}) within the Region
   *     at the *to* position of EXIT segments.
   * @param {Region} region                         The region.
   * @param {RegionMovementWaypoint[]} waypoints    The waypoints of movement.
   * @param {object} [options]                      Additional options
   * @param {boolean} [options.teleport=false]      Is it teleportation?
   * @returns {RegionMovementSegment[]}             The movement split into its segments.
   */
  segmentizeRegionMovement(region, waypoints, {teleport=false}={}) {
    return region.segmentizeMovement(waypoints, [this.getCenterPoint({x: 0, y: 0})], {teleport});
  }

  /* -------------------------------------------- */

  /**
   * Set this Token as an active target for the current game User.
   * Note: If the context is set with groupSelection:true, you need to manually broadcast the activity for other users.
   * @param {boolean} targeted                        Is the Token now targeted?
   * @param {object} [context={}]                     Additional context options
   * @param {User|null} [context.user=null]           Assign the token as a target for a specific User
   * @param {boolean} [context.releaseOthers=true]    Release other active targets for the same player?
   * @param {boolean} [context.groupSelection=false]  Is this target being set as part of a group selection workflow?
   */
  setTarget(targeted=true, {user=null, releaseOthers=true, groupSelection=false}={}) {

    // Do not allow setting a preview token as a target
    if ( this.isPreview ) return;

    // Release other targets
    user = user || game.user;
    if ( user.targets.size && releaseOthers ) {
      user.targets.forEach(t => {
        if ( t !== this ) t.setTarget(false, {user, releaseOthers: false, groupSelection: true});
      });
    }

    // Acquire target
    const wasTargeted = this.targeted.has(user);
    if ( targeted ) {
      this.targeted.add(user);
      user.targets.add(this);
    }

    // Release target
    else {
      this.targeted.delete(user);
      user.targets.delete(this);
    }

    // If target status changed
    if ( wasTargeted !== targeted ) {
      this.renderFlags.set({refreshTarget: true});
      if ( this.hasActiveHUD ) this.layer.hud.render();
    }

    // Broadcast the target change if it was not part of a group selection
    if ( !groupSelection ) user.broadcastActivity({targets: user.targets.ids});
  }


  /* -------------------------------------------- */

  /**
   * The external radius of the token in pixels.
   * @type {number}
   */
  get externalRadius() {
    const {width, height} = this.getSize();
    return Math.max(width, height) / 2;
  }

  /* -------------------------------------------- */

  /**
   * A generic transformation to turn a certain number of grid units into a radius in canvas pixels.
   * This function adds additional padding to the light radius equal to the external radius of the token.
   * This causes light to be measured from the outer token edge, rather than from the center-point.
   * @param {number} units  The radius in grid units
   * @returns {number}      The radius in pixels
   */
  getLightRadius(units) {
    if ( units === 0 ) return 0;
    return ((Math.abs(units) * canvas.dimensions.distancePixels) + this.externalRadius) * Math.sign(units);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getShiftedPosition(dx, dy) {
    const shifted = super._getShiftedPosition(dx, dy);
    const collides = this.checkCollision(this.getCenterPoint(shifted));
    return collides ? {x: this.document._source.x, y: this.document._source.y} : shifted;
  }

  /* -------------------------------------------- */

  /** @override */
  _updateRotation({angle, delta=0, snap=0}={}) {
    let degrees = Number.isNumeric(angle) ? angle : this.document.rotation + delta;
    const isHexRow = [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR].includes(canvas.grid.type);
    if ( isHexRow ) degrees -= 30;
    if ( snap > 0 ) degrees = degrees.toNearest(snap);
    if ( isHexRow ) degrees += 30;
    return Math.normalizeDegrees(degrees);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    this.initializeSources(); // Update vision and lighting sources
    if ( !game.user.isGM && this.isOwner && !this.document.hidden ) this.control({pan: true}); // Assume control
    canvas.perception.update({refreshOcclusion: true});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    const doc = this.document;

    // Record movement
    const positionChanged = ("x" in changed) || ("y" in changed);
    const rotationChanged = "rotation" in changed;
    const sizeChanged = ("width" in changed) || ("height" in changed);
    const elevationChanged = "elevation" in changed;
    if ( positionChanged || rotationChanged || sizeChanged ) {
      this.#recordPosition(positionChanged, rotationChanged, sizeChanged);
    }
    // Acquire or release Token control
    const hiddenChanged = "hidden" in changed;
    if ( hiddenChanged ) {
      if ( this.controlled && changed.hidden && !game.user.isGM ) this.release();
      else if ( (changed.hidden === false) && !canvas.tokens.controlled.length ) this.control({pan: true});
      if ( this.isOwner && (this.layer.occlusionMode & CONST.TOKEN_OCCLUSION_MODES.OWNED) ) {
        canvas.perception.update({refreshOcclusion: true});
      }
    }

    // Automatically pan the canvas
    if ( positionChanged && this.controlled && (options.pan !== false) ) this.#panCanvas();

    // Process Combat Tracker changes
    if ( this.inCombat && ("name" in changed) ) game.combat.debounceSetup();

    // Texture and Ring changes
    const textureChanged = "texture" in changed;
    const ringEnabled = doc.ring.enabled;
    const ringChanged = "ring" in changed;
    const ringEnabledChanged = ringChanged && ("enabled" in changed.ring);
    const ringSubjectChanged = ringEnabled && ringChanged && ("subject" in changed.ring);
    const ringSubjectTextureChanged = ringSubjectChanged && ("texture" in changed.ring.subject);
    const ringVisualsChanged = ringEnabled && ringChanged && (("colors" in changed.ring) || ("effects" in changed.ring));

    // Handle animatable changes
    if ( options.animate === false ) this.stopAnimation({reset: false});
    else {
      const to = foundry.utils.filterObject(this._getAnimationData(), changed);
      // TODO: Can we find a solution that doesn't require special handling for hidden?
      if ( hiddenChanged ) to.alpha = doc.alpha;

      // We need to infer subject texture if ring is enabled and texture is changed
      if ( (ringEnabled || ringEnabledChanged) && !ringSubjectTextureChanged && textureChanged && ("src" in changed.texture)
        && !doc._source.ring.subject.texture ) {
        foundry.utils.mergeObject(to, {ring: {subject: {texture: doc.texture.src}}});
      }

      // Don't animate movement if teleport
      if ( options.teleport === true ) this.#handleTeleportAnimation(to);

      // Dispatch the animation
      this.animate(to, options.animation);
    }

    // Source and perception updates
    if ( hiddenChanged || elevationChanged || ("light" in changed) || ("sight" in changed) || ("detectionModes" in changed) ) {
      this.initializeSources();
    }
    if ( !game.user.isGM && this.controlled && (hiddenChanged || (("sight" in changed) && ("enabled" in changed.sight))) ) {
      for ( const token of this.layer.placeables ) {
        if ( (token !== this) && (!token.vision === token._isVisionSource()) ) token.initializeVisionSource();
      }
    }
    if ( hiddenChanged || elevationChanged ) {
      canvas.perception.update({refreshVision: true, refreshSounds: true, refreshOcclusion: true});
    }
    if ( "occludable" in changed ) canvas.perception.update({refreshOcclusionMask: true});

    // Incremental refresh
    this.renderFlags.set({
      redraw: ringEnabledChanged || ("actorId" in changed) || ("actorLink" in changed),
      refreshState: hiddenChanged || ("sort" in changed) || ("disposition" in changed) || ("displayBars" in changed) || ("displayName" in changed),
      refreshRotation: "lockRotation" in changed,
      refreshElevation: elevationChanged,
      refreshMesh: textureChanged && ("fit" in changed.texture),
      refreshShape: "hexagonalShape" in changed,
      refreshBars: ["displayBars", "bar1", "bar2"].some(k => k in changed),
      refreshNameplate: ["displayName", "name", "appendNumber", "prependAdjective"].some(k => k in changed),
      refreshRingVisuals: ringVisualsChanged
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    game.user.targets.delete(this);
    this.initializeSources({deleted: true});
    canvas.perception.update({refreshOcclusion: true});
    return super._onDelete(options, userId);
  }

  /* -------------------------------------------- */

  /**
   * When Token position or rotation changes, record the movement vector.
   * Update cached values for both #validPosition and #priorMovement.
   * @param {boolean} positionChange    Did the x/y position change?
   * @param {boolean} rotationChange    Did rotation change?
   * @param {boolean} sizeChange        Did the width or height change?
   */
  #recordPosition(positionChange, rotationChange, sizeChange) {

    // Update rotation
    const position = {};
    if ( rotationChange ) {
      position.rotation = this.document.rotation;
    }

    // Update movement vector
    if ( positionChange ) {
      const origin = {x: this.#animationData.x, y: this.#animationData.y};
      position.x = this.document.x;
      position.y = this.document.y;
      const ray = new Ray(origin, position);

      // Offset movement relative to prior vector
      const prior = this.#priorMovement;
      const ox = ray.dx === 0 ? prior.ox : Math.sign(ray.dx);
      const oy = ray.dy === 0 ? prior.oy : Math.sign(ray.dy);
      this.#priorMovement = {dx: ray.dx, dy: ray.dy, ox, oy};
    }

    // Update valid position
    foundry.utils.mergeObject(this.#validPosition, position);
  }

  /* -------------------------------------------- */

  /**
   * Automatically pan the canvas when a controlled Token moves offscreen.
   */
  #panCanvas() {

    // Target center point in screen coordinates
    const c = this.center;
    const {x: sx, y: sy} = canvas.stage.transform.worldTransform.apply(c);

    // Screen rectangle minus padding space
    const pad = 50;
    const sidebarPad = $("#sidebar").width() + pad;
    const rect = new PIXI.Rectangle(pad, pad, window.innerWidth - sidebarPad, window.innerHeight - pad);

    // Pan the canvas if the target center-point falls outside the screen rect
    if ( !rect.contains(sx, sy) ) canvas.animatePan(this.center);
  }

  /* -------------------------------------------- */

  /**
   * Handle changes to Token behavior when a significant status effect is applied
   * @param {string} statusId       The status effect ID being applied, from CONFIG.specialStatusEffects
   * @param {boolean} active        Is the special status effect now active?
   * @protected
   * @internal
   */
  _onApplyStatusEffect(statusId, active) {
    switch ( statusId ) {
      case CONFIG.specialStatusEffects.BURROW:
        this.initializeSources();
        break;
      case CONFIG.specialStatusEffects.FLY:
      case CONFIG.specialStatusEffects.HOVER:
        canvas.perception.update({refreshVision: true});
        break;
      case CONFIG.specialStatusEffects.INVISIBLE:
        canvas.perception.update({refreshVision: true});
        this._configureFilterEffect(statusId, active);
        break;
      case CONFIG.specialStatusEffects.BLIND:
        this.initializeVisionSource();
        break;
    }

    // Call hooks
    Hooks.callAll("applyTokenStatusEffect", this, statusId, active);
  }

  /* -------------------------------------------- */

  /**
   * Add/Modify a filter effect on this token.
   * @param {string} statusId       The status effect ID being applied, from CONFIG.specialStatusEffects
   * @param {boolean} active        Is the special status effect now active?
   * @internal
   */
  _configureFilterEffect(statusId, active) {
    let filterClass = null;
    let filterUniforms = {};

    // TODO: The filter class should be into CONFIG with specialStatusEffects or conditions.
    switch ( statusId ) {
      case CONFIG.specialStatusEffects.INVISIBLE:
        filterClass = InvisibilityFilter;
        break;
    }
    if ( !filterClass ) return;

    const target = this.mesh;
    target.filters ??= [];

    // Is a filter active for this id?
    let filter = this.#filterEffects.get(statusId);
    if ( !filter && active ) {
      filter = filterClass.create(filterUniforms);

      // Push the filter and set the filter effects map
      target.filters.push(filter);
      this.#filterEffects.set(statusId, filter);
    }
    else if ( filter ) {
      filter.enabled = active;
      foundry.utils.mergeObject(filter.uniforms, filterUniforms, {
        insertKeys: false,
        overwrite: true,
        enforceTypes: true
      });
      if ( active && !target.filters.find(f => f === filter) ) target.filters.push(filter);
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the filter effects depending on special status effects
   * TODO: replace this method by something more convenient.
   * @internal
   */
  _updateSpecialStatusFilterEffects() {
    const invisible = CONFIG.specialStatusEffects.INVISIBLE;
    this._configureFilterEffect(invisible, this.document.hasStatusEffect(invisible));
  }

  /* -------------------------------------------- */

  /**
   * Remove all filter effects on this placeable.
   * @internal
   */
  _removeAllFilterEffects() {
    const target = this.mesh;
    if ( target?.filters?.length ) {
      for ( const filterEffect of this.#filterEffects.values() ) {
        target.filters.findSplice(f => f === filterEffect);
      }
    }
    this.#filterEffects.clear();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onControl({releaseOthers=true, pan=false, ...options}={}) {
    super._onControl(options);
    for ( const token of this.layer.placeables ) {
      if ( !token.vision === token._isVisionSource() ) token.initializeVisionSource();
    }
    _token = this; // Debugging global window variable
    canvas.perception.update({
      refreshVision: true,
      refreshSounds: true,
      refreshOcclusion: this.layer.occlusionMode & CONST.TOKEN_OCCLUSION_MODES.CONTROLLED
    });

    // Pan to the controlled Token
    if ( pan ) canvas.animatePan(this.center);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onRelease(options) {
    super._onRelease(options);
    for ( const token of this.layer.placeables ) {
      if ( !token.vision === token._isVisionSource() ) token.initializeVisionSource();
    }
    canvas.perception.update({
      refreshVision: true,
      refreshSounds: true,
      refreshOcclusion: this.layer.occlusionMode & CONST.TOKEN_OCCLUSION_MODES.CONTROLLED
    });
  }

  /* -------------------------------------------- */

  /** @override */
  _overlapsSelection(rectangle) {
    if ( !this.shape ) return false;
    const shape = this.shape;
    const isRectangle = shape instanceof PIXI.Rectangle;
    if ( !isRectangle && !rectangle.intersects(this.bounds) ) return false;
    const localRectangle = new PIXI.Rectangle(
      rectangle.x - this.document.x,
      rectangle.y - this.document.y,
      rectangle.width,
      rectangle.height
    );
    if ( isRectangle ) return localRectangle.intersects(shape);
    const shapePolygon = shape instanceof PIXI.Polygon ? shape : shape.toPolygon();
    const intersection = localRectangle.intersectPolygon(shapePolygon, {scalingFactor: 100});
    return intersection.points.length !== 0;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  _canControl(user, event) {
    if ( !this.layer.active || this.isPreview ) return false;
    if ( canvas.controls.ruler.state === Ruler.STATES.MEASURING ) return false;
    const tool = game.activeTool;
    if ( (tool === "target") && !this.isPreview ) return true;
    return super._canControl(user, event);
  }

  /* -------------------------------------------- */

  /** @override */
  _canHUD(user, event) {
    if ( canvas.controls.ruler.state === Ruler.STATES.MEASURING ) return false;
    return user.isGM || (this.actor?.testUserPermission(user, "OWNER") ?? false);
  }

  /* -------------------------------------------- */

  /** @override */
  _canConfigure(user, event) {
    if ( canvas.controls.ruler.state === Ruler.STATES.MEASURING ) return false;
    return !this.isPreview;
  }

  /* -------------------------------------------- */

  /** @override */
  _canHover(user, event) {
    return !this.isPreview;
  }

  /* -------------------------------------------- */

  /** @override */
  _canView(user, event) {
    if ( canvas.controls.ruler.state === Ruler.STATES.MEASURING ) return false;
    if ( !this.actor ) ui.notifications.warn("TOKEN.WarningNoActor", {localize: true});
    return this.actor?.testUserPermission(user, "LIMITED");
  }

  /* -------------------------------------------- */

  /** @override */
  _canDrag(user, event) {
    if ( !this.controlled ) return false;
    if ( !this.layer.active || (game.activeTool !== "select") ) return false;
    const ruler = canvas.controls.ruler;
    if ( ruler.state === Ruler.STATES.MEASURING ) return false;
    if ( ruler.token === this ) return false;
    if ( CONFIG.Canvas.rulerClass.canMeasure ) return false;
    return true;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onHoverIn(event, options) {
    const combatant = this.combatant;
    if ( combatant ) ui.combat.hoverCombatant(combatant, true);
    if ( this.layer.occlusionMode & CONST.TOKEN_OCCLUSION_MODES.HOVERED ) {
      canvas.perception.update({refreshOcclusion: true});
    }
    return super._onHoverIn(event, options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onHoverOut(event) {
    const combatant = this.combatant;
    if ( combatant ) ui.combat.hoverCombatant(combatant, false);
    if ( this.layer.occlusionMode & CONST.TOKEN_OCCLUSION_MODES.HOVERED ) {
      canvas.perception.update({refreshOcclusion: true});
    }
    return super._onHoverOut(event);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClickLeft(event) {
    const tool = game.activeTool;
    if ( tool === "target" ) {
      event.stopPropagation();
      if ( this.document.isSecret ) return;
      return this.setTarget(!this.isTargeted, {releaseOthers: !event.shiftKey});
    }
    super._onClickLeft(event);
  }

  /** @override */
  _propagateLeftClick(event) {
    return CONFIG.Canvas.rulerClass.canMeasure;
  }

  /* -------------------------------------------- */

  /** @override */
  _onClickLeft2(event) {
    if ( !this._propagateLeftClick(event) ) event.stopPropagation();
    const sheet = this.actor?.sheet;
    if ( sheet?.rendered ) {
      sheet.maximize();
      sheet.bringToTop();
    }
    else sheet?.render(true, {token: this.document});
  }

  /* -------------------------------------------- */

  /** @override */
  _onClickRight2(event) {
    if ( !this._propagateRightClick(event) ) event.stopPropagation();
    if ( this.isOwner && game.user.can("TOKEN_CONFIGURE") ) return super._onClickRight2(event);
    if ( this.document.isSecret ) return;
    return this.setTarget(!this.targeted.has(game.user), {releaseOthers: !event.shiftKey});
  }

  /* -------------------------------------------- */

  /** @override */
  _onDragLeftStart(event) {
    const currentX = this.#animationData.x;
    const currentY = this.#animationData.y;
    this.stopAnimation();
    const origin = event.interactionData.origin;
    origin.x += (this.document.x - currentX);
    origin.y += (this.document.y - currentY);
    return super._onDragLeftStart(event);
  }

  /* -------------------------------------------- */

  /** @override */
  _prepareDragLeftDropUpdates(event) {
    const updates = [];
    for ( const clone of event.interactionData.clones ) {
      const {document, _original: original} = clone;
      const dest = !event.shiftKey ? clone.getSnappedPosition() : {x: document.x, y: document.y};
      const target = clone.getCenterPoint(dest);
      if ( !game.user.isGM ) {
        let collides = original.checkCollision(target);
        if ( collides ) {
          ui.notifications.error("RULER.MovementCollision", {localize: true, console: false});
          continue;
        }
      }
      else if ( !canvas.dimensions.rect.contains(target.x, target.y) ) continue;
      updates.push({_id: original.id, x: dest.x, y: dest.y});
    }
    return updates;
  }

  /* -------------------------------------------- */

  /** @override */
  _onDragLeftMove(event) {
    const {destination, clones} = event.interactionData;
    const preview = game.settings.get("core", "tokenDragPreview");

    // Pan the canvas if the drag event approaches the edge
    canvas._onDragCanvasPan(event);

    // Determine dragged distance
    const origin = this.getCenterPoint();
    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;

    // Update the position of each clone
    for ( const c of clones ) {
      const o = c._original;
      let position = {x: o.document.x + dx, y: o.document.y + dy};
      if ( !event.shiftKey ) position = c.getSnappedPosition(position);
      if ( preview && !game.user.isGM ) {
        const collision = o.checkCollision(o.getCenterPoint(position));
        if ( collision ) continue;
      }
      c.document.x = position.x;
      c.document.y = position.y;
      c.renderFlags.set({refreshPosition: true});
      if ( preview ) c.initializeSources();
    }

    // Update perception immediately
    if ( preview ) canvas.perception.update({refreshLighting: true, refreshVision: true});
  }

  /* -------------------------------------------- */

  /** @override */
  _onDragEnd() {
    this.initializeSources({deleted: true});
    this._original?.initializeSources();
    super._onDragEnd();
  }

  /* -------------------------------------------- */
  /*  Hexagonal Shape Helpers                     */
  /* -------------------------------------------- */

  /**
   * A hexagonal shape of a Token.
   * @typedef {object} TokenHexagonalShape
   * @property {number[]} points    The points in normalized coordinates
   * @property {Point} center       The center of the shape in normalized coordiantes
   * @property {{behavior: GridSnappingBehavior, anchor: Point}} snapping
   *   The snapping behavior and snapping anchor in normalized coordinates
   */

  /**
   * The cache of hexagonal shapes.
   * @type {Map<string, DeepReadonly<TokenHexagonalShape>>}
   */
  static #hexagonalShapes = new Map();

  /* -------------------------------------------- */

  /**
   * Get the hexagonal shape given the type, width, and height.
   * @param {boolean} columns    Column-based instead of row-based hexagonal grid?
   * @param {number} type        The hexagonal shape (one of {@link CONST.TOKEN_HEXAGONAL_SHAPES})
   * @param {number} width       The width of the Token (positive)
   * @param {number} height      The height of the Token (positive)
   * @returns {DeepReadonly<TokenHexagonalShape>|null}    The hexagonal shape or null if there is no shape
   *                                                      for the given combination of arguments
   */
  static #getHexagonalShape(columns, type, width, height) {
    if ( !Number.isInteger(width * 2) || !Number.isInteger(height * 2) ) return null;
    const key = `${columns ? "C" : "R"},${type},${width},${height}`;
    let shape = Token.#hexagonalShapes.get(key);
    if ( shape ) return shape;
    const T = CONST.TOKEN_HEXAGONAL_SHAPES;
    const M = CONST.GRID_SNAPPING_MODES;

    // Hexagon symmetry
    if ( columns ) {
      const rowShape = Token.#getHexagonalShape(false, type, height, width);
      if ( !rowShape ) return null;

      // Transpose and reverse the points of the shape in row orientation
      const points = [];
      for ( let i = rowShape.points.length; i > 0; i -= 2 ) {
        points.push(rowShape.points[i - 1], rowShape.points[i - 2]);
      }
      shape = {
        points,
        center: {x: rowShape.center.y, y: rowShape.center.x},
        snapping: {
          behavior: rowShape.snapping.behavior,
          anchor: {x: rowShape.snapping.anchor.y, y: rowShape.snapping.anchor.x}
        }
      };
    }

    // Small hexagon
    else if ( (width === 0.5) && (height === 0.5) ) {
      shape = {
        points: [0.25, 0.0, 0.5, 0.125, 0.5, 0.375, 0.25, 0.5, 0.0, 0.375, 0.0, 0.125],
        center: {x: 0.25, y: 0.25},
        snapping: {behavior: {mode: M.CENTER, resolution: 1}, anchor: {x: 0.25, y: 0.25}}
      };
    }

    // Normal hexagon
    else if ( (width === 1) && (height === 1) ) {
      shape = {
        points: [0.5, 0.0, 1.0, 0.25, 1, 0.75, 0.5, 1.0, 0.0, 0.75, 0.0, 0.25],
        center: {x: 0.5, y: 0.5},
        snapping: {behavior: {mode: M.TOP_LEFT_CORNER, resolution: 1}, anchor: {x: 0.0, y: 0.0}}
      };
    }

    // Hexagonal ellipse or trapezoid
    else if ( type <= T.TRAPEZOID_2 ) {
      shape = Token.#createHexagonalEllipseOrTrapezoid(type, width, height);
    }

    // Hexagonal rectangle
    else if ( type <= T.RECTANGLE_2 ) {
      shape = Token.#createHexagonalRectangle(type, width, height);
    }

    // Cache the shape
    if ( shape ) {
      Object.freeze(shape);
      Object.freeze(shape.points);
      Object.freeze(shape.center);
      Object.freeze(shape.snapping);
      Object.freeze(shape.snapping.behavior);
      Object.freeze(shape.snapping.anchor);
      Token.#hexagonalShapes.set(key, shape);
    }
    return shape;
  }

  /* -------------------------------------------- */

  /**
   * Create the row-based hexagonal ellipse/trapezoid given the type, width, and height.
   * @param {number} type                   The shape type (must be ELLIPSE_1, ELLIPSE_1, TRAPEZOID_1, or TRAPEZOID_2)
   * @param {number} width                  The width of the Token (positive)
   * @param {number} height                 The height of the Token (positive)
   * @returns {TokenHexagonalShape|null}    The hexagonal shape or null if there is no shape
   *                                        for the given combination of arguments
   */
  static #createHexagonalEllipseOrTrapezoid(type, width, height) {
    if ( !Number.isInteger(width) || !Number.isInteger(height) ) return null;
    const T = CONST.TOKEN_HEXAGONAL_SHAPES;
    const M = CONST.GRID_SNAPPING_MODES;
    const points = [];
    let top;
    let bottom;
    switch ( type ) {
      case T.ELLIPSE_1:
        if ( height >= 2 * width ) return null;
        top = Math.floor(height / 2);
        bottom = Math.floor((height - 1) / 2);
        break;
      case T.ELLIPSE_2:
        if ( height >= 2 * width ) return null;
        top = Math.floor((height - 1) / 2);
        bottom = Math.floor(height / 2);
        break;
      case T.TRAPEZOID_1:
        if ( height > width ) return null;
        top = height - 1;
        bottom = 0;
        break;
      case T.TRAPEZOID_2:
        if ( height > width ) return null;
        top = 0;
        bottom = height - 1;
        break;
    }
    let x = 0.5 * bottom;
    let y = 0.25;
    for ( let k = width - bottom; k--; ) {
      points.push(x, y);
      x += 0.5;
      y -= 0.25;
      points.push(x, y);
      x += 0.5;
      y += 0.25;
    }
    points.push(x, y);
    for ( let k = bottom; k--; ) {
      y += 0.5;
      points.push(x, y);
      x += 0.5;
      y += 0.25;
      points.push(x, y);
    }
    y += 0.5;
    for ( let k = top; k--; ) {
      points.push(x, y);
      x -= 0.5;
      y += 0.25;
      points.push(x, y);
      y += 0.5;
    }
    for ( let k = width - top; k--; ) {
      points.push(x, y);
      x -= 0.5;
      y += 0.25;
      points.push(x, y);
      x -= 0.5;
      y -= 0.25;
    }
    points.push(x, y);
    for ( let k = top; k--; ) {
      y -= 0.5;
      points.push(x, y);
      x -= 0.5;
      y -= 0.25;
      points.push(x, y);
    }
    y -= 0.5;
    for ( let k = bottom; k--; ) {
      points.push(x, y);
      x += 0.5;
      y -= 0.25;
      points.push(x, y);
      y -= 0.5;
    }
    return {
      points,
      // We use the centroid of the polygon for ellipse and trapzoid shapes
      center: foundry.utils.polygonCentroid(points),
      snapping: {
        behavior: {mode: bottom % 2 ? M.BOTTOM_RIGHT_VERTEX : M.TOP_LEFT_CORNER, resolution: 1},
        anchor: {x: 0.0, y: 0.0}
      }
    };
  }

  /**
   * Create the row-based hexagonal rectangle given the type, width, and height.
   * @param {number} type                   The shape type (must be RECTANGLE_1 or RECTANGLE_2)
   * @param {number} width                  The width of the Token (positive)
   * @param {number} height                 The height of the Token (positive)
   * @returns {TokenHexagonalShape|null}    The hexagonal shape or null if there is no shape
   *                                        for the given combination of arguments
   */
  static #createHexagonalRectangle(type, width, height) {
    if ( (width < 1) || !Number.isInteger(height) ) return null;
    if ( (width === 1) && (height > 1) ) return null;
    if ( !Number.isInteger(width) && (height === 1) ) return null;
    const T = CONST.TOKEN_HEXAGONAL_SHAPES;
    const M = CONST.GRID_SNAPPING_MODES;
    const even = (type === T.RECTANGLE_1) || (height === 1);
    let x = even ? 0.0 : 0.5;
    let y = 0.25;
    const points = [x, y];
    while ( x + 1 <= width ) {
      x += 0.5;
      y -= 0.25;
      points.push(x, y);
      x += 0.5;
      y += 0.25;
      points.push(x, y);
    }
    if ( x !== width ) {
      y += 0.5;
      points.push(x, y);
      x += 0.5;
      y += 0.25;
      points.push(x, y);
    }
    while ( y + 1.5 <= 0.75 * height ) {
      y += 0.5;
      points.push(x, y);
      x -= 0.5;
      y += 0.25;
      points.push(x, y);
      y += 0.5;
      points.push(x, y);
      x += 0.5;
      y += 0.25;
      points.push(x, y);
    }
    if ( y + 0.75 < 0.75 * height ) {
      y += 0.5;
      points.push(x, y);
      x -= 0.5;
      y += 0.25;
      points.push(x, y);
    }
    y += 0.5;
    points.push(x, y);
    while ( x - 1 >= 0 ) {
      x -= 0.5;
      y += 0.25;
      points.push(x, y);
      x -= 0.5;
      y -= 0.25;
      points.push(x, y);
    }
    if ( x !== 0 ) {
      y -= 0.5;
      points.push(x, y);
      x -= 0.5;
      y -= 0.25;
      points.push(x, y);
    }
    while ( y - 1.5 > 0 ) {
      y -= 0.5;
      points.push(x, y);
      x += 0.5;
      y -= 0.25;
      points.push(x, y);
      y -= 0.5;
      points.push(x, y);
      x -= 0.5;
      y -= 0.25;
      points.push(x, y);
    }
    if ( y - 0.75 > 0 ) {
      y -= 0.5;
      points.push(x, y);
      x += 0.5;
      y -= 0.25;
      points.push(x, y);
    }
    return {
      points,
      // We use center of the rectangle (and not the centroid of the polygon) for the rectangle shapes
      center: {
        x: width / 2,
        y: ((0.75 * Math.floor(height)) + (0.5 * (height % 1)) + 0.25) / 2
      },
      snapping: {
        behavior: {mode: even ? M.TOP_LEFT_CORNER : M.BOTTOM_RIGHT_VERTEX, resolution: 1},
        anchor: {x: 0.0, y: 0.0}
      }
    };
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v11
   * @ignore
   */
  updatePosition() {
    const msg = "Token#updatePosition has been deprecated without replacement as it is no longer required.";
    foundry.utils.logCompatibilityWarning(msg, {since: 11, until: 13});
  }

  /**
   * @deprecated since 11
   * @ignore
   */
  refreshHUD({bars=true, border=true, effects=true, elevation=true, nameplate=true}={}) {
    const msg = "Token#refreshHUD is deprecated in favor of token.renderFlags.set()";
    foundry.utils.logCompatibilityWarning(msg, {since: 11, until: 13});
    this.renderFlags.set({
      refreshBars: bars,
      refreshBorder: border,
      refreshElevation: elevation,
      refreshNameplate: nameplate,
      redrawEffects: effects
    });
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  updateSource({deleted=false}={}) {
    const msg = "Token#updateSource has been deprecated in favor of Token#initializeSources";
    foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    this.initializeSources({deleted});
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  getCenter(x, y) {
    const msg = "Token#getCenter(x, y) has been deprecated in favor of Token#getCenterPoint(Point).";
    foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
    return this.getCenterPoint(x !== undefined ? {x, y} : this.document);
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  get owner() {
    const msg = "Token#owner has been deprecated. Use Token#isOwner instead.";
    foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14});
    return this.isOwner;
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  async toggleCombat(combat) {
    foundry.utils.logCompatibilityWarning("Token#toggleCombat is deprecated in favor of TokenDocument#toggleCombatant,"
      + " TokenDocument.implementation.createCombatants, and TokenDocument.implementation.deleteCombatants", {since: 12, until: 14});
    const tokens = canvas.tokens.controlled.map(t => t.document);
    if ( !this.controlled ) tokens.push(this.document);
    if ( this.inCombat ) await TokenDocument.implementation.deleteCombatants(tokens);
    else await TokenDocument.implementation.createCombatants(tokens);
  }


  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  async toggleEffect(effect, {active, overlay=false}={}) {
    foundry.utils.logCompatibilityWarning("Token#toggleEffect is deprecated in favor of Actor#toggleStatusEffect",
      {since: 12, until: 14});
    if ( !this.actor || !effect.id ) return false;
    return this.actor.toggleStatusEffect(effect.id, {active, overlay});
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  async toggleVisibility() {
    foundry.utils.logCompatibilityWarning("Token#toggleVisibility is deprecated without replacement in favor of"
      + " updating the hidden field of the TokenDocument directly.", {since: 12, until: 14});
    let isHidden = this.document.hidden;
    const tokens = this.controlled ? canvas.tokens.controlled : [this];
    const updates = tokens.map(t => { return {_id: t.id, hidden: !isHidden};});
    return canvas.scene.updateEmbeddedDocuments("Token", updates);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12 Stable 4
   * @ignore
   */
  _recoverFromPreview() {
    foundry.utils.logCompatibilityWarning("Token#_recoverFromPreview is deprecated without replacement in favor of"
      + " recovering from preview directly into TokenConfig#_resetPreview.", {since: 12, until: 14});
    this.renderable = true;
    this.initializeSources();
    this.control();
  }
}

/**
 * A "secret" global to help debug attributes of the currently controlled Token.
 * This is only for debugging, and may be removed in the future, so it's not safe to use.
 * @type {Token}
 * @ignore
 */
let _token = null;
