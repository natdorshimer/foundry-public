/**
 * The virtual tabletop environment is implemented using a WebGL powered HTML 5 canvas using the powerful PIXI.js
 * library. The canvas is comprised by an ordered sequence of layers which define rendering groups and collections of
 * objects that are drawn on the canvas itself.
 *
 * ### Hook Events
 * {@link hookEvents.canvasConfig}
 * {@link hookEvents.canvasInit}
 * {@link hookEvents.canvasReady}
 * {@link hookEvents.canvasPan}
 * {@link hookEvents.canvasTearDown}
 *
 * @category - Canvas
 *
 * @example Canvas State
 * ```js
 * canvas.ready; // Is the canvas ready for use?
 * canvas.scene; // The currently viewed Scene document.
 * canvas.dimensions; // The dimensions of the current Scene.
 * ```
 * @example Canvas Methods
 * ```js
 * canvas.draw(); // Completely re-draw the game canvas (this is usually unnecessary).
 * canvas.pan(x, y, zoom); // Pan the canvas to new coordinates and scale.
 * canvas.recenter(); // Re-center the canvas on the currently controlled Token.
 * ```
 */
class Canvas {
  constructor() {
    Object.defineProperty(this, "edges", {value: new foundry.canvas.edges.CanvasEdges()});
    Object.defineProperty(this, "fog", {value: new CONFIG.Canvas.fogManager()});
    Object.defineProperty(this, "perception", {value: new PerceptionManager()});
  }

  /**
   * A set of blur filter instances which are modified by the zoom level and the "soft shadows" setting
   * @type {Set<PIXI.filters>}
   */
  blurFilters = new Set();

  /**
   * A reference to the MouseInteractionManager that is currently controlling pointer-based interaction, or null.
   * @type {MouseInteractionManager|null}
   */
  currentMouseManager = null;

  /**
   * Configure options passed to the texture loaded for the Scene.
   * This object can be configured during the canvasInit hook before textures have been loaded.
   * @type {{expireCache: boolean, additionalSources: string[]}}
   */
  loadTexturesOptions;

  /**
   * Configure options used by the visibility framework for special effects
   * This object can be configured during the canvasInit hook before visibility is initialized.
   * @type {{persistentVision: boolean}}
   */
  visibilityOptions;

  /**
   * Configure options passed to initialize blur for the Scene and override normal behavior.
   * This object can be configured during the canvasInit hook before blur is initialized.
   * @type {{enabled: boolean, blurClass: Class, strength: number, passes: number, kernels: number}}
   */
  blurOptions;

  /**
   * Configure the Textures to apply to the Scene.
   * Textures registered here will be automatically loaded as part of the TextureLoader.loadSceneTextures workflow.
   * Textures which need to be loaded should be configured during the "canvasInit" hook.
   * @type {{[background]: string, [foreground]: string, [fogOverlay]: string}}
   */
  sceneTextures = {};

  /**
   * Record framerate performance data.
   * @type {{average: number, values: number[], element: HTMLElement, render: number}}
   */
  fps = {
    average: 0,
    values: [],
    render: 0,
    element: document.getElementById("fps")
  };

  /**
   * The singleton interaction manager instance which handles mouse interaction on the Canvas.
   * @type {MouseInteractionManager}
   */
  mouseInteractionManager;

  /**
   * @typedef {Object} CanvasPerformanceSettings
   * @property {number} mode      The performance mode in CONST.CANVAS_PERFORMANCE_MODES
   * @property {string} mipmap    Whether to use mipmaps, "ON" or "OFF"
   * @property {boolean} msaa     Whether to apply MSAA at the overall canvas level
   * @property {boolean} smaa     Whether to apply SMAA at the overall canvas level
   * @property {number} fps       Maximum framerate which should be the render target
   * @property {boolean} tokenAnimation   Whether to display token movement animation
   * @property {boolean} lightAnimation   Whether to display light source animation
   * @property {boolean} lightSoftEdges   Whether to render soft edges for light sources
   */

  /**
   * Configured performance settings which affect the behavior of the Canvas and its renderer.
   * @type {CanvasPerformanceSettings}
   */
  performance;

  /**
   * @typedef {Object} CanvasSupportedComponents
   * @property {boolean} webGL2           Is WebGL2 supported?
   * @property {boolean} readPixelsRED    Is reading pixels in RED format supported?
   * @property {boolean} offscreenCanvas  Is the OffscreenCanvas supported?
   */

  /**
   * A list of supported webGL capabilities and limitations.
   * @type {CanvasSupportedComponents}
   */
  supported;

  /**
   * Is the photosensitive mode enabled?
   * @type {boolean}
   */
  photosensitiveMode;

  /**
   * The renderer screen dimensions.
   * @type {number[]}
   */
  screenDimensions = [0, 0];

  /**
   * A flag to indicate whether a new Scene is currently being drawn.
   * @type {boolean}
   */
  loading = false;

  /**
   * A promise that resolves when the canvas is first initialized and ready.
   * @type {Promise<void>|null}
   */
  initializing = null;

  /* -------------------------------------------- */

  /**
   * A throttled function that handles mouse moves.
   * @type {function()}
   */
  #throttleOnMouseMove = foundry.utils.throttle(this.#onMouseMove.bind(this), 100);

  /**
   * An internal reference to a Promise in-progress to draw the canvas.
   * @type {Promise<Canvas>}
   */
  #drawing = Promise.resolve(this);

  /* -------------------------------------------- */
  /*  Canvas Groups and Layers                    */
  /* -------------------------------------------- */

  /**
   * The singleton PIXI.Application instance rendered on the Canvas.
   * @type {PIXI.Application}
   */
  app;

  /**
   * The primary stage container of the PIXI.Application.
   * @type {PIXI.Container}
   */
  stage;

  /**
   * The rendered canvas group which render the environment canvas group and the interface canvas group.
   * @see environment
   * @see interface
   * @type {RenderedCanvasGroup}
   */
  rendered;

  /**
   * A singleton CanvasEdges instance.
   * @type {foundry.canvas.edges.CanvasEdges}
   */
  edges;

  /**
   * The singleton FogManager instance.
   * @type {FogManager}
   */
  fog;

  /**
   * A perception manager interface for batching lighting, sight, and sound updates.
   * @type {PerceptionManager}
   */
  perception;

  /**
   * The environment canvas group which render the primary canvas group and the effects canvas group.
   * @see primary
   * @see effects
   * @type {EnvironmentCanvasGroup}
   */
  environment;

  /**
   * The primary Canvas group which generally contains tangible physical objects which exist within the Scene.
   * This group is a {@link CachedContainer} which is rendered to the Scene as a {@link SpriteMesh}.
   * This allows the rendered result of the Primary Canvas Group to be affected by a {@link BaseSamplerShader}.
   * @type {PrimaryCanvasGroup}
   */
  primary;

  /**
   * The effects Canvas group which modifies the result of the {@link PrimaryCanvasGroup} by adding special effects.
   * This includes lighting, vision, fog of war and related animations.
   * @type {EffectsCanvasGroup}
   */
  effects;

  /**
   * The visibility Canvas group which handles the fog of war overlay by consolidating multiple render textures,
   * and applying a filter with special effects and blur.
   * @type {CanvasVisibility}
   */
  visibility;

  /**
   * The interface Canvas group which is rendered above other groups and contains all interactive elements.
   * The various {@link InteractionLayer} instances of the interface group provide different control sets for
   * interacting with different types of {@link Document}s which can be represented on the Canvas.
   * @type {InterfaceCanvasGroup}
   */
  interface;

  /**
   * The overlay Canvas group which is rendered above other groups and contains elements not bound to stage transform.
   * @type {OverlayCanvasGroup}
   */
  overlay;

  /**
   * The singleton HeadsUpDisplay container which overlays HTML rendering on top of this Canvas.
   * @type {HeadsUpDisplay}
   */
  hud;

  /**
   * Position of the mouse on stage.
   * @type {PIXI.Point}
   */
  mousePosition = new PIXI.Point();

  /**
   * The DragDrop instance which handles interactivity resulting from DragTransfer events.
   * @type {DragDrop}
   * @private
   */
  #dragDrop;

  /**
   * An object of data which caches data which should be persisted across re-draws of the game canvas.
   * @type {{scene: string, layer: string, controlledTokens: string[], targetedTokens: string[]}}
   * @private
   */
  #reload = {};

  /**
   * Track the last automatic pan time to throttle
   * @type {number}
   * @private
   */
  _panTime = 0;

  /* -------------------------------------------- */

  /**
   * Force snapping to grid vertices?
   * @type {boolean}
   */
  forceSnapVertices = false;

  /* -------------------------------------------- */
  /*  Properties and Attributes
  /* -------------------------------------------- */

