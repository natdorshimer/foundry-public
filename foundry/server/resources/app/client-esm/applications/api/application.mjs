import EventEmitterMixin from "../../../common/utils/event-emitter.mjs";
import Semaphore from "../../../common/utils/semaphore.mjs";

/**
 * @typedef {import("../_types.mjs").ApplicationConfiguration} ApplicationConfiguration
 * @typedef {import("../_types.mjs").ApplicationRenderOptions} ApplicationRenderOptions
 * @typedef {import("../_types.mjs").ApplicationRenderContext} ApplicationRenderContext
 * @typedef {import("../_types.mjs").ApplicationClosingOptions} ApplicationClosingOptions
 * @typedef {import("../_types.mjs").ApplicationPosition} ApplicationPosition
 * @typedef {import("../_types.mjs").ApplicationHeaderControlsEntry} ApplicationHeaderControlsEntry
 */

/**
 * The Application class is responsible for rendering an HTMLElement into the Foundry Virtual Tabletop user interface.
 * @template {ApplicationConfiguration} Configuration
 * @template {ApplicationRenderOptions} RenderOptions
 * @alias ApplicationV2
 */
export default class ApplicationV2 extends EventEmitterMixin(Object) {

  /**
   * Applications are constructed by providing an object of configuration options.
   * @param {Partial<Configuration>} [options]     Options used to configure the Application instance
   */
  constructor(options={}) {
    super();

    // Configure Application Options
    this.options = Object.freeze(this._initializeApplicationOptions(options));
    this.#id = this.options.id.replace("{id}", this.options.uniqueId);
    Object.assign(this.#position, this.options.position);

    // Verify the Application class is renderable
    this.#renderable = (this._renderHTML !== ApplicationV2.prototype._renderHTML)
      && (this._replaceHTML !== ApplicationV2.prototype._replaceHTML);
  }

  /**
   * Designates which upstream Application class in this class' inheritance chain is the base application.
   * Any DEFAULT_OPTIONS of super-classes further upstream of the BASE_APPLICATION are ignored.
   * Hook events for super-classes further upstream of the BASE_APPLICATION are not dispatched.
   * @type {typeof ApplicationV2}
   */
  static BASE_APPLICATION = ApplicationV2;

  /**
   * The default configuration options which are assigned to every instance of this Application class.
   * @type {Partial<Configuration>}
   */
  static DEFAULT_OPTIONS = {
    id: "app-{id}",
    classes: [],
    tag: "div",
    window: {
      frame: true,
      positioned: true,
      title: "",
      icon: "",
      controls: [],
      minimizable: true,
      resizable: false,
      contentTag: "section",
      contentClasses: []
    },
    actions: {},
    form: {
      handler: undefined,
      submitOnChange: false,
      closeOnSubmit: false
    },
    position: {}
  }

  /**
   * The sequence of rendering states that describe the Application life-cycle.
   * @enum {number}
   */
  static RENDER_STATES = Object.freeze({
    ERROR: -3,
    CLOSING: -2,
    CLOSED: -1,
    NONE: 0,
    RENDERING: 1,
    RENDERED: 2
  });

  /**
   * Which application is currently "in front" with the maximum z-index
   * @type {ApplicationV2}
   */
  static #frontApp;

  /** @override */
  static emittedEvents = Object.freeze(["render", "close", "position"]);

  /**
   * Application instance configuration options.
   * @type {Configuration}
   */
  options;

  /**
   * @type {string}
   */
  #id;

  /**
   * Flag that this Application instance is renderable.
   * Applications are not renderable unless a subclass defines the _renderHTML and _replaceHTML methods.
   */
  #renderable = true;

  /**
   * The outermost HTMLElement of this rendered Application.
   * For window applications this is ApplicationV2##frame.
   * For non-window applications this ApplicationV2##content.
   * @type {HTMLDivElement}
   */
  #element;

  /**
   * The HTMLElement within which inner HTML is rendered.
   * For non-window applications this is the same as ApplicationV2##element.
   * @type {HTMLElement}
   */
  #content;

  /**
   * Data pertaining to the minimization status of the Application.
   * @type {{
   *  active: boolean,
   *  [priorWidth]: number,
   *  [priorHeight]: number,
   *  [priorBoundingWidth]: number,
   *  [priorBoundingHeight]: number
   * }}
   */
  #minimization = Object.seal({
    active: false,
    priorWidth: undefined,
    priorHeight: undefined,
    priorBoundingWidth: undefined,
    priorBoundingHeight: undefined
  });

  /**
   * The rendered position of the Application.
   * @type {ApplicationPosition}
   */
  #position = Object.seal({
    top: undefined,
    left: undefined,
    width: undefined,
    height: "auto",
    scale: 1,
    zIndex: _maxZ
  });

  /**
   * @type {ApplicationV2.RENDER_STATES}
   */
  #state = ApplicationV2.RENDER_STATES.NONE;

  /**
   * A Semaphore used to enqueue asynchronous operations.
   * @type {Semaphore}
   */
  #semaphore = new Semaphore(1);

  /**
   * Convenience references to window header elements.
   * @type {{
   *  header: HTMLElement,
   *  resize: HTMLElement,
   *  title: HTMLHeadingElement,
   *  icon: HTMLElement,
   *  close: HTMLButtonElement,
   *  controls: HTMLButtonElement,
   *  controlsDropdown: HTMLDivElement,
   *  onDrag: Function,
   *  onResize: Function,
   *  pointerStartPosition: ApplicationPosition,
   *  pointerMoveThrottle: boolean
   * }}
   */
  get window() {
    return this.#window;
  }
  #window = {
    title: undefined,
    icon: undefined,
    close: undefined,
    controls: undefined,
    controlsDropdown: undefined,
    onDrag: this.#onWindowDragMove.bind(this),
    onResize: this.#onWindowResizeMove.bind(this),
    pointerStartPosition: undefined,
    pointerMoveThrottle: false
  };

  /**
   * If this Application uses tabbed navigation groups, this mapping is updated whenever the changeTab method is called.
   * Reports the active tab for each group.
   * Subclasses may override this property to define default tabs for each group.
   * @type {Record<string, string>}
   */
  tabGroups = {};

  /* -------------------------------------------- */
  /*  Application Properties                      */
  /* -------------------------------------------- */

  /**
   * The CSS class list of this Application instance
   * @type {DOMTokenList}
   */
  get classList() {
    return this.#element?.classList;
  }

  /**
   * The HTML element ID of this Application instance.
   * @type {string}
   */
  get id() {
    return this.#id;
  }

  /**
   * A convenience reference to the title of the Application window.
   * @type {string}
   */
  get title() {
    return game.i18n.localize(this.options.window.title);
  }

  /**
   * The HTMLElement which renders this Application into the DOM.
   * @type {HTMLElement}
   */
  get element() {
    return this.#element;
  }

  /**
   * Is this Application instance currently minimized?
   * @type {boolean}
   */
  get minimized() {
    return this.#minimization.active;
  }

  /**
   * The current position of the application with respect to the window.document.body.
   * @type {ApplicationPosition}
   */
  position = new Proxy(this.#position, {
    set: (obj, prop, value) => {
      if ( prop in obj ) {
        obj[prop] = value;
        this._updatePosition(this.#position);
        return value;
      }
    }
  });

  /**
   * Is this Application instance currently rendered?
   * @type {boolean}
   */
  get rendered() {
    return this.#state === ApplicationV2.RENDER_STATES.RENDERED;
  }

  /**
   * The current render state of the Application.
   * @type {ApplicationV2.RENDER_STATES}
   */
  get state() {
    return this.#state;
  }

  /**
   * Does this Application instance render within an outer window frame?
   * @type {boolean}
   */
  get hasFrame() {
    return this.options.window.frame;
  }

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /**
   * Iterate over the inheritance chain of this Application.
   * The chain includes this Application itself and all parents until the base application is encountered.
   * @see ApplicationV2.BASE_APPLICATION
   * @generator
   * @yields {typeof ApplicationV2}
   */
  static *inheritanceChain() {
    let cls = this;
    while ( cls ) {
      yield cls;
      if ( cls === this.BASE_APPLICATION ) return;
      cls = Object.getPrototypeOf(cls);
    }
  }

  /* -------------------------------------------- */

  /**
   * Initialize configuration options for the Application instance.
   * The default behavior of this method is to intelligently merge options for each class with those of their parents.
   * - Array-based options are concatenated
   * - Inner objects are merged
   * - Otherwise, properties in the subclass replace those defined by a parent
   * @param {Partial<ApplicationConfiguration>} options      Options provided directly to the constructor
   * @returns {ApplicationConfiguration}                     Configured options for the application instance
   * @protected
   */
  _initializeApplicationOptions(options) {

    // Options initialization order
    const order = [options];
    for ( const cls of this.constructor.inheritanceChain() ) {
      order.unshift(cls.DEFAULT_OPTIONS);
    }

    // Intelligently merge with parent class options
    const applicationOptions = {};
    for ( const opts of order ) {
      for ( const [k, v] of Object.entries(opts) ) {
        if ( (k in applicationOptions) ) {
          const v0 = applicationOptions[k];
          if ( Array.isArray(v0) ) applicationOptions[k].push(...v);                // Concatenate arrays
          else if ( foundry.utils.getType(v0) === "Object") Object.assign(v0, v);   // Merge objects
          else applicationOptions[k] = foundry.utils.deepClone(v);                  // Override option
        }
        else applicationOptions[k] = foundry.utils.deepClone(v);
      }
    }

    // Unique application ID
    applicationOptions.uniqueId = String(++globalThis._appId);

    // Special handling for classes
    if ( applicationOptions.window.frame ) applicationOptions.classes.unshift("application");
    applicationOptions.classes = Array.from(new Set(applicationOptions.classes));
    return applicationOptions;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Render the Application, creating its HTMLElement and replacing its innerHTML.
   * Add it to the DOM if it is not currently rendered and rendering is forced. Otherwise, re-render its contents.
   * @param {boolean|RenderOptions} [options]             Options which configure application rendering behavior.
   *                                                      A boolean is interpreted as the "force" option.
   * @param {RenderOptions} [_options]                    Legacy options for backwards-compatibility with the original
   *                                                      ApplicationV1#render signature.
   * @returns {Promise<ApplicationV2>}            A Promise which resolves to the rendered Application instance
   */
  async render(options={}, _options={}) {
    if ( typeof options === "boolean" ) options = Object.assign(_options, {force: options});
    return this.#semaphore.add(this.#render.bind(this), options);
  }

  /* -------------------------------------------- */

  /**
   * Manage the rendering step of the Application life-cycle.
   * This private method delegates out to several protected methods which can be defined by the subclass.
   * @param {RenderOptions} [options]             Options which configure application rendering behavior
   * @returns {Promise<ApplicationV2>}            A Promise which resolves to the rendered Application instance
   */
  async #render(options) {
    const states = ApplicationV2.RENDER_STATES;
    if ( !this.#renderable ) throw new Error(`The ${this.constructor.name} Application class is not renderable because`
      + " it does not define the _renderHTML and _replaceHTML methods which are required.");

    // Verify that the Application is allowed to be rendered
    try {
      const canRender = this._canRender(options);
      if ( canRender === false ) return this;
    } catch(err) {
      ui.notifications.warn(err.message);
      return this;
    }
    options.isFirstRender = this.#state <= states.NONE;

    // Prepare rendering context data
    this._configureRenderOptions(options);
    const context = await this._prepareContext(options);

    // Pre-render life-cycle events (awaited)
    if ( options.isFirstRender ) {
      if ( !options.force ) return this;
      await this.#doEvent(this._preFirstRender, {async: true, handlerArgs: [context, options],
        debugText: "Before first render"});
    }
    await this.#doEvent(this._preRender, {async: true, handlerArgs: [context, options],
      debugText: "Before render"});

    // Render the Application frame
    this.#state = states.RENDERING;
    if ( options.isFirstRender ) {
      this.#element = await this._renderFrame(options);
      this.#content = this.hasFrame ? this.#element.querySelector(".window-content") : this.#element;
      this._attachFrameListeners();
    }

    // Render Application content
    try {
      const result = await this._renderHTML(context, options);
      this._replaceHTML(result, this.#content, options);
    }
    catch(err) {
      if ( this.#element ) {
        this.#element.remove();
        this.#element = null;
      }
      this.#state = states.ERROR;
      throw new Error(`Failed to render Application "${this.id}":\n${err.message}`, { cause: err });
    }

    // Register the rendered Application
    if ( options.isFirstRender ) {
      foundry.applications.instances.set(this.#id, this);
      this._insertElement(this.#element);
    }
    if ( this.hasFrame ) this._updateFrame(options);
    this.#state = states.RENDERED;

    // Post-render life-cycle events (not awaited)
    if ( options.isFirstRender ) {
      // noinspection ES6MissingAwait
      this.#doEvent(this._onFirstRender, {handlerArgs: [context, options], debugText: "After first render"});
    }
    // noinspection ES6MissingAwait
    this.#doEvent(this._onRender, {handlerArgs: [context, options], debugText: "After render", eventName: "render",
        hookName: "render", hookArgs: [this.#element]});

    // Update application position
    if ( "position" in options ) this.setPosition(options.position);
    if ( options.force && this.minimized ) this.maximize();
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Modify the provided options passed to a render request.
   * @param {RenderOptions} options                 Options which configure application rendering behavior
   * @protected
   */
  _configureRenderOptions(options) {
    const isFirstRender = this.#state <= ApplicationV2.RENDER_STATES.NONE;
    const {window, position} = this.options;

    // Initial frame options
    if ( isFirstRender ) {
      if ( this.hasFrame ) {
        options.window ||= {};
        options.window.title ||= this.title;
        options.window.icon ||= window.icon;
        options.window.controls = true;
        options.window.resizable = window.resizable;
      }
    }

    // Automatic repositioning
    if ( isFirstRender ) options.position = Object.assign(this.#position, options.position);
    else {
      if ( position.width === "auto" ) options.position = Object.assign({width: "auto"}, options.position);
      if ( position.height === "auto" ) options.position = Object.assign({height: "auto"}, options.position);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare application rendering context data for a given render request.
   * @param {RenderOptions} options                 Options which configure application rendering behavior
   * @returns {Promise<ApplicationRenderContext>}   Context data for the render operation
   * @protected
   */
  async _prepareContext(options) {
    return {};
  }

  /* -------------------------------------------- */

  /**
   * Configure the array of header control menu options
   * @returns {ApplicationHeaderControlsEntry[]}
   * @protected
   */
  _getHeaderControls() {
    return this.options.window.controls || [];
  }

  /* -------------------------------------------- */

  /**
   * Iterate over header control buttons, filtering for controls which are visible for the current client.
   * @returns {Generator<ApplicationHeaderControlsEntry>}
   * @yields {ApplicationHeaderControlsEntry}
   * @protected
   */
  *_headerControlButtons() {
    for ( const control of this._getHeaderControls() ) {
      if ( control.visible === false ) continue;
      yield control;
    }
  }

  /* -------------------------------------------- */

  /**
   * Render an HTMLElement for the Application.
   * An Application subclass must implement this method in order for the Application to be renderable.
   * @param {ApplicationRenderContext} context      Context data for the render operation
   * @param {RenderOptions} options                 Options which configure application rendering behavior
   * @returns {Promise<any>}                        The result of HTML rendering may be implementation specific.
   *                                                Whatever value is returned here is passed to _replaceHTML
   * @abstract
   */
  async _renderHTML(context, options) {}

  /* -------------------------------------------- */

  /**
   * Replace the HTML of the application with the result provided by the rendering backend.
   * An Application subclass should implement this method in order for the Application to be renderable.
   * @param {any} result                            The result returned by the application rendering backend
   * @param {HTMLElement} content                   The content element into which the rendered result must be inserted
   * @param {RenderOptions} options                 Options which configure application rendering behavior
   * @protected
   */
  _replaceHTML(result, content, options) {}

  /* -------------------------------------------- */

  /**
   * Render the outer framing HTMLElement which wraps the inner HTML of the Application.
   * @param {RenderOptions} options                 Options which configure application rendering behavior
   * @returns {Promise<HTMLElement>}
   * @protected
   */
  async _renderFrame(options) {
    const frame = document.createElement(this.options.tag);
    frame.id = this.#id;
    if ( this.options.classes.length ) frame.className = this.options.classes.join(" ");
    if ( !this.hasFrame ) return frame;

    // Window applications
    const labels = {
      controls: game.i18n.localize("APPLICATION.TOOLS.ControlsMenu"),
      toggleControls: game.i18n.localize("APPLICATION.TOOLS.ToggleControls"),
      close: game.i18n.localize("APPLICATION.TOOLS.Close")
    }
    const contentClasses = ["window-content", ...this.options.window.contentClasses].join(" ");
    frame.innerHTML = `<header class="window-header">
      <i class="window-icon hidden"></i>
      <h1 class="window-title"></h1>
      <button type="button" class="header-control fa-solid fa-ellipsis-vertical"
              data-tooltip="${labels.toggleControls}" aria-label="${labels.toggleControls}"
              data-action="toggleControls"></button>
      <button type="button" class="header-control fa-solid fa-times"
              data-tooltip="${labels.close}" aria-label="${labels.close}" data-action="close"></button>
    </header>
    <menu class="controls-dropdown"></menu>
    <${this.options.window.contentTag} class="${contentClasses}"></section>
    ${this.options.window.resizable ? `<div class="window-resize-handle"></div>` : ""}`;

    // Reference elements
    this.#window.header = frame.querySelector(".window-header");
    this.#window.title = frame.querySelector(".window-title");
    this.#window.icon = frame.querySelector(".window-icon");
    this.#window.resize = frame.querySelector(".window-resize-handle");
    this.#window.close = frame.querySelector("button[data-action=close]");
    this.#window.controls = frame.querySelector("button[data-action=toggleControls]");
    this.#window.controlsDropdown = frame.querySelector(".controls-dropdown");
    return frame;
  }

  /* -------------------------------------------- */

  /**
   * Render a header control button.
   * @param {ApplicationHeaderControlsEntry} control
   * @returns {HTMLLIElement}
   * @protected
   */
  _renderHeaderControl(control) {
    const li = document.createElement("li");
    li.className = "header-control";
    li.dataset.action = control.action;
    const label = game.i18n.localize(control.label);
    li.innerHTML = `<button type="button" class="control">
        <i class="control-icon fa-fw ${control.icon}"></i><span class="control-label">${label}</span>
    </button>`;
    return li;
  }

  /* -------------------------------------------- */

  /**
   * When the Application is rendered, optionally update aspects of the window frame.
   * @param {RenderOptions} options               Options provided at render-time
   * @protected
   */
  _updateFrame(options) {
    const window = options.window;
    if ( !window ) return;
    if ( "title" in window ) this.#window.title.innerText = window.title;
    if ( "icon" in window ) this.#window.icon.className = `window-icon fa-fw ${window.icon || "hidden"}`;

    // Window header controls
    if ( "controls" in window ) {
      const controls = [];
      for ( const c of this._headerControlButtons() ) {
        controls.push(this._renderHeaderControl(c));
      }
      this.#window.controlsDropdown.replaceChildren(...controls);
      this.#window.controls.classList.toggle("hidden", !controls.length);
    }
  }

  /* -------------------------------------------- */

  /**
   * Insert the application HTML element into the DOM.
   * Subclasses may override this method to customize how the application is inserted.
   * @param {HTMLElement} element                 The element to insert
   * @protected
   */
  _insertElement(element) {
    const existing = document.getElementById(element.id);
    if ( existing ) existing.replaceWith(element);
    else document.body.append(element);
    element.querySelector("[autofocus]")?.focus();
  }

  /* -------------------------------------------- */
  /*  Closing                                     */
  /* -------------------------------------------- */

  /**
   * Close the Application, removing it from the DOM.
   * @param {ApplicationClosingOptions} [options] Options which modify how the application is closed.
   * @returns {Promise<ApplicationV2>}            A Promise which resolves to the closed Application instance
   */
  async close(options={}) {
    return this.#semaphore.add(this.#close.bind(this), options);
  }

  /* -------------------------------------------- */

  /**
   * Manage the closing step of the Application life-cycle.
   * This private method delegates out to several protected methods which can be defined by the subclass.
   * @param {ApplicationClosingOptions} [options] Options which modify how the application is closed
   * @returns {Promise<ApplicationV2>}            A Promise which resolves to the rendered Application instance
   */
  async #close(options) {
    const states = ApplicationV2.RENDER_STATES;
    if ( !this.#element ) {
      this.#state = states.CLOSED;
      return this;
    }

    // Pre-close life-cycle events (awaited)
    await this.#doEvent(this._preClose, {async: true, handlerArgs: [options], debugText: "Before close"});

    // Set explicit dimensions for the transition.
    if ( options.animate !== false ) {
      const { width, height } = this.#element.getBoundingClientRect();
      this.#applyPosition({ ...this.#position, width, height });
    }

    // Remove the application element
    this.#element.classList.add("minimizing")
    this.#element.style.maxHeight = "0px";
    this.#state = states.CLOSING;
    if ( options.animate !== false ) await this._awaitTransition(this.#element, 1000);

    // Remove the closed element
    this._removeElement(this.#element);
    this.#element = null;
    this.#state = states.CLOSED;
    foundry.applications.instances.delete(this.#id);

    // Reset minimization state
    this.#minimization.active = false;

    // Post-close life-cycle events (not awaited)
    // noinspection ES6MissingAwait
    this.#doEvent(this._onClose, {handlerArgs: [options], debugText: "After close", eventName: "close",
      hookName: "close"});
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Remove the application HTML element from the DOM.
   * Subclasses may override this method to customize how the application element is removed.
   * @param {HTMLElement} element                 The element to be removed
   * @protected
   */
  _removeElement(element) {
    element.remove();
  }

  /* -------------------------------------------- */
  /*  Positioning                                 */
  /* -------------------------------------------- */

  /**
   * Update the Application element position using provided data which is merged with the prior position.
   * @param {Partial<ApplicationPosition>} [position] New Application positioning data
   * @returns {ApplicationPosition}                   The updated application position
   */
  setPosition(position) {
    if ( !this.options.window.positioned ) return;
    position = Object.assign(this.#position, position);
    this.#doEvent(this._prePosition, {handlerArgs: [position], debugText: "Before reposition"});

    // Update resolved position
    const updated = this._updatePosition(position);
    Object.assign(this.#position, updated);

    // Assign CSS styles
    this.#applyPosition(updated);
    this.#doEvent(this._onPosition, {handlerArgs: [position], debugText: "After reposition", eventName: "position"});
    return position;
  }

  /* -------------------------------------------- */

  /**
   * Translate a requested application position updated into a resolved allowed position for the Application.
   * Subclasses may override this method to implement more advanced positioning behavior.
   * @param {ApplicationPosition} position        Requested Application positioning data
   * @returns {ApplicationPosition}               Resolved Application positioning data
   * @protected
   */
  _updatePosition(position) {
    if ( !this.#element ) return position;
    const el = this.#element;
    let {width, height, left, top, scale} = position;
    scale ??= 1.0;
    const computedStyle = getComputedStyle(el);
    let minWidth = ApplicationV2.parseCSSDimension(computedStyle.minWidth, el.parentElement.offsetWidth) || 0;
    let maxWidth = ApplicationV2.parseCSSDimension(computedStyle.maxWidth, el.parentElement.offsetWidth) || Infinity;
    let minHeight = ApplicationV2.parseCSSDimension(computedStyle.minHeight, el.parentElement.offsetHeight) || 0;
    let maxHeight = ApplicationV2.parseCSSDimension(computedStyle.maxHeight, el.parentElement.offsetHeight) || Infinity;
    let bounds = el.getBoundingClientRect();
    const {clientWidth, clientHeight} = document.documentElement;

    // Explicit width
    const autoWidth = width === "auto";
    if ( !autoWidth ) {
      const targetWidth = Number(width || bounds.width);
      minWidth = parseInt(minWidth) || 0;
      maxWidth = parseInt(maxWidth) || (clientWidth / scale);
      width = Math.clamp(targetWidth, minWidth, maxWidth);
    }

    // Explicit height
    const autoHeight = height === "auto";
    if ( !autoHeight ) {
      const targetHeight = Number(height || bounds.height);
      minHeight = parseInt(minHeight) || 0;
      maxHeight = parseInt(maxHeight) || (clientHeight / scale);
      height = Math.clamp(targetHeight, minHeight, maxHeight);
    }

    // Implicit height
    if ( autoHeight ) {
      Object.assign(el.style, {width: `${width}px`, height: ""});
      bounds = el.getBoundingClientRect();
      height = bounds.height;
    }

    // Implicit width
    if ( autoWidth ) {
      Object.assign(el.style, {height: `${height}px`, width: ""});
      bounds = el.getBoundingClientRect();
      width = bounds.width;
    }

    // Left Offset
    const scaledWidth = width * scale;
    const targetLeft = left ?? ((clientWidth - scaledWidth) / 2);
    const maxLeft = Math.max(clientWidth - scaledWidth, 0);
    left = Math.clamp(targetLeft, 0, maxLeft);

    // Top Offset
    const scaledHeight = height * scale;
    const targetTop = top ?? ((clientHeight - scaledHeight) / 2);
    const maxTop = Math.max(clientHeight - scaledHeight, 0);
    top = Math.clamp(targetTop, 0, maxTop);

    // Scale
    scale ??= 1.0;
    return {width: autoWidth ? "auto" : width, height: autoHeight ? "auto" : height, left, top, scale};
  }

  /* -------------------------------------------- */

  /**
   * Apply validated position changes to the element.
   * @param {ApplicationPosition} position  The new position data to apply.
   */
  #applyPosition(position) {
    Object.assign(this.#element.style, {
      width: position.width === "auto" ? "" : `${position.width}px`,
      height: position.height === "auto" ? "" : `${position.height}px`,
      left: `${position.left}px`,
      top: `${position.top}px`,
      transform: position.scale === 1 ? "" : `scale(${position.scale})`
    });
  }

  /* -------------------------------------------- */
  /*  Other Public Methods                        */
  /* -------------------------------------------- */

  /**
   * Is the window control buttons menu currently expanded?
   * @type {boolean}
   */
  #controlsExpanded = false;

  /**
   * Toggle display of the Application controls menu.
   * Only applicable to window Applications.
   * @param {boolean} [expanded]      Set the controls visibility to a specific state.
   *                                  Otherwise, the visible state is toggled from its current value
   */
  toggleControls(expanded) {
    expanded ??= !this.#controlsExpanded;
    if ( expanded === this.#controlsExpanded ) return;
    const dropdown = this.#element.querySelector(".controls-dropdown")
    dropdown.classList.toggle("expanded", expanded);
    this.#controlsExpanded = expanded;
    game.tooltip.deactivate();
  }

  /* -------------------------------------------- */

  /**
   * Minimize the Application, collapsing it to a minimal header.
   * @returns {Promise<void>}
   */
  async minimize() {
    if ( this.minimized || !this.hasFrame || !this.options.window.minimizable ) return;
    this.#minimization.active = true;

    // Set explicit dimensions for the transition.
    const { width, height } = this.#element.getBoundingClientRect();
    this.#applyPosition({ ...this.#position, width, height });

    // Record pre-minimization data
    this.#minimization.priorWidth = this.#position.width;
    this.#minimization.priorHeight = this.#position.height;
    this.#minimization.priorBoundingWidth = width;
    this.#minimization.priorBoundingHeight = height;

    // Animate to collapsed size
    this.#element.classList.add("minimizing");
    this.#element.style.maxWidth = "var(--minimized-width)";
    this.#element.style.maxHeight = "var(--header-height)";
    await this._awaitTransition(this.#element, 1000);
    this.#element.classList.add("minimized");
    this.#element.classList.remove("minimizing");
  }

  /* -------------------------------------------- */

  /**
   * Restore the Application to its original dimensions.
   * @returns {Promise<void>}
   */
  async maximize() {
    if ( !this.minimized ) return;
    this.#minimization.active = false;

    // Animate back to full size
    const { priorBoundingWidth: width, priorBoundingHeight: height } = this.#minimization;
    this.#element.classList.remove("minimized");
    this.#element.classList.add("maximizing");
    this.#element.style.maxWidth = "";
    this.#element.style.maxHeight = "";
    this.#applyPosition({ ...this.#position, width, height });
    await this._awaitTransition(this.#element, 1000);
    this.#element.classList.remove("maximizing");

    // Restore the application position
    this._updatePosition(Object.assign(this.#position, {
      width: this.#minimization.priorWidth,
      height: this.#minimization.priorHeight
    }));
  }

  /* -------------------------------------------- */

  /**
   * Bring this Application window to the front of the rendering stack by increasing its z-index.
   * Once ApplicationV1 is deprecated we should switch from _maxZ to ApplicationV2#maxZ
   * We should also eliminate ui.activeWindow in favor of only ApplicationV2#frontApp
   */
  bringToFront() {
    if ( !((ApplicationV2.#frontApp === this) && (ui.activeWindow === this)) ) this.#position.zIndex = ++_maxZ;
    this.#element.style.zIndex = String(this.#position.zIndex);
    ApplicationV2.#frontApp = this;
    ui.activeWindow = this; // ApplicationV1 compatibility
  }

  /* -------------------------------------------- */

  /**
   * Change the active tab within a tab group in this Application instance.
   * @param {string} tab        The name of the tab which should become active
   * @param {string} group      The name of the tab group which defines the set of tabs
   * @param {object} [options]  Additional options which affect tab navigation
   * @param {Event} [options.event]                 An interaction event which caused the tab change, if any
   * @param {HTMLElement} [options.navElement]      An explicit navigation element being modified
   * @param {boolean} [options.force=false]         Force changing the tab even if the new tab is already active
   * @param {boolean} [options.updatePosition=true] Update application position after changing the tab?
   */
  changeTab(tab, group, {event, navElement, force=false, updatePosition=true}={}) {
    if ( !tab || !group ) throw new Error("You must pass both the tab and tab group identifier");
    if ( (this.tabGroups[group] === tab) && !force ) return;  // No change necessary
    const tabElement = this.#content.querySelector(`.tabs > [data-group="${group}"][data-tab="${tab}"]`);
    if ( !tabElement ) throw new Error(`No matching tab element found for group "${group}" and tab "${tab}"`);

    // Update tab navigation
    for ( const t of this.#content.querySelectorAll(`.tabs > [data-group="${group}"]`) ) {
      t.classList.toggle("active", t.dataset.tab === tab);
    }

    // Update tab contents
    for ( const section of this.#content.querySelectorAll(`.tab[data-group="${group}"]`) ) {
      section.classList.toggle("active", section.dataset.tab === tab);
    }
    this.tabGroups[group] = tab;

    // Update automatic width or height
    if ( !updatePosition ) return;
    const positionUpdate = {};
    if ( this.options.position.width === "auto" ) positionUpdate.width = "auto";
    if ( this.options.position.height === "auto" ) positionUpdate.height = "auto";
    if ( !foundry.utils.isEmpty(positionUpdate) ) this.setPosition(positionUpdate);
  }

  /* -------------------------------------------- */
  /*  Life-Cycle Handlers                         */
  /* -------------------------------------------- */

  /**
   * Perform an event in the application life-cycle.
   * Await an internal life-cycle method defined by the class.
   * Optionally dispatch an event for any registered listeners.
   * @param {Function} handler        A handler function to call
   * @param {object} options          Options which configure event handling
   * @param {boolean} [options.async]         Await the result of the handler function?
   * @param {any[]} [options.handlerArgs]     Arguments passed to the handler function
   * @param {string} [options.debugText]      Debugging text to log for the event
   * @param {string} [options.eventName]      An event name to dispatch for registered listeners
   * @param {string} [options.hookName]       A hook name to dispatch for this and all parent classes
   * @param {any[]} [options.hookArgs]        Arguments passed to the requested hook function
   * @returns {Promise<void>}         A promise which resoles once the handler is complete
   */
  async #doEvent(handler, {async=false, handlerArgs, debugText, eventName, hookName, hookArgs=[]}={}) {

    // Debug logging
    if ( debugText && CONFIG.debug.applications ) {
      console.debug(`${this.constructor.name} | ${debugText}`);
    }

    // Call handler function
    const response = handler.call(this, ...handlerArgs);
    if ( async ) await response;

    // Dispatch event for this Application instance
    if ( eventName ) this.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true }));

    // Call hooks for this Application class
    if ( hookName ) {
      for ( const cls of this.constructor.inheritanceChain() ) {
        if ( !cls.name ) continue;
        Hooks.callAll(`${hookName}${cls.name}`, this, ...hookArgs);
      }
    }
    return response;
  }

  /* -------------------------------------------- */
  /*  Rendering Life-Cycle Methods                */
  /* -------------------------------------------- */

  /**
   * Test whether this Application is allowed to be rendered.
   * @param {RenderOptions} options                 Provided render options
   * @returns {false|void}                          Return false to prevent rendering
   * @throws {Error}                                An Error to display a warning message
   * @protected
   */
  _canRender(options) {}

  /**
   * Actions performed before a first render of the Application.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @returns {Promise<void>}
   * @protected
   */
  async _preFirstRender(context, options) {}

  /**
   * Actions performed after a first render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onFirstRender(context, options) {}

  /**
   * Actions performed before any render of the Application.
   * Pre-render steps are awaited by the render process.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @returns {Promise<void>}
   * @protected
   */
  async _preRender(context, options) {}

  /**
   * Actions performed after any render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onRender(context, options) {}

  /**
   * Actions performed before closing the Application.
   * Pre-close steps are awaited by the close process.
   * @param {RenderOptions} options                 Provided render options
   * @returns {Promise<void>}
   * @protected
   */
  async _preClose(options) {}

  /**
   * Actions performed after closing the Application.
   * Post-close steps are not awaited by the close process.
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onClose(options) {}

  /**
   * Actions performed before the Application is re-positioned.
   * Pre-position steps are not awaited because setPosition is synchronous.
   * @param {ApplicationPosition} position          The requested application position
   * @protected
   */
  _prePosition(position) {}

  /**
   * Actions performed after the Application is re-positioned.
   * @param {ApplicationPosition} position          The requested application position
   * @protected
   */
  _onPosition(position) {}

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Attach event listeners to the Application frame.
   * @protected
   */
  _attachFrameListeners() {

    // Application Click Events
    this.#element.addEventListener("pointerdown", this.#onPointerDown.bind(this), {capture: true});
    const click = this.#onClick.bind(this);
    this.#element.addEventListener("click", click);
    this.#element.addEventListener("contextmenu", click);

    if ( this.hasFrame ) {
      this.bringToFront();
      this.#window.header.addEventListener("pointerdown", this.#onWindowDragStart.bind(this));
      this.#window.header.addEventListener("dblclick", this.#onWindowDoubleClick.bind(this));
      this.#window.resize?.addEventListener("pointerdown", this.#onWindowResizeStart.bind(this));
    }

    // Form handlers
    if ( this.options.tag === "form" ) {
      this.#element.addEventListener("submit", this._onSubmitForm.bind(this, this.options.form));
      this.#element.addEventListener("change", this._onChangeForm.bind(this, this.options.form));
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle initial pointerdown events inside a rendered Application.
   * @param {PointerEvent} event
   */
  async #onPointerDown(event) {
    if ( this.hasFrame ) this.bringToFront();
  }

  /* -------------------------------------------- */

  /**
   * Centralized handling of click events which occur on or within the Application frame.
   * @param {PointerEvent} event
   */
  async #onClick(event) {
    const target = event.target;
    const actionButton = target.closest("[data-action]");
    if ( actionButton ) return this.#onClickAction(event, actionButton);
  }

  /* -------------------------------------------- */

  /**
   * Handle a click event on an element which defines a [data-action] handler.
   * @param {PointerEvent} event      The originating click event
   * @param {HTMLElement} target      The capturing HTML element which defined a [data-action]
   */
  #onClickAction(event, target) {
    const action = target.dataset.action;
    switch ( action ) {
      case "close":
        event.stopPropagation();
        if ( event.button === 0 ) this.close();
        break;
      case "tab":
        if ( event.button === 0 ) this.#onClickTab(event);
        break;
      case "toggleControls":
        event.stopPropagation();
        if ( event.button === 0 ) this.toggleControls();
        break;
      default:
        let handler = this.options.actions[action];

        // No defined handler
        if ( !handler ) {
          this._onClickAction(event, target);
          break;
        }

        // Defined handler
        let buttons = [0];
        if ( typeof handler === "object" ) {
          buttons = handler.buttons;
          handler = handler.handler;
        }
        if ( buttons.includes(event.button) ) handler?.call(this, event, target);
        break;
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle click events on a tab within the Application.
   * @param {PointerEvent} event
   */
  #onClickTab(event) {
    const button = event.target;
    const tab = button.dataset.tab;
    if ( !tab || button.classList.contains("active") ) return;
    const group = button.dataset.group;
    const navElement = button.closest(".tabs");
    this.changeTab(tab, group, {event, navElement});
  }

  /* -------------------------------------------- */

  /**
   * A generic event handler for action clicks which can be extended by subclasses.
   * Action handlers defined in DEFAULT_OPTIONS are called first. This method is only called for actions which have
   * no defined handler.
   * @param {PointerEvent} event      The originating click event
   * @param {HTMLElement} target      The capturing HTML element which defined a [data-action]
   * @protected
   */
  _onClickAction(event, target) {}

  /* -------------------------------------------- */

  /**
   * Begin capturing pointer events on the application frame.
   * @param {PointerEvent} event  The triggering event.
   * @param {function} callback   The callback to attach to pointer move events.
   */
  #startPointerCapture(event, callback) {
    this.#window.pointerStartPosition = Object.assign(foundry.utils.deepClone(this.#position), {
      clientX: event.clientX, clientY: event.clientY
    });
    this.#element.addEventListener("pointermove", callback, { passive: true });
    this.#element.addEventListener("pointerup", event => this.#endPointerCapture(event, callback), {
      capture: true, once: true
    });
  }

  /* -------------------------------------------- */

  /**
   * End capturing pointer events on the application frame.
   * @param {PointerEvent} event  The triggering event.
   * @param {function} callback   The callback to remove from pointer move events.
   */
  #endPointerCapture(event, callback) {
    this.#element.releasePointerCapture(event.pointerId);
    this.#element.removeEventListener("pointermove", callback);
    delete this.#window.pointerStartPosition;
    this.#window.pointerMoveThrottle = false;
  }

  /* -------------------------------------------- */

  /**
   * Handle a pointer move event while dragging or resizing the window frame.
   * @param {PointerEvent} event
   * @returns {{dx: number, dy: number}|void}  The amount the cursor has moved since the last frame, or undefined if
   *                                           the movement occurred between frames.
   */
  #onPointerMove(event) {
    if ( this.#window.pointerMoveThrottle ) return;
    this.#window.pointerMoveThrottle = true;
    const dx = event.clientX - this.#window.pointerStartPosition.clientX;
    const dy = event.clientY - this.#window.pointerStartPosition.clientY;
    requestAnimationFrame(() => this.#window.pointerMoveThrottle = false);
    return { dx, dy };
  }

  /* -------------------------------------------- */

  /**
   * Begin dragging the Application position.
   * @param {PointerEvent} event
   */
  #onWindowDragStart(event) {
    if ( event.target.closest(".header-control") ) return;
    this.#endPointerCapture(event, this.#window.onDrag);
    this.#startPointerCapture(event, this.#window.onDrag);
  }

  /* -------------------------------------------- */

  /**
   * Begin resizing the Application.
   * @param {PointerEvent} event
   */
  #onWindowResizeStart(event) {
    this.#endPointerCapture(event, this.#window.onResize);
    this.#startPointerCapture(event, this.#window.onResize);
  }

  /* -------------------------------------------- */

  /**
   * Drag the Application position during mouse movement.
   * @param {PointerEvent} event
   */
  #onWindowDragMove(event) {
    if ( !this.#window.header.hasPointerCapture(event.pointerId) ) {
      this.#window.header.setPointerCapture(event.pointerId);
    }
    const delta = this.#onPointerMove(event);
    if ( !delta ) return;
    const { pointerStartPosition } = this.#window;
    let { top, left, height, width } = pointerStartPosition;
    left += delta.dx;
    top += delta.dy;
    this.setPosition({ top, left, height, width });
  }

  /* -------------------------------------------- */

  /**
   * Resize the Application during mouse movement.
   * @param {PointerEvent} event
   */
  #onWindowResizeMove(event) {
    if ( !this.#window.resize.hasPointerCapture(event.pointerId) ) {
      this.#window.resize.setPointerCapture(event.pointerId);
    }
    const delta = this.#onPointerMove(event);
    if ( !delta ) return;
    const { scale } = this.#position;
    const { pointerStartPosition } = this.#window;
    let { top, left, height, width } = pointerStartPosition;
    if ( width !== "auto" ) width += delta.dx / scale;
    if ( height !== "auto" ) height += delta.dy / scale;
    this.setPosition({ top, left, width, height });
  }

  /* -------------------------------------------- */

  /**
   * Double-click events on the window title are used to minimize or maximize the application.
   * @param {PointerEvent} event
   */
  #onWindowDoubleClick(event) {
    event.preventDefault();
    if ( event.target.dataset.action ) return; // Ignore double clicks on buttons which perform an action
    if ( !this.options.window.minimizable ) return;
    if ( this.minimized ) this.maximize();
    else this.minimize();
  }

  /* -------------------------------------------- */

  /**
   * Handle submission for an Application which uses the form element.
   * @param {ApplicationFormConfiguration} formConfig     The form configuration for which this handler is bound
   * @param {Event|SubmitEvent} event                     The form submission event
   * @returns {Promise<void>}
   * @protected
   */
  async _onSubmitForm(formConfig, event) {
    event.preventDefault();
    const form = event.currentTarget;
    const {handler, closeOnSubmit} = formConfig;
    const formData = new FormDataExtended(form);
    if ( handler instanceof Function ) {
      try {
        await handler.call(this, event, form, formData);
      } catch(err){
        ui.notifications.error(err, {console: true});
        return; // Do not close
      }
    }
    if ( closeOnSubmit ) await this.close();
  }

  /* -------------------------------------------- */

  /**
   * Handle changes to an input element within the form.
   * @param {ApplicationFormConfiguration} formConfig     The form configuration for which this handler is bound
   * @param {Event} event                                 An input change event within the form
   */
  _onChangeForm(formConfig, event) {
    if ( formConfig.submitOnChange ) this._onSubmitForm(formConfig, event);
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Parse a CSS style rule into a number of pixels which apply to that dimension.
   * @param {string} style            The CSS style rule
   * @param {number} parentDimension  The relevant dimension of the parent element
   * @returns {number}                The parsed style dimension in pixels
   */
  static parseCSSDimension(style, parentDimension) {
    if ( style.includes("px") ) return parseInt(style.replace("px", ""));
    if ( style.includes("%") ) {
      const p = parseInt(style.replace("%", "")) / 100;
      return parentDimension * p;
    }
  }

  /* -------------------------------------------- */

  /**
   * Wait for a CSS transition to complete for an element.
   * @param {HTMLElement} element         The element which is transitioning
   * @param {number} timeout              A timeout in milliseconds in case the transitionend event does not occur
   * @returns {Promise<void>}
   * @internal
   */
  async _awaitTransition(element, timeout) {
    return Promise.race([
      new Promise(resolve => element.addEventListener("transitionend", resolve, {once: true})),
      new Promise(resolve => window.setTimeout(resolve, timeout))
    ]);
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  bringToTop() {
    foundry.utils.logCompatibilityWarning(`ApplicationV2#bringToTop is not a valid function and redirects to 
      ApplicationV2#bringToFront. This shim will be removed in v14.`, {since: 12, until: 14});
    return this.bringToFront();
  }
}
