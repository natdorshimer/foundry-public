/**
 * The Application responsible for configuring a single Scene document.
 * @extends {DocumentSheet}
 * @param {Scene} object                    The Scene Document which is being configured
 * @param {DocumentSheetOptions} [options]  Application configuration options.
 */
class SceneConfig extends DocumentSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "scene-config",
      classes: ["sheet", "scene-sheet"],
      template: "templates/scene/config.html",
      width: 560,
      height: "auto",
      tabs: [
        {navSelector: '.tabs[data-group="main"]', contentSelector: "form", initial: "basic"},
        {navSelector: '.tabs[data-group="ambience"]', contentSelector: '.tab[data-tab="ambience"]', initial: "basic"}
      ]
    });
  }

  /* -------------------------------------------- */

  /**
   * Indicates if width / height should change together to maintain aspect ratio
   * @type {boolean}
   */
  linkedDimensions = true;

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `${game.i18n.localize("SCENES.ConfigTitle")}: ${this.object.name}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async close(options={}) {
    this._resetScenePreview();
    return super.close(options);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  render(force, options={}) {
    if ( options.renderContext && !["createScene", "updateScene"].includes(options.renderContext) ) return this;
    return super.render(force, options);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getData(options={}) {
    const context = super.getData(options);
    context.data = this.document.toObject();  // Source data, not derived
    context.playlistSound = this.document.playlistSound?.id || "";
    context.foregroundElevation = this.document.foregroundElevation;

    // Selectable types
    context.minGrid = CONST.GRID_MIN_SIZE;
    context.gridTypes = this.constructor._getGridTypes();
    context.gridStyles = CONFIG.Canvas.gridStyles;
    context.weatherTypes = this._getWeatherTypes();
    context.ownerships = [
      {value: 0, label: "SCENES.AccessibilityGM"},
      {value: 2, label: "SCENES.AccessibilityAll"}
    ];

    // Referenced documents
    context.playlists = this._getDocuments(game.playlists);
    context.sounds = this._getDocuments(this.object.playlist?.sounds ?? []);
    context.journals = this._getDocuments(game.journal);
    context.pages = this.object.journal?.pages.contents.sort((a, b) => a.sort - b.sort) ?? [];
    context.isEnvironment = (this._tabs[0].active === "ambience") && (this._tabs[1].active === "environment");
    context.baseHueSliderDisabled = (this.document.environment.base.intensity === 0);
    context.darknessHueSliderDisabled = (this.document.environment.dark.intensity === 0);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Get an enumeration of the available grid types which can be applied to this Scene
   * @returns {object}
   * @internal
   */
  static _getGridTypes() {
    const labels = {
      GRIDLESS: "SCENES.GridGridless",
      SQUARE: "SCENES.GridSquare",
      HEXODDR: "SCENES.GridHexOddR",
      HEXEVENR: "SCENES.GridHexEvenR",
      HEXODDQ: "SCENES.GridHexOddQ",
      HEXEVENQ: "SCENES.GridHexEvenQ"
    };
    return Object.keys(CONST.GRID_TYPES).reduce((obj, t) => {
      obj[CONST.GRID_TYPES[t]] = labels[t];
      return obj;
    }, {});
  }

  /* --------------------------------------------- */

  /** @inheritdoc */
  async _renderInner(...args) {
    await loadTemplates([
      "templates/scene/parts/scene-ambience.html"
    ]);
    return super._renderInner(...args);
  }

  /* -------------------------------------------- */

  /**
   * Get the available weather effect types which can be applied to this Scene
   * @returns {object}
   * @private
   */
  _getWeatherTypes() {
    const types = {};
    for ( let [k, v] of Object.entries(CONFIG.weatherEffects) ) {
      types[k] = game.i18n.localize(v.label);
    }
    return types;
  }

  /* -------------------------------------------- */

  /**
   * Get the alphabetized Documents which can be chosen as a configuration for the Scene
   * @param {WorldCollection} collection
   * @returns {object[]}
   * @private
   */
  _getDocuments(collection) {
    const documents = collection.map(doc => {
      return {id: doc.id, name: doc.name};
    });
    documents.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    return documents;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("button.capture-position").click(this._onCapturePosition.bind(this));
    html.find("button.grid-config").click(this._onGridConfig.bind(this));
    html.find("button.dimension-link").click(this._onLinkDimensions.bind(this));
    html.find("select[name='playlist']").change(this._onChangePlaylist.bind(this));
    html.find('select[name="journal"]').change(this._onChangeJournal.bind(this));
    html.find('button[type="reset"]').click(this._onResetForm.bind(this));
    html.find("hue-slider").change(this._onChangeRange.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Capture the current Scene position and zoom level as the initial view in the Scene config
   * @param {Event} event   The originating click event
   * @private
   */
  _onCapturePosition(event) {
    event.preventDefault();
    if ( !canvas.ready ) return;
    const btn = event.currentTarget;
    const form = btn.form;
    form["initial.x"].value = parseInt(canvas.stage.pivot.x);
    form["initial.y"].value = parseInt(canvas.stage.pivot.y);
    form["initial.scale"].value = canvas.stage.scale.x;
    ui.notifications.info("SCENES.CaptureInitialViewPosition", {localize: true});
  }

  /* -------------------------------------------- */

  /**
   * Handle click events to open the grid configuration application
   * @param {Event} event   The originating click event
   * @private
   */
  async _onGridConfig(event) {
    event.preventDefault();
    new GridConfig(this.object, this).render(true);
    return this.minimize();
  }

  /* -------------------------------------------- */

  /**
   * Handle click events to link or unlink the scene dimensions
   * @param {Event} event
   * @returns {Promise<void>}
   * @private
   */
  async _onLinkDimensions(event) {
    event.preventDefault();
    this.linkedDimensions = !this.linkedDimensions;
    this.element.find("button.dimension-link > i").toggleClass("fa-link-simple", this.linkedDimensions);
    this.element.find("button.dimension-link > i").toggleClass("fa-link-simple-slash", !this.linkedDimensions);
    this.element.find("button.resize").attr("disabled", !this.linkedDimensions);

    // Update Tooltip
    const tooltip = game.i18n.localize(this.linkedDimensions ? "SCENES.DimensionLinked" : "SCENES.DimensionUnlinked");
    this.element.find("button.dimension-link").attr("data-tooltip", tooltip);
    game.tooltip.activate(this.element.find("button.dimension-link")[0], { text: tooltip });
  }

  /* -------------------------------------------- */

  /** @override */
  async _onChangeInput(event) {
    if ( event.target.name === "width" || event.target.name === "height" ) this._onChangeDimensions(event);
    if ( event.target.name === "environment.darknessLock" ) await this.#onDarknessLockChange(event.target.checked);
    this._previewScene(event.target.name);
    return super._onChangeInput(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle darkness lock change and update immediately the database.
   * @param {boolean} darknessLock     If the darkness lock is checked or not.
   * @returns {Promise<void>}
   */
  async #onDarknessLockChange(darknessLock) {
    const darknessLevelForm = this.form["environment.darknessLevel"];
    darknessLevelForm.disabled = darknessLock;
    await this.document.update({
      environment: {
        darknessLock,
        darknessLevel: darknessLevelForm.valueAsNumber
      }}, {render: false});
  }

  /* -------------------------------------------- */

  /** @override */
  _onChangeColorPicker(event) {
    super._onChangeColorPicker(event);
    this._previewScene(event.target.dataset.edit);
  }

  /* -------------------------------------------- */

  /** @override */
  _onChangeRange(event) {
    super._onChangeRange(event);
    for ( const target of ["base", "dark"] ) {
      if ( event.target.name === `environment.${target}.intensity` ) {
        const intensity = this.form[`environment.${target}.intensity`].valueAsNumber;
        this.form[`environment.${target}.hue`].disabled = (intensity === 0);
      }
    }
    this._previewScene(event.target.name);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onChangeTab(event, tabs, active) {
    super._onChangeTab(event, tabs, active);
    const enabled = (this._tabs[0].active === "ambience") && (this._tabs[1].active === "environment");
    this.element.find('button[type="reset"]').toggleClass("hidden", !enabled);
  }

  /* -------------------------------------------- */

  /**
   * Reset the values of the environment attributes to their default state.
   * @param {PointerEvent} event    The originating click event
   * @private
   */
  _onResetForm(event) {
    event.preventDefault();

    // Get base and dark ambience defaults and originals
    const def = Scene.cleanData().environment;
    const ori = this.document.toObject().environment;
    const defaults = {base: def.base, dark: def.dark};
    const original = {base: ori.base, dark: ori.dark};

    // Reset the elements to the default values
    for ( const target of ["base", "dark"] ) {
      this.form[`environment.${target}.hue`].disabled = (defaults[target].intensity === 0);
      this.form[`environment.${target}.intensity`].value = defaults[target].intensity;
      this.form[`environment.${target}.luminosity`].value = defaults[target].luminosity;
      this.form[`environment.${target}.saturation`].value = defaults[target].saturation;
      this.form[`environment.${target}.shadows`].value = defaults[target].shadows;
      this.form[`environment.${target}.hue`].value = defaults[target].hue;
    }

    // Update the document with the default environment values
    this.document.updateSource({environment: defaults});

    // Preview the scene and re-render the config
    this._previewScene("forceEnvironmentPreview");
    this.render();

    // Restore original environment values
    this.document.updateSource({environment: original});
  }

  /* -------------------------------------------- */

  /**
   * Live update the scene as certain properties are changed.
   * @param {string} changed  The changed property.
   * @internal
   */
  _previewScene(changed) {
    if ( !this.object.isView || !canvas.ready || !changed ) return;
    const force = changed.includes("force");

    // Preview triggered for the grid
    if ( ["grid.style", "grid.thickness", "grid.color", "grid.alpha"].includes(changed) || force ) {
      canvas.interface.grid.initializeMesh({
        style: this.form["grid.style"].value,
        thickness: Number(this.form["grid.thickness"].value),
        color: this.form["grid.color"].value,
        alpha: Number(this.form["grid.alpha"].value)
      });
    }

    // To easily track all the environment changes
    const environmentChange = changed.includes("environment.") || changed.includes("forceEnvironmentPreview") || force;

    // Preview triggered for the ambience manager
    if ( ["backgroundColor", "fog.colors.explored", "fog.colors.unexplored"].includes(changed)
      || environmentChange ) {
      canvas.environment.initialize(this.#getAmbienceFormData());
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the ambience form data.
   * @returns {Object}
   */
  #getAmbienceFormData() {
    const fd = new FormDataExtended(this.form);
    const formData = foundry.utils.expandObject(fd.object);
    return {
      backgroundColor: formData.backgroundColor,
      fogExploredColor: formData.fog.colors.explored,
      fogUnexploredColor: formData.fog.colors.unexplored,
      environment: formData.environment
    };
  }

  /* -------------------------------------------- */

  /**
   * Reset the previewed darkness level, background color, grid alpha, and grid color back to their true values.
   * @private
   */
  _resetScenePreview() {
    if ( !this.object.isView || !canvas.ready ) return;
    canvas.scene.reset();
    canvas.environment.initialize();
    canvas.interface.grid.initializeMesh(canvas.scene.grid);
  }

  /* -------------------------------------------- */

  /**
   * Handle updating the select menu of PlaylistSound options when the Playlist is changed
   * @param {Event} event   The initiating select change event
   * @private
   */
  _onChangePlaylist(event) {
    event.preventDefault();
    const playlist = game.playlists.get(event.target.value);
    const sounds = this._getDocuments(playlist?.sounds || []);
    const options = ['<option value=""></option>'].concat(sounds.map(s => {
      return `<option value="${s.id}">${s.name}</option>`;
    }));
    const select = this.form.querySelector("select[name=\"playlistSound\"]");
    select.innerHTML = options.join("");
  }

  /* -------------------------------------------- */

  /**
   * Handle updating the select menu of JournalEntryPage options when the JournalEntry is changed.
   * @param {Event} event  The initiating select change event.
   * @protected
   */
  _onChangeJournal(event) {
    event.preventDefault();
    const entry = game.journal.get(event.currentTarget.value);
    const pages = entry?.pages.contents.sort((a, b) => a.sort - b.sort) ?? [];
    const options = pages.map(page => {
      const selected = (entry.id === this.object.journal?.id) && (page.id === this.object.journalEntryPage);
      return `<option value="${page.id}"${selected ? " selected" : ""}>${page.name}</option>`;
    });
    this.form.elements.journalEntryPage.innerHTML = `<option></option>${options}`;
  }

  /* -------------------------------------------- */

  /**
   * Handle updating the select menu of JournalEntryPage options when the JournalEntry is changed.
   * @param event
   * @private
   */
  _onChangeDimensions(event) {
    event.preventDefault();
    if ( !this.linkedDimensions ) return;
    const name = event.currentTarget.name;
    const value = Number(event.currentTarget.value);
    const oldValue = name === "width" ? this.object.width : this.object.height;
    const scale = value / oldValue;
    const otherInput = this.form.elements[name === "width" ? "height" : "width"];
    otherInput.value = otherInput.value * scale;

    // If new value is not a round number, display an error and revert
    if ( !Number.isInteger(parseFloat(otherInput.value)) ) {
      ui.notifications.error(game.i18n.localize("SCENES.InvalidDimension"));
      this.form.elements[name].value = oldValue;
      otherInput.value = name === "width" ? this.object.height : this.object.width;
      return;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    const scene = this.document;

    // FIXME: Ideally, FormDataExtended would know to set these fields to null instead of keeping a blank string
    // SceneData.texture.src is nullable in the schema, causing an empty string to be initialised to null. We need to
    // match that logic here to ensure that comparisons to the existing scene image are accurate.
    if ( formData["background.src"] === "" ) formData["background.src"] = null;
    if ( formData.foreground === "" ) formData.foreground = null;
    if ( formData["fog.overlay"] === "" ) formData["fog.overlay"] = null;

    // The same for fog colors
    if ( formData["fog.colors.unexplored"] === "" ) formData["fog.colors.unexplored"] = null;
    if ( formData["fog.colors.explored"] === "" ) formData["fog.colors.explored"] = null;

    // Determine what type of change has occurred
    const hasDefaultDims = (scene.background.src === null) && (scene.width === 4000) && (scene.height === 3000);
    const hasImage = formData["background.src"] || scene.background.src;
    const changedBackground =
      (formData["background.src"] !== undefined) && (formData["background.src"] !== scene.background.src);
    const clearedDims = (formData.width === null) || (formData.height === null);
    const needsThumb = changedBackground || !scene.thumb;
    const needsDims = formData["background.src"] && (clearedDims || hasDefaultDims);
    const createThumbnail = hasImage && (needsThumb || needsDims);

    // Update thumbnail and image dimensions
    if ( createThumbnail && game.settings.get("core", "noCanvas") ) {
      ui.notifications.warn("SCENES.GenerateThumbNoCanvas", {localize: true});
      formData.thumb = null;
    } else if ( createThumbnail ) {
      let td = {};
      try {
        td = await scene.createThumbnail({img: formData["background.src"] ?? scene.background.src});
      } catch(err) {
        Hooks.onError("SceneConfig#_updateObject", err, {
          msg: "Thumbnail generation for Scene failed",
          notify: "error",
          log: "error",
          scene: scene.id
        });
      }
      if ( needsThumb ) formData.thumb = td.thumb || null;
      if ( needsDims ) {
        formData.width = td.width;
        formData.height = td.height;
      }
    }

    // Warn the user if Scene dimensions are changing
    const delta = foundry.utils.diffObject(scene._source, foundry.utils.expandObject(formData));
    const changes = foundry.utils.flattenObject(delta);
    const textureChange = ["scaleX", "scaleY", "rotation"].map(k => `background.${k}`);
    if ( ["grid.size", ...textureChange].some(k => k in changes) ) {
      const confirm = await Dialog.confirm({
        title: game.i18n.localize("SCENES.DimensionChangeTitle"),
        content: `<p>${game.i18n.localize("SCENES.DimensionChangeWarning")}</p>`
      });
      if ( !confirm ) return;
    }

    // If the canvas size has changed in a nonuniform way, ask the user if they want to reposition
    let autoReposition = false;
    if ( (scene.background?.src || scene.foreground?.src) && (["width", "height", "padding", "background", "grid.size"].some(x => x in changes)) ) {
      autoReposition = true;

      // If aspect ratio changes, prompt to replace all tokens with new dimensions and warn about distortions
      let showPrompt = false;
      if ( "width" in changes && "height" in changes ) {
        const currentScale = this.object.width / this.object.height;
        const newScale = formData.width / formData.height;
        if ( currentScale !== newScale ) {
          showPrompt = true;
        }
      }
      else if ( "width" in changes || "height" in changes ) {
        showPrompt = true;
      }

      if ( showPrompt ) {
        const confirm = await Dialog.confirm({
          title: game.i18n.localize("SCENES.DistortedDimensionsTitle"),
          content: game.i18n.localize("SCENES.DistortedDimensionsWarning"),
          defaultYes: false
        });
        if ( !confirm ) autoReposition = false;
      }
    }

    // Perform the update
    delete formData["environment.darknessLock"];
    return scene.update(formData, {autoReposition});
  }
}
