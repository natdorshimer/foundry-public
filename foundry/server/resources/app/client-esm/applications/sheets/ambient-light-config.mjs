import DocumentSheetV2 from "../api/document-sheet.mjs";
import HandlebarsApplicationMixin from "../api/handlebars-application.mjs";

/**
 * The AmbientLight configuration application.
 * @extends DocumentSheetV2
 * @mixes HandlebarsApplication
 * @alias AmbientLightConfig
 */
export default class AmbientLightConfig extends HandlebarsApplicationMixin(DocumentSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["ambient-light-config"],
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
    },
    actions:{
      reset: this.#onReset
    }
  };

  /** @override */
  static PARTS = {
    tabs: {
      template: "templates/generic/tab-navigation.hbs"
    },
    basic: {
      template: "templates/scene/parts/light-basic.hbs"
    },
    animation: {
      template: "templates/scene/parts/light-animation.hbs"
    },
    advanced: {
      template: "templates/scene/parts/light-advanced.hbs"
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  }

  /**
   * Maintain a copy of the original to show a real-time preview of changes.
   * @type {AmbientLightDocument}
   */
  preview;

  /** @override */
  tabGroups = {
    sheet: "basic"
  }

  /* -------------------------------------------- */
  /*  Application Rendering                       */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preRender(context, options) {
    await super._preRender(context, options);
    if ( this.preview?.rendered ) {
      await this.preview.object.draw();
      this.document.object.initializeLightSource({deleted: true});
      this.preview.object.layer.preview.addChild(this.preview.object);
      this._previewChanges();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#toggleReset();
  }

  /* -------------------------------------------- */

  /** @override */
  _onClose(options) {
    super._onClose(options);
    if ( this.preview ) this._resetPreview();
    if ( this.document.rendered ) this.document.object.initializeLightSource();
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {

    // Create the preview on first render
    if ( options.isFirstRender && this.document.object ) {
      const clone = this.document.object.clone();
      this.preview = clone.document;
    }

    // Prepare context
    const document = this.preview ?? this.document;
    const isDarkness = document.config.negative;
    return {
      light: document,
      source: document.toObject(),
      fields: document.schema.fields,
      colorationTechniques: AdaptiveLightingShader.SHADER_TECHNIQUES,
      gridUnits: document.parent.grid.units || game.i18n.localize("GridUnits"),
      isDarkness,
      lightAnimations: isDarkness ? CONFIG.Canvas.darknessAnimations : CONFIG.Canvas.lightAnimations,
      tabs: this.#getTabs(),
      buttons: [
        {
          type: "reset",
          action: "reset",
          icon: "fa-solid fa-undo",
          label: "AMBIENT_LIGHT.ACTIONS.RESET"
        },
        {
          type: "submit",
          icon: "fa-solid fa-save",
          label: this.document.id ? "AMBIENT_LIGHT.ACTIONS.UPDATE" : "AMBIENT_LIGHT.ACTIONS.CREATE"
        }
      ]
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  #getTabs() {
    const tabs = {
      basic: {id: "basic", group: "sheet", icon: "fa-solid fa-lightbulb", label: "AMBIENT_LIGHT.SECTIONS.BASIC"},
      animation: {id: "animation", group: "sheet", icon: "fa-solid fa-play", label: "AMBIENT_LIGHT.SECTIONS.ANIMATION"},
      advanced: {id: "advanced", group: "sheet", icon: "fa-solid fa-cogs", label: "AMBIENT_LIGHT.SECTIONS.ADVANCED"}
    }
    for ( const v of Object.values(tabs) ) {
      v.active = this.tabGroups[v.group] === v.id;
      v.cssClass = v.active ? "active" : "";
    }
    return tabs;
  }

  /* -------------------------------------------- */

  /**
   * Toggle visibility of the reset button which is only visible on the advanced tab.
   */
  #toggleReset() {
    const reset = this.element.querySelector("button[data-action=reset]");
    reset.classList.toggle("hidden", this.tabGroups.sheet !== "advanced");
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  changeTab(...args) {
    super.changeTab(...args);
    this.#toggleReset();
  }

  /* -------------------------------------------- */
  /*  Real-Time Preview                           */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    const formData = new FormDataExtended(this.element);
    this._previewChanges(formData.object);

    // Special handling for darkness state change
    if ( event.target.name === "config.negative") this.render({parts: ["animation", "advanced"]});
  }

  /* -------------------------------------------- */

  /**
   * Preview changes to the AmbientLight document as if they were true document updates.
   * @param {object} [change]  A change to preview.
   * @protected
   */
  _previewChanges(change) {
    if ( !this.preview ) return;
    if ( change ) this.preview.updateSource(change);
    if ( this.preview?.rendered ) {
      this.preview.object.renderFlags.set({refresh: true});
      this.preview.object.initializeLightSource();
    }
  }

  /* -------------------------------------------- */

  /**
   * Restore the true data for the AmbientLight document when the form is submitted or closed.
   * @protected
   */
  _resetPreview() {
    if ( !this.preview ) return;
    if ( this.preview.rendered ) {
      this.preview.object.destroy({children: true});
    }
    this.preview = null;
    if ( this.document.rendered ) {
      const object = this.document.object;
      object.renderable = true;
      object.initializeLightSource();
      object.renderFlags.set({refresh: true});
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Process form submission for the sheet.
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {FormDataExtended} formData           Processed data for the submitted form
   * @this {AmbientLightConfig}
   * @returns {Promise<void>}
   */
  static async #onSubmit(event, form, formData) {
    const submitData = this._prepareSubmitData(event, form, formData);
    if ( this.document.id ) await this.document.update(submitData);
    else await this.document.constructor.create(submitData, {parent: canvas.scene});
  }

  /* -------------------------------------------- */

  /**
   * Process reset button click
   * @param {PointerEvent} event                  The originating button click
   * @this {AmbientLightConfig}
   * @returns {Promise<void>}
   */
  static async #onReset(event) {
    event.preventDefault();
    const defaults = AmbientLightDocument.cleanData();
    const keys = ["vision", "config"];
    const configKeys = ["coloration", "contrast", "attenuation", "luminosity", "saturation", "shadows"];
    for ( const k in defaults ) {
      if ( !keys.includes(k) ) delete defaults[k];
    }
    for ( const k in defaults.config ) {
      if ( !configKeys.includes(k) ) delete defaults.config[k];
    }
    this._previewChanges(defaults);
    await this.render();
  }
}
