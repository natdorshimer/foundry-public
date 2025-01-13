import AbstractFormInputElement from "./form-element.mjs";

/**
 * @typedef {import("../forms/fields.mjs").FormInputConfig} FormInputConfig
 */

/**
 * @typedef {Object} StringTagsInputConfig
 * @property {boolean} slug               Automatically slugify provided strings?
 */

/**
 * A custom HTML element which allows for arbitrary assignment of a set of string tags.
 * This element may be used directly or subclassed to impose additional validation or functionality.
 * @extends {AbstractFormInputElement<Set<string>>}
 */
export default class HTMLStringTagsElement extends AbstractFormInputElement {
  constructor() {
    super();
    this.#slug = this.hasAttribute("slug");
    this._value = new Set();
    this._initializeTags();
  }

  /** @override */
  static tagName = "string-tags";

  static icons = {
    add: "fa-solid fa-tag",
    remove: "fa-solid fa-times"
  }

  static labels = {
    add: "ELEMENTS.TAGS.Add",
    remove: "ELEMENTS.TAGS.Remove",
    placeholder: ""
  }

  /**
   * The button element to add a new tag.
   * @type {HTMLButtonElement}
   */
  #button;

  /**
   * The input element to enter a new tag.
   * @type {HTMLInputElement}
   */
  #input;

  /**
   * The tags list of assigned tags.
   * @type {HTMLDivElement}
   */
  #tags;

  /**
   * Automatically slugify all strings provided to the element?
   * @type {boolean}
   */
  #slug;

  /* -------------------------------------------- */

  /**
   * Initialize innerText or an initial value attribute of the element as a comma-separated list of currently assigned
   * string tags.
   * @protected
   */
  _initializeTags() {
    const initial = this.getAttribute("value") || this.innerText || "";
    const tags = initial ? initial.split(",") : [];
    for ( let tag of tags ) {
      tag = tag.trim();
      if ( tag ) {
        if ( this.#slug ) tag = tag.slugify({strict: true});
        try {
          this._validateTag(tag);
        } catch ( err ) {
          console.warn(err.message);
          continue;
        }
        this._value.add(tag);
      }
    }
    this.innerText = "";
    this.removeAttribute("value");
  }

  /* -------------------------------------------- */

  /**
   * Subclasses may impose more strict validation on what tags are allowed.
   * @param {string} tag      A candidate tag
   * @throws {Error}          An error if the candidate tag is not allowed
   * @protected
   */
  _validateTag(tag) {
    if ( !tag ) throw new Error(game.i18n.localize("ELEMENTS.TAGS.ErrorBlank"));
  }

  /* -------------------------------------------- */

  /** @override */
  _buildElements() {

    // Create tags list
    const tags = document.createElement("div");
    tags.className = "tags input-element-tags";
    this.#tags = tags;

    // Create input element
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = game.i18n.localize(this.constructor.labels.placeholder);
    this.#input = this._primaryInput = input;

    // Create button
    const button = document.createElement("button");
    button.type = "button"
    button.className = `icon ${this.constructor.icons.add}`;
    button.dataset.tooltip = this.constructor.labels.add;
    button.ariaLabel = game.i18n.localize(this.constructor.labels.add);
    this.#button = button;
    return [this.#tags, this.#input, this.#button];
  }

  /* -------------------------------------------- */

  /** @override */
  _refresh() {
    const tags = this.value.map(tag => this.constructor.renderTag(tag, tag, this.editable));
    this.#tags.replaceChildren(...tags);
  }

  /* -------------------------------------------- */

  /**
   * Render the tagged string as an HTML element.
   * @param {string} tag        The raw tag value
   * @param {string} [label]    An optional tag label
   * @param {boolean} [editable=true]  Is the tag editable?
   * @returns {HTMLDivElement}  A rendered HTML element for the tag
   */
  static renderTag(tag, label, editable=true) {
    const div = document.createElement("div");
    div.className = "tag";
    div.dataset.key = tag;
    const span = document.createElement("span");
    span.textContent = label ?? tag;
    div.append(span);
    if ( editable ) {
      const t = game.i18n.localize(this.labels.remove);
      const a = `<a class="remove ${this.icons.remove}" data-tooltip="${t}" aria-label="${t}"></a>`;
      div.insertAdjacentHTML("beforeend", a);
    }
    return div;
  }

  /* -------------------------------------------- */

  /** @override */
  _activateListeners() {
    this.#button.addEventListener("click", this.#addTag.bind(this));
    this.#tags.addEventListener("click", this.#onClickTag.bind(this));
    this.#input.addEventListener("keydown", this.#onKeydown.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Remove a tag from the set when its removal button is clicked.
   * @param {PointerEvent} event
   */
  #onClickTag(event) {
    if ( !event.target.classList.contains("remove") ) return;
    const tag = event.target.closest(".tag");
    this._value.delete(tag.dataset.key);
    this.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    this._refresh();
  }

  /* -------------------------------------------- */

  /**
   * Add a tag to the set when the ENTER key is pressed in the text input.
   * @param {KeyboardEvent} event
   */
  #onKeydown(event) {
    if ( event.key !== "Enter" ) return;
    event.preventDefault();
    event.stopPropagation();
    this.#addTag();
  }

  /* -------------------------------------------- */

  /**
   * Add a new tag to the set upon user input.
   */
  #addTag() {
    let tag = this.#input.value.trim();
    if ( this.#slug ) tag = tag.slugify({strict: true});

    // Validate the proposed code
    try {
      this._validateTag(tag);
    } catch(err) {
      ui.notifications.error(err.message);
      this.#input.value = "";
      return;
    }

    // Ensure uniqueness
    if ( this._value.has(tag) ) {
      const message = game.i18n.format("ELEMENTS.TAGS.ErrorNonUnique", {tag});
      ui.notifications.error(message);
      this.#input.value = "";
      return;
    }

    // Add hex
    this._value.add(tag);
    this.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    this.#input.value = "";
    this._refresh();
  }

  /* -------------------------------------------- */
  /*  Form Handling                               */
  /* -------------------------------------------- */

  /** @override */
  _getValue() {
    return Array.from(this._value);
  }

  /* -------------------------------------------- */

  /** @override */
  _setValue(value) {
    this._value.clear();
    const toAdd = [];
    for ( let v of value ) {
      if ( this.#slug ) v = v.slugify({strict: true});
      this._validateTag(v);
      toAdd.push(v);
    }
    for ( const v of toAdd ) this._value.add(v);
  }

  /* -------------------------------------------- */

  /** @override */
  _toggleDisabled(disabled) {
    this.#input.toggleAttribute("disabled", disabled);
    this.#button.toggleAttribute("disabled", disabled);
  }

  /* -------------------------------------------- */

  /**
   * Create a HTMLStringTagsElement using provided configuration data.
   * @param {FormInputConfig & StringTagsInputConfig} config
   */
  static create(config) {
    const tags = document.createElement(this.tagName);
    tags.name = config.name;
    const value = Array.from(config.value || []).join(",");
    tags.toggleAttribute("slug", !!config.slug)
    tags.setAttribute("value", value);
    foundry.applications.fields.setInputAttributes(tags, config);
    return tags;
  }
}