  /**
   * A flag for whether the game Canvas is fully initialized and ready for additional content to be drawn.
   * @type {boolean}
   */
  get initialized() {
    return this.#initialized;
  }

  /** @ignore */
  #initialized = false;

  /* -------------------------------------------- */

  /**
   * A reference to the currently displayed Scene document, or null if the Canvas is currently blank.
   * @type {Scene|null}
   */
  get scene() {
    return this.#scene;
  }

  /** @ignore */
  #scene = null;

  /* -------------------------------------------- */

  /**
   * A SceneManager instance which adds behaviors to this Scene, or null if there is no manager.
   * @type {SceneManager|null}
   */
  get manager() {
    return this.#manager;
  }

  #manager = null;

  /* -------------------------------------------- */

  /**
   * @typedef {object} _CanvasDimensions
   * @property {PIXI.Rectangle} rect      The canvas rectangle.
   * @property {PIXI.Rectangle} sceneRect The scene rectangle.
   */

  /**
   * @typedef {SceneDimensions & _CanvasDimensions} CanvasDimensions
   */

  /**
   * The current pixel dimensions of the displayed Scene, or null if the Canvas is blank.
   * @type {Readonly<CanvasDimensions>|null}
   */
  get dimensions() {
    return this.#dimensions;
  }

  #dimensions = null;

  /* -------------------------------------------- */

  /**
   * A reference to the grid of the currently displayed Scene document, or null if the Canvas is currently blank.
   * @type {foundry.grid.BaseGrid|null}
   */
  get grid() {
    return this.scene?.grid ?? null;
  }

  /* -------------------------------------------- */

  /**
   * A flag for whether the game Canvas is ready to be used. False if the canvas is not yet drawn, true otherwise.
   * @type {boolean}
   */
  get ready() {
    return this.#ready;
  }

  /** @ignore */
  #ready = false;

  /* -------------------------------------------- */

  /**
   * The colors bound to this scene and handled by the color manager.
   * @type {Color}
   */
  get colors() {
    return this.environment.colors;
  }

  /* -------------------------------------------- */

  /**
   * Shortcut to get the masks container from HiddenCanvasGroup.
   * @type {PIXI.Container}
   */
  get masks() {
    return this.hidden.masks;
  }

  /* -------------------------------------------- */

  /**
   * The id of the currently displayed Scene.
   * @type {string|null}
   */
  get id() {
    return this.#scene?.id || null;
  }

  /* -------------------------------------------- */

  /**
   * A mapping of named CanvasLayer classes which defines the layers which comprise the Scene.
   * @type {Record<string, CanvasLayer>}
   */
  static get layers() {
    return CONFIG.Canvas.layers;
  }

  /* -------------------------------------------- */

  /**
   * An Array of all CanvasLayer instances which are active on the Canvas board
   * @type {CanvasLayer[]}
   */
  get layers() {
    const layers = [];
    for ( const [k, cfg] of Object.entries(CONFIG.Canvas.layers) ) {
      const l = this[cfg.group]?.[k] ?? this[k];
      if ( l instanceof CanvasLayer ) layers.push(l);
    }
    return layers;
  }

  /* -------------------------------------------- */

  /**
   * Return a reference to the active Canvas Layer
   * @type {CanvasLayer}
   */
  get activeLayer() {
    for ( const layer of this.layers ) {
      if ( layer.active ) return layer;
    }
    return null;
  }

  /* -------------------------------------------- */

  /**
   * The currently displayed darkness level, which may override the saved Scene value.
   * @type {number}
   */
  get darknessLevel() {
    return this.environment.darknessLevel;
  }

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /**
   * Initialize the Canvas by creating the HTML element and PIXI application.
   * This step should only ever be performed once per client session.
   * Subsequent requests to reset the canvas should go through Canvas#draw
   */
  initialize() {
    if ( this.#initialized ) throw new Error("The Canvas is already initialized and cannot be re-initialized");

    // If the game canvas is disabled by "no canvas" mode, we don't need to initialize anything
    if ( game.settings.get("core", "noCanvas") ) return;

    // Verify that WebGL is available
    Canvas.#configureWebGL();

    // Create the HTML Canvas element
    const canvas = Canvas.#createHTMLCanvas();

    // Configure canvas settings
    const config = Canvas.#configureCanvasSettings();

    // Create the PIXI Application
    this.#createApplication(canvas, config);

    // Configure the desired performance mode
    this._configurePerformanceMode();

    // Display any performance warnings which suggest that the created Application will not function well
    game.issues._detectWebGLIssues();

    // Activate drop handling
    this.#dragDrop = new DragDrop({ callbacks: { drop: this._onDrop.bind(this) } }).bind(canvas);

    // Create heads up display
    Object.defineProperty(this, "hud", {value: new HeadsUpDisplay(), writable: false});

    // Cache photosensitive mode
    Object.defineProperty(this, "photosensitiveMode", {
      value: game.settings.get("core", "photosensitiveMode"),
      writable: false
    });

    // Create groups
    this.#createGroups("stage", this.stage);

    // Update state flags
    this.#scene = null;
    this.#manager = null;
    this.#initialized = true;
    this.#ready = false;
  }

  /* -------------------------------------------- */

  /**
   * Configure the usage of WebGL for the PIXI.Application that will be created.
   * @throws an Error if WebGL is not supported by this browser environment.
   */
  static #configureWebGL() {
    if ( !PIXI.utils.isWebGLSupported() ) {
      const err = new Error(game.i18n.localize("ERROR.NoWebGL"));
      ui.notifications.error(err.message, {permanent: true});
      throw err;
    }
    PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL2;
  }

  /* -------------------------------------------- */

