/**
 * The Application responsible for configuring a single Token document within a parent Scene.
 * @param {TokenDocument|Actor} object          The {@link TokenDocument} being configured or an {@link Actor} for whom
 *                                              to configure the {@link PrototypeToken}
 * @param {FormApplicationOptions} [options]    Application configuration options.
 */
class TokenConfig extends DocumentSheet {
  constructor(object, options) {
    super(object, options);

    /**
     * The placed Token object in the Scene
     * @type {TokenDocument}
     */
    this.token = this.object;

    /**
     * A reference to the Actor which the token depicts
     * @type {Actor}
     */
    this.actor = this.object.actor;

    // Configure options
    if ( this.isPrototype ) this.options.sheetConfig = false;
  }

  /**
   * Maintain a copy of the original to show a real-time preview of changes.
   * @type {TokenDocument|PrototypeToken}
   */
  preview;

  /* -------------------------------------------- */

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sheet", "token-sheet"],
      template: "templates/scene/token-config.html",
      width: 480,
      height: "auto",
      tabs: [
        {navSelector: '.tabs[data-group="main"]', contentSelector: "form", initial: "character"},
        {navSelector: '.tabs[data-group="light"]', contentSelector: '.tab[data-tab="light"]', initial: "basic"},
        {navSelector: '.tabs[data-group="vision"]', contentSelector: '.tab[data-tab="vision"]', initial: "basic"}
      ],
      viewPermission: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      sheetConfig: true
    });
  }

  /* -------------------------------------------- */

  /**
   * A convenience accessor to test whether we are configuring the prototype Token for an Actor.
   * @type {boolean}
   */
  get isPrototype() {
    return this.object instanceof foundry.data.PrototypeToken;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  get id() {
    if ( this.isPrototype ) return `${this.constructor.name}-${this.actor.uuid}`;
    else return super.id;
  }

  /* -------------------------------------------- */


  /** @inheritdoc */
  get title() {
    if ( this.isPrototype ) return `${game.i18n.localize("TOKEN.TitlePrototype")}: ${this.actor.name}`;
    return `${game.i18n.localize("TOKEN.Title")}: ${this.token.name}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  render(force=false, options={}) {
    if ( this.isPrototype ) this.object.actor.apps[this.appId] = this;
    return super.render(force, options);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _render(force, options={}) {
    await this._handleTokenPreview(force, options);
    return super._render(force, options);
  }

  /* -------------------------------------------- */

  /**
   * Handle preview with a token.
   * @param {boolean} force
   * @param {object} options
   * @returns {Promise<void>}
   * @protected
   */
  async _handleTokenPreview(force, options={}) {
    const states = Application.RENDER_STATES;
    if ( force && [states.CLOSED, states.NONE].includes(this._state) ) {
      if ( this.isPrototype ) {
        this.preview = this.object.clone();
        return;
      }
      if ( !this.document.object ) {
        this.preview = null;
        return;
      }
      if ( !this.preview ) {
        const clone = this.document.object.clone({}, {keepId: true});
        this.preview = clone.document;
        clone.control({releaseOthers: true});
      }
      await this.preview.object.draw();
      this.document.object.renderable = false;
      this.document.object.initializeSources({deleted: true});
      this.preview.object.layer.preview.addChild(this.preview.object);
      this._previewChanges();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _canUserView(user) {
    const canView = super._canUserView(user);
    return canView && game.user.can("TOKEN_CONFIGURE");
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async getData(options={}) {
    const alternateImages = await this._getAlternateTokenImages();
    const usesTrackableAttributes = !foundry.utils.isEmpty(CONFIG.Actor.trackableAttributes);
    const attributeSource = (this.actor?.system instanceof foundry.abstract.DataModel) && usesTrackableAttributes
      ? this.actor?.type
      : this.actor?.system;
    const attributes = TokenDocument.implementation.getTrackedAttributes(attributeSource);
    const canBrowseFiles = game.user.hasPermission("FILES_BROWSE");

    // Prepare Token data
    const doc = this.preview ?? this.document;
    const source = doc.toObject();
    const sourceDetectionModes = new Set(source.detectionModes.map(m => m.id));
    const preparedDetectionModes = doc.detectionModes.filter(m => !sourceDetectionModes.has(m.id));

    // Return rendering context
    return {
      fields: this.document.schema.fields, // Important to use the true document schema,
      lightFields: this.document.schema.fields.light.fields,
      cssClasses: [this.isPrototype ? "prototype" : null].filter(c => !!c).join(" "),
      isPrototype: this.isPrototype,
      hasAlternates: !foundry.utils.isEmpty(alternateImages),
      alternateImages: alternateImages,
      object: source,
      options: this.options,
      gridUnits: (this.isPrototype ? "" : this.document.parent?.grid.units) || game.i18n.localize("GridUnits"),
      barAttributes: TokenDocument.implementation.getTrackedAttributeChoices(attributes),
      bar1: doc.getBarAttribute?.("bar1"),
      bar2: doc.getBarAttribute?.("bar2"),
      colorationTechniques: AdaptiveLightingShader.SHADER_TECHNIQUES,
      visionModes: Object.values(CONFIG.Canvas.visionModes).filter(f => f.tokenConfig),
      detectionModes: Object.values(CONFIG.Canvas.detectionModes).filter(f => f.tokenConfig),
      preparedDetectionModes,
      displayModes: Object.entries(CONST.TOKEN_DISPLAY_MODES).reduce((obj, e) => {
        obj[e[1]] = game.i18n.localize(`TOKEN.DISPLAY_${e[0]}`);
        return obj;
      }, {}),
      hexagonalShapes: Object.entries(CONST.TOKEN_HEXAGONAL_SHAPES).reduce((obj, [k, v]) => {
        obj[v] = game.i18n.localize(`TOKEN.HEXAGONAL_SHAPE_${k}`);
        return obj;
      }, {}),
      showHexagonalShapes: this.isPrototype || !doc.parent || doc.parent.grid.isHexagonal,
      actors: game.actors.reduce((actors, a) => {
        if ( !a.isOwner ) return actors;
        actors.push({_id: a.id, name: a.name});
        return actors;
      }, []).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang)),
      dispositions: Object.entries(CONST.TOKEN_DISPOSITIONS).reduce((obj, e) => {
        obj[e[1]] = game.i18n.localize(`TOKEN.DISPOSITION.${e[0]}`);
        return obj;
      }, {}),
      lightAnimations: CONFIG.Canvas.lightAnimations,
      isGM: game.user.isGM,
      randomImgEnabled: this.isPrototype && (canBrowseFiles || doc.randomImg),
      scale: Math.abs(doc.texture.scaleX),
      mirrorX: doc.texture.scaleX < 0,
      mirrorY: doc.texture.scaleY < 0,
      textureFitModes: CONST.TEXTURE_DATA_FIT_MODES.reduce((obj, fit) => {
        obj[fit] = game.i18n.localize(`TEXTURE_DATA.FIT.${fit}`);
        return obj;
      }, {}),
      ringEffectsInput: this.#ringEffectsInput.bind(this)
    };
  }

  /* --------------------------------------------- */

  /** @inheritdoc */
  async _renderInner(...args) {
    await loadTemplates([
      "templates/scene/parts/token-lighting.hbs",
      "templates/scene/parts/token-vision.html",
      "templates/scene/parts/token-resources.html"
    ]);
    return super._renderInner(...args);
  }

  /* -------------------------------------------- */

  /**
   * Render the Token ring effects input using a multi-checkbox element.
   * @param {NumberField} field             The ring effects field
   * @param {FormInputConfig} inputConfig   Form input configuration
   * @returns {HTMLMultiCheckboxElement}
   */
  #ringEffectsInput(field, inputConfig) {
    const options = [];
    const value = [];
    for ( const [effectName, effectValue] of Object.entries(CONFIG.Token.ring.ringClass.effects) ) {
      const localization = CONFIG.Token.ring.effects[effectName];
      if ( (effectName === "DISABLED") || (effectName === "ENABLED") || !localization ) continue;
      options.push({value: effectName, label: game.i18n.localize(localization)});
      if ( (inputConfig.value & effectValue) !== 0 ) value.push(effectName);
    }
    Object.assign(inputConfig, {name: field.fieldPath, options, value, type: "checkboxes"});
    return foundry.applications.fields.createMultiSelectInput(inputConfig);
  }

  /* -------------------------------------------- */

  /**
   * Get an Object of image paths and filenames to display in the Token sheet
   * @returns {Promise<object>}
   * @private
   */
  async _getAlternateTokenImages() {
    if ( !this.actor?.prototypeToken.randomImg ) return {};
    const alternates = await this.actor.getTokenImages();
    return alternates.reduce((obj, img) => {
      obj[img] = img.split("/").pop();
      return obj;
    }, {});
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".action-button").click(this._onClickActionButton.bind(this));
    html.find(".bar-attribute").change(this._onBarChange.bind(this));
    html.find(".alternate-images").change(ev => ev.target.form["texture.src"].value = ev.target.value);
    html.find("button.assign-token").click(this._onAssignToken.bind(this));
    this._disableEditImage();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async close(options={}) {
    const states = Application.RENDER_STATES;
    if ( options.force || [states.RENDERED, states.ERROR].includes(this._state) ) {
      this._resetPreview();
    }
    await super.close(options);
    if ( this.isPrototype ) delete this.object.actor.apps?.[this.appId];
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getSubmitData(updateData={}) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));

    // Prototype Token unpacking
    if ( this.document instanceof foundry.data.PrototypeToken ) {
      Object.assign(formData, formData.prototypeToken);
      delete formData.prototypeToken;
    }

    // Mirror token scale
    if ( "scale" in formData ) {
      formData.texture.scaleX = formData.scale * (formData.mirrorX ? -1 : 1);
      formData.texture.scaleY = formData.scale * (formData.mirrorY ? -1 : 1);
    }
    ["scale", "mirrorX", "mirrorY"].forEach(k => delete formData[k]);

    // Token Ring Effects
    if ( Array.isArray(formData.ring?.effects) ) {
      const TRE = CONFIG.Token.ring.ringClass.effects;
      let effects = formData.ring.enabled ? TRE.ENABLED : TRE.DISABLED;
      for ( const effectName of formData.ring.effects ) {
        const v = TRE[effectName] ?? 0;
        effects |= v;
      }
      formData.ring.effects = effects;
    }

    // Clear detection modes array
    formData.detectionModes ??= [];

    // Treat "None" as null for bar attributes
    formData.bar1.attribute ||= null;
    formData.bar2.attribute ||= null;
    return foundry.utils.flattenObject(formData);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onChangeInput(event) {
    await super._onChangeInput(event);

    // Disable image editing for wildcards
    this._disableEditImage();

    // Pre-populate vision mode defaults
    const element = event.target;
    if ( element.name === "sight.visionMode" ) {
      const visionDefaults = CONFIG.Canvas.visionModes[element.value]?.vision?.defaults || {};
      const update = fieldName => {
        const field = this.form.querySelector(`[name="sight.${fieldName}"]`);
        if ( fieldName in visionDefaults ) {
          const value = visionDefaults[fieldName];
          if ( value === undefined ) return;
          if ( field.type === "checkbox" ) {
            field.checked = value;
          } else if ( field.type === "range" ) {
            field.value = value;
            const rangeValue = field.parentNode.querySelector(".range-value");
            if ( rangeValue ) rangeValue.innerText = value;
          } else if ( field.classList.contains("color") ) {
            field.value = value;
            const colorInput = field.parentNode.querySelector('input[type="color"]');
            if ( colorInput ) colorInput.value = value;
          } else {
            field.value = value;
          }
        }
      };
      for ( const fieldName of ["color", "attenuation", "brightness", "saturation", "contrast"] ) update(fieldName);
    }

    // Preview token changes
    const previewData = this._getSubmitData();
    this._previewChanges(previewData);
  }

  /* -------------------------------------------- */

  /**
   * Mimic changes to the Token document as if they were true document updates.
   * @param {object} [change]  The change to preview.
   * @protected
   */
  _previewChanges(change) {
    if ( !this.preview ) return;
    if ( change ) {
      change = {...change};
      delete change.actorId;
      delete change.actorLink;
      this.preview.updateSource(change);
    }
    if ( !this.isPrototype && (this.preview.object?.destroyed === false) ) {
      this.preview.object.initializeSources();
      this.preview.object.renderFlags.set({refresh: true});
    }
  }

  /* -------------------------------------------- */

  /**
   * Reset the temporary preview of the Token when the form is submitted or closed.
   * @protected
   */
  _resetPreview() {
    if ( !this.preview ) return;
    if ( this.isPrototype ) return this.preview = null;
    if ( this.preview.object?.destroyed === false ) {
      this.preview.object.destroy({children: true});
    }
    this.preview.baseActor?._unregisterDependentToken(this.preview);
    this.preview = null;
    if ( this.document.object?.destroyed === false ) {
      this.document.object.renderable = true;
      this.document.object.initializeSources();
      this.document.object.control();
      this.document.object.renderFlags.set({refresh: true});
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _updateObject(event, formData) {
    this._resetPreview();
    return this.token.update(formData);
  }

  /* -------------------------------------------- */

  /**
   * Handle Token assignment requests to update the default prototype Token
   * @param {MouseEvent} event  The left-click event on the assign token button
   * @private
   */
  async _onAssignToken(event) {
    event.preventDefault();

    // Get controlled Token data
    let tokens = canvas.ready ? canvas.tokens.controlled : [];
    if ( tokens.length !== 1 ) {
      ui.notifications.warn("TOKEN.AssignWarn", {localize: true});
      return;
    }
    const token = tokens.pop().document.toObject();
    token.tokenId = token.x = token.y = null;
    token.randomImg = this.form.elements.randomImg.checked;
    if ( token.randomImg ) delete token.texture.src;

    // Update the prototype token for the actor using the existing Token instance
    await this.actor.update({prototypeToken: token}, {diff: false, recursive: false, noHook: true});
    ui.notifications.info(game.i18n.format("TOKEN.AssignSuccess", {name: this.actor.name}));
  }

  /* -------------------------------------------- */

  /**
   * Handle changing the attribute bar in the drop-down selector to update the default current and max value
   * @param {Event} event  The select input change event
   * @private
   */
  async _onBarChange(event) {
    const form = event.target.form;
    const doc = this.preview ?? this.document;
    const attr = doc.getBarAttribute("", {alternative: event.target.value});
    const bar = event.target.name.split(".").shift();
    form.querySelector(`input.${bar}-value`).value = attr !== null ? attr.value : "";
    form.querySelector(`input.${bar}-max`).value = ((attr !== null) && (attr.type === "bar")) ? attr.max : "";
  }

  /* -------------------------------------------- */

  /**
   * Handle click events on a token configuration sheet action button
   * @param {PointerEvent} event    The originating click event
   * @protected
   */
  _onClickActionButton(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const action = button.dataset.action;
    game.tooltip.deactivate();

    // Get pending changes to modes
    const modes = Object.values(foundry.utils.expandObject(this._getSubmitData())?.detectionModes || {});

    // Manipulate the array
    switch ( action ) {
      case "addDetectionMode":
        this._onAddDetectionMode(modes);
        break;
      case "removeDetectionMode":
        const idx = button.closest(".detection-mode").dataset.index;
        this._onRemoveDetectionMode(Number(idx), modes);
        break;
    }

    this._previewChanges({detectionModes: modes});
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle adding a detection mode.
   * @param {object[]} modes  The existing detection modes.
   * @protected
   */
  _onAddDetectionMode(modes) {
    modes.push({id: "", range: 0, enabled: true});
  }

  /* -------------------------------------------- */

  /**
   * Handle removing a detection mode.
   * @param {number} index    The index of the detection mode to remove.
   * @param {object[]} modes  The existing detection modes.
   * @protected
   */
  _onRemoveDetectionMode(index, modes) {
    modes.splice(index, 1);
  }

  /* -------------------------------------------- */

  /**
   * Disable the user's ability to edit the token image field if wildcard images are enabled and that user does not have
   * file browser permissions.
   * @private
   */
  _disableEditImage() {
    const img = this.form.querySelector('[name="texture.src"]');
    const randomImg = this.form.querySelector('[name="randomImg"]');
    if ( randomImg ) img.disabled = !game.user.hasPermission("FILES_BROWSE") && randomImg.checked;
  }
}

/**
 * A sheet that alters the values of the default Token configuration used when new Token documents are created.
 * @extends {TokenConfig}
 */
class DefaultTokenConfig extends TokenConfig {
  constructor(object, options) {
    const setting = game.settings.get("core", DefaultTokenConfig.SETTING);
    const cls = getDocumentClass("Token");
    object = new cls({name: "Default Token", ...setting}, {strict: false});
    super(object, options);
  }

  /**
   * The named world setting that stores the default Token configuration
   * @type {string}
   */
  static SETTING = "defaultToken";

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "templates/scene/default-token-config.html",
      sheetConfig: false
    });
  }

  /* --------------------------------------------- */

  /** @inheritdoc */
  get id() {
    return "default-token-config";
  }

  /* --------------------------------------------- */

  /** @inheritdoc */
  get title() {
    return game.i18n.localize("SETTINGS.DefaultTokenN");
  }

  /* -------------------------------------------- */

  /** @override */
  get isEditable() {
    return game.user.can("SETTINGS_MODIFY");
  }

  /* -------------------------------------------- */

  /** @override */
  _canUserView(user) {
    return user.can("SETTINGS_MODIFY");
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options={}) {
    const context = await super.getData(options);
    return Object.assign(context, {
      object: this.token.toObject(false),
      isDefault: true,
      barAttributes: TokenDocument.implementation.getTrackedAttributeChoices(),
      bar1: this.token.bar1,
      bar2: this.token.bar2
    });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _getSubmitData(updateData = {}) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));
    formData.light.color = formData.light.color || undefined;
    formData.bar1.attribute = formData.bar1.attribute || null;
    formData.bar2.attribute = formData.bar2.attribute || null;
    return formData;
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {

    // Validate the default data
    try {
      this.object.updateSource(formData);
      formData = foundry.utils.filterObject(this.token.toObject(), formData);
    } catch(err) {
      Hooks.onError("DefaultTokenConfig#_updateObject", err, {notify: "error"});
    }

    // Diff the form data against normal defaults
    const defaults = foundry.documents.BaseToken.cleanData();
    const delta = foundry.utils.diffObject(defaults, formData);
    await game.settings.set("core", DefaultTokenConfig.SETTING, delta);
    return SettingsConfig.reloadConfirm({ world: true });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[data-action="reset"]').click(this.reset.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Reset the form to default values
   * @returns {Promise<void>}
   */
  async reset() {
    const cls = getDocumentClass("Token");
    this.object = new cls({}, {strict: false});
    this.token = this.object;
    this.render();
  }

  /* --------------------------------------------- */

  /** @inheritdoc */
  async _onBarChange() {}

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onAddDetectionMode(modes) {
    super._onAddDetectionMode(modes);
    this.document.updateSource({ detectionModes: modes });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onRemoveDetectionMode(index, modes) {
    super._onRemoveDetectionMode(index, modes);
    this.document.updateSource({ detectionModes: modes });
  }
}
