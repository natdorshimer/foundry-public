import ApplicationV2 from "./application.mjs";
import {DOCUMENT_OWNERSHIP_LEVELS} from "../../../common/constants.mjs";

/**
 * @typedef {import("../_types.mjs").ApplicationConfiguration} ApplicationConfiguration
 * @typedef {import("../_types.mjs").ApplicationRenderOptions} ApplicationRenderOptions
 */

/**
 * @typedef {Object} DocumentSheetConfiguration
 * @property {Document} document          The Document instance associated with this sheet
 * @property {number} viewPermission      A permission level in CONST.DOCUMENT_OWNERSHIP_LEVELS
 * @property {number} editPermission      A permission level in CONST.DOCUMENT_OWNERSHIP_LEVELS
 * @property {boolean} sheetConfig        Allow sheet configuration as a header button
 */

/**
 * @typedef {Object} DocumentSheetRenderOptions
 * @property {string} renderContext       A string with the format "{operation}{documentName}" providing context
 * @property {object} renderData          Data describing the document modification that occurred
 */

/**
 * The Application class is responsible for rendering an HTMLElement into the Foundry Virtual Tabletop user interface.
 * @extends {ApplicationV2<
 *  ApplicationConfiguration & DocumentSheetConfiguration,
 *  ApplicationRenderOptions & DocumentSheetRenderOptions
 * >}
 * @alias DocumentSheetV2
 */
export default class DocumentSheetV2 extends ApplicationV2 {
  constructor(options={}) {
    super(options);
    this.#document = options.document;
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "{id}",
    classes: ["sheet"],
    tag: "form",  // Document sheets are forms by default
    document: null,
    viewPermission: DOCUMENT_OWNERSHIP_LEVELS.LIMITED,
    editPermission: DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    sheetConfig: true,
    actions: {
      configureSheet: DocumentSheetV2.#onConfigureSheet,
      copyUuid: {handler: DocumentSheetV2.#onCopyUuid, buttons: [0, 2]}
    },
    form: {
      handler: this.#onSubmitDocumentForm,
      submitOnChange: false,
      closeOnSubmit: false
    }
  };

  /* -------------------------------------------- */

  /**
   * The Document instance associated with the application
   * @type {ClientDocument}
   */
  get document() {
    return this.#document;
  }

  #document;

  /* -------------------------------------------- */

  /** @override */
  get title() {
    const {constructor: cls, id, name, type} = this.document;
    const prefix = cls.hasTypeData ? CONFIG[cls.documentName].typeLabels[type] : cls.metadata.label
    return `${game.i18n.localize(prefix)}: ${name ?? id}`;
  }

  /* -------------------------------------------- */

  /**
   * Is this Document sheet visible to the current User?
   * This is governed by the viewPermission threshold configured for the class.
   * @type {boolean}
   */
  get isVisible() {
    return this.document.testUserPermission(game.user, this.options.viewPermission);
  }

  /* -------------------------------------------- */

  /**
   * Is this Document sheet editable by the current User?
   * This is governed by the editPermission threshold configured for the class.
   * @type {boolean}
   */
  get isEditable() {
    if ( this.document.pack ) {
      const pack = game.packs.get(this.document.pack);
      if ( pack.locked ) return false;
    }
    return this.document.testUserPermission(game.user, this.options.editPermission);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    options.uniqueId = `${this.constructor.name}-${options.document.uuid}`;
    return options;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  *_headerControlButtons() {
    for ( const control of this._getHeaderControls() ) {
      if ( control.visible === false ) continue;
      if ( ("ownership" in control) && !this.document.testUserPermission(game.user, control.ownership) ) continue;
      yield control;
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);

    // Add form options
    if ( this.options.tag === "form" ) frame.autocomplete = "off";

    // Add document ID copy
    const copyLabel = game.i18n.localize("SHEETS.CopyUuid");
    const copyId = `<button type="button" class="header-control fa-solid fa-passport" data-action="copyUuid"
                            data-tooltip="${copyLabel}" aria-label="${copyLabel}"></button>`;
    this.window.close.insertAdjacentHTML("beforebegin", copyId);

    // Add sheet configuration button
    if ( this.options.sheetConfig && this.isEditable && !this.document.getFlag("core", "sheetLock") ) {
      const label = game.i18n.localize("SHEETS.ConfigureSheet");
      const sheetConfig = `<button type="button" class="header-control fa-solid fa-cog" data-action="configureSheet"
                                   data-tooltip="${label}" aria-label="${label}"></button>`;
      this.window.close.insertAdjacentHTML("beforebegin", sheetConfig);
    }
    return frame;
  }

  /* -------------------------------------------- */
  /*  Application Life-Cycle Events               */
  /* -------------------------------------------- */

  /** @override */
  _canRender(_options) {
    if ( !this.isVisible ) throw new Error(game.i18n.format("SHEETS.DocumentSheetPrivate", {
      type: game.i18n.localize(this.document.constructor.metadata.label)
    }));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.document.apps[this.id] = this;
  }

  /* -------------------------------------------- */

  /** @override */
  _onClose(_options) {
    delete this.document.apps[this.id];
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle click events to configure the sheet used for this document.
   * @param {PointerEvent} event
   * @this {DocumentSheetV2}
   */
  static #onConfigureSheet(event) {
    event.stopPropagation(); // Don't trigger other events
    if ( event.detail > 1 ) return; // Ignore repeated clicks
    new DocumentSheetConfig(this.document, {
      top: this.position.top + 40,
      left: this.position.left + ((this.position.width - DocumentSheet.defaultOptions.width) / 2)
    }).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle click events to copy the UUID of this document to clipboard.
   * @param {PointerEvent} event
   * @this {DocumentSheetV2}
   */
  static #onCopyUuid(event) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if ( event.detail > 1 ) return; // Ignore repeated clicks
    const id = event.button === 2 ? this.document.id : this.document.uuid;
    const type = event.button === 2 ? "id" : "uuid";
    const label = game.i18n.localize(this.document.constructor.metadata.label);
    game.clipboard.copyPlainText(id);
    ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {label, type, id}));
  }