  /**
   * Create the Canvas element which will be the render target for the PIXI.Application instance.
   * Replace the template element which serves as a placeholder in the initially served HTML response.
   * @returns {HTMLCanvasElement}
   */
  static #createHTMLCanvas() {
    const board = document.getElementById("board");
    const canvas = document.createElement("canvas");
    canvas.id = "board";
    canvas.style.display = "none";
    board.replaceWith(canvas);
    return canvas;
  }

  /* -------------------------------------------- */

  /**
   * Configure the settings used to initialize the PIXI.Application instance.
   * @returns {object}    Options passed to the PIXI.Application constructor.
   */
  static #configureCanvasSettings() {
    const config = {
      width: window.innerWidth,
      height: window.innerHeight,
      transparent: false,
      resolution: game.settings.get("core", "pixelRatioResolutionScaling") ? window.devicePixelRatio : 1,
      autoDensity: true,
      antialias: false,  // Not needed because we use SmoothGraphics
      powerPreference: "high-performance" // Prefer high performance GPU for devices with dual graphics cards
    };
    Hooks.callAll("canvasConfig", config);
    return config;
  }

  /* -------------------------------------------- */

  /**
   * Initialize custom pixi plugins.
   */
  #initializePlugins() {
    BaseSamplerShader.registerPlugin({force: true});
    OccludableSamplerShader.registerPlugin();
    DepthSamplerShader.registerPlugin();

    // Configure TokenRing
    CONFIG.Token.ring.ringClass.initialize();
  }

  /* -------------------------------------------- */

  /**
   * Create the PIXI.Application and update references to the created app and stage.
   * @param {HTMLCanvasElement} canvas    The target canvas view element
   * @param {object} config               Desired PIXI.Application configuration options
   */
  #createApplication(canvas, config) {
    this.#initializePlugins();

    // Create the Application instance
    const app = new PIXI.Application({view: canvas, ...config});
    Object.defineProperty(this, "app", {value: app, writable: false});

    // Reference the Stage
    Object.defineProperty(this, "stage", {value: this.app.stage, writable: false});

    // Map all the custom blend modes
    this.#mapBlendModes();

    // Attach specific behaviors to the PIXI runners
    this.#attachToRunners();

    // Test the support of some GPU features
    const supported = this.#testSupport(app.renderer);
    Object.defineProperty(this, "supported", {
      value: Object.freeze(supported),
      writable: false,
      enumerable: true
    });

    // Additional PIXI configuration : Adding the FramebufferSnapshot to the canvas
    const snapshot = new FramebufferSnapshot();
    Object.defineProperty(this, "snapshot", {value: snapshot, writable: false});
  }

  /* -------------------------------------------- */

  /**
   * Attach specific behaviors to the PIXI runners.
   * - contextChange => Remap all the blend modes
   */
  #attachToRunners() {
    const contextChange = {
      contextChange: () => {
        console.debug(`${vtt} | Recovering from context loss.`);
        this.#mapBlendModes();
        this.hidden.invalidateMasks();
        this.effects.illumination.invalidateDarknessLevelContainer(true);
      }
    };
    this.app.renderer.runners.contextChange.add(contextChange);
  }

  /* -------------------------------------------- */

  /**
   * Map custom blend modes and premultiplied blend modes.
   */
  #mapBlendModes() {
    for ( let [k, v] of Object.entries(BLEND_MODES) ) {
      const pos = this.app.renderer.state.blendModes.push(v) - 1;
      PIXI.BLEND_MODES[k] = pos;
      PIXI.BLEND_MODES[pos] = k;
    }
    // Fix a PIXI bug with custom blend modes
    this.#mapPremultipliedBlendModes();
  }

  /* -------------------------------------------- */

  /**
   * Remap premultiplied blend modes/non premultiplied blend modes to fix PIXI bug with custom BM.
   */
  #mapPremultipliedBlendModes() {
    const pm = [];
    const npm = [];

    // Create the reference mapping
    for ( let i = 0; i < canvas.app.renderer.state.blendModes.length; i++ ) {
      pm[i] = i;
      npm[i] = i;
    }

    // Assign exceptions
    pm[PIXI.BLEND_MODES.NORMAL_NPM] = PIXI.BLEND_MODES.NORMAL;
    pm[PIXI.BLEND_MODES.ADD_NPM] = PIXI.BLEND_MODES.ADD;
    pm[PIXI.BLEND_MODES.SCREEN_NPM] = PIXI.BLEND_MODES.SCREEN;

    npm[PIXI.BLEND_MODES.NORMAL] = PIXI.BLEND_MODES.NORMAL_NPM;
    npm[PIXI.BLEND_MODES.ADD] = PIXI.BLEND_MODES.ADD_NPM;
    npm[PIXI.BLEND_MODES.SCREEN] = PIXI.BLEND_MODES.SCREEN_NPM;

    // Keep the reference to PIXI.utils.premultiplyBlendMode!
    // And recreate the blend modes mapping with the same object.
    PIXI.utils.premultiplyBlendMode.splice(0, PIXI.utils.premultiplyBlendMode.length);
    PIXI.utils.premultiplyBlendMode.push(npm);
    PIXI.utils.premultiplyBlendMode.push(pm);
  }

  /* -------------------------------------------- */

  /**
   * Initialize the group containers of the game Canvas.
   * @param {string} parentName
   * @param {PIXI.DisplayObject} parent
   */
  #createGroups(parentName, parent) {
    for ( const [name, config] of Object.entries(CONFIG.Canvas.groups) ) {
      if ( config.parent !== parentName ) continue;
      const group = new config.groupClass();
      Object.defineProperty(this, name, {value: group, writable: false});    // Reference on the Canvas
      Object.defineProperty(parent, name, {value: group, writable: false});  // Reference on the parent
      parent.addChild(group);
      this.#createGroups(name, group);                                       // Recursive
    }
  }

  /* -------------------------------------------- */

  /**
   * TODO: Add a quality parameter
   * Compute the blur parameters according to grid size and performance mode.
   * @param options            Blur options.
   * @private
   */
  _initializeBlur(options={}) {
    // Discard shared filters
    this.blurFilters.clear();

    // Compute base values from grid size
    const gridSize = this.scene.grid.size;
    const blurStrength = gridSize / 25;
    const blurFactor = gridSize / 100;

    // Lower stress for MEDIUM performance mode
    const level =
      Math.max(0, this.performance.mode - (this.performance.mode < CONST.CANVAS_PERFORMANCE_MODES.HIGH ? 1 : 0));
    const maxKernels = Math.max(5 + (level * 2), 5);
    const maxPass = 2 + (level * 2);

    // Compute blur parameters
    this.blur = new Proxy(Object.seal({
      enabled: options.enabled ?? this.performance.mode > CONST.CANVAS_PERFORMANCE_MODES.MED,
      blurClass: options.blurClass ?? AlphaBlurFilter,
      blurPassClass: options.blurPassClass ?? AlphaBlurFilterPass,
      strength: options.strength ?? blurStrength,
      passes: options.passes ?? Math.clamp(level + Math.floor(blurFactor), 2, maxPass),
      kernels: options.kernels
        ?? Math.clamp((2 * Math.ceil((1 + (2 * level) + Math.floor(blurFactor)) / 2)) - 1, 5, maxKernels)
    }), {
      set(obj, prop, value) {
        if ( prop !== "strength" ) throw new Error(`canvas.blur.${prop} is immutable`);
        const v = Reflect.set(obj, prop, value);
        canvas.updateBlur();
        return v;
      }
    });

    // Immediately update blur
    this.updateBlur();
  }

  /* -------------------------------------------- */

  /**
   * Configure performance settings for hte canvas application based on the selected performance mode.
   * @returns {CanvasPerformanceSettings}
   * @internal
   */
  _configurePerformanceMode() {
    const modes = CONST.CANVAS_PERFORMANCE_MODES;

    // Get client settings
    let mode = game.settings.get("core", "performanceMode");
    const fps = game.settings.get("core", "maxFPS");
    const mip = game.settings.get("core", "mipmap");

    // Deprecation shim for textures
    const gl = this.app.renderer.context.gl;
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    // Configure default performance mode if one is not set
    if ( mode === null ) {
      if ( maxTextureSize <= Math.pow(2, 12) ) mode = CONST.CANVAS_PERFORMANCE_MODES.LOW;
      else if ( maxTextureSize <= Math.pow(2, 13) ) mode = CONST.CANVAS_PERFORMANCE_MODES.MED;
      else mode = CONST.CANVAS_PERFORMANCE_MODES.HIGH;
      game.settings.storage.get("client").setItem("core.performanceMode", String(mode));
    }

    // Construct performance settings object
    const settings = {
      mode: mode,
      mipmap: mip ? "ON" : "OFF",
      msaa: false,
      smaa: false,
      fps: Math.clamp(fps, 0, 60),
      tokenAnimation: true,
      lightAnimation: true,
      lightSoftEdges: false
    };

    // Low settings
    if ( mode >= modes.LOW ) {
      settings.tokenAnimation = false;
      settings.lightAnimation = false;
    }

    // Medium settings
    if ( mode >= modes.MED ) {
      settings.lightSoftEdges = true;
      settings.smaa = true;
    }

    // Max settings
    if ( mode === modes.MAX ) {
      if ( settings.fps === 60 ) settings.fps = 0;
    }

    // Configure performance settings
    PIXI.BaseTexture.defaultOptions.mipmap = PIXI.MIPMAP_MODES[settings.mipmap];
    // Use the resolution and multisample of the current render target for filters by default
    PIXI.Filter.defaultResolution = null;
    PIXI.Filter.defaultMultisample = null;
    this.app.ticker.maxFPS = PIXI.Ticker.shared.maxFPS = PIXI.Ticker.system.maxFPS = settings.fps;
    return this.performance = settings;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Draw the game canvas.
   * @param {Scene} [scene]         A specific Scene document to render on the Canvas
   * @returns {Promise<Canvas>}     A Promise which resolves once the Canvas is fully drawn
   */
  async draw(scene) {
    this.#drawing = this.#drawing.finally(this.#draw.bind(this, scene));
    await this.#drawing;
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Draw the game canvas.
   * This method is wrapped by a promise that enqueues multiple draw requests.
   * @param {Scene} [scene]         A specific Scene document to render on the Canvas
   * @returns {Promise<void>}
   */
  async #draw(scene) {

    // If the canvas had not yet been initialized, we have done something out of order
    if ( !this.#initialized ) {
      throw new Error("You may not call Canvas#draw before Canvas#initialize");
    }

    // Identify the Scene which should be drawn
    if ( scene === undefined ) scene = game.scenes.current;
    if ( !((scene instanceof Scene) || (scene === null)) ) {
      throw new Error("You must provide a Scene Document to draw the Canvas.");
    }

    // Assign status flags
    const wasReady = this.#ready;
    this.#ready = false;
    this.stage.visible = false;
    this.loading = true;

    // Tear down any existing scene
    if ( wasReady ) {
      try {
        await this.tearDown();
      } catch(err) {
        err.message = `Encountered an error while tearing down the previous scene: ${err.message}`;
        logger.error(err);
      }
    }

    // Record Scene changes
    if ( this.#scene && (scene !== this.#scene) ) {
      this.#scene._view = false;
      if ( game.user.viewedScene === this.#scene.id ) game.user.viewedScene = null;
    }
    this.#scene = scene;

    // Draw a blank canvas
    if ( this.#scene === null ) return this.#drawBlank();

    // Configure Scene dimensions
    const {rect, sceneRect, ...sceneDimensions} = scene.getDimensions();
    this.#dimensions = Object.assign(sceneDimensions, {
      rect: new PIXI.Rectangle(rect.x, rect.y, rect.width, rect.height),
      sceneRect: new PIXI.Rectangle(sceneRect.x, sceneRect.y, sceneRect.width, sceneRect.height)
    });
    canvas.app.view.style.display = "block";
    document.documentElement.style.setProperty("--gridSize", `${this.dimensions.size}px`);

    // Configure a SceneManager instance
    this.#manager = Canvas.getSceneManager(this.#scene);

    // Initialize the basis transcoder
    if ( CONFIG.Canvas.transcoders.basis ) await TextureLoader.initializeBasisTranscoder();

    // Call Canvas initialization hooks
    this.loadTexturesOptions = {expireCache: true, additionalSources: []};
    this.visibilityOptions = {persistentVision: false};
    console.log(`${vtt} | Drawing game canvas for scene ${this.#scene.name}`);
    await this.#callManagerEvent("_onInit");
    await this.#callManagerEvent("_registerHooks");
    Hooks.callAll("canvasInit", this);

    // Configure attributes of the Stage
    this.stage.position.set(window.innerWidth / 2, window.innerHeight / 2);
    this.stage.hitArea = {contains: () => true};
    this.stage.eventMode = "static";
    this.stage.sortableChildren = true;

    // Initialize the camera view position (although the canvas is hidden)
    this.initializeCanvasPosition();

    // Initialize blur parameters
    this._initializeBlur(this.blurOptions);

    // Load required textures
    try {
      await TextureLoader.loadSceneTextures(this.#scene, this.loadTexturesOptions);
    } catch(err) {
      Hooks.onError("Canvas#draw", err, {
        msg: `Texture loading failed: ${err.message}`,
        log: "error",
        notify: "error"
      });
      this.loading = false;
      return;
    }

    // Configure the SMAA filter
    if ( this.performance.smaa ) this.stage.filters = [new foundry.canvas.SMAAFilter()];

    // Configure TokenRing
    CONFIG.Token.ring.ringClass.createAssetsUVs();

    // Activate ticker render workflows
    this.#activateTicker();

    // Draw canvas groups
    await this.#callManagerEvent("_onDraw");
    Hooks.callAll("canvasDraw", this);
    for ( const name of Object.keys(CONFIG.Canvas.groups) ) {
      const group = this[name];
      try {
        await group.draw();
      } catch(err) {
        Hooks.onError("Canvas#draw", err, {
          msg: `Failed drawing ${name} canvas group: ${err.message}`,
          log: "error",
          notify: "error"
        });
        this.loading = false;
        return;
      }
    }

    // Mask primary and effects layers by the overall canvas
    const cr = canvas.dimensions.rect;
    this.masks.canvas.clear().beginFill(0xFFFFFF, 1.0).drawRect(cr.x, cr.y, cr.width, cr.height).endFill();
    this.primary.sprite.mask = this.primary.mask = this.effects.mask = this.interface.grid.mask =
      this.interface.templates.mask = this.masks.canvas;

    // Compute the scene scissor mask
    const sr = canvas.dimensions.sceneRect;
    this.masks.scene.clear().beginFill(0xFFFFFF, 1.0).drawRect(sr.x, sr.y, sr.width, sr.height).endFill();

    // Initialize starting conditions
    await this.#initialize();

    this.#scene._view = true;
    this.stage.visible = true;
    await this.#callManagerEvent("_onReady");
    Hooks.call("canvasReady", this);

    // Record that loading was complete and return
    this.loading = false;

    // Trigger Region status events
    await this.#handleRegionBehaviorStatusEvents(true);

    MouseInteractionManager.emulateMoveEvent();
  }

  /* -------------------------------------------- */

  /**
   * When re-drawing the canvas, first tear down or discontinue some existing processes
   * @returns {Promise<void>}
   */
  async tearDown() {
    this.stage.visible = false;
    this.stage.filters = null;
    this.sceneTextures = {};
    this.blurOptions = undefined;

    // Track current data which should be restored on draw
    this.#reload = {
      scene: this.#scene.id,
      layer: this.activeLayer?.options.name,
      controlledTokens: this.tokens.controlled.map(t => t.id),
      targetedTokens: Array.from(game.user.targets).map(t => t.id)
    };

    // Deactivate ticker workflows
    this.#deactivateTicker();
    this.deactivateFPSMeter();

    // Deactivate every layer before teardown
    for ( let l of this.layers.reverse() ) {
      if ( l instanceof InteractionLayer ) l.deactivate();
    }

    // Trigger Region status events
    await this.#handleRegionBehaviorStatusEvents(false);

    // Call tear-down hooks
    await this.#callManagerEvent("_deactivateHooks");
    await this.#callManagerEvent("_onTearDown");
    Hooks.callAll("canvasTearDown", this);

    // Tear down groups
    for ( const name of Object.keys(CONFIG.Canvas.groups).reverse() ) {
      const group = this[name];
      await group.tearDown();
    }

    // Tear down every layer
    await this.effects.tearDown();
    for ( let l of this.layers.reverse() ) {
      await l.tearDown();
    }

    // Clear edges
    this.edges.clear();

    // Discard shared filters
    this.blurFilters.clear();

    // Create a new event boundary for the stage
    this.app.renderer.events.rootBoundary = new PIXI.EventBoundary(this.stage);
    MouseInteractionManager.emulateMoveEvent();
  }

  /* -------------------------------------------- */

  /**
   * Handle Region BEHAVIOR_STATUS events that are triggered when the Scene is (un)viewed.
   * @param {boolean} viewed    Is the scene viewed or not?
   */
  async #handleRegionBehaviorStatusEvents(viewed) {
    const results = await Promise.allSettled(this.scene.regions.map(region => region._handleEvent({
      name: CONST.REGION_EVENTS.BEHAVIOR_STATUS,
      data: {viewed},
      region,
      user: game.user
    })));
    for ( const result of results ) {
      if ( result.status === "rejected" ) console.error(result.reason);
    }
  }

  /* -------------------------------------------- */

  /**
   * Create a SceneManager instance used for this Scene, if any.
   * @param {Scene} scene
   * @returns {foundry.canvas.SceneManager|null}
   * @internal
   */
  static getSceneManager(scene) {
    const managerCls = CONFIG.Canvas.managedScenes[scene.id];
    return managerCls ? new managerCls(scene) : null;
  }

  /* -------------------------------------------- */

  /**
   * A special workflow to perform when rendering a blank Canvas with no active Scene.
   */
  #drawBlank() {
    console.log(`${vtt} | Skipping game canvas - no active scene.`);
    canvas.app.view.style.display = "none";
    ui.controls.render();
    this.loading = this.#ready = false;
    this.#manager = null;
    this.#dimensions = null;
    MouseInteractionManager.emulateMoveEvent();
  }

  /* -------------------------------------------- */

  /**
   * Get the value of a GL parameter
   * @param {string} parameter  The GL parameter to retrieve
   * @returns {*}               The GL parameter value
   */
  getGLParameter(parameter) {
    const gl = this.app.renderer.context.gl;
    return gl.getParameter(gl[parameter]);
  }

  /* -------------------------------------------- */

  /**
   * Once the canvas is drawn, initialize control, visibility, and audio states
   * @returns {Promise<void>}
   */
  async #initialize() {
    this.#ready = true;

    // Clear the set of targeted Tokens for the current user
    game.user.targets.clear();

    // Render the HUD layer
    this.hud.render(true);

    // Initialize canvas conditions
    this.#initializeCanvasLayer();
    this.#initializeTokenControl();
    this._onResize();
    this.#reload = {};

    // Initialize edges and perception
    this.edges.initialize();
    this.perception.initialize();

    // Broadcast user presence in the Scene and request user activity data
    game.user.viewedScene = this.#scene.id;
    game.user.broadcastActivity({sceneId: this.#scene.id, cursor: null, ruler: null, targets: []});
    game.socket.emit("getUserActivity");

    // Activate user interaction
    this.#addListeners();

    // Call PCO sorting
    canvas.primary.sortChildren();
  }

  /* -------------------------------------------- */

  /**
   * Initialize the starting view of the canvas stage
   * If we are re-drawing a scene which was previously rendered, restore the prior view position
   * Otherwise set the view to the top-left corner of the scene at standard scale
   */
  initializeCanvasPosition() {

    // If we are re-drawing a Scene that was already visited, use it's cached view position
    let position = this.#scene._viewPosition;

    // Use a saved position, or determine the default view based on the scene size
    if ( foundry.utils.isEmpty(position) ) {
      let {x, y, scale} = this.#scene.initial;
      const r = this.dimensions.rect;
      x ??= (r.right / 2);
      y ??= (r.bottom / 2);
      scale ??= Math.clamp(Math.min(window.innerHeight / r.height, window.innerWidth / r.width), 0.25, 3);
      position = {x, y, scale};
    }

    // Pan to the initial view
    this.pan(position);
  }

  /* -------------------------------------------- */

  /**
   * Initialize a CanvasLayer in the activation state
   */
  #initializeCanvasLayer() {
    const layer = this[this.#reload.layer] ?? this.tokens;
    layer.activate();
  }

  /* -------------------------------------------- */

  /**
   * Initialize a token or set of tokens which should be controlled.
   * Restore controlled and targeted tokens from before the re-draw.
   */
  #initializeTokenControl() {
    let panToken = null;
    let controlledTokens = [];
    let targetedTokens = [];

    // Initial tokens based on reload data
    let isReload = this.#reload.scene === this.#scene.id;
    if ( isReload ) {
      controlledTokens = this.#reload.controlledTokens.map(id => canvas.tokens.get(id));
      targetedTokens = this.#reload.targetedTokens.map(id => canvas.tokens.get(id));
    }

    // Initialize tokens based on player character
    else if ( !game.user.isGM ) {
      controlledTokens = game.user.character?.getActiveTokens() || [];
      if (!controlledTokens.length) {
        controlledTokens = canvas.tokens.placeables.filter(t => t.actor?.testUserPermission(game.user, "OWNER"));
      }
      if (!controlledTokens.length) {
        const observed = canvas.tokens.placeables.filter(t => t.actor?.testUserPermission(game.user, "OBSERVER"));
        panToken = observed.shift() || null;
      }
    }

    // Initialize Token Control
    for ( let token of controlledTokens ) {
      if ( !panToken ) panToken = token;
      token?.control({releaseOthers: false});
    }

    // Display a warning if the player has no vision tokens in a visibility-restricted scene
    if ( !game.user.isGM && this.#scene.tokenVision && !canvas.effects.visionSources.size ) {
      ui.notifications.warn("TOKEN.WarningNoVision", {localize: true});
    }

    // Initialize Token targets
    for ( const token of targetedTokens ) {
      token?.setTarget(true, {releaseOthers: false, groupSelection: true});
    }

    // Pan camera to controlled token
    if ( panToken && !isReload ) this.pan({x: panToken.center.x, y: panToken.center.y, duration: 250});
  }

  /* -------------------------------------------- */

  /**
   * Safely call a function of the SceneManager instance, catching and logging any errors.
   * @param {string} fnName       The name of the manager function to invoke
   * @returns {Promise<void>}
   */
  async #callManagerEvent(fnName) {
    if ( !this.#manager ) return;
    const fn = this.#manager[fnName];
    try {
      if ( !(fn instanceof Function) ) {
        console.error(`Invalid SceneManager function name "${fnName}"`);
        return;
      }
      await fn.call(this.#manager);
    } catch(err) {
      err.message = `${this.#manager.constructor.name}#${fnName} failed with error: ${err.message}`;
      console.error(err);
    }
  }

  /* -------------------------------------------- */

  /**
   * Given an embedded object name, get the canvas layer for that object
   * @param {string} embeddedName
   * @returns {PlaceablesLayer|null}
   */
  getLayerByEmbeddedName(embeddedName) {
    return {
      AmbientLight: this.lighting,
      AmbientSound: this.sounds,
      Drawing: this.drawings,
      MeasuredTemplate: this.templates,
      Note: this.notes,
      Region: this.regions,
      Tile: this.tiles,
      Token: this.tokens,
      Wall: this.walls
    }[embeddedName] || null;
  }

  /* -------------------------------------------- */

  /**
   * Get the InteractionLayer of the canvas which manages Documents of a certain collection within the Scene.
   * @param {string} collectionName     The collection name
   * @returns {PlaceablesLayer}         The canvas layer
   */
  getCollectionLayer(collectionName) {
    return {
      drawings: this.drawings,
      lights: this.lighting,
      notes: this.notes,
      regions: this.regions,
      sounds: this.sounds,
      templates: this.templates,
      tiles: this.tiles,
      tokens: this.tokens,
      walls: this.walls
    }[collectionName];
  }

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /**
   * Activate framerate tracking by adding an HTML element to the display and refreshing it every frame.
   */
  activateFPSMeter() {
    this.deactivateFPSMeter();
    if ( !this.#ready ) return;
    this.fps.element.style.display = "block";
    this.app.ticker.add(this.#measureFPS, this, PIXI.UPDATE_PRIORITY.LOW);
  }

  /* -------------------------------------------- */

  /**
   * Deactivate framerate tracking by canceling ticker updates and removing the HTML element.
   */
  deactivateFPSMeter() {
    this.app.ticker.remove(this.#measureFPS, this);
    this.fps.element.style.display = "none";
  }

  /* -------------------------------------------- */

  /**
   * Measure average framerate per second over the past 30 frames
   */
  #measureFPS() {
    const lastTime = this.app.ticker.lastTime;

    // Push fps values every frame
    this.fps.values.push(1000 / this.app.ticker.elapsedMS);
    if ( this.fps.values.length > 60 ) this.fps.values.shift();

    // Do some computations and rendering occasionally
    if ( (lastTime - this.fps.render) < 250 ) return;
    if ( !this.fps.element ) return;

    // Compute average fps
    const total = this.fps.values.reduce((fps, total) => total + fps, 0);
    this.fps.average = (total / this.fps.values.length);

    // Render it
    this.fps.element.innerHTML = `<label>FPS:</label> <span>${this.fps.average.toFixed(2)}</span>`;
    this.fps.render = lastTime;
  }

  /* -------------------------------------------- */

  /**
   * @typedef {Object} CanvasViewPosition
   * @property {number|null} x      The x-coordinate which becomes stage.pivot.x
   * @property {number|null} y      The y-coordinate which becomes stage.pivot.y
   * @property {number|null} scale  The zoom level up to CONFIG.Canvas.maxZoom which becomes stage.scale.x and y
   */

  /**
   * Pan the canvas to a certain {x,y} coordinate and a certain zoom level
   * @param {CanvasViewPosition} position     The canvas position to pan to
   */
  pan({x=null, y=null, scale=null}={}) {

    // Constrain the resulting canvas view
    const constrained = this._constrainView({x, y, scale});
    const scaleChange = constrained.scale !== this.stage.scale.x;

    // Set the pivot point
    this.stage.pivot.set(constrained.x, constrained.y);

    // Set the zoom level
    if ( scaleChange ) {
      this.stage.scale.set(constrained.scale, constrained.scale);
      this.updateBlur();
    }

    // Update the scene tracked position
    this.scene._viewPosition = constrained;

    // Call hooks
    Hooks.callAll("canvasPan", this, constrained);

    // Update controls
    this.controls._onCanvasPan();

    // Align the HUD
    this.hud.align();

    // Invalidate cached containers
    this.hidden.invalidateMasks();
    this.effects.illumination.invalidateDarknessLevelContainer();

    // Emulate mouse event to update the hover states
    MouseInteractionManager.emulateMoveEvent();
  }

  /* -------------------------------------------- */


  /**
   * Animate panning the canvas to a certain destination coordinate and zoom scale
   * Customize the animation speed with additional options
   * Returns a Promise which is resolved once the animation has completed
   *
   * @param {CanvasViewPosition} view     The desired view parameters
   * @param {number} [view.duration=250]  The total duration of the animation in milliseconds; used if speed is not set
   * @param {number} [view.speed]         The speed of animation in pixels per second; overrides duration if set
   * @param {Function} [view.easing]      An easing function passed to CanvasAnimation animate
   * @returns {Promise}                   A Promise which resolves once the animation has been completed
   */
  async animatePan({x, y, scale, duration=250, speed, easing}={}) {

    // Determine the animation duration to reach the target
    if ( speed ) {
      let ray = new Ray(this.stage.pivot, {x, y});
      duration = Math.round(ray.distance * 1000 / speed);
    }

    // Constrain the resulting dimensions and construct animation attributes
    const position = {...this.scene._viewPosition};
    const constrained = this._constrainView({x, y, scale});

    // Trigger the animation function
    return CanvasAnimation.animate([
      {parent: position, attribute: "x", to: constrained.x},
      {parent: position, attribute: "y", to: constrained.y},
      {parent: position, attribute: "scale", to: constrained.scale}
    ], {
      name: "canvas.animatePan",
      duration: duration,
      easing: easing ?? CanvasAnimation.easeInOutCosine,
      ontick: () => this.pan(position)
    });
  }

  /* -------------------------------------------- */

  /**
   * Recenter the canvas with a pan animation that ends in the center of the canvas rectangle.
   * @param {CanvasViewPosition} initial    A desired initial position from which to begin the animation
   * @returns {Promise<void>}               A Promise which resolves once the animation has been completed
   */
  async recenter(initial) {
    if ( initial ) this.pan(initial);
    const r = this.dimensions.sceneRect;
    return this.animatePan({
      x: r.x + (window.innerWidth / 2),
      y: r.y + (window.innerHeight / 2),
      duration: 250
    });
  }

  /* -------------------------------------------- */

  /**
   * Highlight objects on any layers which are visible
   * @param {boolean} active
   */
  highlightObjects(active) {
    if ( !this.#ready ) return;
    for ( let layer of this.layers ) {
      if ( !layer.objects || !layer.interactiveChildren ) continue;
      layer.highlightObjects = active;
      for ( let o of layer.placeables ) {
        o.renderFlags.set({refreshState: true});
      }
    }
    if ( canvas.tokens.occlusionMode & CONST.TOKEN_OCCLUSION_MODES.HIGHLIGHTED ) {
      canvas.perception.update({refreshOcclusion: true});
    }
    /** @see hookEvents.highlightObjects */
    Hooks.callAll("highlightObjects", active);
  }

  /* -------------------------------------------- */

  /**
   * Displays a Ping both locally and on other connected client, following these rules:
   * 1) Displays on the current canvas Scene
   * 2) If ALT is held, becomes an ALERT ping
   * 3) Else if the user is GM and SHIFT is held, becomes a PULL ping
   * 4) Else is a PULSE ping
   * @param {Point} origin                  Point to display Ping at
   * @param {PingOptions} [options]         Additional options to configure how the ping is drawn.
   * @returns {Promise<boolean>}
   */
  async ping(origin, options) {
    // Don't allow pinging outside of the canvas bounds
    if ( !this.dimensions.rect.contains(origin.x, origin.y) ) return false;
    // Configure the ping to be dispatched
    const types = CONFIG.Canvas.pings.types;
    const isPull = game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.SHIFT);
    const isAlert = game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.ALT);
    let style = types.PULSE;
    if ( isPull ) style = types.PULL;
    else if ( isAlert ) style = types.ALERT;
    let ping = {scene: this.scene?.id, pull: isPull, style, zoom: canvas.stage.scale.x};
    ping = foundry.utils.mergeObject(ping, options);

    // Broadcast the ping to other connected clients
    /** @type ActivityData */
    const activity = {cursor: origin, ping};
    game.user.broadcastActivity(activity);

    // Display the ping locally
    return this.controls.handlePing(game.user, origin, ping);
  }

  /* -------------------------------------------- */

  /**
   * Get the constrained zoom scale parameter which is allowed by the maxZoom parameter
   * @param {CanvasViewPosition} position   The unconstrained position
   * @returns {CanvasViewPosition}          The constrained position
   * @internal
   */
  _constrainView({x, y, scale}) {
    if ( !Number.isNumeric(x) ) x = this.stage.pivot.x;
    if ( !Number.isNumeric(y) ) y = this.stage.pivot.y;
    if ( !Number.isNumeric(scale) ) scale = this.stage.scale.x;
    const d = canvas.dimensions;

    // Constrain the scale to the maximum zoom level
    const maxScale = CONFIG.Canvas.maxZoom;
    const minScale = 1 / Math.max(d.width / window.innerWidth, d.height / window.innerHeight, maxScale);
    scale = Math.clamp(scale, minScale, maxScale);

    // Constrain the pivot point using the new scale
    const padX = 0.4 * (window.innerWidth / scale);
    const padY = 0.4 * (window.innerHeight / scale);
    x = Math.clamp(x, -padX, d.width + padX);
    y = Math.clamp(y, -padY, d.height + padY);

    // Return the constrained view dimensions
    return {x, y, scale};
  }

  /* -------------------------------------------- */

  /**
   * Create a BlurFilter instance and register it to the array for updates when the zoom level changes.
   * @param {number} blurStrength         The desired blur strength to use for this filter
   * @param {number} blurQuality          The desired quality to use for this filter
   * @returns {PIXI.BlurFilter}
   */
  createBlurFilter(blurStrength, blurQuality=CONFIG.Canvas.blurQuality) {
    const configuredStrength = blurStrength ?? this.blur.strength ?? CONFIG.Canvas.blurStrength;
    const f = new PIXI.BlurFilter(configuredStrength, blurQuality);
    f._configuredStrength = configuredStrength;
    this.addBlurFilter(f);
    return f;
  }

  /* -------------------------------------------- */

  /**
   * Add a filter to the blur filter list. The filter must have the blur property
   * @param {PIXI.BlurFilter} filter    The Filter instance to add
   * @returns {PIXI.BlurFilter}         The added filter for method chaining
   */
  addBlurFilter(filter) {
    if ( filter.blur === undefined ) return;
    filter.blur = (filter._configuredStrength ?? this.blur.strength ?? CONFIG.Canvas.blurStrength) * this.stage.scale.x;
    this.blurFilters.add(filter); // Save initial blur of the filter in the set
    return filter;
  }

  /* -------------------------------------------- */

  /**
   * Update the blur strength depending on the scale of the canvas stage.
   * This number is zero if "soft shadows" are disabled
   * @param {number} [strength]      Optional blur strength to apply
   * @private
   */
  updateBlur(strength) {
    for ( const filter of this.blurFilters ) {
      filter.blur = (strength ?? filter._configuredStrength ?? this.blur.strength ?? CONFIG.Canvas.blurStrength)
        * this.stage.scale.x;
    }
  }

  /* -------------------------------------------- */

  /**
   * Convert canvas coordinates to the client's viewport.
   * @param {Point} origin  The canvas coordinates.
   * @returns {Point}       The corresponding coordinates relative to the client's viewport.
   */
  clientCoordinatesFromCanvas(origin) {
    const point = {x: origin.x, y: origin.y};
    return this.stage.worldTransform.apply(point, point);
  }

  /* -------------------------------------------- */

  /**
   * Convert client viewport coordinates to canvas coordinates.
   * @param {Point} origin  The client coordinates.
   * @returns {Point}       The corresponding canvas coordinates.
   */
  canvasCoordinatesFromClient(origin) {
    const point = {x: origin.x, y: origin.y};
    return this.stage.worldTransform.applyInverse(point, point);
  }

  /* -------------------------------------------- */

  /**
   * Determine whether given canvas coordinates are off-screen.
   * @param {Point} position  The canvas coordinates.
   * @returns {boolean}       Is the coordinate outside the screen bounds?
   */
  isOffscreen(position) {
    const { clientWidth, clientHeight } = document.documentElement;
    const { x, y } = this.clientCoordinatesFromCanvas(position);
    return (x < 0) || (y < 0) || (x >= clientWidth) || (y >= clientHeight);
  }


  /* -------------------------------------------- */

  /**
   * Remove all children of the display object and call one cleaning method:
   * clean first, then tearDown, and destroy if no cleaning method is found.
   * @param {PIXI.DisplayObject} displayObject  The display object to clean.
   * @param {boolean} destroy                   If textures should be destroyed.
   */
  static clearContainer(displayObject, destroy=true) {
    const children = displayObject.removeChildren();
    for ( const child of children ) {
      if ( child.clear ) child.clear(destroy);
      else if ( child.tearDown ) child.tearDown();
      else child.destroy(destroy);
    }
  }

  /* -------------------------------------------- */

  /**
   * Get a texture with the required configuration and clear color.
   * @param {object} options
   * @param {number[]} [options.clearColor]           The clear color to use for this texture. Transparent by default.
   * @param {object} [options.textureConfiguration]   The render texture configuration.
   * @returns {PIXI.RenderTexture}
   */
  static getRenderTexture({clearColor, textureConfiguration}={}) {
    const texture = PIXI.RenderTexture.create(textureConfiguration);
    if ( clearColor ) texture.baseTexture.clearColor = clearColor;
    return texture;
  }

  /* -------------------------------------------- */
  /* Event Handlers
  /* -------------------------------------------- */

  /**
   * Attach event listeners to the game canvas to handle click and interaction events
   */
  #addListeners() {

    // Remove all existing listeners
    this.stage.removeAllListeners();

    // Define callback functions for mouse interaction events
    const callbacks = {
      clickLeft: this.#onClickLeft.bind(this),
      clickLeft2: this.#onClickLeft2.bind(this),
      clickRight: this.#onClickRight.bind(this),
      clickRight2: this.#onClickRight2.bind(this),
      dragLeftStart: this.#onDragLeftStart.bind(this),
      dragLeftMove: this.#onDragLeftMove.bind(this),
      dragLeftDrop: this.#onDragLeftDrop.bind(this),
      dragLeftCancel: this.#onDragLeftCancel.bind(this),
      dragRightStart: this._onDragRightStart.bind(this),
      dragRightMove: this._onDragRightMove.bind(this),
      dragRightDrop: this._onDragRightDrop.bind(this),
      dragRightCancel: this._onDragRightCancel.bind(this),
      longPress: this.#onLongPress.bind(this)
    };

    // Create and activate the interaction manager
    const permissions = {
      clickRight2: false,
      dragLeftStart: this.#canDragLeftStart.bind(this)
    };
    const mgr = new MouseInteractionManager(this.stage, this.stage, permissions, callbacks);
    this.mouseInteractionManager = mgr.activate();

    // Debug average FPS
    if ( game.settings.get("core", "fpsMeter") ) this.activateFPSMeter();
    this.dt = 0;

    // Add a listener for cursor movement
    this.stage.on("pointermove", event => {
      event.getLocalPosition(this.stage, this.mousePosition);
      this.#throttleOnMouseMove();
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle mouse movement on the game canvas.
   */
  #onMouseMove() {
    this.controls._onMouseMove();
    this.sounds._onMouseMove();
    this.primary._onMouseMove();
  }

  /* -------------------------------------------- */

  /**
   * Handle left mouse-click events occurring on the Canvas.
   * @see {MouseInteractionManager##handleClickLeft}
   * @param {PIXI.FederatedEvent} event
   */
  #onClickLeft(event) {
    const layer = this.activeLayer;
    if ( layer instanceof InteractionLayer ) return layer._onClickLeft(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle double left-click events occurring on the Canvas.
   * @see {MouseInteractionManager##handleClickLeft2}
   * @param {PIXI.FederatedEvent} event
   */
  #onClickLeft2(event) {
    const layer = this.activeLayer;
    if ( layer instanceof InteractionLayer ) return layer._onClickLeft2(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle long press events occurring on the Canvas.
   * @see {MouseInteractionManager##handleLongPress}
   * @param {PIXI.FederatedEvent}   event   The triggering canvas interaction event.
   * @param {PIXI.Point}            origin  The local canvas coordinates of the mousepress.
   */
  #onLongPress(event, origin) {
    canvas.controls._onLongPress(event, origin);
  }

  /* -------------------------------------------- */

  /**
   * Does the User have permission to left-click drag on the Canvas?
   * @param {User} user                    The User performing the action.
   * @param {PIXI.FederatedEvent} event    The event object.
   * @returns {boolean}
   */
  #canDragLeftStart(user, event) {
    const layer = this.activeLayer;
    if ( (layer instanceof TokenLayer) && CONFIG.Canvas.rulerClass.canMeasure ) return !this.controls.ruler.active;
    if ( ["select", "target"].includes(game.activeTool) ) return true;
    if ( layer instanceof InteractionLayer ) return layer._canDragLeftStart(user, event);
    return false;
  }

  /* -------------------------------------------- */

  /**
   * Handle the beginning of a left-mouse drag workflow on the Canvas stage or its active Layer.
   * @see {MouseInteractionManager##handleDragStart}
   * @param {PIXI.FederatedEvent} event
   */
  #onDragLeftStart(event) {
    const layer = this.activeLayer;

    // Begin ruler measurement
    if ( (layer instanceof TokenLayer) && CONFIG.Canvas.rulerClass.canMeasure ) {
      event.interactionData.ruler = true;
      return this.controls.ruler._onDragStart(event);
    }

    // Activate select rectangle
    const isSelect = ["select", "target"].includes(game.activeTool);
    if ( isSelect ) {
      // The event object appears to be reused, so delete any coords from a previous selection.
      delete event.interactionData.coords;
      canvas.controls.select.active = true;
      return;
    }

    // Dispatch the event to the active layer
    if ( layer instanceof InteractionLayer ) return layer._onDragLeftStart(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle mouse movement events occurring on the Canvas.
   * @see {MouseInteractionManager##handleDragMove}
   * @param {PIXI.FederatedEvent} event
   */
  #onDragLeftMove(event) {
    const layer = this.activeLayer;

    // Pan the canvas if the drag event approaches the edge
    this._onDragCanvasPan(event);

    // Continue a Ruler measurement
    if ( event.interactionData.ruler ) return this.controls.ruler._onMouseMove(event);

    // Continue a select event
    const isSelect = ["select", "target"].includes(game.activeTool);
    if ( isSelect && canvas.controls.select.active ) return this.#onDragSelect(event);

    // Dispatch the event to the active layer
    if ( layer instanceof InteractionLayer ) return layer._onDragLeftMove(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle the conclusion of a left-mouse drag workflow when the mouse button is released.
   * @see {MouseInteractionManager##handleDragDrop}
   * @param {PIXI.FederatedEvent} event
   * @internal
   */
  #onDragLeftDrop(event) {

    // Extract event data
    const coords = event.interactionData.coords;
    const tool = game.activeTool;
    const layer = canvas.activeLayer;

    // Conclude a measurement event if we aren't holding the CTRL key
    if ( event.interactionData.ruler ) return canvas.controls.ruler._onMouseUp(event);

    // Conclude a select event
    const isSelect = ["select", "target"].includes(tool);
    const targetKeyDown = game.keyboard.isCoreActionKeyActive("target");
    if ( isSelect && canvas.controls.select.active && (layer instanceof PlaceablesLayer) ) {
      canvas.controls.select.clear();
      canvas.controls.select.active = false;
      const releaseOthers = !event.shiftKey;
      if ( !coords ) return;
      if ( tool === "select" && !targetKeyDown ) return layer.selectObjects(coords, {releaseOthers});
      else if ( tool === "target" || targetKeyDown ) return layer.targetObjects(coords, {releaseOthers});
    }

    // Dispatch the event to the active layer
    if ( layer instanceof InteractionLayer ) return layer._onDragLeftDrop(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle the cancellation of a left-mouse drag workflow
   * @see {MouseInteractionManager##handleDragCancel}
   * @param {PointerEvent} event
   * @internal
   */
  #onDragLeftCancel(event) {
    const layer = canvas.activeLayer;
    const tool = game.activeTool;

    // Don't cancel ruler measurement unless the token was moved by the ruler
    if ( event.interactionData.ruler ) {
      const ruler = canvas.controls.ruler;
      return !ruler.active || (ruler.state === Ruler.STATES.MOVING);
    }

    // Clear selection
    const isSelect = ["select", "target"].includes(tool);
    if ( isSelect ) {
      canvas.controls.select.clear();
      return;
    }

    // Dispatch the event to the active layer
    if ( layer instanceof InteractionLayer ) return layer._onDragLeftCancel(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle right mouse-click events occurring on the Canvas.
   * @see {MouseInteractionManager##handleClickRight}
   * @param {PIXI.FederatedEvent} event
   */
  #onClickRight(event) {
    const ruler = canvas.controls.ruler;
    if ( ruler.state === Ruler.STATES.MEASURING ) return ruler._onClickRight(event);

    // Dispatch to the active layer
    const layer = this.activeLayer;
    if ( layer instanceof InteractionLayer ) return layer._onClickRight(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle double right-click events occurring on the Canvas.
   * @see {MouseInteractionManager##handleClickRight}
   * @param {PIXI.FederatedEvent} event
   */
  #onClickRight2(event) {
    const layer = this.activeLayer;
    if ( layer instanceof InteractionLayer ) return layer._onClickRight2(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle right-mouse start drag events occurring on the Canvas.
   * @see {MouseInteractionManager##handleDragStart}
   * @param {PIXI.FederatedEvent} event
   * @internal
   */
  _onDragRightStart(event) {}

  /* -------------------------------------------- */

  /**
   * Handle right-mouse drag events occurring on the Canvas.
   * @see {MouseInteractionManager##handleDragMove}
   * @param {PIXI.FederatedEvent} event
   * @internal
   */
  _onDragRightMove(event) {
    // Extract event data
    const {origin, destination} = event.interactionData;
    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;

    // Pan the canvas
    this.pan({
      x: canvas.stage.pivot.x - (dx * CONFIG.Canvas.dragSpeedModifier),
      y: canvas.stage.pivot.y - (dy * CONFIG.Canvas.dragSpeedModifier)
    });

    // Reset Token tab cycling
    this.tokens._tabIndex = null;
  }

  /* -------------------------------------------- */

  /**
   * Handle the conclusion of a right-mouse drag workflow the Canvas stage.
   * @see {MouseInteractionManager##handleDragDrop}
   * @param {PIXI.FederatedEvent} event
   * @internal
   */
  _onDragRightDrop(event) {}

  /* -------------------------------------------- */

  /**
   * Handle the cancellation of a right-mouse drag workflow the Canvas stage.
   * @see {MouseInteractionManager##handleDragCancel}
   * @param {PIXI.FederatedEvent} event
   * @internal
   */
  _onDragRightCancel(event) {}

  /* -------------------------------------------- */

  /**
   * Determine selection coordinate rectangle during a mouse-drag workflow
   * @param {PIXI.FederatedEvent} event
   */
  #onDragSelect(event) {

    // Extract event data
    const {origin, destination} = event.interactionData;

    // Determine rectangle coordinates
    let coords = {
      x: Math.min(origin.x, destination.x),
      y: Math.min(origin.y, destination.y),
      width: Math.abs(destination.x - origin.x),
      height: Math.abs(destination.y - origin.y)
    };

    // Draw the select rectangle
    canvas.controls.drawSelect(coords);
    event.interactionData.coords = coords;
  }

  /* -------------------------------------------- */

  /**
   * Pan the canvas view when the cursor position gets close to the edge of the frame
   * @param {MouseEvent} event    The originating mouse movement event
   */
  _onDragCanvasPan(event) {

    // Throttle panning by 200ms
    const now = Date.now();
    if ( now - (this._panTime || 0) <= 200 ) return;
    this._panTime = now;

    // Shift by 3 grid spaces at a time
    const {x, y} = event;
    const pad = 50;
    const shift = (this.dimensions.size * 3) / this.stage.scale.x;

    // Shift horizontally
    let dx = 0;
    if ( x < pad ) dx = -shift;
    else if ( x > window.innerWidth - pad ) dx = shift;

    // Shift vertically
    let dy = 0;
    if ( y < pad ) dy = -shift;
    else if ( y > window.innerHeight - pad ) dy = shift;

    // Enact panning
    if ( dx || dy ) return this.animatePan({x: this.stage.pivot.x + dx, y: this.stage.pivot.y + dy, duration: 200});
  }

  /* -------------------------------------------- */
  /*  Other Event Handlers                        */
  /* -------------------------------------------- */

  /**
   * Handle window resizing with the dimensions of the window viewport change
   * @param {Event} event     The Window resize event
   * @private
   */
  _onResize(event=null) {
    if ( !this.#ready ) return false;

    // Resize the renderer to the current screen dimensions
    this.app.renderer.resize(window.innerWidth, window.innerHeight);

    // Record the dimensions that were resized to (may be rounded, etc..)
    const w = this.screenDimensions[0] = this.app.renderer.screen.width;
    const h = this.screenDimensions[1] = this.app.renderer.screen.height;

    // Update the canvas position
    this.stage.position.set(w/2, h/2);
    this.pan(this.stage.pivot);
  }

  /* -------------------------------------------- */

  /**
   * Handle mousewheel events which adjust the scale of the canvas
   * @param {WheelEvent} event    The mousewheel event that zooms the canvas
   * @private
   */
  _onMouseWheel(event) {
    let dz = ( event.delta < 0 ) ? 1.05 : 0.95;
    this.pan({scale: dz * canvas.stage.scale.x});
  }

  /* -------------------------------------------- */

  /**
   * Event handler for the drop portion of a drag-and-drop event.
   * @param {DragEvent} event  The drag event being dropped onto the canvas
   * @private
   */
  _onDrop(event) {
    event.preventDefault();
    const data = TextEditor.getDragEventData(event);
    if ( !data.type ) return;

    // Acquire the cursor position transformed to Canvas coordinates
    const {x, y} = this.canvasCoordinatesFromClient({x: event.clientX, y: event.clientY});
    data.x = x;
    data.y = y;

    /**
     * A hook event that fires when some useful data is dropped onto the
     * Canvas.
     * @function dropCanvasData
     * @memberof hookEvents
     * @param {Canvas} canvas The Canvas
     * @param {object} data   The data that has been dropped onto the Canvas
     */
    const allowed = Hooks.call("dropCanvasData", this, data);
    if ( allowed === false ) return;

    // Handle different data types
    switch ( data.type ) {
      case "Actor":
        return canvas.tokens._onDropActorData(event, data);
      case "JournalEntry": case "JournalEntryPage":
        return canvas.notes._onDropData(event, data);
      case "Macro":
        return game.user.assignHotbarMacro(null, Number(data.slot));
      case "PlaylistSound":
        return canvas.sounds._onDropData(event, data);
      case "Tile":
        return canvas.tiles._onDropData(event, data);
    }
  }

  /* -------------------------------------------- */
  /*  Pre-Rendering Workflow                      */
  /* -------------------------------------------- */

  /**
   * Track objects which have pending render flags.
   * @enum {Set<RenderFlagObject>}
   */
  pendingRenderFlags;

  /**
   * Cached references to bound ticker functions which can be removed later.
   * @type {Record<string, Function>}
   */
  #tickerFunctions = {};

  /* -------------------------------------------- */

  /**
   * Activate ticker functions which should be called as part of the render loop.
   * This occurs as part of setup for a newly viewed Scene.
   */
  #activateTicker() {
    const p = PIXI.UPDATE_PRIORITY;

    // Define custom ticker priorities
    Object.assign(p, {
      OBJECTS: p.HIGH - 2,
      PRIMARY: p.NORMAL + 3,
      PERCEPTION: p.NORMAL + 2
    });

    // Create pending queues
    Object.defineProperty(this, "pendingRenderFlags", {
      value: {
        OBJECTS: new Set(),
        PERCEPTION: new Set()
      },
      configurable: true,
      writable: false
    });

    // Apply PlaceableObject RenderFlags
    this.#tickerFunctions.OBJECTS = this.#applyRenderFlags.bind(this, this.pendingRenderFlags.OBJECTS);
    this.app.ticker.add(this.#tickerFunctions.OBJECTS, undefined, p.OBJECTS);

    // Update the primary group
    this.#tickerFunctions.PRIMARY = this.primary.update.bind(this.primary);
    this.app.ticker.add(this.#tickerFunctions.PRIMARY, undefined, p.PRIMARY);

    // Update Perception
    this.#tickerFunctions.PERCEPTION = this.#applyRenderFlags.bind(this, this.pendingRenderFlags.PERCEPTION);
    this.app.ticker.add(this.#tickerFunctions.PERCEPTION, undefined, p.PERCEPTION);
  }

  /* -------------------------------------------- */

  /**
   * Deactivate ticker functions which were previously registered.
   * This occurs during tear-down of a previously viewed Scene.
   */
  #deactivateTicker() {
    for ( const queue of Object.values(this.pendingRenderFlags) ) queue.clear();
    for ( const [k, fn] of Object.entries(this.#tickerFunctions) ) {
      canvas.app.ticker.remove(fn);
      delete this.#tickerFunctions[k];
    }
  }

  /* -------------------------------------------- */

  /**
   * Apply pending render flags which should be handled at a certain ticker priority.
   * @param {Set<RenderFlagObject>} queue       The queue of objects to handle
   */
  #applyRenderFlags(queue) {
    if ( !queue.size ) return;
    const objects = Array.from(queue);
    queue.clear();
    for ( const object of objects ) object.applyRenderFlags();
  }

  /* -------------------------------------------- */

  /**
   * Test support for some GPU capabilities and update the supported property.
   * @param {PIXI.Renderer} renderer
   */
  #testSupport(renderer) {
    const supported = {};
    const gl = renderer?.gl;

    if ( !(gl instanceof WebGL2RenderingContext) ) {
      supported.webGL2 = false;
      return supported;
    }

    supported.webGL2 = true;
    let renderTexture;

    // Test support for reading pixels in RED/UNSIGNED_BYTE format
    renderTexture = PIXI.RenderTexture.create({
      width: 1,
      height: 1,
      format: PIXI.FORMATS.RED,
      type: PIXI.TYPES.UNSIGNED_BYTE,
      resolution: 1,
      multisample: PIXI.MSAA_QUALITY.NONE
    });
    renderer.renderTexture.bind(renderTexture);
    const format = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT);
    const type = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
    supported.readPixelsRED = (format === gl.RED) && (type === gl.UNSIGNED_BYTE);
    renderer.renderTexture.bind();
    renderTexture?.destroy(true);

    // Test support for OffscreenCanvas
    try {
      supported.offscreenCanvas =
        (typeof OffscreenCanvas !== "undefined") && (!!new OffscreenCanvas(10, 10).getContext("2d"));
    } catch(e) {
      supported.offscreenCanvas = false;
    }
    return supported;
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v11
   * @ignore
   */
  addPendingOperation(name, fn, scope, args) {
    const msg = "Canvas#addPendingOperation is deprecated without replacement in v11. The callback that you have "
      + "passed as a pending operation has been executed immediately. We recommend switching your code to use a "
      + "debounce operation or RenderFlags to de-duplicate overlapping requests.";
    foundry.utils.logCompatibilityWarning(msg, {since: 11, until: 13});
    fn.call(scope, ...args);
  }

  /**
   * @deprecated since v11
   * @ignore
   */
  triggerPendingOperations() {
    const msg = "Canvas#triggerPendingOperations is deprecated without replacement in v11 and performs no action.";
    foundry.utils.logCompatibilityWarning(msg, {since: 11, until: 13});
  }

  /**
   * @deprecated since v11
   * @ignore
   */
  get pendingOperations() {
    const msg = "Canvas#pendingOperations is deprecated without replacement in v11.";
    foundry.utils.logCompatibilityWarning(msg, {since: 11, until: 13});
    return [];
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  get colorManager() {
    const msg = "Canvas#colorManager is deprecated and replaced by Canvas#environment";
    foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14});
    return this.environment;
  }
}
