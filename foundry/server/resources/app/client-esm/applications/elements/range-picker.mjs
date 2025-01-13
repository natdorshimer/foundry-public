import AbstractFormInputElement from "./form-element.mjs";

/**
 * @typedef {import("../forms/fields.mjs").FormInputConfig} FormInputConfig
 */

/**
 * @typedef {Object} RangePickerInputConfig
 * @property {number} min
 * @property {number} max
 * @property {number} [step]
 */

/**
 * A custom HTML element responsible selecting a value on a range slider with a linked number input field.
 * @extends {AbstractFormInputElement<number>}
 */
export default class HTMLRangePickerElement extends AbstractFormInputElement {
  constructor() {
    super();
    this.#min = Number(this.getAttribute("min")) ?? 0;
    this.#max = Number(this.getAttribute("max")) ?? 1;
    this.#step = Number(this.getAttribute("step")) || undefined;
    this._setValue(Number(this.getAttribute("value"))); // Initialize existing value
  }

  /** @override */
  static tagName = "range-picker";

  /**
   * The range input.
   * @type {HTMLInputElement}
   */
  #rangeInput;

  /**
   * The number input.
   * @type {HTMLInputElement}
   */
  #numberInput;

  /**
   * The minimum allowed value for the range.
   * @type {number}
   */
  #min;

  /**
   * The maximum allowed value for the range.
   * @type {number}
   */
  #max;

  /**
   * A required step size for the range.
   * @type {number}
   */
  #step;

  /* -------------------------------------------- */

  /**
   * The value of the input element.
   * @type {number}
   */
  get valueAsNumber() {
    return this._getValue();
  }

  /* -------------------------------------------- */

  /** @override */
  _buildElements() {

    // Create range input element
    const r = this.#rangeInput = document.createElement("input");
    r.type = "range";
    r.min = String(this.#min);
    r.max = String(this.#max);
    r.step = String(this.#step ?? 0.1);
    this._applyInputAttributes(r);

    // Create the number input element
    const n = this.#numberInput = this._primaryInput = document.createElement("input");
    n.type = "number";
    n.min = String(this.#min);
    n.max = String(this.#max);
    n.step = this.#step ?? "any";
    this._applyInputAttributes(n);
    return [this.#rangeInput, this.#numberInput];
  }

  /* -------------------------------------------- */

  /** @override */
  _setValue(value) {
    value = Math.clamp(value, this.#min, this.#max);
    if ( this.#step ) value = value.toNearest(this.#step);
    this._value = value;
  }

  /* -------------------------------------------- */

  /** @override */
  _refresh() {
    if ( !this.#rangeInput ) return; // Not yet connected
    this.#rangeInput.valueAsNumber = this.#numberInput.valueAsNumber = this._value;
  }

  /* -------------------------------------------- */

  /** @override */
  _activateListeners() {
    const onChange = this.#onChangeInput.bind(this);
    this.#rangeInput.addEventListener("input", this.#onDragSlider.bind(this));
    this.#rangeInput.addEventListener("change", onChange);
    this.#numberInput.addEventListener("change", onChange);
  }

  /* -------------------------------------------- */

  /**
   * Update display of the number input as the range slider is actively changed.
   * @param {InputEvent} event     The originating input event
   */
  #onDragSlider(event) {
    event.preventDefault();
    this.#numberInput.valueAsNumber = this.#rangeInput.valueAsNumber;
  }

  /* -------------------------------------------- */

  /**
   * Handle changes to one of the inputs of the range picker element.
   * @param {InputEvent} event     The originating input change event
   */
  #onChangeInput(event) {
    event.stopPropagation();
    this.value = event.currentTarget.valueAsNumber;
  }

  /* -------------------------------------------- */

  /** @override */
  _toggleDisabled(disabled) {
    this.#rangeInput.toggleAttribute("disabled", disabled);
    this.#numberInput.toggleAttribute("disabled", disabled);
  }

  /* -------------------------------------------- */

  /**
   * Create a HTMLRangePickerElement using provided configuration data.
   * @param {FormInputConfig & RangePickerInputConfig} config
   * @returns {HTMLRangePickerElement}
   */
  static create(config) {
    const picker = document.createElement(HTMLRangePickerElement.tagName);
    picker.name = config.name;
    for ( const attr of ["value", "min", "max", "step"] ) {
      if ( attr in config ) picker.setAttribute(attr, config[attr]);
    }
    foundry.applications.fields.setInputAttributes(picker, config);
    return picker;
  }
}