  /* -------------------------------------------- */
  /*  Form Submission                             */
  /* -------------------------------------------- */

  /**
   * Process form submission for the sheet
   * @this {DocumentSheetV2}                      The handler is called with the application as its bound scope
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {FormDataExtended} formData           Processed data for the submitted form
   * @returns {Promise<void>}
   */
  static async #onSubmitDocumentForm(event, form, formData) {
    const submitData = this._prepareSubmitData(event, form, formData);
    await this._processSubmitData(event, form, submitData);
  }

  /* -------------------------------------------- */

  /**
   * Prepare data used to update the Item upon form submission.
   * This data is cleaned and validated before being returned for further processing.
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {FormDataExtended} formData           Processed data for the submitted form
   * @returns {object}                            Prepared submission data as an object
   * @throws {Error}                              Subclasses may throw validation errors here to prevent form submission
   * @protected
   */
  _prepareSubmitData(event, form, formData) {
    const submitData = this._processFormData(event, form, formData);
    const addType = this.document.constructor.hasTypeData && !("type" in submitData);
    if ( addType ) submitData.type = this.document.type;
    this.document.validate({changes: submitData, clean: true, fallback: false});
    if ( addType ) delete submitData.type;
    return submitData;
  }

  /* -------------------------------------------- */

  /**
   * Customize how form data is extracted into an expanded object.
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {FormDataExtended} formData           Processed data for the submitted form
   * @returns {object}                            An expanded object of processed form data
   * @throws {Error}                              Subclasses may throw validation errors here to prevent form submission
   */
  _processFormData(event, form, formData) {
    return foundry.utils.expandObject(formData.object);
  }

  /* -------------------------------------------- */

  /**
   * Submit a document update based on the processed form data.
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {object} submitData                   Processed and validated form data to be used for a document update
   * @returns {Promise<void>}
   * @protected
   */
  async _processSubmitData(event, form, submitData) {
    await this.document.update(submitData);
  }

  /* -------------------------------------------- */

  /**
   * Programmatically submit a DocumentSheetV2 instance, providing additional data to be merged with form data.
   * @param {object} options
   * @param {object} [options.updateData]           Additional data merged with processed form data
   * @returns {Promise<void>}
   */
  async submit({updateData}={}) {
    const formConfig = this.options.form;
    if ( !formConfig?.handler ) throw new Error(`The ${this.constructor.name} DocumentSheetV2 does not support a`
      + ` single top-level form element.`);
    const form = this.element;
    const event = new Event("submit");
    const formData = new FormDataExtended(form);
    const submitData = this._prepareSubmitData(event, form, formData);
    foundry.utils.mergeObject(submitData, updateData, {inplace: true});
    await this._processSubmitData(event, form, submitData);
  }
}
