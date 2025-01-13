import AbstractFormInputElement from "./form-element.mjs";

/**
 * @typedef {import("../forms/fields.mjs").FormInputConfig} FormInputConfig
 */

/**
 * @typedef {Object} ProseMirrorInputConfig
 * @property {boolean} toggled            Is this editor toggled (true) or always active (false)
 * @property {string} [enriched]          If the editor is toggled, provide the enrichedHTML which is displayed while
 *                                        the editor is not active.
 * @property {boolean} collaborate        Does this editor instance support collaborative editing?
 * @property {boolean} compact            Should the editor be presented in compact mode?
 * @property {string} documentUUID        A Document UUID. Required for collaborative editing
 */

/**
 * A custom HTML element responsible displaying a ProseMirror rich text editor.
 * @extends {AbstractFormInputElement<string>}
 */
export default class HTMLProseMirrorElement extends AbstractFormInputElement {
  constructor() {
    super();

    // Initialize raw content
    this._setValue(this.getAttribute("value") || "");
    this.removeAttribute("value");

    // Initialize enriched content
    this.#toggled = this.hasAttribute("toggled");
    this.#enriched = this.innerHTML;
  }

  /** @override */
  static tagName = "prose-mirror";

  /**
   * Is the editor in active edit mode?
   * @type {boolean}
   */
  #active = false;

  /**
   * The ProseMirror editor instance.
   * @type {ProseMirrorEditor}
   */
  #editor;

  /**
   * Current editor contents
   * @type {HTMLDivElement}
   */
  #content;

  /**
   * Does this editor function via a toggle button? Or is it always active?
   * @type {boolean}
   */
  #toggled;

  /**
   * Enriched content which is optionally used if the editor is toggled.
   * @type {string}
   */
  #enriched;

  /**
   * An optional edit button which activates edit mode for the editor
   * @type {HTMLButtonElement|null}
   */
  #button = null;

  /* -------------------------------------------- */

  /**
   * Actions to take when the custom element is removed from the document.
   */
  disconnectedCallback() {
    this.#editor?.destroy();
  }

  /* -------------------------------------------- */

  /** @override */
  _buildElements() {
    this.classList.add("editor", "prosemirror", "inactive");
    const elements = [];
    this.#content = document.createElement("div");
    this.#content.className = "editor-content";
    elements.push(this.#content);
    if ( this.#toggled ) {
      this.#button = document.createElement("button");
      this.#button.type = "button";
      this.#button.className = "icon toggle";
      this.#button.innerHTML = `<i class="fa-solid fa-edit"></i>`;
      elements.push(this.#button);
    }
    return elements;
  }

  /* -------------------------------------------- */

  /** @override */
  _refresh() {
    if ( this.#active ) return; // It is not safe to replace the content while the editor is active
    if ( this.#toggled ) this.#content.innerHTML = this.#enriched ?? this._value;
    else this.#content.innerHTML = this._value;
  }

  /* -------------------------------------------- */

  /** @override */
  _activateListeners() {
    if ( this.#toggled ) this.#button.addEventListener("click", this.#onClickButton.bind(this));
    else this.#activateEditor();
  }

  /* -------------------------------------------- */

  /** @override */
  _getValue() {
    if ( this.#active ) return ProseMirror.dom.serializeString(this.#editor.view.state.doc.content);
    return this._value;
  }

  /* -------------------------------------------- */

  /**
   * Activate the ProseMirror editor.
   * @returns {Promise<void>}
   */
  async #activateEditor() {

    // If the editor was toggled, replace with raw editable content
    if ( this.#toggled ) this.#content.innerHTML = this._value;

    // Create the TextEditor instance
    const document = await fromUuid(this.dataset.documentUuid ?? this.dataset.documentUUID);
    this.#editor = await TextEditor.create({
      engine: "prosemirror",
      plugins: this._configurePlugins(),
      fieldName: this.name,
      collaborate: this.hasAttribute("collaborate"),
      target: this.#content,
      document
    }, this._getValue());

    // Toggle active state
    this.#active = true;
    if ( this.#button ) this.#button.disabled = true;
    this.classList.add("active");
    this.classList.remove("inactive");
  }

  /* -------------------------------------------- */

  /**
   * Configure ProseMirror editor plugins.
   * @returns {Record<string, ProseMirror.Plugin>}
   * @protected
   */
  _configurePlugins() {
    return {
      menu: ProseMirror.ProseMirrorMenu.build(ProseMirror.defaultSchema, {
        compact: this.hasAttribute("compact"),
        destroyOnSave: this.#toggled,
        onSave: this.#save.bind(this)
      }),
      keyMaps: ProseMirror.ProseMirrorKeyMaps.build(ProseMirror.defaultSchema, {
        onSave: this.#save.bind(this)
      })
    };
  }

  /* -------------------------------------------- */

  /**
   * Handle clicking the editor activation button.
   * @param {PointerEvent} event  The triggering event.
   */
  #onClickButton(event) {
    event.preventDefault();
    this.#activateEditor();
  }

  /* -------------------------------------------- */

  /**
   * Handle saving the editor content.
   * Store new parsed HTML into the _value attribute of the element.
   * If the editor is toggled, also deactivate editing mode.
   */
  #save() {
    const value = ProseMirror.dom.serializeString(this.#editor.view.state.doc.content);
    if ( value !== this._value ) {
      this._setValue(value);
      this.dispatchEvent(new Event("change", {bubbles: true, cancelable: true}));
    }

    // Deactivate a toggled editor
    if ( this.#toggled ) {
      this.#button.disabled = this.disabled;
      this.#active = false;
      this.#editor.destroy();
      this.classList.remove("active");
      this.classList.add("inactive");
      this.replaceChildren(this.#button, this.#content);
      this._refresh();
      this.dispatchEvent(new Event("close", {bubbles: true, cancelable: true}));
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _toggleDisabled(disabled) {
    if ( this.#toggled ) this.#button.disabled = disabled;
  }

  /* -------------------------------------------- */

  /**
   * Create a HTMLProseMirrorElement using provided configuration data.
   * @param {FormInputConfig & ProseMirrorInputConfig} config
   * @returns {HTMLProseMirrorElement}
   */
  static create(config) {
    const editor = document.createElement(HTMLProseMirrorElement.tagName);
    editor.name = config.name;

    // Configure editor properties
    editor.toggleAttribute("collaborate", config.collaborate ?? false);
    editor.toggleAttribute("compact", config.compact ?? false);
    editor.toggleAttribute("toggled", config.toggled ?? false);
    if ( "documentUUID" in config ) Object.assign(editor.dataset, {
      documentUuid: config.documentUUID,
      documentUUID: config.documentUUID
    });
    if ( Number.isNumeric(config.height) ) editor.style.height = `${config.height}px`;

    // Un-enriched content gets temporarily assigned to the value property of the element
    editor.setAttribute("value", config.value);

    // Enriched content gets temporarily assigned as the innerHTML of the element
    if ( config.toggled && config.enriched ) editor.innerHTML = config.enriched;
    return editor;
  }
}
