/**
 * An abstract custom HTMLElement designed for use with form inputs.
 * @abstract
 * @template {any} FormInputValueType
 *
 * @fires {Event} input           An "input" event when the value of the input changes
 * @fires {Event} change          A "change" event when the value of the element changes
 */
export default class AbstractFormInputElement extends HTMLElement {
  constructor() {
    super();
    this._internals = this.attachInternals();
  }

  /**
   * The HTML tag name used by this element.
   * @type {string}
   */
  static tagName;

  /**
   * Declare that this custom element provides form element functionality.
   * @type {boolean}
   */
  static formAssociated = true;

  /**
   * Attached ElementInternals which provides form handling functionality.
   * @type {ElementInternals}
   * @protected
   */
  _internals;

  /**
   * The primary input (if any). Used to determine what element should receive focus when an associated label is clicked
   * on.
   * @type {HTMLElement}
   * @protected
   */
  _primaryInput;

  /**
   * The form this element belongs to.
   * @type {HTMLFormElement}
   */
  get form() {
    return this._internals.form;
  }

  /* -------------------------------------------- */
  /*  Element Properties                          */
  /* -------------------------------------------- */

  /**
   * The input element name.
   * @type {string}
   */
  get name() {
    return this.getAttribute("name");
  }

  set name(value) {
    this.setAttribute("name", value);
  }

  /* -------------------------------------------- */

  /**
   * The value of the input element.
   * @type {FormInputValueType}
   */
  get value() {
    return this._getValue();
  }

  set value(value) {
    this._setValue(value);
    this.dispatchEvent(new Event("input", {bubbles: true, cancelable: true}));
    this.dispatchEvent(new Event("change", {bubbles: true, cancelable: true}));
    this._refresh();
  }

  /**
   * The underlying value of the element.
   * @type {FormInputValueType}
   * @protected
   */
  _value;

  /* -------------------------------------------- */

  /**
   * Return the value of the input element which should be submitted to the form.
   * @returns {FormInputValueType}
   * @protected
   */
  _getValue() {
    return this._value;
  }

  /* -------------------------------------------- */

  /**
   * Translate user-provided input value into the format that should be stored.
   * @param {FormInputValueType} value  A new value to assign to the element
   * @throws {Error}        An error if the provided value is invalid
   * @protected
   */
  _setValue(value) {
    this._value = value;
  }

  /* -------------------------------------------- */

  /**
   * Is this element disabled?
   * @type {boolean}
   */
  get disabled() {
    return this.hasAttribute("disabled");
  }

  set disabled(value) {
    this.toggleAttribute("disabled", value);
    this._toggleDisabled(!this.editable);
  }

  /* -------------------------------------------- */

  /**
   * Is this field editable? The field can be neither disabled nor readonly.
   * @type {boolean}
   */
  get editable() {
    return !(this.hasAttribute("disabled") || this.hasAttribute("readonly"));
  }

  /* -------------------------------------------- */

  /**
   * Special behaviors that the subclass should implement when toggling the disabled state of the input.
   * @param {boolean} disabled    The new disabled state
   * @protected
   */
  _toggleDisabled(disabled) {}

  /* -------------------------------------------- */
  /*  Element Lifecycle                           */
  /* -------------------------------------------- */

  /**
   * Initialize the custom element, constructing its HTML.
   */
  connectedCallback() {
    const elements = this._buildElements();
    this.replaceChildren(...elements);
    this._refresh();
    this._toggleDisabled(!this.editable);
    this.addEventListener("click", this._onClick.bind(this));
    this._activateListeners();
  }

  /* -------------------------------------------- */

  /**
   * Create the HTML elements that should be included in this custom element.
   * Elements are returned as an array of ordered children.
   * @returns {HTMLElement[]}
   * @protected
   */
  _buildElements() {
    return [];
  }

  /* -------------------------------------------- */

  /**
   * Refresh the active state of the custom element.
   * @protected
   */
  _refresh() {}

  /* -------------------------------------------- */

  /**
   * Apply key attributes on the containing custom HTML element to input elements contained within it.
   * @internal
   */
  _applyInputAttributes(input) {
    input.toggleAttribute("required", this.hasAttribute("required"));
    input.toggleAttribute("disabled", this.hasAttribute("disabled"));
    input.toggleAttribute("readonly", this.hasAttribute("readonly"));
  }

  /* -------------------------------------------- */

  /**
   * Activate event listeners which add dynamic behavior to the custom element.
   * @protected
   */
  _activateListeners() {}

  /* -------------------------------------------- */

  /**
   * Special handling when the custom element is clicked. This should be implemented to transfer focus to an
   * appropriate internal element.
   * @param {PointerEvent} event
   * @protected
   */
  _onClick(event) {
    if ( event.target === this ) this._primaryInput?.focus?.();
  }
}
