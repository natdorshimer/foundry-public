import DocumentSheetV2 from "../api/document-sheet.mjs";
import HandlebarsApplicationMixin from "../api/handlebars-application.mjs";

/**
 * The AmbientSound configuration application.
 * @extends DocumentSheetV2
 * @mixes HandlebarsApplication
 * @alias AmbientSoundConfig
 */
export default class AmbientSoundConfig extends HandlebarsApplicationMixin(DocumentSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["ambient-sound-config"],
    window: {
      contentClasses: ["standard-form"]
    },
    position: {
      width: 560,
      height: "auto"
    },
    form: {
      handler: this.#onSubmit,
      closeOnSubmit: true
    }
  };

  /** @override */
  static PARTS = {
    body: {
      template: "templates/scene/ambient-sound-config.hbs"
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  get title() {
    if ( !this.document.id ) return game.i18n.localize("AMBIENT_SOUND.ACTIONS.CREATE");
    return super.title;
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(_options) {
    return {
      sound: this.document,
      source: this.document.toObject(),
      fields: this.document.schema.fields,
      gridUnits: this.document.parent.grid.units || game.i18n.localize("GridUnits"),
      soundEffects: CONFIG.soundEffects,
      buttons: [{
        type: "submit",
        icon: "fa-solid fa-save",
        label: game.i18n.localize(this.document.id ? "AMBIENT_SOUND.ACTIONS.UPDATE" : "AMBIENT_SOUND.ACTIONS.CREATE")
      }]
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context, options) {
    this.#toggleDisabledFields();
    return super._onRender(context, options);
  }

  /* -------------------------------------------- */

  /** @override */
  _onClose(_options) {
    if ( !this.document.id ) canvas.sounds.clearPreviewContainer();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    this.#toggleDisabledFields();
    return super._onChangeForm(formConfig, event);
  }

  /* -------------------------------------------- */

  /**
   * Special logic to toggle the disabled state of form fields depending on the values of other fields.
   */
  #toggleDisabledFields() {
    const form = this.element;
    form["effects.base.intensity"].disabled = !form["effects.base.type"].value;
    form["effects.muffled.type"].disabled = form.walls.checked;
    form["effects.muffled.intensity"].disabled = form.walls.checked || !form["effects.muffled.type"].value;
  }

  /* -------------------------------------------- */

  /**
   * Process form submission for the sheet.
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {FormDataExtended} formData           Processed data for the submitted form
   * @this {AmbientSoundConfig}
   * @returns {Promise<void>}
   */
  static async #onSubmit(event, form, formData) {
    const submitData = this._prepareSubmitData(event, form, formData);
    if ( this.document.id ) await this.document.update(submitData);
    else await this.document.constructor.create(submitData, {parent: canvas.scene});
  }
}
