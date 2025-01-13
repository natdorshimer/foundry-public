import AbstractFormInputElement from "./form-element.mjs";

/**
 * @typedef {import("../forms/fields.mjs").FormInputConfig} FormInputConfig
 */

/**
 * A custom HTMLElement used to select a color using a linked pair of input fields.
 * @extends {AbstractFormInputElement<string>}
 */
export default class HTMLColorPickerElement extends AbstractFormInputElement {
  constructor() {
    super();
    this._setValue(this.getAttribute("value")); // Initialize existing color value
  }

  /** @override */
  static tagName = "color-picker";

  /* -------------------------------------------- */

  /**
   * The button element to add a new document.
   * @type {HTMLInputElement}
   */
  #colorSelector;

  /**
   * The input element to define a Document UUID.
   * @type {HTMLInputElement}
   */
  #colorString;

  /* -------------------------------------------- */

  /** @override */
  _buildElements() {

    // Create string input element
    this.#colorString = this._primaryInput = document.createElement("input");
    this.#colorString.type = "text";
    this.#colorString.placeholder = this.getAttribute("placeholder") || "";
    this._applyInputAttributes(this.#colorString);

    // Create color selector element
    this.#colorSelector = document.createElement("input");
    this.#colorSelector.type = "color";
    this._applyInputAttributes(this.#colorSelector);
    return [this.#colorString, this.#colorSelector];
  }

  /* -------------------------------------------- */

  /** @override */
  _refresh() {
    if ( !this.#colorString ) return; // Not yet connected
    this.#colorString.value = this._value;
    this.#colorSelector.value = this._value || this.#colorString.placeholder || "#000000";
  }

  /* -------------------------------------------- */

  /** @override */
  _activateListeners() {
    const onChange = this.#onChangeInput.bind(this);
    this.#colorString.addEventListener("change", onChange);
    this.#colorSelector.addEventListener("change", onChange);
  }

  /* -------------------------------------------- */

  /**
   * Handle changes to one of the inputs of the color picker element.
   * @param {InputEvent} event     The originating input change event
   */
  #onChangeInput(event) {
    event.stopPropagation();
    this.value = event.currentTarget.value;
  }

  /* -------------------------------------------- */

  /** @override */
  _toggleDisabled(disabled) {
    this.#colorString.toggleAttribute("disabled", disabled);
    this.#colorSelector.toggleAttribute("disabled", disabled);
  }

  /* -------------------------------------------- */

  /**
   * Create a HTMLColorPickerElement using provided configuration data.
   * @param {FormInputConfig} config
   * @returns {HTMLColorPickerElement}
   */
  static create(config) {
    const picker = document.createElement(HTMLColorPickerElement.tagName);
    picker.name = config.name;
    picker.setAttribute("value", config.value ?? "");
    foundry.applications.fields.setInputAttributes(picker, config);
    return picker;
  }
}
