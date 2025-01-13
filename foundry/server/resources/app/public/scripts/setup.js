(function () {
  'use strict';

  const _app$6 = foundry.applications.api;

  /**
   * Display the End User License Agreement and prompt the user to agree before moving forwards.
   * @extends ApplicationV2
   * @mixes HandlebarsApplication
   */
  class EULA extends _app$6.HandlebarsApplicationMixin(_app$6.ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      id: "eula",
      tag: "aside",
      window: {
        title: "End User License Agreement",
        icon: "fa-solid fa-file-contract",
        minimizable: false
      },
      position: {
        width: 800,
        height: "auto"
      },
      actions: {
        accept: EULA.#onClickAccept,
        decline: EULA.#onClickDecline
      }
    }, {inplace: false});

    /** @override */
    static PARTS = {
      content: {
        id: "content",
        template: "templates/setup/parts/eula-content.hbs",
        scrollable: [""]
      },
      form: {
        id: "form",
        template: "templates/setup/parts/eula-form.hbs"
      }
    };

    /* -------------------------------------------- */

    /** @override */
    async _prepareContext(options) {
      const html = await foundry.utils.fetchWithTimeout("license.html").then(r => r.text());
      return {html};
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async _renderFrame(options) {
      const frame = await super._renderFrame(options);
      this.window.controlsDropdown.remove();
      this.window.close.remove();
      return frame;
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /**
     * Require the user to have checked the agreement box in order to proceed.
     * @this {EULA}
     * @param {PointerEvent} event
     * @param {HTMLButtonElement} target
     */
    static #onClickAccept(event, target) {
      if ( !this.parts.form.agree.checked ) {
        event.preventDefault();
        event.stopPropagation();
        ui.notifications.error("EULA.ErrorAgreeRequired", {localize: true});
      }
    }

    /* -------------------------------------------- */

    /**
     * Require the user to have checked the agreement box in order to proceed.
     * @this {EULA}
     * @param {PointerEvent} event
     * @param {HTMLButtonElement} target
     */
    static #onClickDecline(event, target) {
      this.parts.form.agree.checked = false;
      ui.notifications.warn("EULA.Declined", {localize: true});
      setTimeout(() => window.location.href = CONST.WEBSITE_URL, 1000);
    }
  }

  const _app$5 = foundry.applications.api;

  /**
   * The Join Game setup application.
   * @extends ApplicationV2
   * @mixes HandlebarsApplication
   */
  class JoinGameForm extends _app$5.HandlebarsApplicationMixin(_app$5.ApplicationV2) {
    constructor(options) {
      super(options);
      game.users.apps.push(this);
    }

    /** @inheritDoc */
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      id: "join-game",
      window: {
        frame: false,
        positioned: false
      }
    }, {inplace: false});

    /** @override */
    static PARTS = {
      form: {
        id: "form",
        template: "templates/setup/parts/join-form.hbs",
        forms: {
          "#join-game-form": {
            handler: JoinGameForm.#onSubmitLoginForm
          }
        }
      },
      details: {
        id: "details",
        template: "templates/setup/parts/join-details.hbs",
      },
      setup: {
        id: "setup",
        template: "templates/setup/parts/join-setup.hbs",
        forms: {
          "#join-game-setup": {
            handler: JoinGameForm.#onSubmitSetupForm
          }
        }
      },
      world: {
        id: "world",
        template: "templates/setup/parts/join-world.hbs",
        scrollable: ["#world-description"]
      }
    };

    /* -------------------------------------------- */

    /** @inheritDoc */
    _configureRenderOptions(options) {
      super._configureRenderOptions(options);
      if ( game.world.joinTheme === "minimal" ) {
        const minimalParts = ["form", "setup"];
        options.parts = options.parts.filter(p => minimalParts.includes(p));
      }
    }

    /* -------------------------------------------- */

    /** @override */
    async _prepareContext(options) {
      const context = {
        isAdmin: game.data.isAdmin,
        users: game.users,
        world: game.world,
        passwordString: game.data.passwordString,
        usersCurrent: game.users.filter(u => u.active).length,
        usersMax: game.users.contents.length
      };

      // Next session time
      const nextDate = new Date(game.world.nextSession || undefined);
      if ( nextDate.isValid() ) {
        context.nextTime = nextDate.toLocaleTimeString(game.i18n.lang, {
          weekday: "long",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          timeZoneName: "short"
        });
      }
      return context;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _syncPartState(partId, newElement, priorElement, state) {
      super._syncPartState(partId, newElement, priorElement, state);
      // Retain login form state
      if ( partId === "form" ) {
        newElement.userid.value = priorElement.userid.value;
        if ( newElement.userid.selectedOptions[0]?.disabled ) newElement.userid.value = "";
        newElement.password.value = priorElement.password.value;
      }
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /**
     * @this {JoinGameForm}
     * @param {SubmitEvent} event
     * @param {HTMLFormElement} form
     * @param {FormDataExtended} formData
     */
    static async #onSubmitSetupForm(event, form, formData) {
      event.preventDefault();
      form.disabled = true;

      // Display a warning if other players are connected
      const othersActive = game.users.filter(u => u.active).length;
      if ( othersActive ) {
        const warning = othersActive > 1 ? "GAME.ReturnSetupActiveUsers" : "GAME.ReturnSetupActiveUser";
        const confirm = await Dialog.confirm({
          title: game.i18n.localize("GAME.ReturnSetup"),
          content: `<p>${game.i18n.format(warning, {number: othersActive})}</p>`
        });
        if ( !confirm ) {
          form.disabled = false;
          return;
        }
      }

      // Submit the request
      const postData = Object.assign(formData.object, {action: "shutdown"});
      return this.#post(form, postData);
    }


    /* -------------------------------------------- */

    /**
     * @this {JoinGameForm}
     * @param {SubmitEvent} event
     * @param {HTMLFormElement} form
     * @param {FormDataExtended} formData
     */
    static async #onSubmitLoginForm(event, form, formData) {
      event.preventDefault();
      if ( !formData.get("userid") ) return ui.notifications.error("JOIN.ErrorMustSelectUser", {localize: true});
      const postData = Object.assign(formData.object, {action: "join"});
      return this.#post(form, postData);
    }

    /* -------------------------------------------- */

    /**
     * Submit join view POST requests to the server for handling.
     * @param {HTMLFormElement} form                    The form being submitted
     * @param {object} postData                         The processed form data
     * @returns {Promise<void>}
     */
    async #post(form, postData) {
      form.disabled = true;
      const joinURL = foundry.utils.getRoute("join");
      const user = game.users.get(postData.userid)?.name || postData.userid;
      let response;

      // Submit the request
      try {
        response = await foundry.utils.fetchJsonWithTimeout(joinURL, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(postData)
        });
      }
      catch(e) {
        if (e instanceof foundry.utils.HttpError) {
          const error = game.i18n.format(e.displayMessage, {user});
          ui.notifications.error(error);
        }
        else {
          ui.notifications.error(e);
        }
        form.disabled = false;
        return;
      }

      // Redirect on success
      ui.notifications.info(game.i18n.format(response.message, {user}));
      setTimeout(() => window.location.href = response.redirect, 500 );
    }
  }

  /**
   * A form application for managing core server configuration options.
   * @see config.ApplicationConfiguration
   */
  class SetupApplicationConfiguration extends FormApplication {

    /**
     * An ApplicationConfiguration instance which is used for validation and processing of form changes.
     * @type {config.ApplicationConfiguration}
     */
    config = new foundry.config.ApplicationConfiguration(this.object);

    /** @inheritdoc */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "setup-configuration",
        template: "templates/setup/app-configuration.hbs",
        title: "SETUP.ConfigTitle",
        popOut: true,
        width: 720
      });
    }

    /**
     * Which CSS theme is currently being previewed
     * @type {string}
     */
    #previewTheme = this.config.cssTheme;

    /* -------------------------------------------- */

    /** @override */
    getData(options={}) {
      const worlds = Array.from(game.worlds.values());
      worlds.sort((a, b) => a.title.localeCompare(b.title, game.i18n.lang));
      return {
        noAdminPW: !game.data.options.adminPassword,
        config: this.config.toObject(),
        cssThemes: CONST.CSS_THEMES,
        languages: this.#getLanguages(),
        fields: this.config.schema.fields,
        worlds: worlds,
      };
    }

    /* -------------------------------------------- */

    /**
     * Get the set of languages which are choices for selection.
     * @returns {FormSelectOption[]}
     */
    #getLanguages() {
      const options = [];
      for ( const l of game.data.languages ) {
        for ( const m of l.modules ) {
          options.push({group: l.label, value: `${l.id}.${m.id}`, label: `${l.label} - ${m.label}`});
        }
      }
      return options;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async close(options) {
      this.#applyThemeChange(this.config.cssTheme);
      return super.close(options);
    }

    /* -------------------------------------------- */

    /** @override */
    async _onChangeInput(event) {
      this.#applyThemeChange(this.form.cssTheme.value);
    }

    /* -------------------------------------------- */

    /** @override */
    async _onSubmit(event, options={}) {
      event.preventDefault();
      const original = this.config.toObject();

      // Validate the proposed changes
      const formData = this._getSubmitData();
      let changes;
      try {
        changes = this.config.updateSource(formData);
      } catch(err) {
        return ui.notifications.error(err.message);
      }
      if ( foundry.utils.isEmpty(changes) ) return this.close();

      // Confirm that a server restart is okay
      const confirm = await Dialog.confirm({
        title: game.i18n.localize("SETUP.ConfigSave"),
        content: `<p>${game.i18n.localize("SETUP.ConfigSaveWarning")}</p>`,
        defaultYes: false,
        options: {width: 480}
      });

      // Submit the form
      if ( confirm ) {
        const response = await Setup.post({action: "adminConfigure", config: changes});
        if ( response.restart ) ui.notifications.info("SETUP.ConfigSaveRestart", {localize: true, permanent: true});
        return this.close();
      }

      // Reset the form
      this.config.updateSource(original);
      return this.render();
    }

    /* -------------------------------------------- */

    /** @override */
    async _updateObject(event, formData) {}

    /* -------------------------------------------- */

    /**
     * Update the body class with the previewed CSS theme.
     * @param {string} themeId     The theme ID to preview
     */
    #applyThemeChange(themeId) {
      document.body.classList.replace(`theme-${this.#previewTheme}`, `theme-${themeId}`);
      this.#previewTheme = themeId;
    }

    /* -------------------------------------------- */

    /**
     * Prompt the user with a request to share telemetry data if they have not yet chosen an option.
     * @returns {Promise<void>}
     */
    static async telemetryRequestDialog() {
      if ( game.data.options.telemetry !== undefined ) return;
      const response = await Dialog.wait({
        title: game.i18n.localize("SETUP.TelemetryRequestTitle"),
        content: `<p>${game.i18n.localize("SETUP.TelemetryRequest1")}</p>`
          + `<blockquote>${game.i18n.localize("SETUP.TelemetryHint")}</blockquote>`
          + `<p>${game.i18n.localize("SETUP.TelemetryRequest2")}</p>`,
        focus: true,
        close: () => null,
        buttons: {
          yes: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize("SETUP.TelemetryAllow"),
            callback: () => true
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("SETUP.TelemetryDecline"),
            callback: () => false
          }
        }
      }, {width: 480});
      if ( response !== null ) {
        const { changes } = await Setup.post({action: "adminConfigure", config: {telemetry: response}});
        foundry.utils.mergeObject(game.data.options, changes);
      }
    }
  }

  const _app$4 = foundry.applications.api;

  /**
   * The Setup Authentication Form.
   * Prompt the user to provide a server administrator password if one has been configured.
   * @extends ApplicationV2
   * @mixes HandlebarsApplication
   */
  class SetupAuthenticationForm extends _app$4.HandlebarsApplicationMixin(_app$4.ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      id: "setup-authentication",
      classes: ["application", "framed"],
      window: {
        frame: false,
        positioned: false
      }
    }, {inplace: false});

    /** @override */
    static PARTS = {
      form: {
        template: "templates/setup/setup-authentication.hbs"
      }
    };
  }

  const _app$3 = foundry.applications.api;

  /**
   * An application that renders the floating setup menu buttons.
   * @extends ApplicationV2
   * @mixes HandlebarsApplication
   */
  class SetupWarnings extends _app$3.HandlebarsApplicationMixin(_app$3.ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      id: "setup-warnings",
      window: {
        title: "SETUP.WarningsTitle",
        icon: "fa-solid fa-triangle-exclamation"
      },
      position: {
        width: 680
      },
      actions: {
        reinstallPackage: SetupWarnings.#reinstallPackage,
        uninstallPackage: SetupWarnings.#uninstallPackage,
        managePackage: SetupWarnings.#managePackage
      }
    }, {inplace: false});

    /** @override */
    static PARTS = {
      packages: {
        id: "packages",
        template: "templates/setup/setup-warnings.hbs",
        scrollable: [""]
      }
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    get title() {
      return `${super.title} (${game.issueCount.total})`;
    }

    /* -------------------------------------------- */

    /** @override */
    async _prepareContext(options) {
      const categories = {
        world: {label: "SETUP.Worlds", packages: {}},
        system: {label: "SETUP.Systems", packages: {}},
        module: {label: "SETUP.Modules", packages: {}}
      };

      // Organize warnings
      for ( const pkg of Object.values(game.data.packageWarnings) ) {
        const cls = PACKAGE_TYPES[pkg.type];
        const p = game[cls.collection].get(pkg.id);
        categories[pkg.type].packages[pkg.id] = {
          id: pkg.id,
          type: pkg.type,
          name: p ? p.title : "",
          errors: pkg.error.map(e => e.trim()).join("\n"),
          warnings: pkg.warning.map(e => e.trim()).join("\n"),
          reinstallable: pkg.reinstallable,
          installed: p !== undefined
        };
      }

      // Filter categories to ones which have issues
      for ( const [k, v] of Object.entries(categories) ) {
        if ( foundry.utils.isEmpty(v.packages) ) delete categories[k];
      }
      return {categories};
    }

    /* -------------------------------------------- */

    /**
     * Handle button clicks to manage the package in the main setup interface.
     * @param {PointerEvent} event          The initiating click event
     * @param {HTMLButtonElement} target    The clicked button
     */
    static #managePackage(event, target) {
      event.preventDefault();
      const li = target.closest(".package");
      const packageType = li.closest("section[data-package-type]").dataset.packageType;
      ui.setupPackages.activateTab(`${packageType}s`);

      // Filter to the target package
      const packageId = li.dataset.packageId;
      const filter = ui.setupPackages._searchFilters.find(f => f._inputSelector === `#${packageType}-filter`)._input;
      filter.value = packageId;
      filter.dispatchEvent(new Event("input", {bubbles: true}));
    }

    /* -------------------------------------------- */

    /**
     * Handle button clicks to reinstall a package.
     * @param {PointerEvent} event          The initiating click event
     * @param {HTMLButtonElement} target    The clicked button
     */
    static async #reinstallPackage(event, target) {
      event.preventDefault();
      const pkg = target.closest("[data-package-id]");
      const id = pkg.dataset.packageId;
      const type = pkg.dataset.packageType;
      target.querySelector("i").classList.add("fa-spin");

      // Uninstall current
      await Setup.uninstallPackage({id, type});
      delete game.data.packageWarnings[id];

      // Install package
      await Setup.warmPackages({ type });
      const warnInfo = game.data.packageWarnings[id];
      if ( !pkg && !warnInfo?.manifest )  {
        return ui.notifications.error("SETUP.ReinstallPackageNotFound", { localize: true, permanent: true });
      }
      await Setup.installPackage({ type, id, manifest: warnInfo?.manifest ?? pkg.manifest });
    }

    /* -------------------------------------------- */

    /**
     * Handle button clicks to uninstall a package
     * @param {PointerEvent} event          The initiating click event
     * @param {HTMLButtonElement} target    The clicked button
     */
    static async #uninstallPackage(event, target) {
      event.preventDefault();
      const pkg = target.closest("[data-package-id]");
      const id = pkg.dataset.packageId;
      const type = pkg.dataset.packageType;
      await Setup.uninstallPackage({id, type});
      delete game.data.packageWarnings[id];
    }
  }

  /**
   * @typedef {FormApplicationOptions} CategoryFilterApplicationOptions
   * @property {string} initialCategory  The category that is initially selected when the Application first renders.
   * @property {string[]} inputs         A list of selectors for form inputs that should have their values preserved on
   *                                     re-render.
   */

  /**
   * @typedef {object} CategoryFilterCategoryContext
   * @property {string} id       The category identifier.
   * @property {boolean} active  Whether the category is currently selected.
   * @property {string} label    The localized category label.
   * @property {number} count    The number of entries in this category.
   */

  /**
   * An abstract class responsible for displaying a 2-pane Application that allows for entries to be grouped and filtered
   * by category.
   */
  class CategoryFilterApplication extends FormApplication {
    /**
     * The currently selected category.
     * @type {string}
     */
    #category = this.options.initialCategory;

    /**
     * The currently selected category.
     * @type {string}
     */
    get category() {
      return this.#category;
    }

    /**
     * Record the state of user inputs.
     * @type {string[]}
     * @protected
     */
    _inputs = [];

    /* -------------------------------------------- */

    /** @returns {CategoryFilterApplicationOptions} */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["category-filter"],
        width: 920,
        height: 780,
        scrollY: [".categories", ".entry-list"],
        filters: [{ inputSelector: 'input[name="filter"]', contentSelector: ".entries" }]
      });
    }

    /* -------------------------------------------- */

    /** @override */
    async _updateObject(event, formData) {}

    /* -------------------------------------------- */

    /** @inheritdoc */
    async _render(force=false, options={}) {
      this._saveInputs();
      await super._render(force, options);
      this._restoreInputs();
    }

    /* -------------------------------------------- */

    /** @override */
    getData(options={}) {
      const { categories, entries } = this._prepareCategoryData();
      categories.sort(this._sortCategories.bind(this));
      entries.sort(this._sortEntries.bind(this));
      return { categories, entries };
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    activateListeners(html) {
      super.activateListeners(html);
      html[0].children[0].onsubmit = ev => ev.preventDefault();
      html.find(".entry-title h3").on("click", this._onClickEntryTitle.bind(this));
      html.find(".categories .category").on("click", this._onClickCategoryFilter.bind(this));
    }

    /* -------------------------------------------- */

    /**
     * Category comparator.
     * @param {CategoryFilterCategoryContext} a
     * @param {CategoryFilterCategoryContext} b
     * @returns {number}
     * @protected
     */
    _sortCategories(a, b) {
      return 0;
    }

    /* -------------------------------------------- */

    /**
     * Entries comparator.
     * @param {object} a
     * @param {object} b
     * @return {number}
     * @protected
     */
    _sortEntries(a, b) {
      return 0;
    }

    /* -------------------------------------------- */

    /**
     * Handle click events to filter by a certain category.
     * @param {PointerEvent} event  The triggering event.
     * @protected
     */
    _onClickCategoryFilter(event) {
      event.preventDefault();
      this.#category = event.currentTarget.dataset.category;
      this.render();
    }

    /* -------------------------------------------- */

    /** @override */
    _onSearchFilter(event, query, rgx, html) {
      if ( html.classList.contains("loading") ) return;
      for ( const entry of html.querySelectorAll(".entry") ) {
        if ( !query ) {
          entry.classList.remove("hidden");
          continue;
        }
        let match = false;
        this._getSearchFields(entry).forEach(field => match ||= rgx.test(SearchFilter.cleanQuery(field)));
        entry.classList.toggle("hidden", !match);
      }
    }

    /* -------------------------------------------- */

    /**
     * Retrieve any additional fields that the entries should be filtered on.
     * @param {HTMLElement} entry  The entry element.
     * @returns {string[]}
     * @protected
     */
    _getSearchFields(entry) {
      return [];
    }

    /* -------------------------------------------- */

    /**
     * Record the state of user inputs.
     * @protected
     */
    _saveInputs() {
      if ( !this.element.length || !this.options.inputs?.length ) return;
      this._inputs = this.options.inputs.map(selector => {
        const input = this.element[0].querySelector(selector);
        return input?.value ?? "";
      });
    }

    /* -------------------------------------------- */

    /**
     * Restore the state of user inputs.
     * @protected
     */
    _restoreInputs() {
      if ( !this.options.inputs?.length || !this.element.length ) return;
      this.options.inputs.forEach((selector, i) => {
        const value = this._inputs[i] ?? "";
        const input = this.element[0].querySelector(selector);
        if ( input ) input.value = value;
      });
    }

    /* -------------------------------------------- */
    /*  Abstract Methods                            */
    /* -------------------------------------------- */

    /**
     * Get category context data.
     * @returns {{categories: CategoryFilterCategoryContext[], entries: object[]}}
     * @abstract
     */
    _prepareCategoryData() {
      return { categories: [], entries: [] };
    }

    /* -------------------------------------------- */

    /**
     * Handle clicking on the entry title.
     * @param {PointerEvent} event  The triggering event.
     * @abstract
     */
    _onClickEntryTitle(event) {}
  }

  /**
   * An application that manages backups for a single package.
   */
  class BackupList extends FormApplication {

    /**
     * The list of available backups for this package.
     * @type {BackupData[]}
     */
    #backups = [];

    /**
     * The backup date formatter.
     * @type {Intl.DateTimeFormat}
     */
    #dateFormatter = new Intl.DateTimeFormat(game.i18n.lang, { dateStyle: "full", timeStyle: "short" });

    /* -------------------------------------------- */

    /** @inheritdoc */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["backup-list", "category-filter"],
        template: "templates/setup/backup-list.hbs",
        width: 640,
        height: 780
      });
    }

    /* -------------------------------------------- */

    /** @override */
    get id() {
      return `backup-list-${this.object.type}-${this.object.id}`;
    }

    /** @override */
    get title() {
      return game.i18n.format("SETUP.BACKUPS.ManagePackage", { package: this.object.title });
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    async _render(force=false, options={}) {
      await super._render(force, options);
      if ( !Setup.backups && force ) Setup.listBackups().then(() => this.render());
    }

    /* -------------------------------------------- */

    /** @override */
    getData(options={}) {
      const context = {};
      if ( Setup.backups ) this.#backups = Setup.backups[this.object.type]?.[this.object.id] ?? [];
      else context.progress = { label: "SETUP.BACKUPS.Loading", icon: "fas fa-spinner fa-spin" };
      context.entries = this.#prepareEntries();
      return context;
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-action]").on("click", this.#onAction.bind(this));
      html.find(".entry-title").on("click", this.#onClickEntryTitle.bind(this));
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _getHeaderButtons() {
      const buttons = super._getHeaderButtons();
      buttons.unshift({
        label: "SETUP.BACKUPS.TakeBackup",
        class: "create-backup",
        icon: "fas fa-floppy-disk",
        onclick: this.#onCreateBackup.bind(this)
      });
      return buttons;
    }

    /* -------------------------------------------- */

    /**
     * Delete any selected backups.
     */
    async #deleteSelected() {
      const toDelete = [];
      for ( const el of this.form.elements ) {
        if ( el.checked && (el.name !== "select-all") ) toDelete.push(el.name);
      }
      await Setup.deleteBackups(this.object, toDelete, { dialog: true });
      this.render();
    }

    /* -------------------------------------------- */

    /**
     * Prepare template context data for backup entries.
     * @returns {BackupEntryUIDescriptor[]}
     */
    #prepareEntries() {
      return this.#backups.map(backupData => {
        const { id, size, note, createdAt, snapshotId } = backupData;
        const tags = [
          { label: foundry.utils.formatFileSize(size, { decimalPlaces: 0 }) },
          this.constructor.getVersionTag(backupData)
        ];
        if ( snapshotId ) tags.unshift({ label: game.i18n.localize("SETUP.BACKUPS.Snapshot") });
        return {
          id, tags,
          description: note,
          inSnapshot: !!snapshotId,
          noRestore: !this.constructor.canRestoreBackup(backupData),
          title: this.#dateFormatter.format(createdAt),
        };
      });
    }

    /* -------------------------------------------- */

    /**
     * Determine the version tag for a given backup.
     * @param {BackupData} backupData  The backup.
     * @returns {BackupEntryTagDescriptor}
     */
    static getVersionTag(backupData) {
      const cls = PACKAGE_TYPES[backupData.type];
      const availability = cls.testAvailability(backupData);
      return cls.getVersionBadge(availability, backupData);
    }

    /* -------------------------------------------- */

    /**
     * Determine if a given backup is allowed to be restored.
     * @param {BackupData} backupData  The backup.
     * @returns {boolean}
     */
    static canRestoreBackup(backupData) {
      const { packageId, type } = backupData;
      const cls = PACKAGE_TYPES[type];
      const pkg = game[cls.collection].get(packageId);

      // If there is no currently-installed version of the package, it can always be restored.
      if ( !pkg ) return true;

      const codes = CONST.PACKAGE_AVAILABILITY_CODES;
      const usable = code => (code >= codes.VERIFIED) && (code <= codes.UNVERIFIED_GENERATION);

      // If the installed package is already unusable, there is no harm in restoring a backup, it can't make things worse.
      if ( !usable(pkg.availability) ) return true;

      // Otherwise check if restoring the backup would make the package unusable.
      return usable(cls.testAvailability(backupData));
    }

    /* -------------------------------------------- */

    /**
     * Handle clicking on an action button.
     * @param {PointerEvent} event  The triggering event.
     */
    #onAction(event) {
      const { action } = event.currentTarget.dataset;
      switch ( action ) {
        case "delete":
          this.#deleteSelected();
          break;

        case "restore":
          this.#onRestore(event);
          break;

        case "select-all":
          this.#toggleSelectAll(event.currentTarget.checked);
          break;
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle clicking the backup title in order to toggle its checkbox.
     * @param {PointerEvent} event  The triggering event.
     */
    #onClickEntryTitle(event) {
      const row = event.currentTarget.closest(".checkbox-row");
      const checkbox = row.querySelector("input");
      if ( !checkbox.disabled ) checkbox.checked = !checkbox.checked;
    }

    /* -------------------------------------------- */

    /**
     * Handle creating a new backup.
     */
    async #onCreateBackup() {
      await Setup.createBackup(this.object, { dialog: true });
      this.render();
    }

    /* -------------------------------------------- */

    /**
     * Handle restoring a specific backup.
     * @param {PointerEvent} event  The triggering event.
     */
    async #onRestore(event) {
      const { backupId } = event.currentTarget.closest("[data-backup-id]").dataset;
      const backupData = this.#backups.find(entry => entry.id === backupId);
      const pkg = game[`${this.object.type}s`].get(this.object.id);
      await Setup.restoreBackup(backupData, { dialog: !!pkg });
      this.render();
    }

    /* -------------------------------------------- */

    /**
     * Handle selecting or deselecting all backups.
     * @param {boolean} select  Whether to select or deselect.
     */
    #toggleSelectAll(select) {
      for ( const el of this.form.elements ) {
        if ( !el.disabled && (el.type === "checkbox") && (el.name !== "select-all") ) el.checked = select;
      }
    }

    /* -------------------------------------------- */

    /**
     * Toggle the locked state of the interface.
     * @param {boolean} locked  Is the interface locked?
     */
    toggleLock(locked) {
      const element = this.element[0];
      if ( !element ) return;
      element.querySelectorAll("a.button, .create-backup").forEach(el => el.classList.toggle("disabled", locked));
      element.querySelectorAll("button").forEach(el => el.disabled = locked);
    }
  }

  /**
   * @typedef {object} BackupEntryTagDescriptor
   * @property {"unsafe"|"warning"|"neutral"|"safe"} [type]  The tag type.
   * @property {string} [icon]                               An icon class.
   * @property {string} label                                The tag text.
   * @property {string} [tooltip]                            Tooltip text.
   */

  /**
   * @typedef {object} BackupEntryUIDescriptor
   * @property {string} [packageId]     The ID of the package this backup represents, if applicable.
   * @property {string} [backupId]      The ID of the package backup, if applicable.
   * @property {string} [snapshotId]    The ID of the snapshot, if applicable.
   * @property {number} [createdAt]     The snapshot's creation timestamp.
   * @property {string} title           The title of the entry. Either a formatted date for snapshots, or the title of the
   *                                    package for package backups.
   * @property {string} [restoreLabel]  The label for the restore button.
   * @property {string} description     The description for the entry. Either the user's note for snapshots, or the
   *                                    package description for package backups.
   * @property {boolean} [inSnapshot]   For package backups, this indicates that it is part of a snapshot.
   * @property {boolean} [noRestore]    Is the backup allowed to be restored.
   * @property {BackupEntryTagDescriptor[]} tags  Tag descriptors for the backup or snapshot.
   */

  /**
   * An Application that manages user backups and snapshots.
   */
  class BackupManager extends CategoryFilterApplication {
    /**
     * The snapshot date formatter.
     * @type {Intl.DateTimeFormat}
     */
    #dateFormatter = new Intl.DateTimeFormat(game.i18n.lang, { dateStyle: "full", timeStyle: "short" });

    /* -------------------------------------------- */

    /** @inheritdoc */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "backup-manager",
        template: "templates/setup/backup-manager.hbs",
        title: "SETUP.BACKUPS.ManageBackups",
        inputs: ['[name="filter"]'],
        initialCategory: "world"
      });
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    async _render(force=false, options={}) {
      await super._render(force, options);
      if ( !Setup.backups && force ) Setup.listBackups().then(() => this.render(false));
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    getData(options={}) {
      const context = super.getData(options);

      // Loading progress.
      if ( Setup.backups ) {
        const totalSize = Object.entries(Setup.backups).reduce((acc, [k, v]) => {
          if ( k === "snapshots" ) return acc;
          return acc + Object.values(v).reduce((acc, arr) => acc + arr.reduce((acc, d) => acc + d.size, 0), 0);
        }, 0);
        context.totalSize = foundry.utils.formatFileSize(totalSize, { decimalPlaces: 0 });
      }
      else context.progress = { label: "SETUP.BACKUPS.Loading", icon: "fas fa-spinner fa-spin" };

      context.hasBulkActions = this.category === "snapshots";
      return context;
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-action]").on("click", this.#onAction.bind(this));
    }

    /* -------------------------------------------- */

    /** @override */
    _prepareCategoryData() {
      const categories = ["snapshots", "world", "module", "system"].map(id => {
        let count;
        if ( id === "snapshots" ) count = Object.keys(Setup.backups?.[id] ?? {}).length;
        else count = Object.values(Setup.backups?.[id] ?? {}).filter(backups => backups.length).length;
        return {
          id, count,
          active: this.category === id,
          label: game.i18n.localize(`SETUP.BACKUPS.TYPE.${id}`)
        };
      });

      let entries;
      if ( this.category === "snapshots" ) entries = this.#getSnapshotsContext();
      else entries = this.#getPackagesContext(this.category);

      return { categories, entries };
    }

    /* -------------------------------------------- */

    /** @override */
    _sortEntries(a, b) {
      if ( this.category === "snapshots" ) return b.createdAt - a.createdAt;
      return a.title.localeCompare(b.title, game.i18n.lang);
    }

    /* -------------------------------------------- */

    /** @override */
    _sortCategories(a, b) {
      const order = ["snapshots", "world", "module", "system"];
      return order.indexOf(a.id) - order.indexOf(b.id);
    }

    /* -------------------------------------------- */

    /**
     * Get snapshot context data.
     * @returns {BackupEntryUIDescriptor[]}
     */
    #getSnapshotsContext() {
      return Object.values(Setup.backups?.snapshots ?? {}).map(snapshotData => {
        const { createdAt } = snapshotData;
        const versionTag = this.#getSnapshotVersionTag(snapshotData);
        return {
          createdAt,
          snapshotId: snapshotData.id,
          title: this.#dateFormatter.format(createdAt),
          restoreLabel: "SETUP.BACKUPS.Restore",
          description: snapshotData.note,
          noRestore: versionTag.noRestore,
          tags: [
            versionTag,
            { label: foundry.utils.formatFileSize(snapshotData.size, { decimalPlaces: 0 }) }
          ]
        };
      });
    }

    /* -------------------------------------------- */

    /**
     * Determine the version tag for a given snapshot.
     * @param {SnapshotData} snapshotData  The snapshot.
     * @returns {BackupEntryTagDescriptor}
     */
    #getSnapshotVersionTag({ generation, build }) {
      const label = game.i18n.format("SETUP.BACKUPS.VersionFormat", { version: `${generation}.${build}` });

      // Safe to restore a snapshot taken in the current generation.
      if ( generation === game.release.generation ) return { label, type: "safe", icon: "fas fa-code-branch" };

      // Potentially safe to restore a snapshot from an older generation into a newer generation software version.
      if ( generation < game.release.generation ) return { label, type: "warning", icon: "fas fa-exclamation-triangle" };

      // Impossible to restore a snapshot from a newer generation than the current software version.
      if ( generation > game.release.generation ) return {
        label,
        type: "error",
        icon: "fa fa-file-slash",
        noRestore: true
      };
    }

    /* -------------------------------------------- */

    /**
     * Get package backup context data.
     * @param {"module"|"system"|"world"} type  The package type.
     * @returns {BackupEntryUIDescriptor[]}
     */
    #getPackagesContext(type) {
      const entries = [];
      for ( const backups of Object.values(Setup.backups?.[type] ?? {}) ) {
        if ( !backups.length ) continue;
        const newest = backups[0];
        const size = backups.reduce((acc, backupData) => acc + backupData.size, 0);
        const { packageId, title, description } = newest;
        const pkg = game[PACKAGE_TYPES[type].collection].get(packageId);
        const tags = [
          { label: game.i18n.format(`SETUP.BACKUPS.Num${backups.length === 1 ? "" : "Pl"}`, { number: backups.length }) },
          { label: foundry.utils.formatFileSize(size, { decimalPlaces: 0 }) },
          BackupList.getVersionTag(newest)
        ];
        entries.push({
          packageId, title, tags,
          packageType: type,
          backupId: newest.id,
          restoreLabel: "SETUP.BACKUPS.RestoreLatest",
          noRestore: !BackupList.canRestoreBackup(newest),
          packageExists: !!pkg,
          description: TextEditor.previewHTML(description, 150)
        });
      }
      return entries;
    }

    /* -------------------------------------------- */

    /** @override */
    _onClickEntryTitle(event) {
      const { packageId, packageType, packageTitle } = event.currentTarget.closest(".entry").dataset;
      return new BackupList({ id: packageId, type: packageType, title: packageTitle }).render(true);
    }

    /* -------------------------------------------- */

    /**
     * Handle clicking on an action button.
     * @param {PointerEvent} event  The triggering event.
     */
    #onAction(event) {
      const { action } = event.currentTarget.dataset;
      switch ( action ) {
        case "create":
          this.#onCreateBackup(event);
          break;

        case "delete":
          this.#deleteSelected();
          break;

        case "manage":
          this._onClickEntryTitle(event);
          break;

        case "restore":
          this.#onRestore(event);
          break;

        case "select-all":
          this.#toggleSelectAll(event.currentTarget.checked);
          break;
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle selecting or deleting all snapshots.
     * @param {boolean} select Whether to select or deselect.
     */
    #toggleSelectAll(select) {
      for ( const el of this.form.elements ) {
        if ( !el.disabled && (el.type === "checkbox") && (el.name !== "select-all") ) el.checked = select;
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle creating a new package backup.
     * @param {PointerEvent} event  The triggering event.
     * @returns {Promise<void>}
     */
    async #onCreateBackup(event) {
      const { packageId, packageType } = event.currentTarget.closest(".entry").dataset;
      const pkg = game[PACKAGE_TYPES[packageType].collection].get(packageId);
      if ( !pkg ) return;
      await Setup.createBackup(pkg, { dialog: true });
      this.render();
    }

    /* -------------------------------------------- */

    /**
     * Handle restoring a snapshot or the latest backup.
     * @param {PointerEvent} event  The triggering event.
     */
    async #onRestore(event) {
      const { packageId, packageType, snapshotId } = event.currentTarget.closest(".entry").dataset;
      if ( snapshotId ) return Setup.restoreSnapshot(Setup.backups.snapshots[snapshotId], { dialog: true });
      const pkg = game[PACKAGE_TYPES[packageType].collection].get(packageId);
      await Setup.restoreLatestBackup({ id: packageId, type: packageType }, { dialog: !!pkg });
      this.render();
    }

    /* -------------------------------------------- */

    /**
     * Handle creating a snapshot.
     */
    async #onCreateSnapshot() {
      await Setup.createSnapshot({ dialog: true });
      this.render(true);
    }

    /* -------------------------------------------- */

    /**
     * Delete any selected snapshots.
     */
    async #deleteSelected() {
      const toDelete = [];
      for ( const el of this.form.elements ) {
        if ( el.checked && (el.name !== "select-all") ) toDelete.push(el.name);
      }
      await Setup.deleteSnapshots(toDelete, { dialog: true });
      this.render(true);
    }

    /* -------------------------------------------- */

    /** @override */
    _getSearchFields(entry) {
      return [entry.dataset.packageId ?? "", entry.querySelector(".entry-title h3")?.textContent ?? ""];
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    _getHeaderButtons() {
      const buttons = super._getHeaderButtons();
      const packages = game.worlds.size + game.systems.size + game.modules.size;
      if ( packages ) {
        buttons.unshift({
          label: "SETUP.BACKUPS.CreateSnapshot",
          class: "create-snapshot",
          icon: "fas fa-camera-retro",
          onclick: this.#onCreateSnapshot.bind(this)
        });
      }
      return buttons;
    }

    /* -------------------------------------------- */

    /**
     * Toggle the locked state of the interface.
     * @param {boolean} locked  Is the interface locked?
     */
    toggleLock(locked) {
      const element = this.element[0];
      if ( !element ) return;
      element.querySelectorAll("a.control.category, .create-snapshot, a.button, .entry-title h3").forEach(el => {
        el.classList.toggle("disabled", locked);
      });
      element.querySelectorAll("button").forEach(el => el.disabled = locked);
    }
  }

  const _app$2 = foundry.applications.api;

  /**
   * An application that renders the floating setup menu buttons.
   * @extends ApplicationV2
   * @mixes HandlebarsApplication
   */
  class SetupMenu extends _app$2.HandlebarsApplicationMixin(_app$2.ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      id: "setup-menu",
      tag: "nav",
      window: {
        frame: false,
        positioned: false
      },
      actions: {
        adminLogout: SetupMenu.#onClickAdminLogout,
        backups: SetupMenu.#onClickBackupManager,
        configure: SetupMenu.#onClickConfiguration,
        update: SetupMenu.#onClickUpdate,
        viewWarnings: SetupMenu.#onClickViewWarnings
      }
    }, {inplace: false});

    /** @override */
    static PARTS = {
      buttons: {
        id: "buttons",
        template: "templates/setup/parts/setup-menu.hbs",
      }
    }

    /* -------------------------------------------- */

    /** @override */
    async _prepareContext(options) {
      let { hasUpdate, channel } = game.data.coreUpdate;
      hasUpdate &&= ["testing", "stable"].includes(channel);
      const buttons = [
        {
          action: "viewWarnings",
          tooltip: game.i18n.localize("Warnings"),
          icon: "fa-solid fa-triangle-exclamation",
          pip: game.issueCount.total ? {
            type: game.issueCount.error > 0 ? "error" : "warning",
            label: game.issueCount.total
          } : null
        },
        {
          action: "configure",
          tooltip: "Configure",
          icon: "fa-solid fa-cogs",
          pip: !game.data.options.adminPassword ? {
            type: "warning",
            label: "!"
          } : null
        },
        {
          action: "update",
          tooltip: "Update",
          icon: "fa-solid fa-download",
          pip: hasUpdate ? {
            type: "warning",
            label: "!"
          } : null
        }
      ];

      // Backup
      const canBackup = !game.data.options.noBackups;
      if ( canBackup ) buttons.push({
        action: "backups",
        tooltip: game.i18n.localize("SETUP.BACKUPS.ManageBackups"),
        icon: "fa-solid fa-floppy-disks"
      });

      // Log Out
      const canLogOut = !!game.data.options.adminPassword;
      if ( canLogOut ) buttons.push({
        action: "adminLogout",
        tooltip: "Log Out",
        icon: "fa-solid fa-door-open"
      });
      return {buttons};
    }

    /* -------------------------------------------- */

    /**
     * Toggle the locked state of the interface.
     * @param {boolean} locked  Is the interface locked?
     */
    toggleLock(locked) {
      if ( !this.rendered ) return;
      this.element.querySelectorAll("button").forEach(el => el.disabled = locked);
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    static #onClickAdminLogout() {
      Setup.post({action: "adminLogout"});
    }

    static #onClickBackupManager() {
      new BackupManager().render(true);
    }

    static #onClickConfiguration() {
      new SetupApplicationConfiguration(game.data.options).render(true);
    }

    static #onClickUpdate() {
      window.location.href = foundry.utils.getRoute("update");
    }

    static #onClickViewWarnings(event, target) {
      const warnings = new SetupWarnings();
      const {bottom, right} = target.parentElement.getBoundingClientRect();
      warnings.render(true, {left: right - warnings.options.width, top: bottom + 20});
    }
  }

  /**
   * A FormApplication which facilitates the creation of a new Module.
   */
  class ModuleConfigurationForm extends FormApplication {
    constructor(moduleData, options) {
      super(undefined, options);
      this.#module = new Module(moduleData || {
        id: "my-new-module",
        title: "My New Module",
        version: "1.0.0",
        compatibility: {
          minimum: game.release.generation,
          verified: game.release.generation
        }
      });
      this.#source = moduleData ? game.modules.get(this.#module.id) : undefined;
    }

    /** @override */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "module-create",
        template: "templates/setup/module-configuration.hbs",
        width: 760,
        height: "auto",
        tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "basics"}]
      });
    }

    /** @override */
    get title() {
      if ( !this.#source ) return game.i18n.localize("PACKAGE.ModuleCreate");
      return `${game.i18n.localize("PACKAGE.ModuleEdit")}: ${this.#module.title}`;
    }

    /**
     * A Module instance used as the source data for the form and to validate changes.
     * @type {Module}
     */
    #module;

    /**
     * If editing an existing package, track a reference to its persisted data
     * @type {Module}
     */
    #source;

    /**
     * Display a pending relationship which has not yet been confirmed to appear at the bottom of the list?
     * @type {boolean}
     */
    #pendingRelationship = false;

    /* -------------------------------------------- */

    /** @inheritDoc */
    async getData(options={}) {
      const compendiumTypes = CONST.COMPENDIUM_DOCUMENT_TYPES.map(documentName => {
        return { value: documentName, label: game.i18n.localize(getDocumentClass(documentName).metadata.label) };
      });
      game.i18n.sortObjects(compendiumTypes, "label");

      return {
        compendiumTypes,
        isCreation: !this.#source,
        module: this.#module,
        moduleId: this.#source?.id || "",
        packs: this.#getPacks(),
        relatedPackages: {
          systems: Object.fromEntries(Array.from(game.systems.values()).map(s => [s.id, s.title])),
          modules: Object.fromEntries(Array.from(game.modules.values()).map(m => [m.id, m.title]))
        },
        relationships: this.#getFlattenedRelationships(),
        relationshipCategories: {
          requires: "PACKAGE.Relationships.Requires",
          recommends: "PACKAGE.Relationships.Recommends",
          conflicts: "PACKAGE.Relationships.Conflicts"
        },
        submitLabel: this.#source ? "PACKAGE.ModuleEdit" : "PACKAGE.ModuleCreate"
      }
    }

    /* -------------------------------------------- */

    #getPacks() {
      return this.#module.packs.map(pack => {
        return {
          name: pack.name,
          label: pack.label,
          type: pack.type,
          system: pack.system,
          creating: pack.flags?._placeholder,
          existing: this.#source?.packs.find(p => p.name === pack.name)
        }
      });
    }

    /* -------------------------------------------- */

    /**
     * Flatten the relationships object into an array which is more convenient for rendering.
     * @returns {Array<{id: string, type: string, category: string}>}
     */
    #getFlattenedRelationships() {
      const relationships = [];
      for ( const [category, rs] of Object.entries(this.#module.relationships) ) {
        if ( !["systems", "requires", "recommends", "conflicts"].includes(category) ) continue;
        for ( let [i, r] of Object.entries(Array.from(rs)) ) {
          r = foundry.utils.deepClone(r);
          r.category = category;
          r.index = i;
          relationships.push(r);
        }
      }
      if ( this.#pendingRelationship ) relationships.push({id: "", category: "", index: -1});
      return relationships;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    activateListeners(html) {
      super.activateListeners(html);
      html.on("click", "[data-action]", this.#onAction.bind(this));
      html.on("input", "input[data-slugify]", this.#onSlugify.bind(this));
    }

    /* -------------------------------------------- */

    /**
     * Handle click events on action buttons within the form.
     * @param {Event} event    The originating click event
     */
    #onAction(event) {
      event.preventDefault();
      const button = event.currentTarget;
      switch ( button.dataset.action ) {
        case "authorAdd":
          return this.#authorAdd();
        case "authorDelete":
          return this.#authorDelete(Number(button.dataset.index));
        case "packAdd":
          return this.#packAdd();
        case "packDelete":
          return this.#packDelete(Number(button.dataset.index));
        case "relationshipAdd":
          return this.#relationshipAdd();
        case "relationshipDelete":
          return this.#relationshipDelete(button.dataset.category, Number(button.dataset.index));
      }
    }

    /* -------------------------------------------- */

    /**
     * Add a new entry to the authors array.
     */
    #authorAdd() {
      const data = this._getSubmitData();
      data.authors.push({name: `Author ${data.authors.length + 1}`});
      this.#tryUpdate(data);
    }

    /* -------------------------------------------- */

    /**
     * Delete an entry from the authors array.
     * @param {number} index      The array index to delete
     */
    #authorDelete(index) {
      const data = this._getSubmitData();
      data.authors.splice(index, 1);
      this.#tryUpdate(data);
    }

    /* -------------------------------------------- */

    /**
     * Add a new entry to the packs array.
     */
    #packAdd() {
      const data = this._getSubmitData();
      let i = data.packs.length;
      let nextName;
      while ( true ) {
        i++;
        nextName = `pack-${i}`;
        if ( !data.packs.find(p => p.name === nextName ) && !this.#source?.packs.find(p => p.name === nextName) ) break;
      }
      data.packs.push({
        name: nextName,
        label: `Pack ${i}`,
        path: `packs/${nextName}`,
        type: "JournalEntry",
        ownership: {PLAYER: "OBSERVER", ASSISTANT: "OWNER"},
        flags: {
          _placeholder: true
        }
      });
      this.#tryUpdate(data);
    }

    /* -------------------------------------------- */

    /**
     * Delete an entry from the packs array.
     * @param {number} index      The array index to delete
     */
    #packDelete(index) {
      const data = this._getSubmitData();
      data.packs.splice(index, 1);
      this.#tryUpdate(data);
    }

    /* -------------------------------------------- */

    /**
     * Add a pending relationship entry to the relationships object.
     */
    #relationshipAdd() {
      this.#pendingRelationship = true;
      const data = this._getSubmitData();
      this.#tryUpdate(data);
    }

    /* -------------------------------------------- */

    /**
     * Remove a relationship, or remove the pending relationship from the relationships object.
     * @param {string} category   The relationship category being removed
     * @param {number} index      The array index to delete
     */
    #relationshipDelete(category, index) {
      const data = this._getSubmitData();
      for ( const c of ["systems", "requires", "recommends", "conflicts"] ) {
        if ( !data.relationships[c] ) continue;
        for ( const [i, r] of Object.entries(data.relationships[c]) ) {
          if ( (r._category === category) && (r._index === index) ) {
            data.relationships[c].splice(i, 1);
            break;
          }
        }
      }
      this.#pendingRelationship = false;
      this.#tryUpdate(data);
    }

    /* -------------------------------------------- */

    /** @override */
    async _onChangeInput(event) {
      await super._onChangeInput(event);

      // If the .relationship select changes, update the category select
      if ( event.target.classList.contains("relationship") ) {
        this.#updateRelationshipOptions(event.currentTarget);
      }
    }

    /* -------------------------------------------- */

    /** @override */
    async _render(force, options) {
      await super._render(force, options);
      this.element[0].querySelectorAll("select.relationship")
        .forEach(select => this.#updateRelationshipOptions(select));
    }

    /* -------------------------------------------- */

    /**
     * Swaps what options are available based on Package type
     * @param {HTMLSelectElement} select     The select element
     */
    #updateRelationshipOptions(select) {
      // If this is a system relationship, the only valid category is "system"
      const selectedOption = select.options[select.selectedIndex];
      const isSystem = selectedOption.parentNode.dataset.category === "system";
      const categorySelect = select.closest("fieldset").querySelector("select[name$='.category']");

      // Remove the system option, if it exists
      categorySelect.querySelector("option[value='systems']")?.remove();

      categorySelect.disabled = isSystem;
      if ( isSystem ) {
        // Create a selected option
        const option = document.createElement("option");
        option.value = "systems";
        option.text = game.i18n.localize("PACKAGE.Relationships.Systems");
        option.selected = true;

        // Prepend the selected option
        categorySelect.prepend(option);
      }
    }

    /* -------------------------------------------- */

    /**
     * Automatically slugify a related input field as text is typed.
     * @param {Event} event       The field input event
     */
    #onSlugify(event) {
      const input = event.currentTarget;
      const target = this.form[input.dataset.slugify];
      if ( target.disabled ) return;
      target.placeholder = input.value.slugify({strict: true});
    }

    /* -------------------------------------------- */

    /** @override */
    _getSubmitData(updateData = {}) {
      const fd = new FormDataExtended(this.form, {disabled: true});
      const formData = foundry.utils.expandObject(fd.object);
      const moduleData = this.#module.toObject();

      // Module ID
      if ( this.#source ) formData.id = this.#source.id;
      else if ( !formData.id ) formData.id = formData.title.slugify({strict: true});

      // Authors
      formData.authors = Object.values(formData.authors || {}).map((author, i) => {
        const moduleAuthor = moduleData.authors[i];
        author = foundry.utils.mergeObject(moduleAuthor, author, {inplace: false});
        if ( foundry.utils.isEmpty(author.flags) ) delete author.flags;
        return author;
      });

      // Packs
      formData.packs = Object.values(formData.packs || {}).map((pack, i) => {
        const modulePack = moduleData.packs[i];
        if ( !pack.name ) pack.name = pack.label.slugify({strict: true});
        const sourcePath = this.#source?.packs.find(p => p.name === pack.name)?.path;
        pack.path = sourcePath?.replace(`modules/${this.#source.id}/`, "") ?? `packs/${pack.name}`;
        pack = foundry.utils.mergeObject(modulePack, pack, {inplace: false});
        if ( pack.flags?._placeholder ) delete pack.flags._placeholder;
        if ( foundry.utils.isEmpty(pack.flags) ) delete pack.flags;
        return pack;
      });

      // Relationships
      const relationships = {};
      for ( let r of Object.values(formData.relationships || {}) ) {
        if ( !(r.category && r.id) ) continue;
        const c = r.category;
        delete r.category;
        if ( r._category ) {
          const moduleRelationship = moduleData.relationships[r._category][r._index];
          r = foundry.utils.mergeObject(moduleRelationship, r, {inplace: false});
        }
        if ( foundry.utils.isEmpty(r.compatibility) ) delete r.compatibility;
        relationships[c] ||= [];
        r.type = game.systems.has(r.id) ? "system" : "module";
        relationships[c].push(r);
      }
      formData.relationships = relationships;
      return formData;
    }

    /* -------------------------------------------- */

    /** @override */
    async _updateObject(event, formData) {

      // Assert that the final data is valid
      this.form.disabled = true;
      this.#tryUpdate(formData, {render: false});

      // Prepare request data
      let requestData;
      if ( this.#source ) {
        requestData = this.#source.updateSource(formData, {dryRun: true});
        requestData.id = this.#source.id;
      }
      else {
        requestData = this.#module.toObject();
        if ( game.modules.has(requestData.id) ) {
          const msg = game.i18n.format("PACKAGE.ModuleCreateErrorAlreadyExists", {id: this.#module.id});
          ui.notifications.error(msg, {console: false});
          throw new Error(msg);
        }
      }
      requestData.action = "manageModule";

      // Submit the module management request
      await Setup.post(requestData);
      const msg = this.#source ? "PACKAGE.ModuleEditSuccess" : "PACKAGE.ModuleCreateSuccess";
      ui.notifications.info(game.i18n.format(msg, {id: this.#module.id}));
      return Setup.reload();
    }

    /* -------------------------------------------- */

    /**
     * Attempt to update the working Module instance, displaying error messages for any validation failures.
     * @param {object} changes    Proposed changes to the Module source
     * @param {object} [options]  Additional options
     * @param {boolean} [options.render]  Re-render the app?
     */
    #tryUpdate(changes, {render=true}={}) {
      try {
        this.#module.updateSource(changes);
      } catch(err) {
        ui.notifications.error(err.message);
        this.form.disabled = false;
        throw err;
      }
      if ( render ) this.render();
    }
  }

  /**
   * A class responsible for managing a server-side operation's progress lifecycle.
   */
  class ProgressReceiver extends foundry.utils.EventEmitterMixin(Object) {

    /**
     * @typedef {object} ProgressReceiverPacket
     * @property {string} action     The progress action.
     * @property {string} id         The operation identifier.
     * @property {number} pct        The progress percentage.
     * @property {string} step       The individual step in the action.
     * @property {string} [message]  A text status message.
     * @property {string} [title]    The title of the entry. If not provided, the ID is used instead.
     */

    /**
     * @typedef {object} ProgressReceiverOptions
     * @property {boolean} [notify=true]                  Spawn UI notifications during the lifecycle events.
     * @property {string} [title]                         A human-readable title for the operation.
     * @property {string} [successMessage]                A message to display on operation success.
     * @property {string} [failureMessage]                A message to display on operation failure.
     */

    /**
     * @callback ProgressReceiverProgress
     * @param {ProgressReceiverPacket} data  The progress packet.
     */

    /**
     * @callback ProgressReceiverComplete
     * @param {ProgressReceiverPacket} data  Completion event data.
     * @returns {void}
     */

    /**
     * @param {string} operationId  A unique identifier for the operation.
     * @param {string} action       The operation action.
     * @param {object} [context]    Additional context to send with the request.
     * @param {ProgressReceiverOptions} [options]
     */
    constructor(operationId, action, context={}, options={}) {
      super();
      this.#operationId = operationId;
      this.#action = action;
      this.#context = context;
      this.#options = { notify: true, ...options };
    }

    static emittedEvents = ["progress", "error", "complete"];

    /**
     * The operation action.
     * @type {string}
     */
    #action;

    /**
     * Additional context to send with the request.
     * @type {object}
     */
    #context;

    /**
     * Additional options to configure behavior.
     * @type {ProgressReceiverOptions}
     */
    #options;

    /**
     * A unique identifier for the operation.
     * @type {string}
     */
    get operationId() {
      return this.#operationId;
    }

    #operationId;

    /**
     * The progress listener.
     * @type {function}
     */
    #progressListener = this._onProgress.bind(this);

    /**
     * A callback to invoke on operation success.
     * @type {function}
     */
    #resolve;

    /* -------------------------------------------- */

    /**
     * Handle operation completion.
     * @param {ProgressReceiverPacket} data  Completion event data.
     * @protected
     */
    _onComplete(data) {
      const { notify, successMessage } = this.#options;
      if ( notify && successMessage ) ui.notifications.info(successMessage);
      Setup._removeProgressListener(this.#progressListener);
      const event = new Event("complete");
      event.data = data;
      this.dispatchEvent(event);
      this.#resolve(data);
    }

    /* -------------------------------------------- */

    /**
     * Handle an error during the operation.
     * @param {object} data        Error event data.
     * @param {string} data.error  The error message.
     * @param {string} data.stack  The error stack.
     * @protected
     */
    _onError(data) {
      const { error, stack, ...context } = data;
      const { notify, failureMessage } = this.#options;
      const err = new Error(error);
      err.stack = stack;
      err.context = context;
      if ( notify && failureMessage ) ui.notifications.error(failureMessage, { console: false, permanent: true });
      console.error(err);
      ui.setupPackages?.removeProgressBar(this.#operationId);
      Setup._removeProgressListener(this.#progressListener);
      const event = new Event("error");
      event.data = data;
      this.dispatchEvent(event);
      this.#resolve(err);
    }

    /* -------------------------------------------- */

    /**
     * Handle progress ticks.
     * @param {ProgressReceiverPacket} data  Progress event data.
     * @protected
     */
    _onProgress(data) {
      const { STEPS } = CONST.SETUP_PACKAGE_PROGRESS;
      const { action, step, id } = data;
      if ( (action !== this.#action) || (id !== this.operationId) ) return;
      if ( (this.#options.title !== undefined) && !("title" in data) ) data.title = this.#options.title;
      ui.setupPackages?.onProgress(data);
      const event = new Event("progress");
      event.data = data;
      this.dispatchEvent(event);
      if ( step === STEPS.ERROR ) return this._onError(data);
      if ( step === STEPS.COMPLETE ) return this._onComplete(data);
    }

    /* -------------------------------------------- */

    /**
     * Handle a warning during the operation.
     * @param {object} data          Warning event data.
     * @param {string} data.warning  The warning message.
     * @protected
     */
    _onWarning({ warning }) {
      if ( this.#options.notify ) ui.notifications.warn(warning);
    }

    /* -------------------------------------------- */

    /**
     * Fire the request and begin listening for progress events.
     * @returns {Promise<void>}
     */
    listen() {
      return new Promise(async (resolve, reject) => {
        this.#resolve = resolve;
        Setup._addProgressListener(this.#progressListener);
        let response;
        try {
          response = await Setup.post({ ...this.#context, action: this.#action });
        } catch(err) {
          Setup._removeProgressListener(this.#progressListener);
          return reject(err);
        }
        if ( response.error ) this._onError(response);
        if ( response.warning ) this._onWarning(response);
      });
    }
  }

  /**
   * @typedef {import("../types.mjs").Constructor} Constructor
   */

  /**
   * @callback EmittedEventListener
   * @param {Event} event         The emitted event
   * @returns {any}
   */

  /**
   * Augment a base class with EventEmitter behavior.
   * @template {Constructor} BaseClass
   * @param {BaseClass} BaseClass         Some base class augmented with event emitter functionality
   */
  function EventEmitterMixin(BaseClass) {
    /**
     * A mixin class which implements the behavior of EventTarget.
     * This is useful in cases where a class wants EventTarget-like behavior but needs to extend some other class.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
     */
    class EventEmitter extends BaseClass {

      /**
       * An array of event types which are valid for this class.
       * @type {string[]}
       */
      static emittedEvents = [];

      /**
       * A mapping of registered events.
       * @type {Record<string, Map<EmittedEventListener, {fn: EmittedEventListener, once: boolean}>>}
       */
      #events = {};

      /* -------------------------------------------- */

      /**
       * Add a new event listener for a certain type of event.
       * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
       * @param {string} type                     The type of event being registered for
       * @param {EmittedEventListener} listener   The listener function called when the event occurs
       * @param {object} [options={}]             Options which configure the event listener
       * @param {boolean} [options.once=false]      Should the event only be responded to once and then removed
       */
      addEventListener(type, listener, {once = false} = {}) {
        if ( !this.constructor.emittedEvents.includes(type) ) {
          throw new Error(`"${type}" is not a supported event of the ${this.constructor.name} class`);
        }
        this.#events[type] ||= new Map();
        this.#events[type].set(listener, {fn: listener, once});
      }

      /* -------------------------------------------- */

      /**
       * Remove an event listener for a certain type of event.
       * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener
       * @param {string} type                     The type of event being removed
       * @param {EmittedEventListener} listener   The listener function being removed
       */
      removeEventListener(type, listener) {
        this.#events[type]?.delete(listener);
      }

      /* -------------------------------------------- */

      /**
       * Dispatch an event on this target.
       * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent
       * @param {Event} event                     The Event to dispatch
       * @returns {boolean}                       Was default behavior for the event prevented?
       */
      dispatchEvent(event) {
        if ( !(event instanceof Event) ) {
          throw new Error("EventEmitter#dispatchEvent must be provided an Event instance");
        }
        if ( !this.constructor.emittedEvents.includes(event?.type) ) {
          throw new Error(`"${event.type}" is not a supported event of the ${this.constructor.name} class`);
        }
        const listeners = this.#events[event.type];
        if ( !listeners ) return true;

        // Extend and configure the Event
        Object.defineProperties(event, {
          target: {value: this},
          stopPropagation: {value: function() {
            event.propagationStopped = true;
            Event.prototype.stopPropagation.call(this);
          }},
          stopImmediatePropagation: {value: function() {
            event.propagationStopped = true;
            Event.prototype.stopImmediatePropagation.call(this);
          }}
        });

        // Call registered listeners
        for ( const listener of listeners.values() ) {
          listener.fn(event);
          if ( listener.once ) this.removeEventListener(event.type, listener.fn);
          if ( event.propagationStopped ) break;
        }
        return event.defaultPrevented;
      }
    }
    return EventEmitter;
  }

  /**
   * A simple Semaphore implementation which provides a limited queue for ensuring proper concurrency.
   * @param {number} [max=1]    The maximum number of tasks which are allowed concurrently.
   *
   * @example Using a Semaphore
   * ```js
   * // Some async function that takes time to execute
   * function fn(x) {
   *   return new Promise(resolve => {
   *     setTimeout(() => {
   *       console.log(x);
   *       resolve(x);
   *     }, 1000));
   *   }
   * };
   *
   * // Create a Semaphore and add many concurrent tasks
   * const semaphore = new Semaphore(1);
   * for ( let i of Array.fromRange(100) ) {
   *   semaphore.add(fn, i);
   * }
   * ```
   */
  class Semaphore {
    constructor(max=1) {

      /**
       * The maximum number of tasks which can be simultaneously attempted.
       * @type {number}
       */
      this.max = max;

      /**
       * A queue of pending function signatures
       * @type {Array<Array<Function|*>>}
       * @private
       */
      this._queue = [];

      /**
       * The number of tasks which are currently underway
       * @type {number}
       * @private
       */
      this._active = 0;
    }

    /**
     * The number of pending tasks remaining in the queue
     * @type {number}
     */
    get remaining() {
      return this._queue.length;
    }

    /**
     * The number of actively executing tasks
     * @type {number}
     */
    get active() {
      return this._active;
    }

    /**
     * Add a new tasks to the managed queue
     * @param {Function} fn     A callable function
     * @param {...*} [args]     Function arguments
     * @returns {Promise}       A promise that resolves once the added function is executed
     */
    add(fn, ...args) {
      return new Promise((resolve, reject) => {
        this._queue.push([fn, args, resolve, reject]);
        return this._try();
      });
    }

    /**
     * Abandon any tasks which have not yet concluded
     */
    clear() {
      this._queue = [];
    }

    /**
     * Attempt to perform a task from the queue.
     * If all workers are busy, do nothing.
     * If successful, try again.
     * @private
     */
    async _try() {
      if ( (this.active === this.max) || !this.remaining ) return false;

      // Obtain the next task from the queue
      const next = this._queue.shift();
      if ( !next ) return;
      this._active += 1;

      // Try and execute it, resolving its promise
      const [fn, args, resolve, reject] = next;
      try {
        const r = await fn(...args);
        resolve(r);
      }
      catch(err) {
        reject(err);
      }

      // Try the next function in the queue
      this._active -= 1;
      return this._try();
    }
  }

  /**
   * @typedef {import("../_types.mjs").ApplicationConfiguration} ApplicationConfiguration
   * @typedef {import("../_types.mjs").ApplicationRenderOptions} ApplicationRenderOptions
   * @typedef {import("../_types.mjs").ApplicationRenderContext} ApplicationRenderContext
   * @typedef {import("../_types.mjs").ApplicationClosingOptions} ApplicationClosingOptions
   * @typedef {import("../_types.mjs").ApplicationPosition} ApplicationPosition
   * @typedef {import("../_types.mjs").ApplicationHeaderControlsEntry} ApplicationHeaderControlsEntry
   */

  /**
   * The Application class is responsible for rendering an HTMLElement into the Foundry Virtual Tabletop user interface.
   * @template {ApplicationConfiguration} Configuration
   * @template {ApplicationRenderOptions} RenderOptions
   * @alias ApplicationV2
   */
  class ApplicationV2 extends EventEmitterMixin(Object) {

    /**
     * Applications are constructed by providing an object of configuration options.
     * @param {Partial<Configuration>} [options]     Options used to configure the Application instance
     */
    constructor(options={}) {
      super();

      // Configure Application Options
      this.options = Object.freeze(this._initializeApplicationOptions(options));
      this.#id = this.options.id.replace("{id}", this.options.uniqueId);
      Object.assign(this.#position, this.options.position);

      // Verify the Application class is renderable
      this.#renderable = (this._renderHTML !== ApplicationV2.prototype._renderHTML)
        && (this._replaceHTML !== ApplicationV2.prototype._replaceHTML);
    }

    /**
     * Designates which upstream Application class in this class' inheritance chain is the base application.
     * Any DEFAULT_OPTIONS of super-classes further upstream of the BASE_APPLICATION are ignored.
     * Hook events for super-classes further upstream of the BASE_APPLICATION are not dispatched.
     * @type {typeof ApplicationV2}
     */
    static BASE_APPLICATION = ApplicationV2;

    /**
     * The default configuration options which are assigned to every instance of this Application class.
     * @type {Partial<Configuration>}
     */
    static DEFAULT_OPTIONS = {
      id: "app-{id}",
      classes: [],
      tag: "div",
      window: {
        frame: true,
        positioned: true,
        title: "",
        icon: "",
        controls: [],
        minimizable: true,
        resizable: false,
        contentTag: "section",
        contentClasses: []
      },
      actions: {},
      form: {
        handler: undefined,
        submitOnChange: false,
        closeOnSubmit: false
      },
      position: {}
    }

    /**
     * The sequence of rendering states that describe the Application life-cycle.
     * @enum {number}
     */
    static RENDER_STATES = Object.freeze({
      ERROR: -3,
      CLOSING: -2,
      CLOSED: -1,
      NONE: 0,
      RENDERING: 1,
      RENDERED: 2
    });

    /**
     * Which application is currently "in front" with the maximum z-index
     * @type {ApplicationV2}
     */
    static #frontApp;

    /** @override */
    static emittedEvents = Object.freeze(["render", "close", "position"]);

    /**
     * Application instance configuration options.
     * @type {Configuration}
     */
    options;

    /**
     * @type {string}
     */
    #id;

    /**
     * Flag that this Application instance is renderable.
     * Applications are not renderable unless a subclass defines the _renderHTML and _replaceHTML methods.
     */
    #renderable = true;

    /**
     * The outermost HTMLElement of this rendered Application.
     * For window applications this is ApplicationV2##frame.
     * For non-window applications this ApplicationV2##content.
     * @type {HTMLDivElement}
     */
    #element;

    /**
     * The HTMLElement within which inner HTML is rendered.
     * For non-window applications this is the same as ApplicationV2##element.
     * @type {HTMLElement}
     */
    #content;

    /**
     * Data pertaining to the minimization status of the Application.
     * @type {{
     *  active: boolean,
     *  [priorWidth]: number,
     *  [priorHeight]: number,
     *  [priorBoundingWidth]: number,
     *  [priorBoundingHeight]: number
     * }}
     */
    #minimization = Object.seal({
      active: false,
      priorWidth: undefined,
      priorHeight: undefined,
      priorBoundingWidth: undefined,
      priorBoundingHeight: undefined
    });

    /**
     * The rendered position of the Application.
     * @type {ApplicationPosition}
     */
    #position = Object.seal({
      top: undefined,
      left: undefined,
      width: undefined,
      height: "auto",
      scale: 1,
      zIndex: _maxZ
    });

    /**
     * @type {ApplicationV2.RENDER_STATES}
     */
    #state = ApplicationV2.RENDER_STATES.NONE;

    /**
     * A Semaphore used to enqueue asynchronous operations.
     * @type {Semaphore}
     */
    #semaphore = new Semaphore(1);

    /**
     * Convenience references to window header elements.
     * @type {{
     *  header: HTMLElement,
     *  resize: HTMLElement,
     *  title: HTMLHeadingElement,
     *  icon: HTMLElement,
     *  close: HTMLButtonElement,
     *  controls: HTMLButtonElement,
     *  controlsDropdown: HTMLDivElement,
     *  onDrag: Function,
     *  onResize: Function,
     *  pointerStartPosition: ApplicationPosition,
     *  pointerMoveThrottle: boolean
     * }}
     */
    get window() {
      return this.#window;
    }
    #window = {
      title: undefined,
      icon: undefined,
      close: undefined,
      controls: undefined,
      controlsDropdown: undefined,
      onDrag: this.#onWindowDragMove.bind(this),
      onResize: this.#onWindowResizeMove.bind(this),
      pointerStartPosition: undefined,
      pointerMoveThrottle: false
    };

    /**
     * If this Application uses tabbed navigation groups, this mapping is updated whenever the changeTab method is called.
     * Reports the active tab for each group.
     * Subclasses may override this property to define default tabs for each group.
     * @type {Record<string, string>}
     */
    tabGroups = {};

    /* -------------------------------------------- */
    /*  Application Properties                      */
    /* -------------------------------------------- */

    /**
     * The CSS class list of this Application instance
     * @type {DOMTokenList}
     */
    get classList() {
      return this.#element?.classList;
    }

    /**
     * The HTML element ID of this Application instance.
     * @type {string}
     */
    get id() {
      return this.#id;
    }

    /**
     * A convenience reference to the title of the Application window.
     * @type {string}
     */
    get title() {
      return game.i18n.localize(this.options.window.title);
    }

    /**
     * The HTMLElement which renders this Application into the DOM.
     * @type {HTMLElement}
     */
    get element() {
      return this.#element;
    }

    /**
     * Is this Application instance currently minimized?
     * @type {boolean}
     */
    get minimized() {
      return this.#minimization.active;
    }

    /**
     * The current position of the application with respect to the window.document.body.
     * @type {ApplicationPosition}
     */
    position = new Proxy(this.#position, {
      set: (obj, prop, value) => {
        if ( prop in obj ) {
          obj[prop] = value;
          this._updatePosition(this.#position);
          return value;
        }
      }
    });

    /**
     * Is this Application instance currently rendered?
     * @type {boolean}
     */
    get rendered() {
      return this.#state === ApplicationV2.RENDER_STATES.RENDERED;
    }

    /**
     * The current render state of the Application.
     * @type {ApplicationV2.RENDER_STATES}
     */
    get state() {
      return this.#state;
    }

    /**
     * Does this Application instance render within an outer window frame?
     * @type {boolean}
     */
    get hasFrame() {
      return this.options.window.frame;
    }

    /* -------------------------------------------- */
    /*  Initialization                              */
    /* -------------------------------------------- */

    /**
     * Iterate over the inheritance chain of this Application.
     * The chain includes this Application itself and all parents until the base application is encountered.
     * @see ApplicationV2.BASE_APPLICATION
     * @generator
     * @yields {typeof ApplicationV2}
     */
    static *inheritanceChain() {
      let cls = this;
      while ( cls ) {
        yield cls;
        if ( cls === this.BASE_APPLICATION ) return;
        cls = Object.getPrototypeOf(cls);
      }
    }

    /* -------------------------------------------- */

    /**
     * Initialize configuration options for the Application instance.
     * The default behavior of this method is to intelligently merge options for each class with those of their parents.
     * - Array-based options are concatenated
     * - Inner objects are merged
     * - Otherwise, properties in the subclass replace those defined by a parent
     * @param {Partial<ApplicationConfiguration>} options      Options provided directly to the constructor
     * @returns {ApplicationConfiguration}                     Configured options for the application instance
     * @protected
     */
    _initializeApplicationOptions(options) {

      // Options initialization order
      const order = [options];
      for ( const cls of this.constructor.inheritanceChain() ) {
        order.unshift(cls.DEFAULT_OPTIONS);
      }

      // Intelligently merge with parent class options
      const applicationOptions = {};
      for ( const opts of order ) {
        for ( const [k, v] of Object.entries(opts) ) {
          if ( (k in applicationOptions) ) {
            const v0 = applicationOptions[k];
            if ( Array.isArray(v0) ) applicationOptions[k].push(...v);                // Concatenate arrays
            else if ( foundry.utils.getType(v0) === "Object") Object.assign(v0, v);   // Merge objects
            else applicationOptions[k] = foundry.utils.deepClone(v);                  // Override option
          }
          else applicationOptions[k] = foundry.utils.deepClone(v);
        }
      }

      // Unique application ID
      applicationOptions.uniqueId = String(++globalThis._appId);

      // Special handling for classes
      if ( applicationOptions.window.frame ) applicationOptions.classes.unshift("application");
      applicationOptions.classes = Array.from(new Set(applicationOptions.classes));
      return applicationOptions;
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /**
     * Render the Application, creating its HTMLElement and replacing its innerHTML.
     * Add it to the DOM if it is not currently rendered and rendering is forced. Otherwise, re-render its contents.
     * @param {boolean|RenderOptions} [options]             Options which configure application rendering behavior.
     *                                                      A boolean is interpreted as the "force" option.
     * @param {RenderOptions} [_options]                    Legacy options for backwards-compatibility with the original
     *                                                      ApplicationV1#render signature.
     * @returns {Promise<ApplicationV2>}            A Promise which resolves to the rendered Application instance
     */
    async render(options={}, _options={}) {
      if ( typeof options === "boolean" ) options = Object.assign(_options, {force: options});
      return this.#semaphore.add(this.#render.bind(this), options);
    }

    /* -------------------------------------------- */

    /**
     * Manage the rendering step of the Application life-cycle.
     * This private method delegates out to several protected methods which can be defined by the subclass.
     * @param {RenderOptions} [options]             Options which configure application rendering behavior
     * @returns {Promise<ApplicationV2>}            A Promise which resolves to the rendered Application instance
     */
    async #render(options) {
      const states = ApplicationV2.RENDER_STATES;
      if ( !this.#renderable ) throw new Error(`The ${this.constructor.name} Application class is not renderable because`
        + " it does not define the _renderHTML and _replaceHTML methods which are required.");

      // Verify that the Application is allowed to be rendered
      try {
        const canRender = this._canRender(options);
        if ( canRender === false ) return this;
      } catch(err) {
        ui.notifications.warn(err.message);
        return this;
      }
      options.isFirstRender = this.#state <= states.NONE;

      // Prepare rendering context data
      this._configureRenderOptions(options);
      const context = await this._prepareContext(options);

      // Pre-render life-cycle events (awaited)
      if ( options.isFirstRender ) {
        if ( !options.force ) return this;
        await this.#doEvent(this._preFirstRender, {async: true, handlerArgs: [context, options],
          debugText: "Before first render"});
      }
      await this.#doEvent(this._preRender, {async: true, handlerArgs: [context, options],
        debugText: "Before render"});

      // Render the Application frame
      this.#state = states.RENDERING;
      if ( options.isFirstRender ) {
        this.#element = await this._renderFrame(options);
        this.#content = this.hasFrame ? this.#element.querySelector(".window-content") : this.#element;
        this._attachFrameListeners();
      }

      // Render Application content
      try {
        const result = await this._renderHTML(context, options);
        this._replaceHTML(result, this.#content, options);
      }
      catch(err) {
        if ( this.#element ) {
          this.#element.remove();
          this.#element = null;
        }
        this.#state = states.ERROR;
        throw new Error(`Failed to render Application "${this.id}":\n${err.message}`, { cause: err });
      }

      // Register the rendered Application
      if ( options.isFirstRender ) {
        foundry.applications.instances.set(this.#id, this);
        this._insertElement(this.#element);
      }
      if ( this.hasFrame ) this._updateFrame(options);
      this.#state = states.RENDERED;

      // Post-render life-cycle events (not awaited)
      if ( options.isFirstRender ) {
        // noinspection ES6MissingAwait
        this.#doEvent(this._onFirstRender, {handlerArgs: [context, options], debugText: "After first render"});
      }
      // noinspection ES6MissingAwait
      this.#doEvent(this._onRender, {handlerArgs: [context, options], debugText: "After render", eventName: "render",
          hookName: "render", hookArgs: [this.#element]});

      // Update application position
      if ( "position" in options ) this.setPosition(options.position);
      if ( options.force && this.minimized ) this.maximize();
      return this;
    }

    /* -------------------------------------------- */

    /**
     * Modify the provided options passed to a render request.
     * @param {RenderOptions} options                 Options which configure application rendering behavior
     * @protected
     */
    _configureRenderOptions(options) {
      const isFirstRender = this.#state <= ApplicationV2.RENDER_STATES.NONE;
      const {window, position} = this.options;

      // Initial frame options
      if ( isFirstRender ) {
        if ( this.hasFrame ) {
          options.window ||= {};
          options.window.title ||= this.title;
          options.window.icon ||= window.icon;
          options.window.controls = true;
          options.window.resizable = window.resizable;
        }
      }

      // Automatic repositioning
      if ( isFirstRender ) options.position = Object.assign(this.#position, options.position);
      else {
        if ( position.width === "auto" ) options.position = Object.assign({width: "auto"}, options.position);
        if ( position.height === "auto" ) options.position = Object.assign({height: "auto"}, options.position);
      }
    }

    /* -------------------------------------------- */

    /**
     * Prepare application rendering context data for a given render request.
     * @param {RenderOptions} options                 Options which configure application rendering behavior
     * @returns {Promise<ApplicationRenderContext>}   Context data for the render operation
     * @protected
     */
    async _prepareContext(options) {
      return {};
    }

    /* -------------------------------------------- */

    /**
     * Configure the array of header control menu options
     * @returns {ApplicationHeaderControlsEntry[]}
     * @protected
     */
    _getHeaderControls() {
      return this.options.window.controls || [];
    }

    /* -------------------------------------------- */

    /**
     * Iterate over header control buttons, filtering for controls which are visible for the current client.
     * @returns {Generator<ApplicationHeaderControlsEntry>}
     * @yields {ApplicationHeaderControlsEntry}
     * @protected
     */
    *_headerControlButtons() {
      for ( const control of this._getHeaderControls() ) {
        if ( control.visible === false ) continue;
        yield control;
      }
    }

    /* -------------------------------------------- */

    /**
     * Render an HTMLElement for the Application.
     * An Application subclass must implement this method in order for the Application to be renderable.
     * @param {ApplicationRenderContext} context      Context data for the render operation
     * @param {RenderOptions} options                 Options which configure application rendering behavior
     * @returns {Promise<any>}                        The result of HTML rendering may be implementation specific.
     *                                                Whatever value is returned here is passed to _replaceHTML
     * @abstract
     */
    async _renderHTML(context, options) {}

    /* -------------------------------------------- */

    /**
     * Replace the HTML of the application with the result provided by the rendering backend.
     * An Application subclass should implement this method in order for the Application to be renderable.
     * @param {any} result                            The result returned by the application rendering backend
     * @param {HTMLElement} content                   The content element into which the rendered result must be inserted
     * @param {RenderOptions} options                 Options which configure application rendering behavior
     * @protected
     */
    _replaceHTML(result, content, options) {}

    /* -------------------------------------------- */

    /**
     * Render the outer framing HTMLElement which wraps the inner HTML of the Application.
     * @param {RenderOptions} options                 Options which configure application rendering behavior
     * @returns {Promise<HTMLElement>}
     * @protected
     */
    async _renderFrame(options) {
      const frame = document.createElement(this.options.tag);
      frame.id = this.#id;
      if ( this.options.classes.length ) frame.className = this.options.classes.join(" ");
      if ( !this.hasFrame ) return frame;

      // Window applications
      const labels = {
        controls: game.i18n.localize("APPLICATION.TOOLS.ControlsMenu"),
        toggleControls: game.i18n.localize("APPLICATION.TOOLS.ToggleControls"),
        close: game.i18n.localize("APPLICATION.TOOLS.Close")
      };
      const contentClasses = ["window-content", ...this.options.window.contentClasses].join(" ");
      frame.innerHTML = `<header class="window-header">
      <i class="window-icon hidden"></i>
      <h1 class="window-title"></h1>
      <button type="button" class="header-control fa-solid fa-ellipsis-vertical"
              data-tooltip="${labels.toggleControls}" aria-label="${labels.toggleControls}"
              data-action="toggleControls"></button>
      <button type="button" class="header-control fa-solid fa-times"
              data-tooltip="${labels.close}" aria-label="${labels.close}" data-action="close"></button>
    </header>
    <menu class="controls-dropdown"></menu>
    <${this.options.window.contentTag} class="${contentClasses}"></section>
    ${this.options.window.resizable ? `<div class="window-resize-handle"></div>` : ""}`;

      // Reference elements
      this.#window.header = frame.querySelector(".window-header");
      this.#window.title = frame.querySelector(".window-title");
      this.#window.icon = frame.querySelector(".window-icon");
      this.#window.resize = frame.querySelector(".window-resize-handle");
      this.#window.close = frame.querySelector("button[data-action=close]");
      this.#window.controls = frame.querySelector("button[data-action=toggleControls]");
      this.#window.controlsDropdown = frame.querySelector(".controls-dropdown");
      return frame;
    }

    /* -------------------------------------------- */

    /**
     * Render a header control button.
     * @param {ApplicationHeaderControlsEntry} control
     * @returns {HTMLLIElement}
     * @protected
     */
    _renderHeaderControl(control) {
      const li = document.createElement("li");
      li.className = "header-control";
      li.dataset.action = control.action;
      const label = game.i18n.localize(control.label);
      li.innerHTML = `<button type="button" class="control">
        <i class="control-icon fa-fw ${control.icon}"></i><span class="control-label">${label}</span>
    </button>`;
      return li;
    }

    /* -------------------------------------------- */

    /**
     * When the Application is rendered, optionally update aspects of the window frame.
     * @param {RenderOptions} options               Options provided at render-time
     * @protected
     */
    _updateFrame(options) {
      const window = options.window;
      if ( !window ) return;
      if ( "title" in window ) this.#window.title.innerText = window.title;
      if ( "icon" in window ) this.#window.icon.className = `window-icon fa-fw ${window.icon || "hidden"}`;

      // Window header controls
      if ( "controls" in window ) {
        const controls = [];
        for ( const c of this._headerControlButtons() ) {
          controls.push(this._renderHeaderControl(c));
        }
        this.#window.controlsDropdown.replaceChildren(...controls);
        this.#window.controls.classList.toggle("hidden", !controls.length);
      }
    }

    /* -------------------------------------------- */

    /**
     * Insert the application HTML element into the DOM.
     * Subclasses may override this method to customize how the application is inserted.
     * @param {HTMLElement} element                 The element to insert
     * @protected
     */
    _insertElement(element) {
      const existing = document.getElementById(element.id);
      if ( existing ) existing.replaceWith(element);
      else document.body.append(element);
      element.querySelector("[autofocus]")?.focus();
    }

    /* -------------------------------------------- */
    /*  Closing                                     */
    /* -------------------------------------------- */

    /**
     * Close the Application, removing it from the DOM.
     * @param {ApplicationClosingOptions} [options] Options which modify how the application is closed.
     * @returns {Promise<ApplicationV2>}            A Promise which resolves to the closed Application instance
     */
    async close(options={}) {
      return this.#semaphore.add(this.#close.bind(this), options);
    }

    /* -------------------------------------------- */

    /**
     * Manage the closing step of the Application life-cycle.
     * This private method delegates out to several protected methods which can be defined by the subclass.
     * @param {ApplicationClosingOptions} [options] Options which modify how the application is closed
     * @returns {Promise<ApplicationV2>}            A Promise which resolves to the rendered Application instance
     */
    async #close(options) {
      const states = ApplicationV2.RENDER_STATES;
      if ( !this.#element ) {
        this.#state = states.CLOSED;
        return this;
      }

      // Pre-close life-cycle events (awaited)
      await this.#doEvent(this._preClose, {async: true, handlerArgs: [options], debugText: "Before close"});

      // Set explicit dimensions for the transition.
      if ( options.animate !== false ) {
        const { width, height } = this.#element.getBoundingClientRect();
        this.#applyPosition({ ...this.#position, width, height });
      }

      // Remove the application element
      this.#element.classList.add("minimizing");
      this.#element.style.maxHeight = "0px";
      this.#state = states.CLOSING;
      if ( options.animate !== false ) await this._awaitTransition(this.#element, 1000);

      // Remove the closed element
      this._removeElement(this.#element);
      this.#element = null;
      this.#state = states.CLOSED;
      foundry.applications.instances.delete(this.#id);

      // Reset minimization state
      this.#minimization.active = false;

      // Post-close life-cycle events (not awaited)
      // noinspection ES6MissingAwait
      this.#doEvent(this._onClose, {handlerArgs: [options], debugText: "After close", eventName: "close",
        hookName: "close"});
      return this;
    }

    /* -------------------------------------------- */

    /**
     * Remove the application HTML element from the DOM.
     * Subclasses may override this method to customize how the application element is removed.
     * @param {HTMLElement} element                 The element to be removed
     * @protected
     */
    _removeElement(element) {
      element.remove();
    }

    /* -------------------------------------------- */
    /*  Positioning                                 */
    /* -------------------------------------------- */

    /**
     * Update the Application element position using provided data which is merged with the prior position.
     * @param {Partial<ApplicationPosition>} [position] New Application positioning data
     * @returns {ApplicationPosition}                   The updated application position
     */
    setPosition(position) {
      if ( !this.options.window.positioned ) return;
      position = Object.assign(this.#position, position);
      this.#doEvent(this._prePosition, {handlerArgs: [position], debugText: "Before reposition"});

      // Update resolved position
      const updated = this._updatePosition(position);
      Object.assign(this.#position, updated);

      // Assign CSS styles
      this.#applyPosition(updated);
      this.#doEvent(this._onPosition, {handlerArgs: [position], debugText: "After reposition", eventName: "position"});
      return position;
    }

    /* -------------------------------------------- */

    /**
     * Translate a requested application position updated into a resolved allowed position for the Application.
     * Subclasses may override this method to implement more advanced positioning behavior.
     * @param {ApplicationPosition} position        Requested Application positioning data
     * @returns {ApplicationPosition}               Resolved Application positioning data
     * @protected
     */
    _updatePosition(position) {
      if ( !this.#element ) return position;
      const el = this.#element;
      let {width, height, left, top, scale} = position;
      scale ??= 1.0;
      const computedStyle = getComputedStyle(el);
      let minWidth = ApplicationV2.parseCSSDimension(computedStyle.minWidth, el.parentElement.offsetWidth) || 0;
      let maxWidth = ApplicationV2.parseCSSDimension(computedStyle.maxWidth, el.parentElement.offsetWidth) || Infinity;
      let minHeight = ApplicationV2.parseCSSDimension(computedStyle.minHeight, el.parentElement.offsetHeight) || 0;
      let maxHeight = ApplicationV2.parseCSSDimension(computedStyle.maxHeight, el.parentElement.offsetHeight) || Infinity;
      let bounds = el.getBoundingClientRect();
      const {clientWidth, clientHeight} = document.documentElement;

      // Explicit width
      const autoWidth = width === "auto";
      if ( !autoWidth ) {
        const targetWidth = Number(width || bounds.width);
        minWidth = parseInt(minWidth) || 0;
        maxWidth = parseInt(maxWidth) || (clientWidth / scale);
        width = Math.clamp(targetWidth, minWidth, maxWidth);
      }

      // Explicit height
      const autoHeight = height === "auto";
      if ( !autoHeight ) {
        const targetHeight = Number(height || bounds.height);
        minHeight = parseInt(minHeight) || 0;
        maxHeight = parseInt(maxHeight) || (clientHeight / scale);
        height = Math.clamp(targetHeight, minHeight, maxHeight);
      }

      // Implicit height
      if ( autoHeight ) {
        Object.assign(el.style, {width: `${width}px`, height: ""});
        bounds = el.getBoundingClientRect();
        height = bounds.height;
      }

      // Implicit width
      if ( autoWidth ) {
        Object.assign(el.style, {height: `${height}px`, width: ""});
        bounds = el.getBoundingClientRect();
        width = bounds.width;
      }

      // Left Offset
      const scaledWidth = width * scale;
      const targetLeft = left ?? ((clientWidth - scaledWidth) / 2);
      const maxLeft = Math.max(clientWidth - scaledWidth, 0);
      left = Math.clamp(targetLeft, 0, maxLeft);

      // Top Offset
      const scaledHeight = height * scale;
      const targetTop = top ?? ((clientHeight - scaledHeight) / 2);
      const maxTop = Math.max(clientHeight - scaledHeight, 0);
      top = Math.clamp(targetTop, 0, maxTop);

      // Scale
      scale ??= 1.0;
      return {width: autoWidth ? "auto" : width, height: autoHeight ? "auto" : height, left, top, scale};
    }

    /* -------------------------------------------- */

    /**
     * Apply validated position changes to the element.
     * @param {ApplicationPosition} position  The new position data to apply.
     */
    #applyPosition(position) {
      Object.assign(this.#element.style, {
        width: position.width === "auto" ? "" : `${position.width}px`,
        height: position.height === "auto" ? "" : `${position.height}px`,
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: position.scale === 1 ? "" : `scale(${position.scale})`
      });
    }

    /* -------------------------------------------- */
    /*  Other Public Methods                        */
    /* -------------------------------------------- */

    /**
     * Is the window control buttons menu currently expanded?
     * @type {boolean}
     */
    #controlsExpanded = false;

    /**
     * Toggle display of the Application controls menu.
     * Only applicable to window Applications.
     * @param {boolean} [expanded]      Set the controls visibility to a specific state.
     *                                  Otherwise, the visible state is toggled from its current value
     */
    toggleControls(expanded) {
      expanded ??= !this.#controlsExpanded;
      if ( expanded === this.#controlsExpanded ) return;
      const dropdown = this.#element.querySelector(".controls-dropdown");
      dropdown.classList.toggle("expanded", expanded);
      this.#controlsExpanded = expanded;
      game.tooltip.deactivate();
    }

    /* -------------------------------------------- */

    /**
     * Minimize the Application, collapsing it to a minimal header.
     * @returns {Promise<void>}
     */
    async minimize() {
      if ( this.minimized || !this.hasFrame || !this.options.window.minimizable ) return;
      this.#minimization.active = true;

      // Set explicit dimensions for the transition.
      const { width, height } = this.#element.getBoundingClientRect();
      this.#applyPosition({ ...this.#position, width, height });

      // Record pre-minimization data
      this.#minimization.priorWidth = this.#position.width;
      this.#minimization.priorHeight = this.#position.height;
      this.#minimization.priorBoundingWidth = width;
      this.#minimization.priorBoundingHeight = height;

      // Animate to collapsed size
      this.#element.classList.add("minimizing");
      this.#element.style.maxWidth = "var(--minimized-width)";
      this.#element.style.maxHeight = "var(--header-height)";
      await this._awaitTransition(this.#element, 1000);
      this.#element.classList.add("minimized");
      this.#element.classList.remove("minimizing");
    }

    /* -------------------------------------------- */

    /**
     * Restore the Application to its original dimensions.
     * @returns {Promise<void>}
     */
    async maximize() {
      if ( !this.minimized ) return;
      this.#minimization.active = false;

      // Animate back to full size
      const { priorBoundingWidth: width, priorBoundingHeight: height } = this.#minimization;
      this.#element.classList.remove("minimized");
      this.#element.classList.add("maximizing");
      this.#element.style.maxWidth = "";
      this.#element.style.maxHeight = "";
      this.#applyPosition({ ...this.#position, width, height });
      await this._awaitTransition(this.#element, 1000);
      this.#element.classList.remove("maximizing");

      // Restore the application position
      this._updatePosition(Object.assign(this.#position, {
        width: this.#minimization.priorWidth,
        height: this.#minimization.priorHeight
      }));
    }

    /* -------------------------------------------- */

    /**
     * Bring this Application window to the front of the rendering stack by increasing its z-index.
     * Once ApplicationV1 is deprecated we should switch from _maxZ to ApplicationV2#maxZ
     * We should also eliminate ui.activeWindow in favor of only ApplicationV2#frontApp
     */
    bringToFront() {
      if ( !((ApplicationV2.#frontApp === this) && (ui.activeWindow === this)) ) this.#position.zIndex = ++_maxZ;
      this.#element.style.zIndex = String(this.#position.zIndex);
      ApplicationV2.#frontApp = this;
      ui.activeWindow = this; // ApplicationV1 compatibility
    }

    /* -------------------------------------------- */

    /**
     * Change the active tab within a tab group in this Application instance.
     * @param {string} tab        The name of the tab which should become active
     * @param {string} group      The name of the tab group which defines the set of tabs
     * @param {object} [options]  Additional options which affect tab navigation
     * @param {Event} [options.event]                 An interaction event which caused the tab change, if any
     * @param {HTMLElement} [options.navElement]      An explicit navigation element being modified
     * @param {boolean} [options.force=false]         Force changing the tab even if the new tab is already active
     * @param {boolean} [options.updatePosition=true] Update application position after changing the tab?
     */
    changeTab(tab, group, {event, navElement, force=false, updatePosition=true}={}) {
      if ( !tab || !group ) throw new Error("You must pass both the tab and tab group identifier");
      if ( (this.tabGroups[group] === tab) && !force ) return;  // No change necessary
      const tabElement = this.#content.querySelector(`.tabs > [data-group="${group}"][data-tab="${tab}"]`);
      if ( !tabElement ) throw new Error(`No matching tab element found for group "${group}" and tab "${tab}"`);

      // Update tab navigation
      for ( const t of this.#content.querySelectorAll(`.tabs > [data-group="${group}"]`) ) {
        t.classList.toggle("active", t.dataset.tab === tab);
      }

      // Update tab contents
      for ( const section of this.#content.querySelectorAll(`.tab[data-group="${group}"]`) ) {
        section.classList.toggle("active", section.dataset.tab === tab);
      }
      this.tabGroups[group] = tab;

      // Update automatic width or height
      if ( !updatePosition ) return;
      const positionUpdate = {};
      if ( this.options.position.width === "auto" ) positionUpdate.width = "auto";
      if ( this.options.position.height === "auto" ) positionUpdate.height = "auto";
      if ( !foundry.utils.isEmpty(positionUpdate) ) this.setPosition(positionUpdate);
    }

    /* -------------------------------------------- */
    /*  Life-Cycle Handlers                         */
    /* -------------------------------------------- */

    /**
     * Perform an event in the application life-cycle.
     * Await an internal life-cycle method defined by the class.
     * Optionally dispatch an event for any registered listeners.
     * @param {Function} handler        A handler function to call
     * @param {object} options          Options which configure event handling
     * @param {boolean} [options.async]         Await the result of the handler function?
     * @param {any[]} [options.handlerArgs]     Arguments passed to the handler function
     * @param {string} [options.debugText]      Debugging text to log for the event
     * @param {string} [options.eventName]      An event name to dispatch for registered listeners
     * @param {string} [options.hookName]       A hook name to dispatch for this and all parent classes
     * @param {any[]} [options.hookArgs]        Arguments passed to the requested hook function
     * @returns {Promise<void>}         A promise which resoles once the handler is complete
     */
    async #doEvent(handler, {async=false, handlerArgs, debugText, eventName, hookName, hookArgs=[]}={}) {

      // Debug logging
      if ( debugText && CONFIG.debug.applications ) {
        console.debug(`${this.constructor.name} | ${debugText}`);
      }

      // Call handler function
      const response = handler.call(this, ...handlerArgs);
      if ( async ) await response;

      // Dispatch event for this Application instance
      if ( eventName ) this.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true }));

      // Call hooks for this Application class
      if ( hookName ) {
        for ( const cls of this.constructor.inheritanceChain() ) {
          if ( !cls.name ) continue;
          Hooks.callAll(`${hookName}${cls.name}`, this, ...hookArgs);
        }
      }
      return response;
    }

    /* -------------------------------------------- */
    /*  Rendering Life-Cycle Methods                */
    /* -------------------------------------------- */

    /**
     * Test whether this Application is allowed to be rendered.
     * @param {RenderOptions} options                 Provided render options
     * @returns {false|void}                          Return false to prevent rendering
     * @throws {Error}                                An Error to display a warning message
     * @protected
     */
    _canRender(options) {}

    /**
     * Actions performed before a first render of the Application.
     * @param {ApplicationRenderContext} context      Prepared context data
     * @param {RenderOptions} options                 Provided render options
     * @returns {Promise<void>}
     * @protected
     */
    async _preFirstRender(context, options) {}

    /**
     * Actions performed after a first render of the Application.
     * Post-render steps are not awaited by the render process.
     * @param {ApplicationRenderContext} context      Prepared context data
     * @param {RenderOptions} options                 Provided render options
     * @protected
     */
    _onFirstRender(context, options) {}

    /**
     * Actions performed before any render of the Application.
     * Pre-render steps are awaited by the render process.
     * @param {ApplicationRenderContext} context      Prepared context data
     * @param {RenderOptions} options                 Provided render options
     * @returns {Promise<void>}
     * @protected
     */
    async _preRender(context, options) {}

    /**
     * Actions performed after any render of the Application.
     * Post-render steps are not awaited by the render process.
     * @param {ApplicationRenderContext} context      Prepared context data
     * @param {RenderOptions} options                 Provided render options
     * @protected
     */
    _onRender(context, options) {}

    /**
     * Actions performed before closing the Application.
     * Pre-close steps are awaited by the close process.
     * @param {RenderOptions} options                 Provided render options
     * @returns {Promise<void>}
     * @protected
     */
    async _preClose(options) {}

    /**
     * Actions performed after closing the Application.
     * Post-close steps are not awaited by the close process.
     * @param {RenderOptions} options                 Provided render options
     * @protected
     */
    _onClose(options) {}

    /**
     * Actions performed before the Application is re-positioned.
     * Pre-position steps are not awaited because setPosition is synchronous.
     * @param {ApplicationPosition} position          The requested application position
     * @protected
     */
    _prePosition(position) {}

    /**
     * Actions performed after the Application is re-positioned.
     * @param {ApplicationPosition} position          The requested application position
     * @protected
     */
    _onPosition(position) {}

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /**
     * Attach event listeners to the Application frame.
     * @protected
     */
    _attachFrameListeners() {

      // Application Click Events
      this.#element.addEventListener("pointerdown", this.#onPointerDown.bind(this), {capture: true});
      const click = this.#onClick.bind(this);
      this.#element.addEventListener("click", click);
      this.#element.addEventListener("contextmenu", click);

      if ( this.hasFrame ) {
        this.bringToFront();
        this.#window.header.addEventListener("pointerdown", this.#onWindowDragStart.bind(this));
        this.#window.header.addEventListener("dblclick", this.#onWindowDoubleClick.bind(this));
        this.#window.resize?.addEventListener("pointerdown", this.#onWindowResizeStart.bind(this));
      }

      // Form handlers
      if ( this.options.tag === "form" ) {
        this.#element.addEventListener("submit", this._onSubmitForm.bind(this, this.options.form));
        this.#element.addEventListener("change", this._onChangeForm.bind(this, this.options.form));
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle initial pointerdown events inside a rendered Application.
     * @param {PointerEvent} event
     */
    async #onPointerDown(event) {
      if ( this.hasFrame ) this.bringToFront();
    }

    /* -------------------------------------------- */

    /**
     * Centralized handling of click events which occur on or within the Application frame.
     * @param {PointerEvent} event
     */
    async #onClick(event) {
      const target = event.target;
      const actionButton = target.closest("[data-action]");
      if ( actionButton ) return this.#onClickAction(event, actionButton);
    }

    /* -------------------------------------------- */

    /**
     * Handle a click event on an element which defines a [data-action] handler.
     * @param {PointerEvent} event      The originating click event
     * @param {HTMLElement} target      The capturing HTML element which defined a [data-action]
     */
    #onClickAction(event, target) {
      const action = target.dataset.action;
      switch ( action ) {
        case "close":
          event.stopPropagation();
          if ( event.button === 0 ) this.close();
          break;
        case "tab":
          if ( event.button === 0 ) this.#onClickTab(event);
          break;
        case "toggleControls":
          event.stopPropagation();
          if ( event.button === 0 ) this.toggleControls();
          break;
        default:
          let handler = this.options.actions[action];

          // No defined handler
          if ( !handler ) {
            this._onClickAction(event, target);
            break;
          }

          // Defined handler
          let buttons = [0];
          if ( typeof handler === "object" ) {
            buttons = handler.buttons;
            handler = handler.handler;
          }
          if ( buttons.includes(event.button) ) handler?.call(this, event, target);
          break;
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle click events on a tab within the Application.
     * @param {PointerEvent} event
     */
    #onClickTab(event) {
      const button = event.target;
      const tab = button.dataset.tab;
      if ( !tab || button.classList.contains("active") ) return;
      const group = button.dataset.group;
      const navElement = button.closest(".tabs");
      this.changeTab(tab, group, {event, navElement});
    }

    /* -------------------------------------------- */

    /**
     * A generic event handler for action clicks which can be extended by subclasses.
     * Action handlers defined in DEFAULT_OPTIONS are called first. This method is only called for actions which have
     * no defined handler.
     * @param {PointerEvent} event      The originating click event
     * @param {HTMLElement} target      The capturing HTML element which defined a [data-action]
     * @protected
     */
    _onClickAction(event, target) {}

    /* -------------------------------------------- */

    /**
     * Begin capturing pointer events on the application frame.
     * @param {PointerEvent} event  The triggering event.
     * @param {function} callback   The callback to attach to pointer move events.
     */
    #startPointerCapture(event, callback) {
      this.#window.pointerStartPosition = Object.assign(foundry.utils.deepClone(this.#position), {
        clientX: event.clientX, clientY: event.clientY
      });
      this.#element.addEventListener("pointermove", callback, { passive: true });
      this.#element.addEventListener("pointerup", event => this.#endPointerCapture(event, callback), {
        capture: true, once: true
      });
    }

    /* -------------------------------------------- */

    /**
     * End capturing pointer events on the application frame.
     * @param {PointerEvent} event  The triggering event.
     * @param {function} callback   The callback to remove from pointer move events.
     */
    #endPointerCapture(event, callback) {
      this.#element.releasePointerCapture(event.pointerId);
      this.#element.removeEventListener("pointermove", callback);
      delete this.#window.pointerStartPosition;
      this.#window.pointerMoveThrottle = false;
    }

    /* -------------------------------------------- */

    /**
     * Handle a pointer move event while dragging or resizing the window frame.
     * @param {PointerEvent} event
     * @returns {{dx: number, dy: number}|void}  The amount the cursor has moved since the last frame, or undefined if
     *                                           the movement occurred between frames.
     */
    #onPointerMove(event) {
      if ( this.#window.pointerMoveThrottle ) return;
      this.#window.pointerMoveThrottle = true;
      const dx = event.clientX - this.#window.pointerStartPosition.clientX;
      const dy = event.clientY - this.#window.pointerStartPosition.clientY;
      requestAnimationFrame(() => this.#window.pointerMoveThrottle = false);
      return { dx, dy };
    }

    /* -------------------------------------------- */

    /**
     * Begin dragging the Application position.
     * @param {PointerEvent} event
     */
    #onWindowDragStart(event) {
      if ( event.target.closest(".header-control") ) return;
      this.#endPointerCapture(event, this.#window.onDrag);
      this.#startPointerCapture(event, this.#window.onDrag);
    }

    /* -------------------------------------------- */

    /**
     * Begin resizing the Application.
     * @param {PointerEvent} event
     */
    #onWindowResizeStart(event) {
      this.#endPointerCapture(event, this.#window.onResize);
      this.#startPointerCapture(event, this.#window.onResize);
    }

    /* -------------------------------------------- */

    /**
     * Drag the Application position during mouse movement.
     * @param {PointerEvent} event
     */
    #onWindowDragMove(event) {
      if ( !this.#window.header.hasPointerCapture(event.pointerId) ) {
        this.#window.header.setPointerCapture(event.pointerId);
      }
      const delta = this.#onPointerMove(event);
      if ( !delta ) return;
      const { pointerStartPosition } = this.#window;
      let { top, left, height, width } = pointerStartPosition;
      left += delta.dx;
      top += delta.dy;
      this.setPosition({ top, left, height, width });
    }

    /* -------------------------------------------- */

    /**
     * Resize the Application during mouse movement.
     * @param {PointerEvent} event
     */
    #onWindowResizeMove(event) {
      if ( !this.#window.resize.hasPointerCapture(event.pointerId) ) {
        this.#window.resize.setPointerCapture(event.pointerId);
      }
      const delta = this.#onPointerMove(event);
      if ( !delta ) return;
      const { scale } = this.#position;
      const { pointerStartPosition } = this.#window;
      let { top, left, height, width } = pointerStartPosition;
      if ( width !== "auto" ) width += delta.dx / scale;
      if ( height !== "auto" ) height += delta.dy / scale;
      this.setPosition({ top, left, width, height });
    }

    /* -------------------------------------------- */

    /**
     * Double-click events on the window title are used to minimize or maximize the application.
     * @param {PointerEvent} event
     */
    #onWindowDoubleClick(event) {
      event.preventDefault();
      if ( event.target.dataset.action ) return; // Ignore double clicks on buttons which perform an action
      if ( !this.options.window.minimizable ) return;
      if ( this.minimized ) this.maximize();
      else this.minimize();
    }

    /* -------------------------------------------- */

    /**
     * Handle submission for an Application which uses the form element.
     * @param {ApplicationFormConfiguration} formConfig     The form configuration for which this handler is bound
     * @param {Event|SubmitEvent} event                     The form submission event
     * @returns {Promise<void>}
     * @protected
     */
    async _onSubmitForm(formConfig, event) {
      event.preventDefault();
      const form = event.currentTarget;
      const {handler, closeOnSubmit} = formConfig;
      const formData = new FormDataExtended(form);
      if ( handler instanceof Function ) {
        try {
          await handler.call(this, event, form, formData);
        } catch(err){
          ui.notifications.error(err, {console: true});
          return; // Do not close
        }
      }
      if ( closeOnSubmit ) await this.close();
    }

    /* -------------------------------------------- */

    /**
     * Handle changes to an input element within the form.
     * @param {ApplicationFormConfiguration} formConfig     The form configuration for which this handler is bound
     * @param {Event} event                                 An input change event within the form
     */
    _onChangeForm(formConfig, event) {
      if ( formConfig.submitOnChange ) this._onSubmitForm(formConfig, event);
    }

    /* -------------------------------------------- */
    /*  Helper Methods                              */
    /* -------------------------------------------- */

    /**
     * Parse a CSS style rule into a number of pixels which apply to that dimension.
     * @param {string} style            The CSS style rule
     * @param {number} parentDimension  The relevant dimension of the parent element
     * @returns {number}                The parsed style dimension in pixels
     */
    static parseCSSDimension(style, parentDimension) {
      if ( style.includes("px") ) return parseInt(style.replace("px", ""));
      if ( style.includes("%") ) {
        const p = parseInt(style.replace("%", "")) / 100;
        return parentDimension * p;
      }
    }

    /* -------------------------------------------- */

    /**
     * Wait for a CSS transition to complete for an element.
     * @param {HTMLElement} element         The element which is transitioning
     * @param {number} timeout              A timeout in milliseconds in case the transitionend event does not occur
     * @returns {Promise<void>}
     * @internal
     */
    async _awaitTransition(element, timeout) {
      return Promise.race([
        new Promise(resolve => element.addEventListener("transitionend", resolve, {once: true})),
        new Promise(resolve => window.setTimeout(resolve, timeout))
      ]);
    }

    /* -------------------------------------------- */
    /*  Deprecations and Compatibility              */
    /* -------------------------------------------- */

    /**
     * @deprecated since v12
     * @ignore
     */
    bringToTop() {
      foundry.utils.logCompatibilityWarning(`ApplicationV2#bringToTop is not a valid function and redirects to 
      ApplicationV2#bringToFront. This shim will be removed in v14.`, {since: 12, until: 14});
      return this.bringToFront();
    }
  }

  /**
   * @typedef {import("../types.mjs").ColorSource} ColorSource
   */

  /**
   * A representation of a color in hexadecimal format.
   * This class provides methods for transformations and manipulations of colors.
   */
  class Color extends Number {

    /**
     * Is this a valid color?
     * @type {boolean}
     */
    get valid() {
      const v = this.valueOf();
      return Number.isInteger(v) && v >= 0 && v <= 0xFFFFFF;
    }

    /* ------------------------------------------ */

    /**
     * A CSS-compatible color string.
     * If this color is not valid, the empty string is returned.
     * An alias for Color#toString.
     * @type {string}
     */
    get css() {
      return this.toString(16);
    }

    /* ------------------------------------------ */

    /**
     * The color represented as an RGB array.
     * @type {[number, number, number]}
     */
    get rgb() {
      return [((this >> 16) & 0xFF) / 255, ((this >> 8) & 0xFF) / 255, (this & 0xFF) / 255];
    }

    /* ------------------------------------------ */

    /**
     * The numeric value of the red channel between [0, 1].
     * @type {number}
     */
    get r() {
      return ((this >> 16) & 0xFF) / 255;
    }

    /* ------------------------------------------ */

    /**
     * The numeric value of the green channel between [0, 1].
     * @type {number}
     */
    get g() {
      return ((this >> 8) & 0xFF) / 255;
    }

    /* ------------------------------------------ */

    /**
     * The numeric value of the blue channel between [0, 1].
     * @type {number}
     */
    get b() {
      return (this & 0xFF) / 255;
    }

    /* ------------------------------------------ */

    /**
     * The maximum value of all channels.
     * @type {number}
     */
    get maximum() {
      return Math.max(...this);
    }

    /* ------------------------------------------ */

    /**
     * The minimum value of all channels.
     * @type {number}
     */
    get minimum() {
      return Math.min(...this);
    }

    /* ------------------------------------------ */

    /**
     * Get the value of this color in little endian format.
     * @type {number}
     */
    get littleEndian() {
      return ((this >> 16) & 0xFF) + (this & 0x00FF00) + ((this & 0xFF) << 16);
    }

    /* ------------------------------------------ */

    /**
     * The color represented as an HSV array.
     * Conversion formula adapted from http://en.wikipedia.org/wiki/HSV_color_space.
     * Assumes r, g, and b are contained in the set [0, 1] and returns h, s, and v in the set [0, 1].
     * @type {[number, number, number]}
     */
    get hsv() {
      const [r, g, b] = this.rgb;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;

      let h;
      const s = max === 0 ? 0 : d / max;
      const v = max;

      // Achromatic colors
      if (max === min) return [0, s, v];

      // Normal colors
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
      return [h, s, v];
    }

    /* ------------------------------------------ */

    /**
     * The color represented as an HSL array.
     * Assumes r, g, and b are contained in the set [0, 1] and returns h, s, and l in the set [0, 1].
     * @type {[number, number, number]}
     */
    get hsl() {
      const [r, g, b] = this.rgb;

      // Compute luminosity, saturation and hue
      const l = Math.max(r, g, b);
      const s = l - Math.min(r, g, b);
      let h = 0;
      if ( s > 0 ) {
        if ( l === r ) {
          h = (g - b) / s;
        } else if ( l === g ) {
          h = 2 + (b - r) / s;
        } else {
          h = 4 + (r - g) / s;
        }
      }
      const finalHue = (60 * h < 0 ? 60 * h + 360 : 60 * h) / 360;
      const finalSaturation = s ? (l <= 0.5 ? s / (2 * l - s) : s / (2 - (2 * l - s))) : 0;
      const finalLuminance = (2 * l - s) / 2;
      return [finalHue, finalSaturation, finalLuminance];
    }

    /* ------------------------------------------ */

    /**
     * The color represented as a linear RGB array.
     * Assumes r, g, and b are contained in the set [0, 1] and returns linear r, g, and b in the set [0, 1].
     * @link https://en.wikipedia.org/wiki/SRGB#Transformation
     * @type {Color}
     */
    get linear() {
      const toLinear = c => (c > 0.04045) ? Math.pow((c + 0.055) / 1.055, 2.4) : (c / 12.92);
      return this.constructor.fromRGB([toLinear(this.r), toLinear(this.g), toLinear(this.b)]);
    }

    /* ------------------------------------------ */
    /*  Color Manipulation Methods                */
    /* ------------------------------------------ */

    /** @override */
    toString(radix) {
      if ( !this.valid ) return "";
      return `#${super.toString(16).padStart(6, "0")}`;
    }

    /* ------------------------------------------ */

    /**
     * Serialize the Color.
     * @returns {string}    The color as a CSS string
     */
    toJSON() {
      return this.css;
    }

    /* ------------------------------------------ */

    /**
     * Returns the color as a CSS string.
     * @returns {string}    The color as a CSS string
     */
    toHTML() {
      return this.css;
    }

    /* ------------------------------------------ */

    /**
     * Test whether this color equals some other color
     * @param {Color|number} other  Some other color or hex number
     * @returns {boolean}           Are the colors equal?
     */
    equals(other) {
      return this.valueOf() === other.valueOf();
    }

    /* ------------------------------------------ */

    /**
     * Get a CSS-compatible RGBA color string.
     * @param {number} alpha      The desired alpha in the range [0, 1]
     * @returns {string}          A CSS-compatible RGBA string
     */
    toRGBA(alpha) {
      const rgba = [(this >> 16) & 0xFF, (this >> 8) & 0xFF, this & 0xFF, alpha];
      return `rgba(${rgba.join(", ")})`;
    }

    /* ------------------------------------------ */

    /**
     * Mix this Color with some other Color using a provided interpolation weight.
     * @param {Color} other       Some other Color to mix with
     * @param {number} weight     The mixing weight placed on this color where weight is placed on the other color
     * @returns {Color}           The resulting mixed Color
     */
    mix(other, weight) {
      return new Color(Color.mix(this, other, weight));
    }

    /* ------------------------------------------ */

    /**
     * Multiply this Color by another Color or a static scalar.
     * @param {Color|number} other  Some other Color or a static scalar.
     * @returns {Color}             The resulting Color.
     */
    multiply(other) {
      if ( other instanceof Color ) return new Color(Color.multiply(this, other));
      return new Color(Color.multiplyScalar(this, other));
    }

    /* ------------------------------------------ */

    /**
     * Add this Color by another Color or a static scalar.
     * @param {Color|number} other  Some other Color or a static scalar.
     * @returns {Color}             The resulting Color.
     */
    add(other) {
      if ( other instanceof Color ) return new Color(Color.add(this, other));
      return new Color(Color.addScalar(this, other));
    }

    /* ------------------------------------------ */

    /**
     * Subtract this Color by another Color or a static scalar.
     * @param {Color|number} other  Some other Color or a static scalar.
     * @returns {Color}             The resulting Color.
     */
    subtract(other) {
      if ( other instanceof Color ) return new Color(Color.subtract(this, other));
      return new Color(Color.subtractScalar(this, other));
    }

    /* ------------------------------------------ */

    /**
     * Max this color by another Color or a static scalar.
     * @param {Color|number} other  Some other Color or a static scalar.
     * @returns {Color}             The resulting Color.
     */
    maximize(other) {
      if ( other instanceof Color ) return new Color(Color.maximize(this, other));
      return new Color(Color.maximizeScalar(this, other));
    }

    /* ------------------------------------------ */

    /**
     * Min this color by another Color or a static scalar.
     * @param {Color|number} other  Some other Color or a static scalar.
     * @returns {Color}             The resulting Color.
     */
    minimize(other) {
      if ( other instanceof Color ) return new Color(Color.minimize(this, other));
      return new Color(Color.minimizeScalar(this, other));
    }

    /* ------------------------------------------ */
    /*  Iterator                                  */
    /* ------------------------------------------ */

    /**
     * Iterating over a Color is equivalent to iterating over its [r,g,b] color channels.
     * @returns {Generator<number>}
     */
    *[Symbol.iterator]() {
      yield this.r;
      yield this.g;
      yield this.b;
    }

    /* ------------------------------------------------------------------------------------------- */
    /*                      Real-time performance Methods and Properties                           */
    /*  Important Note:                                                                            */
    /*  These methods are not a replacement, but a tool when real-time performance is needed.      */
    /*  They do not have the flexibility of the "classic" methods and come with some limitations.  */
    /*  Unless you have to deal with real-time performance, you should use the "classic" methods.  */
    /* ------------------------------------------------------------------------------------------- */

    /**
     * Set an rgb array with the rgb values contained in this Color class.
     * @param {number[]} vec3  Receive the result. Must be an array with at least a length of 3.
     */
    applyRGB(vec3) {
      vec3[0] = ((this >> 16) & 0xFF) / 255;
      vec3[1] = ((this >> 8) & 0xFF) / 255;
      vec3[2] = (this & 0xFF) / 255;
    }

    /* ------------------------------------------ */

    /**
     * Apply a linear interpolation between two colors, according to the weight.
     * @param {number}        color1       The first color to mix.
     * @param {number}        color2       The second color to mix.
     * @param {number}        weight       Weight of the linear interpolation.
     * @returns {number}                   The resulting mixed color
     */
    static mix(color1, color2, weight) {
      return (((((color1 >> 16) & 0xFF) * (1 - weight) + ((color2 >> 16) & 0xFF) * weight) << 16) & 0xFF0000)
        | (((((color1 >> 8) & 0xFF) * (1 - weight) + ((color2 >> 8) & 0xFF) * weight) << 8) & 0x00FF00)
        | (((color1 & 0xFF) * (1 - weight) + (color2 & 0xFF) * weight) & 0x0000FF);
    }

    /* ------------------------------------------ */

    /**
     * Multiply two colors.
     * @param {number}        color1       The first color to multiply.
     * @param {number}        color2       The second color to multiply.
     * @returns {number}                   The result.
     */
    static multiply(color1, color2) {
      return ((((color1 >> 16) & 0xFF) / 255 * ((color2 >> 16) & 0xFF) / 255) * 255 << 16)
        | ((((color1 >> 8) & 0xFF) / 255 * ((color2 >> 8) & 0xFF) / 255) * 255 << 8)
        | (((color1 & 0xFF) / 255 * ((color2 & 0xFF) / 255)) * 255);
    }

    /* ------------------------------------------ */

    /**
     * Multiply a color by a scalar
     * @param {number} color        The color to multiply.
     * @param {number} scalar       A static scalar to multiply with.
     * @returns {number}            The resulting color as a number.
     */
    static multiplyScalar(color, scalar) {
      return (Math.clamp(((color >> 16) & 0xFF) / 255 * scalar, 0, 1) * 255 << 16)
        | (Math.clamp(((color >> 8) & 0xFF) / 255 * scalar, 0, 1) * 255 << 8)
        | (Math.clamp((color & 0xFF) / 255 * scalar, 0, 1) * 255);
    }

    /* ------------------------------------------ */

    /**
     * Maximize two colors.
     * @param {number}        color1       The first color.
     * @param {number}        color2       The second color.
     * @returns {number}                   The result.
     */
    static maximize(color1, color2) {
      return (Math.clamp(Math.max((color1 >> 16) & 0xFF, (color2 >> 16) & 0xFF), 0, 0xFF) << 16)
        | (Math.clamp(Math.max((color1 >> 8) & 0xFF, (color2 >> 8) & 0xFF), 0, 0xFF) << 8)
        | Math.clamp(Math.max(color1 & 0xFF, color2 & 0xFF), 0, 0xFF);
    }

    /* ------------------------------------------ */

    /**
     * Maximize a color by a static scalar.
     * @param {number} color         The color to maximize.
     * @param {number} scalar        Scalar to maximize with (normalized).
     * @returns {number}             The resulting color as a number.
     */
    static maximizeScalar(color, scalar) {
      return (Math.clamp(Math.max((color >> 16) & 0xFF, scalar * 255), 0, 0xFF) << 16)
        | (Math.clamp(Math.max((color >> 8) & 0xFF, scalar * 255), 0, 0xFF) << 8)
        | Math.clamp(Math.max(color & 0xFF, scalar * 255), 0, 0xFF);
    }

    /* ------------------------------------------ */

    /**
     * Add two colors.
     * @param {number}        color1       The first color.
     * @param {number}        color2       The second color.
     * @returns {number}                   The resulting color as a number.
     */
    static add(color1, color2) {
      return (Math.clamp((((color1 >> 16) & 0xFF) + ((color2 >> 16) & 0xFF)), 0, 0xFF) << 16)
        | (Math.clamp((((color1 >> 8) & 0xFF) + ((color2 >> 8) & 0xFF)), 0, 0xFF) << 8)
        | Math.clamp(((color1 & 0xFF) + (color2 & 0xFF)), 0, 0xFF);
    }

    /* ------------------------------------------ */

    /**
     * Add a static scalar to a color.
     * @param {number} color         The color.
     * @param {number} scalar        Scalar to add with (normalized).
     * @returns {number}             The resulting color as a number.
     */
    static addScalar(color, scalar) {
      return (Math.clamp((((color >> 16) & 0xFF) + scalar * 255), 0, 0xFF) << 16)
        | (Math.clamp((((color >> 8) & 0xFF) + scalar * 255), 0, 0xFF) << 8)
        | Math.clamp(((color & 0xFF) + scalar * 255), 0, 0xFF);
    }

    /* ------------------------------------------ */

    /**
     * Subtract two colors.
     * @param {number}        color1       The first color.
     * @param {number}        color2       The second color.
     */
    static subtract(color1, color2) {
      return (Math.clamp((((color1 >> 16) & 0xFF) - ((color2 >> 16) & 0xFF)), 0, 0xFF) << 16)
        | (Math.clamp((((color1 >> 8) & 0xFF) - ((color2 >> 8) & 0xFF)), 0, 0xFF) << 8)
        | Math.clamp(((color1 & 0xFF) - (color2 & 0xFF)), 0, 0xFF);
    }

    /* ------------------------------------------ */

    /**
     * Subtract a color by a static scalar.
     * @param {number} color         The color.
     * @param {number} scalar        Scalar to subtract with (normalized).
     * @returns {number}             The resulting color as a number.
     */
    static subtractScalar(color, scalar) {
      return (Math.clamp((((color >> 16) & 0xFF) - scalar * 255), 0, 0xFF) << 16)
        | (Math.clamp((((color >> 8) & 0xFF) - scalar * 255), 0, 0xFF) << 8)
        | Math.clamp(((color & 0xFF) - scalar * 255), 0, 0xFF);
    }

    /* ------------------------------------------ */

    /**
     * Minimize two colors.
     * @param {number}        color1       The first color.
     * @param {number}        color2       The second color.
     */
    static minimize(color1, color2) {
      return (Math.clamp(Math.min((color1 >> 16) & 0xFF, (color2 >> 16) & 0xFF), 0, 0xFF) << 16)
        | (Math.clamp(Math.min((color1 >> 8) & 0xFF, (color2 >> 8) & 0xFF), 0, 0xFF) << 8)
        | Math.clamp(Math.min(color1 & 0xFF, color2 & 0xFF), 0, 0xFF);
    }

    /* ------------------------------------------ */

    /**
     * Minimize a color by a static scalar.
     * @param {number} color         The color.
     * @param {number} scalar        Scalar to minimize with (normalized).
     */
    static minimizeScalar(color, scalar) {
      return (Math.clamp(Math.min((color >> 16) & 0xFF, scalar * 255), 0, 0xFF) << 16)
        | (Math.clamp(Math.min((color >> 8) & 0xFF, scalar * 255), 0, 0xFF) << 8)
        | Math.clamp(Math.min(color & 0xFF, scalar * 255), 0, 0xFF);
    }

    /* ------------------------------------------ */

    /**
     * Convert a color to RGB and assign values to a passed array.
     * @param {number} color   The color to convert to RGB values.
     * @param {number[]} vec3  Receive the result. Must be an array with at least a length of 3.
     */
    static applyRGB(color, vec3) {
      vec3[0] = ((color >> 16) & 0xFF) / 255;
      vec3[1] = ((color >> 8) & 0xFF) / 255;
      vec3[2] = (color & 0xFF) / 255;
    }

    /* ------------------------------------------ */
    /*  Factory Methods                           */
    /* ------------------------------------------ */

    /**
     * Create a Color instance from an RGB array.
     * @param {ColorSource} color     A color input
     * @returns {Color}               The hex color instance or NaN
     */
    static from(color) {
      if ( (color === null) || (color === undefined) ) return new this(NaN);
      if ( typeof color === "string" ) return this.fromString(color);
      if ( typeof color === "number" ) return new this(color);
      if ( (color instanceof Array) && (color.length === 3) ) return this.fromRGB(color);
      if ( color instanceof Color ) return color;
      return new this(color);
    }

    /* ------------------------------------------ */

    /**
     * Create a Color instance from a color string which either includes or does not include a leading #.
     * @param {string} color                      A color string
     * @returns {Color}                           The hex color instance
     */
    static fromString(color) {
      return new this(parseInt(color.startsWith("#") ? color.substring(1) : color, 16));
    }

    /* ------------------------------------------ */

    /**
     * Create a Color instance from an RGB array.
     * @param {[number, number, number]} rgb      An RGB tuple
     * @returns {Color}                           The hex color instance
     */
    static fromRGB(rgb) {
      return new this(((rgb[0] * 255) << 16) + ((rgb[1] * 255) << 8) + (rgb[2] * 255 | 0));
    }

    /* ------------------------------------------ */

    /**
     * Create a Color instance from an RGB normalized values.
     * @param {number} r                          The red value
     * @param {number} g                          The green value
     * @param {number} b                          The blue value
     * @returns {Color}                           The hex color instance
     */
    static fromRGBvalues(r, g, b) {
      return new this(((r * 255) << 16) + ((g * 255) << 8) + (b * 255 | 0));
    }

    /* ------------------------------------------ */

    /**
     * Create a Color instance from an HSV array.
     * Conversion formula adapted from http://en.wikipedia.org/wiki/HSV_color_space.
     * Assumes h, s, and v are contained in the set [0, 1].
     * @param {[number, number, number]} hsv      An HSV tuple
     * @returns {Color}                           The hex color instance
     */
    static fromHSV(hsv) {
      const [h, s, v] = hsv;
      const i = Math.floor(h * 6);
      const f = (h * 6) - i;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);
      let rgb;
      switch (i % 6) {
        case 0: rgb = [v, t, p]; break;
        case 1: rgb = [q, v, p]; break;
        case 2: rgb = [p, v, t]; break;
        case 3: rgb = [p, q, v]; break;
        case 4: rgb = [t, p, v]; break;
        case 5: rgb = [v, p, q]; break;
      }
      return this.fromRGB(rgb);
    }

    /* ------------------------------------------ */

    /**
     * Create a Color instance from an HSL array.
     * Assumes h, s, and l are contained in the set [0, 1].
     * @param {[number, number, number]} hsl      An HSL tuple
     * @returns {Color}                           The hex color instance
     */
    static fromHSL(hsl) {
      const [h, s, l] = hsl;

      // Calculate intermediate values for the RGB components
      const chroma = (1 - Math.abs(2 * l - 1)) * s;
      const hue = h * 6;
      const x = chroma * (1 - Math.abs(hue % 2 - 1));
      const m = l - chroma / 2;

      let r, g, b;
      switch (Math.floor(hue)) {
        case 0: [r, g, b] = [chroma, x, 0]; break;
        case 1: [r, g, b] = [x, chroma, 0]; break;
        case 2: [r, g, b] = [0, chroma, x]; break;
        case 3: [r, g, b] = [0, x, chroma]; break;
        case 4: [r, g, b] = [x, 0, chroma]; break;
        case 5:
        case 6:[r, g, b] = [chroma, 0, x]; break;
        default: [r, g, b] = [0, 0, 0]; break;
      }

      // Adjust for luminance
      r += m;
      g += m;
      b += m;
      return this.fromRGB([r, g, b]);
    }

    /* ------------------------------------------ */

    /**
     * Create a Color instance (sRGB) from a linear rgb array.
     * Assumes r, g, and b are contained in the set [0, 1].
     * @link https://en.wikipedia.org/wiki/SRGB#Transformation
     * @param {[number, number, number]} linear   The linear rgb array
     * @returns {Color}                           The hex color instance
     */
    static fromLinearRGB(linear) {
      const [r, g, b] = linear;
      const tosrgb = c => (c <= 0.0031308) ? (12.92 * c) : (1.055 * Math.pow(c, 1 / 2.4) - 0.055);
      return this.fromRGB([tosrgb(r), tosrgb(g), tosrgb(b)]);
    }
  }

  /** @module constants */


  /**
   * Valid Chat Message styles which affect how the message is presented in the chat log.
   * @enum {number}
   */
  const CHAT_MESSAGE_STYLES = {
    /**
     * An uncategorized chat message
     */
    OTHER: 0,

    /**
     * The message is spoken out of character (OOC).
     * OOC messages will be outlined by the player's color to make them more easily recognizable.
     */
    OOC: 1,

    /**
     * The message is spoken by an associated character.
     */
    IC: 2,

    /**
     * The message is an emote performed by the selected character.
     * Entering "/emote waves his hand." while controlling a character named Simon will send the message, "Simon waves his hand."
     */
    EMOTE: 3,
  };

  /**
   * The primary Document types.
   * @type {string[]}
   */
  const PRIMARY_DOCUMENT_TYPES = [
    "Actor",
    "Adventure",
    "Cards",
    "ChatMessage",
    "Combat",
    "FogExploration",
    "Folder",
    "Item",
    "JournalEntry",
    "Macro",
    "Playlist",
    "RollTable",
    "Scene",
    "Setting",
    "User"
  ];

  /**
   * The embedded Document types.
   * @type {Readonly<string[]>}
   */
  const EMBEDDED_DOCUMENT_TYPES = [
    "ActiveEffect",
    "ActorDelta",
    "AmbientLight",
    "AmbientSound",
    "Card",
    "Combatant",
    "Drawing",
    "Item",
    "JournalEntryPage",
    "MeasuredTemplate",
    "Note",
    "PlaylistSound",
    "Region",
    "RegionBehavior",
    "TableResult",
    "Tile",
    "Token",
    "Wall"
  ];

  /**
   * A listing of all valid Document types, both primary and embedded.
   * @type {Readonly<string[]>}
   */
  Array.from(new Set([
    ...PRIMARY_DOCUMENT_TYPES,
    ...EMBEDDED_DOCUMENT_TYPES
  ])).sort();

  /**
   * The allowed primary Document types which may exist within a World.
   * @type {string[]}
   */
  const WORLD_DOCUMENT_TYPES = [
    "Actor",
    "Cards",
    "ChatMessage",
    "Combat",
    "FogExploration",
    "Folder",
    "Item",
    "JournalEntry",
    "Macro",
    "Playlist",
    "RollTable",
    "Scene",
    "Setting",
    "User"
  ];

  /**
   * Define the allowed User permission levels.
   * Each level is assigned a value in ascending order. Higher levels grant more permissions.
   * @enum {number}
   * @see https://foundryvtt.com/article/users/
   */
  const USER_ROLES = {
    /**
     * The User is blocked from taking actions in Foundry Virtual Tabletop.
     * You can use this role to temporarily or permanently ban a user from joining the game.
     */
    NONE: 0,

    /**
     * The User is able to join the game with permissions available to a standard player.
     * They cannot take some more advanced actions which require Trusted permissions, but they have the basic functionalities needed to operate in the virtual tabletop.
     */
    PLAYER: 1,

    /**
     * Similar to the Player role, except a Trusted User has the ability to perform some more advanced actions like create drawings, measured templates, or even to (optionally) upload media files to the server.
     */
    TRUSTED: 2,

    /**
     * A special User who has many of the same in-game controls as a Game Master User, but does not have the ability to perform administrative actions like changing User roles or modifying World-level settings.
     */
    ASSISTANT: 3,

    /**
     *  A special User who has administrative control over this specific World.
     *  Game Masters behave quite differently than Players in that they have the ability to see all Documents and Objects within the world as well as the capability to configure World settings.
     */
    GAMEMASTER: 4
  };

  /**
   * Invert the User Role mapping to recover role names from a role integer
   * @enum {string}
   * @see USER_ROLES
   */
  Object.entries(USER_ROLES).reduce((obj, r) => {
    obj[r[1]] = r[0];
    return obj;
  }, {});

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  new Proxy(CHAT_MESSAGE_STYLES, {
    get(target, prop, receiver) {
      const msg = "CONST.CHAT_MESSAGE_TYPES is deprecated in favor of CONST.CHAT_MESSAGE_STYLES because the " +
        "ChatMessage#type field has been renamed to ChatMessage#style";
      foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
      return Reflect.get(...arguments);
    }
  });

  // Deprecated chat message styles
  Object.defineProperties(CHAT_MESSAGE_STYLES, {
    /**
     * @deprecated since v12
     * @ignore
     */
    ROLL: {
      get() {
        foundry.utils.logCompatibilityWarning("CONST.CHAT_MESSAGE_STYLES.ROLL is deprecated in favor of defining " +
          "rolls directly in ChatMessage#rolls", {since: 12, until: 14, once: true});
        return 0;
      }
    },
    /**
     * @deprecated since v12
     * @ignore
     */
    WHISPER: {
      get() {
        foundry.utils.logCompatibilityWarning("CONST.CHAT_MESSAGE_STYLES.WHISPER is deprecated in favor of defining " +
          "whisper recipients directly in ChatMessage#whisper", {since: 12, until: 14, once: true});
        return 0;
      }
    }
  });

  /**
   * @deprecated since v12
   * @ignore
   */
  const _DOCUMENT_TYPES = Object.freeze(WORLD_DOCUMENT_TYPES.filter(t => {
    const excluded = ["FogExploration", "Setting"];
    return !excluded.includes(t);
  }));

  /**
   * @deprecated since v12
   * @ignore
   */
  new Proxy(_DOCUMENT_TYPES, {
    get(target, prop, receiver) {
      const msg = "CONST.DOCUMENT_TYPES is deprecated in favor of either CONST.WORLD_DOCUMENT_TYPES or "
        + "CONST.COMPENDIUM_DOCUMENT_TYPES.";
      foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
      return Reflect.get(...arguments);
    }
  });

  /* -------------------------------------------- */

  /**
   * Quickly clone a simple piece of data, returning a copy which can be mutated safely.
   * This method DOES support recursive data structures containing inner objects or arrays.
   * This method DOES NOT support advanced object types like Set, Map, or other specialized classes.
   * @param {*} original                     Some sort of data
   * @param {object} [options]               Options to configure the behaviour of deepClone
   * @param {boolean} [options.strict=false]  Throw an Error if deepClone is unable to clone something instead of
   *                                          returning the original
   * @param {number} [options._d]             An internal depth tracker
   * @return {*}                             The clone of that data
   */
  function deepClone(original, {strict=false, _d=0}={}) {
    if ( _d > 100 ) {
      throw new Error("Maximum depth exceeded. Be sure your object does not contain cyclical data structures.");
    }
    _d++;

    // Simple types
    if ( (typeof original !== "object") || (original === null) ) return original;

    // Arrays
    if ( original instanceof Array ) return original.map(o => deepClone(o, {strict, _d}));

    // Dates
    if ( original instanceof Date ) return new Date(original);

    // Unsupported advanced objects
    if ( original.constructor && (original.constructor !== Object) ) {
      if ( strict ) throw new Error("deepClone cannot clone advanced objects");
      return original;
    }

    // Other objects
    const clone = {};
    for ( let k of Object.keys(original) ) {
      clone[k] = deepClone(original[k], {strict, _d});
    }
    return clone;
  }

  /* -------------------------------------------- */

  /**
   * Expand a flattened object to be a standard nested Object by converting all dot-notation keys to inner objects.
   * Only simple objects will be expanded. Other Object types like class instances will be retained as-is.
   * @param {object} obj      The object to expand
   * @return {object}         An expanded object
   */
  function expandObject(obj) {
    function _expand(value, depth) {
      if ( depth > 32 ) throw new Error("Maximum object expansion depth exceeded");
      if ( !value ) return value;
      if ( Array.isArray(value) ) return value.map(v => _expand(v, depth+1)); // Map arrays
      if ( value.constructor?.name !== "Object" ) return value;               // Return advanced objects directly
      const expanded = {};                                                    // Expand simple objects
      for ( let [k, v] of Object.entries(value) ) {
        setProperty(expanded, k, _expand(v, depth+1));
      }
      return expanded;
    }
    return _expand(obj, 0);
  }

  /* -------------------------------------------- */

  /**
   * Learn the underlying data type of some variable. Supported identifiable types include:
   * undefined, null, number, string, boolean, function, Array, Set, Map, Promise, Error,
   * HTMLElement (client side only), Object (catchall for other object types)
   * @param {*} variable  A provided variable
   * @return {string}     The named type of the token
   */
  function getType(variable) {

    // Primitive types, handled with simple typeof check
    const typeOf = typeof variable;
    if ( typeOf !== "object" ) return typeOf;

    // Special cases of object
    if ( variable === null ) return "null";
    if ( !variable.constructor ) return "Object"; // Object with the null prototype.
    if ( variable.constructor.name === "Object" ) return "Object";  // simple objects

    // Match prototype instances
    const prototypes = [
      [Array, "Array"],
      [Set, "Set"],
      [Map, "Map"],
      [Promise, "Promise"],
      [Error, "Error"],
      [Color, "number"]
    ];
    if ( "HTMLElement" in globalThis ) prototypes.push([globalThis.HTMLElement, "HTMLElement"]);
    for ( const [cls, type] of prototypes ) {
      if ( variable instanceof cls ) return type;
    }

    // Unknown Object type
    return "Object";
  }

  /* -------------------------------------------- */

  /**
   * A helper function which searches through an object to assign a value using a string key
   * This string key supports the notation a.b.c which would target object[a][b][c]
   * @param {object} object   The object to update
   * @param {string} key      The string key
   * @param {*} value         The value to be assigned
   * @return {boolean}        Whether the value was changed from its previous value
   */
  function setProperty(object, key, value) {
    if ( !key ) return false;

    // Convert the key to an object reference if it contains dot notation
    let target = object;
    if ( key.indexOf('.') !== -1 ) {
      let parts = key.split('.');
      key = parts.pop();
      target = parts.reduce((o, i) => {
        if ( !o.hasOwnProperty(i) ) o[i] = {};
        return o[i];
      }, object);
    }

    // Update the target
    if ( !(key in target) || (target[key] !== value) ) {
      target[key] = value;
      return true;
    }
    return false;
  }

  /* -------------------------------------------- */

  /**
   * Test whether a value is empty-like; either undefined or a content-less object.
   * @param {*} value       The value to test
   * @returns {boolean}     Is the value empty-like?
   */
  function isEmpty(value) {
    const t = getType(value);
    switch ( t ) {
      case "undefined":
        return true;
      case "null":
        return true;
      case "Array":
        return !value.length;
      case "Object":
        return !Object.keys(value).length;
      case "Set":
      case "Map":
        return !value.size;
      default:
        return false;
    }
  }

  /* -------------------------------------------- */

  /**
   * Update a source object by replacing its keys and values with those from a target object.
   *
   * @param {object} original                           The initial object which should be updated with values from the
   *                                                    target
   * @param {object} [other={}]                         A new object whose values should replace those in the source
   * @param {object} [options={}]                       Additional options which configure the merge
   * @param {boolean} [options.insertKeys=true]         Control whether to insert new top-level objects into the resulting
   *                                                    structure which do not previously exist in the original object.
   * @param {boolean} [options.insertValues=true]       Control whether to insert new nested values into child objects in
   *                                                    the resulting structure which did not previously exist in the
   *                                                    original object.
   * @param {boolean} [options.overwrite=true]          Control whether to replace existing values in the source, or only
   *                                                    merge values which do not already exist in the original object.
   * @param {boolean} [options.recursive=true]          Control whether to merge inner-objects recursively (if true), or
   *                                                    whether to simply replace inner objects with a provided new value.
   * @param {boolean} [options.inplace=true]            Control whether to apply updates to the original object in-place
   *                                                    (if true), otherwise the original object is duplicated and the
   *                                                    copy is merged.
   * @param {boolean} [options.enforceTypes=false]      Control whether strict type checking requires that the value of a
   *                                                    key in the other object must match the data type in the original
   *                                                    data to be merged.
   * @param {boolean} [options.performDeletions=false]  Control whether to perform deletions on the original object if
   *                                                    deletion keys are present in the other object.
   * @param {number} [_d=0]                             A privately used parameter to track recursion depth.
   * @returns {object}                                  The original source object including updated, inserted, or
   *                                                    overwritten records.
   *
   * @example Control how new keys and values are added
   * ```js
   * mergeObject({k1: "v1"}, {k2: "v2"}, {insertKeys: false}); // {k1: "v1"}
   * mergeObject({k1: "v1"}, {k2: "v2"}, {insertKeys: true});  // {k1: "v1", k2: "v2"}
   * mergeObject({k1: {i1: "v1"}}, {k1: {i2: "v2"}}, {insertValues: false}); // {k1: {i1: "v1"}}
   * mergeObject({k1: {i1: "v1"}}, {k1: {i2: "v2"}}, {insertValues: true}); // {k1: {i1: "v1", i2: "v2"}}
   * ```
   *
   * @example Control how existing data is overwritten
   * ```js
   * mergeObject({k1: "v1"}, {k1: "v2"}, {overwrite: true}); // {k1: "v2"}
   * mergeObject({k1: "v1"}, {k1: "v2"}, {overwrite: false}); // {k1: "v1"}
   * ```
   *
   * @example Control whether merges are performed recursively
   * ```js
   * mergeObject({k1: {i1: "v1"}}, {k1: {i2: "v2"}}, {recursive: false}); // {k1: {i2: "v2"}}
   * mergeObject({k1: {i1: "v1"}}, {k1: {i2: "v2"}}, {recursive: true}); // {k1: {i1: "v1", i2: "v2"}}
   * ```
   *
   * @example Deleting an existing object key
   * ```js
   * mergeObject({k1: "v1", k2: "v2"}, {"-=k1": null}, {performDeletions: true});   // {k2: "v2"}
   * ```
   */
  function mergeObject(original, other={}, {
      insertKeys=true, insertValues=true, overwrite=true, recursive=true, inplace=true, enforceTypes=false,
      performDeletions=false
    }={}, _d=0) {
    other = other || {};
    if (!(original instanceof Object) || !(other instanceof Object)) {
      throw new Error("One of original or other are not Objects!");
    }
    const options = {insertKeys, insertValues, overwrite, recursive, inplace, enforceTypes, performDeletions};

    // Special handling at depth 0
    if ( _d === 0 ) {
      if ( Object.keys(other).some(k => /\./.test(k)) ) other = expandObject(other);
      if ( Object.keys(original).some(k => /\./.test(k)) ) {
        const expanded = expandObject(original);
        if ( inplace ) {
          Object.keys(original).forEach(k => delete original[k]);
          Object.assign(original, expanded);
        }
        else original = expanded;
      }
      else if ( !inplace ) original = deepClone(original);
    }

    // Iterate over the other object
    for ( let k of Object.keys(other) ) {
      const v = other[k];
      if ( original.hasOwnProperty(k) ) _mergeUpdate(original, k, v, options, _d+1);
      else _mergeInsert(original, k, v, options, _d+1);
    }
    return original;
  }

  /**
   * A helper function for merging objects when the target key does not exist in the original
   * @private
   */
  function _mergeInsert(original, k, v, {insertKeys, insertValues, performDeletions}={}, _d) {
    // Delete a key
    if ( k.startsWith("-=") && performDeletions ) {
      delete original[k.slice(2)];
      return;
    }

    const canInsert = ((_d <= 1) && insertKeys) || ((_d > 1) && insertValues);
    if ( !canInsert ) return;

    // Recursively create simple objects
    if ( v?.constructor === Object ) {
      original[k] = mergeObject({}, v, {insertKeys: true, inplace: true, performDeletions});
      return;
    }

    // Insert a key
    original[k] = v;
  }

  /**
   * A helper function for merging objects when the target key exists in the original
   * @private
   */
  function _mergeUpdate(original, k, v, {
      insertKeys, insertValues, enforceTypes, overwrite, recursive, performDeletions
    }={}, _d) {
    const x = original[k];
    const tv = getType(v);
    const tx = getType(x);

    // Recursively merge an inner object
    if ( (tv === "Object") && (tx === "Object") && recursive) {
      return mergeObject(x, v, {
        insertKeys, insertValues, overwrite, enforceTypes, performDeletions,
        inplace: true
      }, _d);
    }

    // Overwrite an existing value
    if ( overwrite ) {
      if ( (tx !== "undefined") && (tv !== tx) && enforceTypes ) {
        throw new Error(`Mismatched data types encountered during object merge.`);
      }
      original[k] = v;
    }
  }

  /**
   * @typedef {import("../_types.mjs").ApplicationConfiguration} ApplicationConfiguration
   */

  /**
   * @typedef {Object} DialogV2Button
   * @property {string} action                      The button action identifier.
   * @property {string} label                       The button label. Will be localized.
   * @property {string} [icon]                      FontAwesome icon classes.
   * @property {string} [class]                     CSS classes to apply to the button.
   * @property {boolean} [default]                  Whether this button represents the default action to take if the user
   *                                                submits the form without pressing a button, i.e. with an Enter
   *                                                keypress.
   * @property {DialogV2ButtonCallback} [callback]  A function to invoke when the button is clicked. The value returned
   *                                                from this function will be used as the dialog's submitted value.
   *                                                Otherwise, the button's identifier is used.
   */

  /**
   * @callback DialogV2ButtonCallback
   * @param {PointerEvent|SubmitEvent} event        The button click event, or a form submission event if the dialog was
   *                                                submitted via keyboard.
   * @param {HTMLButtonElement} button              If the form was submitted via keyboard, this will be the default
   *                                                button, otherwise the button that was clicked.
   * @param {HTMLDialogElement} dialog              The dialog element.
   * @returns {Promise<any>}
   */

  /**
   * @typedef {Object} DialogV2Configuration
   * @property {boolean} [modal]                    Modal dialogs prevent interaction with the rest of the UI until they
   *                                                are dismissed or submitted.
   * @property {DialogV2Button[]} buttons           Button configuration.
   * @property {string} [content]                   The dialog content.
   * @property {DialogV2SubmitCallback} [submit]    A function to invoke when the dialog is submitted. This will not be
   *                                                called if the dialog is dismissed.
   */

  /**
   * @callback DialogV2RenderCallback
   * @param {Event} event                           The render event.
   * @param {HTMLDialogElement} dialog              The dialog element.
   */

  /**
   * @callback DialogV2CloseCallback
   * @param {Event} event                           The close event.
   * @param {DialogV2} dialog                       The dialog instance.
   */

  /**
   * @callback DialogV2SubmitCallback
   * @param {any} result                            Either the identifier of the button that was clicked to submit the
   *                                                dialog, or the result returned by that button's callback.
   * @returns {Promise<void>}
   */

  /**
   * @typedef {object} DialogV2WaitOptions
   * @property {DialogV2RenderCallback} [render]    A synchronous function to invoke whenever the dialog is rendered.
   * @property {DialogV2CloseCallback} [close]      A synchronous function to invoke when the dialog is closed under any
   *                                                circumstances.
   * @property {boolean} [rejectClose=true]         Throw a Promise rejection if the dialog is dismissed.
   */

  /**
   * A lightweight Application that renders a dialog containing a form with arbitrary content, and some buttons.
   * @extends {ApplicationV2<ApplicationConfiguration & DialogV2Configuration>}
   *
   * @example Prompt the user to confirm an action.
   * ```js
   * const proceed = await foundry.applications.api.DialogV2.confirm({
   *   content: "Are you sure?",
   *   rejectClose: false,
   *   modal: true
   * });
   * if ( proceed ) console.log("Proceed.");
   * else console.log("Do not proceed.");
   * ```
   *
   * @example Prompt the user for some input.
   * ```js
   * let guess;
   * try {
   *   guess = await foundry.applications.api.DialogV2.prompt({
   *     window: { title: "Guess a number between 1 and 10" },
   *     content: '<input name="guess" type="number" min="1" max="10" step="1" autofocus>',
   *     ok: {
   *       label: "Submit Guess",
   *       callback: (event, button, dialog) => button.form.elements.guess.valueAsNumber
   *     }
   *   });
   * } catch {
   *   console.log("User did not make a guess.");
   *   return;
   * }
   * const n = Math.ceil(CONFIG.Dice.randomUniform() * 10);
   * if ( n === guess ) console.log("User guessed correctly.");
   * else console.log("User guessed incorrectly.");
   * ```
   *
   * @example A custom dialog.
   * ```js
   * new foundry.applications.api.DialogV2({
   *   window: { title: "Choose an option" },
   *   content: `
   *     <label><input type="radio" name="choice" value="one" checked> Option 1</label>
   *     <label><input type="radio" name="choice" value="two"> Option 2</label>
   *     <label><input type="radio" name="choice" value="three"> Options 3</label>
   *   `,
   *   buttons: [{
   *     action: "choice",
   *     label: "Make Choice",
   *     default: true,
   *     callback: (event, button, dialog) => button.form.elements.choice.value
   *   }, {
   *     action: "all",
   *     label: "Take All"
   *   }],
   *   submit: result => {
   *     if ( result === "all" ) console.log("User picked all options.");
   *     else console.log(`User picked option: ${result}`);
   *   }
   * }).render({ force: true });
   * ```
   */
  class DialogV2 extends ApplicationV2 {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
      id: "dialog-{id}",
      classes: ["dialog"],
      tag: "dialog",
      form: {
        closeOnSubmit: true
      },
      window: {
        frame: true,
        positioned: true,
        minimizable: false
      }
    };

    /* -------------------------------------------- */

    /** @inheritDoc */
    _initializeApplicationOptions(options) {
      options = super._initializeApplicationOptions(options);
      if ( !options.buttons?.length ) throw new Error("You must define at least one entry in options.buttons");
      options.buttons = options.buttons.reduce((obj, button) => {
        options.actions[button.action] = this.constructor._onClickButton;
        obj[button.action] = button;
        return obj;
      }, {});
      return options;
    }

    /* -------------------------------------------- */

    /** @override */
    async _renderHTML(_context, _options) {
      const form = document.createElement("form");
      form.className = "dialog-form standard-form";
      form.autocomplete = "off";
      form.innerHTML = `
      ${this.options.content ? `<div class="dialog-content standard-form">${this.options.content}</div>` : ""}
      <footer class="form-footer">${this._renderButtons()}</footer>
    `;
      form.addEventListener("submit", event => this._onSubmit(event.submitter, event));
      return form;
    }

    /* -------------------------------------------- */

    /**
     * Render configured buttons.
     * @returns {string}
     * @protected
     */
    _renderButtons() {
      return Object.values(this.options.buttons).map(button => {
        const { action, label, icon, default: isDefault, class: cls="" } = button;
        return `
        <button type="${isDefault ? "submit" : "button"}" data-action="${action}" class="${cls}"
                ${isDefault ? "autofocus" : ""}>
          ${icon ? `<i class="${icon}"></i>` : ""}
          <span>${game.i18n.localize(label)}</span>
        </button>
      `;
      }).join("");
    }

    /* -------------------------------------------- */

    /**
     * Handle submitting the dialog.
     * @param {HTMLButtonElement} target        The button that was clicked or the default button.
     * @param {PointerEvent|SubmitEvent} event  The triggering event.
     * @returns {Promise<DialogV2>}
     * @protected
     */
    async _onSubmit(target, event) {
      event.preventDefault();
      const button = this.options.buttons[target?.dataset.action];
      const result = (await button?.callback?.(event, target, this.element)) ?? button?.action;
      await this.options.submit?.(result);
      return this.options.form.closeOnSubmit ? this.close() : this;
    }

    /* -------------------------------------------- */

    /** @override */
    _onFirstRender(_context, _options) {
      if ( this.options.modal ) this.element.showModal();
      else this.element.show();
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _attachFrameListeners() {
      super._attachFrameListeners();
      this.element.addEventListener("keydown", this._onKeyDown.bind(this));
    }

    /* -------------------------------------------- */

    /** @override */
    _replaceHTML(result, content, _options) {
      content.replaceChildren(result);
    }

    /* -------------------------------------------- */

    /**
     * Handle keypresses within the dialog.
     * @param {KeyboardEvent} event  The triggering event.
     * @protected
     */
    _onKeyDown(event) {
      // Capture Escape keypresses for dialogs to ensure that close is called properly.
      if ( event.key === "Escape" ) {
        event.preventDefault(); // Prevent default browser dialog dismiss behavior.
        event.stopPropagation();
        this.close();
      }
    }

    /* -------------------------------------------- */

    /**
     * @this {DialogV2}
     * @param {PointerEvent} event        The originating click event.
     * @param {HTMLButtonElement} target  The button element that was clicked.
     * @protected
     */
    static _onClickButton(event, target) {
      this._onSubmit(target, event);
    }

    /* -------------------------------------------- */
    /*  Factory Methods                             */
    /* -------------------------------------------- */

    /**
     * A utility helper to generate a dialog with yes and no buttons.
     * @param {Partial<ApplicationConfiguration & DialogV2Configuration & DialogV2WaitOptions>} [options]
     * @param {DialogV2Button} [options.yes]  Options to overwrite the default yes button configuration.
     * @param {DialogV2Button} [options.no]   Options to overwrite the default no button configuration.
     * @returns {Promise<any>}                Resolves to true if the yes button was pressed, or false if the no button
     *                                        was pressed. If additional buttons were provided, the Promise resolves to
     *                                        the identifier of the one that was pressed, or the value returned by its
     *                                        callback. If the dialog was dismissed, and rejectClose is false, the
     *                                        Promise resolves to null.
     */
    static async confirm({ yes={}, no={}, ...options }={}) {
      options.buttons ??= [];
      options.buttons.unshift(mergeObject({
        action: "yes", label: "Yes", icon: "fas fa-check", callback: () => true
      }, yes), mergeObject({
        action: "no", label: "No", icon: "fas fa-xmark", default: true, callback: () => false
      }, no));
      return this.wait(options);
    }

    /* -------------------------------------------- */

    /**
     * A utility helper to generate a dialog with a single confirmation button.
     * @param {Partial<ApplicationConfiguration & DialogV2Configuration & DialogV2WaitOptions>} [options]
     * @param {Partial<DialogV2Button>} [options.ok]  Options to overwrite the default confirmation button configuration.
     * @returns {Promise<any>}                        Resolves to the identifier of the button used to submit the dialog,
     *                                                or the value returned by that button's callback. If the dialog was
     *                                                dismissed, and rejectClose is false, the Promise resolves to null.
     */
    static async prompt({ ok={}, ...options }={}) {
      options.buttons ??= [];
      options.buttons.unshift(mergeObject({
        action: "ok", label: "Confirm", icon: "fas fa-check", default: true
      }, ok));
      return this.wait(options);
    }

    /* -------------------------------------------- */

    /**
     * Spawn a dialog and wait for it to be dismissed or submitted.
     * @param {Partial<ApplicationConfiguration & DialogV2Configuration>} [options]
     * @param {DialogV2RenderCallback} [options.render]  A function to invoke whenever the dialog is rendered.
     * @param {DialogV2CloseCallback} [options.close]    A function to invoke when the dialog is closed under any
     *                                                   circumstances.
     * @param {boolean} [options.rejectClose=true]       Throw a Promise rejection if the dialog is dismissed.
     * @returns {Promise<any>}                           Resolves to the identifier of the button used to submit the
     *                                                   dialog, or the value returned by that button's callback. If the
     *                                                   dialog was dismissed, and rejectClose is false, the Promise
     *                                                   resolves to null.
     */
    static async wait({ rejectClose=true, close, render, ...options }={}) {
      return new Promise((resolve, reject) => {
        // Wrap submission handler with Promise resolution.
        const originalSubmit = options.submit;
        options.submit = async result => {
          await originalSubmit?.(result);
          resolve(result);
        };

        const dialog = new this(options);
        dialog.addEventListener("close", event => {
          if ( close instanceof Function ) close(event, dialog);
          if ( rejectClose ) reject(new Error("Dialog was dismissed without pressing a button."));
          else resolve(null);
        }, { once: true });
        if ( render instanceof Function ) {
          dialog.addEventListener("render", event => render(event, dialog.element));
        }
        dialog.render({ force: true });
      });
    }
  }

  /**
   * The primary application which renders packages on the Setup view.
   */
  class SetupPackages extends Application {
    constructor(...args) {
      super(...args);
      this.#viewModes = this.#initializeViewModes();
    }

    /**
     * Initialize user-designated favorite packages.
     */
    #initializePackageFavorites() {
      const packageFavorites = game.settings.get("core", Setup.FAVORITE_PACKAGES_SETTING);
      for ( const [collectionName, ids] of Object.entries(packageFavorites) ) {
        const c = game[collectionName];
        for ( const id of ids ) {
          const pkg = c.get(id);
          if ( pkg ) pkg.favorite = true;
        }
      }
    }

    /**
     * Retrieve selected view modes from client storage.
     * @returns {{worlds: string, systems: string, modules: string}}
     */
    #initializeViewModes() {
      const vm = game.settings.get("core", "setupViewModes");
      if ( !(vm.worlds in SetupPackages.VIEW_MODES) ) vm.worlds = "GALLERY";
      if ( !(vm.systems in SetupPackages.VIEW_MODES) ) vm.systems = "GALLERY";
      if ( !(vm.modules in SetupPackages.VIEW_MODES) ) vm.modules = "TILES";
      return vm;
    }

    /* -------------------------------------------- */

    /** @override */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "setup-packages",
        template: "templates/setup/setup-packages.hbs",
        popOut: false,
        scrollY: ["#worlds-list", "#systems-list", "#modules-list"],
        tabs: [{navSelector: ".tabs", contentSelector: "#setup-packages", initial: "worlds"}],
        filters: [
          {inputSelector: "#world-filter", contentSelector: "#worlds-list"},
          {inputSelector: "#system-filter", contentSelector: "#systems-list"},
          {inputSelector: "#module-filter", contentSelector: "#modules-list"}
        ]
      });
    }

    /**
     * The set of progress actions eligible for display in the package progress bar.
     * @type {Set<string>}
     */
    static progressActions = new Set([
      CONST.SETUP_PACKAGE_PROGRESS.ACTIONS.INSTALL_PKG,
      CONST.SETUP_PACKAGE_PROGRESS.ACTIONS.LAUNCH_WORLD,
      CONST.SETUP_PACKAGE_PROGRESS.ACTIONS.CREATE_BACKUP,
      CONST.SETUP_PACKAGE_PROGRESS.ACTIONS.RESTORE_BACKUP,
      CONST.SETUP_PACKAGE_PROGRESS.ACTIONS.DELETE_BACKUP,
      CONST.SETUP_PACKAGE_PROGRESS.ACTIONS.CREATE_SNAPSHOT,
      CONST.SETUP_PACKAGE_PROGRESS.ACTIONS.RESTORE_SNAPSHOT
    ]);

    /**
     * A mapping of package IDs to progress bar elements
     * @type {Map<string, HTMLElement>}
     */
    progress = new Map();

    /**
     * The view modes applied to each package tab.
     * @type {{worlds: string, systems: string, modules: string}}
     */
    #viewModes;

    /**
     * Track whether an "Update All" workflow is currently in progress.
     * @type {"world"|"system"|"module"|null}
     */
    #updatingAll = null;

    /**
     * The allowed view modes which can be used for each package-type tab.
     * @enum {Readonly<{id: string, label: string, template: string}>}
     */
    static VIEW_MODES = Object.freeze({
      GALLERY: {
        id: "GALLERY",
        icon: "fa-solid fa-image-landscape",
        label: "PACKAGE.VIEW_MODES.GALLERY",
        template: "templates/setup/parts/package-gallery.hbs"
      },
      TILES: {
        id: "TILES",
        icon: "fa-solid fa-grid-horizontal",
        label: "PACKAGE.VIEW_MODES.TILES",
        template: "templates/setup/parts/package-tiles.hbs"
      },
      DETAILS: {
        id: "DETAILS",
        icon: "fa-solid fa-list",
        label: "PACKAGE.VIEW_MODES.DETAILS",
        template: "templates/setup/parts/package-details.hbs"
      }
    });

    /**
     * The maximum number of progress bars that will be displayed simultaneously.
     * @type {number}
     */
    static MAX_PROGRESS_BARS = 5;

    /* -------------------------------------------- */
    /*  Tabs and Filters                            */
    /* -------------------------------------------- */

    /**
     * The name of the currently active packages tab.
     * @type {string}
     */
    get activeTab() {
      return this._tabs[0].active;
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    _onChangeTab(event, tabs, active) {
      super._onChangeTab(event, tabs, active);
      this._searchFilters.forEach(f => {
        if ( f._input ) f._input.value = "";
        f.filter(null, "");
      });
      this.element.find(".tab.active .filter > input").trigger("focus");
      document.querySelector(".tab.active > header").insertAdjacentElement("afterend", document.getElementById("progress"));
    }

    /* -------------------------------------------- */

    /** @override */
    _onSearchFilter(event, query, rgx, html) {
      if ( !html ) return;
      let anyMatch = !query;
      const noResults = html.closest("section").querySelector(".no-results");
      for ( const li of html.children ) {
        if ( !query ) {
          li.classList.remove("hidden");
          continue;
        }
        const id = li.dataset.packageId;
        const title = li.querySelector(".package-title")?.textContent;
        let match = rgx.test(id) || rgx.test(SearchFilter.cleanQuery(title));
        li.classList.toggle("hidden", !match);
        if ( match ) anyMatch = true;
      }
      const empty = !anyMatch || !html.children.length;
      html.classList.toggle("empty", empty);
      if ( !anyMatch ) {
        const label = game.i18n.localize(`SETUP.${html.closest(".tab").id.titleCase()}`);
        const search = game.i18n.localize("SETUP.PackagesNoResultsSearch", { name: query});
        noResults.innerHTML = `<p>${game.i18n.format("SETUP.PackagesNoResults", {type: label, name: query})}
      <a class="button search-packages" data-action="installPackage" data-query="${query}">${search}</a></p>`;
      }
      noResults.classList.toggle("hidden", anyMatch);
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @inheritdoc */
    async _render(force, options) {
      await loadTemplates([
        "templates/setup/parts/package-tags.hbs",
        ...Object.values(SetupPackages.VIEW_MODES).map(m => m.template)
      ]);
      await super._render(force, options);
      const progressBars = document.getElementById("progress");
      progressBars.append(...this.progress.values());
      document.querySelector(".tab.active > header").insertAdjacentElement("afterend", progressBars);
    }

    /* -------------------------------------------- */

    /** @override */
    async getData(options={}) {
      this.#initializePackageFavorites();
      return {
        worlds: {
          packages: this.#prepareWorlds(),
          count: game.worlds.size,
          viewMode: this.#viewModes.worlds,
          template: SetupPackages.VIEW_MODES[this.#viewModes.worlds].template,
          icon: World.icon,
          updatingAll: this.#updatingAll === "world"
        },
        systems: {
          packages: this.#prepareSystems(),
          count: game.systems.size,
          viewMode: this.#viewModes.systems,
          template: SetupPackages.VIEW_MODES[this.#viewModes.systems].template,
          icon: System.icon,
          updatingAll: this.#updatingAll === "system"
        },
        modules: {
          packages: this.#prepareModules(),
          count: game.modules.size,
          viewMode: this.#viewModes.modules,
          template: SetupPackages.VIEW_MODES[this.#viewModes.modules].template,
          icon: Module.icon,
          updatingAll: this.#updatingAll === "module"
        },
        viewModes: Object.values(SetupPackages.VIEW_MODES)
      };
    }

    /* -------------------------------------------- */

    /**
     * Prepare data for rendering the Worlds tab.
     * @returns {object[]}
     */
    #prepareWorlds() {
      const codes = CONST.PACKAGE_AVAILABILITY_CODES;
      const worlds = game.worlds.map(world => {
        const w = world.toObject();
        w.authors = this.#formatAuthors(w.authors);
        w.system = game.systems.get(w.system);
        w.thumb = this.#getCover(world) || this.#getCover(w.system) || "ui/anvil-bg.png";
        w.badge = world.getVersionBadge();
        w.systemBadge = world.getSystemBadge();
        w.available = (world.availability <= codes.REQUIRES_UPDATE) || (world.availability === codes.VERIFIED);
        w.lastPlayedDate = new Date(w.lastPlayed);
        w.lastPlayedLabel = this.#formatDate(w.lastPlayedDate);
        w.canPlay = !(world.locked || world.unavailable);
        w.favorite = world.favorite;
        w.locked = world.locked;
        w.shortDesc = TextEditor.previewHTML(w.description);
        return w;
      });
      worlds.sort(this.#sortWorlds);
      return worlds;
    }

    /* -------------------------------------------- */

    #prepareSystems() {
      const systems = game.systems.map(system => {
        const s = system.toObject();
        s.authors = this.#formatAuthors(s.authors);
        s.shortDesc = TextEditor.previewHTML(s.description);
        s.badge = system.getVersionBadge();
        s.favorite = system.favorite;
        s.locked = system.locked;
        s.thumb = this.#getCover(system) || "ui/anvil-bg.png";
        return s;
      });
      systems.sort(this.#sortPackages);
      return systems;
    }

    /* -------------------------------------------- */

    #prepareModules() {
      const modules = game.modules.map(module => {
        const m = module.toObject();
        m.authors = this.#formatAuthors(m.authors);
        m.shortDesc = TextEditor.previewHTML(m.description);
        m.badge = module.getVersionBadge();
        m.favorite = module.favorite;
        m.locked = module.locked;
        m.thumb = this.#getCover(module) || "ui/anvil-bg.png";
        return m;
      });
      modules.sort(this.#sortPackages);
      return modules;
    }

    /* -------------------------------------------- */

    /**
     * Obtain a cover image used to represent the package.
     * Prefer the "setup" media type, and prefer a thumbnail to the full image.
     * Otherwise, use a background image if the package has one.
     * @param {BasePackage} pkg     The package which requires a cover image
     * @returns {string}            A cover image URL or undefined
     */
    #getCover(pkg) {
      if ( !pkg ) return undefined;
      if ( pkg.media.size ) {
        const setup = pkg.media.find(m => m.type === "setup");
        if ( setup?.thumbnail ) return setup.thumbnail;
        else if ( setup?.url ) return setup.url;
      }
      if ( pkg.background ) return pkg.background;
    }

    /* -------------------------------------------- */

    #formatAuthors(authors=[]) {
      return authors.map(a => {
        if ( a.url ) return `<a href="${a.url}" target="_blank">${a.name}</a>`;
        return a.name;
      }).join(", ");
    }

    /* -------------------------------------------- */

    /**
     * Format dates displayed in the app.
     * @param {Date} date     The Date instance to format
     * @returns {string}      The formatted date string
     */
    #formatDate(date) {
      return date.isValid() ? date.toLocaleDateString(game.i18n.lang, {
        weekday: "long",
        month: "short",
        day: "numeric"
      }) : "";
    }

    /* -------------------------------------------- */

    /**
     * A sorting function used to order worlds.
     * @returns {number}
     */
    #sortWorlds(a, b) {

      // Favorites
      const fd = b.favorite - a.favorite;
      if ( fd !== 0 ) return fd;

      // Sort date
      const ad = a.lastPlayedDate.isValid() ? a.lastPlayedDate : 0;
      const bd = b.lastPlayedDate.isValid() ? b.lastPlayedDate : 0;
      if ( ad && !bd ) return -1;
      if ( bd && !ad ) return 1;
      if ( ad && bd ) return bd - ad;

      // Sort title
      return a.title.localeCompare(b.title, game.i18n.lang);
    }

    /* -------------------------------------------- */

    /**
     * A sorting function used to order systems and modules.
     * @param {ClientPackage} a   A system or module
     * @param {ClientPackage} b   Another system or module
     * @returns {number}          The relative sort order between the two
     */
    #sortPackages(a, b) {
      return (b.favorite - a.favorite) || a.title.localeCompare(b.title, game.i18n.lang);
    }

    /* -------------------------------------------- */
    /*  Interactivity                               */
    /* -------------------------------------------- */

    /** @inheritDoc */
    activateListeners(html) {
      super.activateListeners(html);
      html.on("click", "[data-action]", this.#onClickAction.bind(this));
      html.on("click", "[data-tour]", this.#onClickTour.bind(this));

      // Context Menu for package management
      new ContextMenu(html, ".package", [], {onOpen: this.#setContextMenuItems.bind(this)});

      // Intersection observer for world background images
      const observer = new IntersectionObserver(this.#onLazyLoadImages.bind(this), { root: html[0] });
      const systems = html.find("#systems-list")[0].children;
      for ( const li of html.find("#worlds-list")[0].children ) observer.observe(li);
      for ( const li of systems ) observer.observe(li);
      for ( const li of html.find("#modules-list")[0].children ) observer.observe(li);

      // If there are no systems, disable the world tab and swap to the systems tab
      if ( systems.length === 0 ) {
        const worldsTab = html.find("[data-tab=worlds]");
        worldsTab.addClass("disabled");
        worldsTab.removeClass("active");
        // Only activate systems if modules is not the active tab
        if ( this.activeTab !== "modules" ) {
          html.find("[data-tab=systems").addClass("active");
        }
      }
    }

    /* -------------------------------------------- */

    /**
     * Dynamically assign context menu options depending on the package that is interacted with.
     * @param {HTMLLIElement} li      The HTML <li> element to which the context menu is attached
     */
    #setContextMenuItems(li) {
      const packageType = li.closest("[data-package-type]").dataset.packageType;
      const typeLabel = game.i18n.localize(`PACKAGE.Type.${packageType}`);
      const collection = PACKAGE_TYPES[packageType].collection;
      const pkg = game[collection].get(li.dataset.packageId);
      const menuItems = [];

      // Launch World
      if ( (packageType === "world") && !pkg.locked && !pkg.unavailable ) menuItems.push({
        name: "SETUP.WorldLaunch",
        icon: '<i class="fas fa-circle-play"></i>',
        callback: () => this.#launchWorld(pkg),
        group: "primary"
      });

      // Edit World
      if ( (packageType === "world") && !pkg.locked ) menuItems.push({
        name: "SETUP.WorldEdit",
        icon: '<i class="fas fa-edit"></i>',
        callback: () => new WorldConfig(pkg).render(true),
        group: "primary"
      });

      // Edit Module
      if ( (packageType === "module") && !pkg.locked ) menuItems.push({
        name: "PACKAGE.ModuleEdit",
        icon: '<i class="fas fa-edit"></i>',
        callback: () => new ModuleConfigurationForm(pkg.toObject()).render(true),
        group: "primary"
      });

      // Mark or Unmark Favorite
      menuItems.push({
        name: game.i18n.format(pkg.favorite ? "PACKAGE.Unfavorite" : "PACKAGE.Favorite"),
        icon: `<i class="${pkg.favorite ? "fa-regular fa-star" : "fa-solid fa-star"}"></i>`,
        callback: () => this.#toggleFavorite(pkg),
        group: "primary"
      });

      // Lock or Unlock Package
      menuItems.push({
        name: game.i18n.format(pkg.locked ? "PACKAGE.Unlock" : "PACKAGE.Lock", {type: typeLabel}),
        icon: `<i class="fas fa-${pkg.locked ? "lock": "unlock"}"></i>`,
        callback: () => this.#toggleLock(pkg),
        group: "primary"
      });

      // Delete Package
      menuItems.push({
        name: packageType === "world" ? "SETUP.WorldDelete" : "SETUP.Uninstall",
        icon: '<i class="fas fa-trash"></i>',
        callback: () => Setup.uninstallPackage(pkg),
        group: "primary"
      });

      if ( !game.data.options.noBackups ) {
        // Taking backups
        menuItems.push({
          name: "SETUP.BACKUPS.TakeBackup",
          icon: '<i class="fas fa-floppy-disk"></i>',
          callback: () => Setup.createBackup(pkg, { dialog: true }),
          group: "backups"
        });

        if ( Setup.backups?.[pkg.type]?.[pkg.id]?.length ) {
          menuItems.push({
            name: "SETUP.BACKUPS.RestoreLatestBackup",
            icon: '<i class="fas fa-undo"></i>',
            callback: () => Setup.restoreLatestBackup(pkg, { dialog: true }),
            group: "backups"
          });
        }

        // Managing backups
        menuItems.push({
          name: "SETUP.BACKUPS.ManageBackups",
          icon: '<i class="fas fa-floppy-disks"></i>',
          callback: () => new BackupList(pkg).render(true),
          group: "backups"
        });
      }

      ui.context.menuItems = menuItems;
    }

    /* -------------------------------------------- */

    /**
     * Handle click events on an action button.
     * @param {PointerEvent} event      The initiating click event
     */
    async #onClickTour(event) {
      event.preventDefault();

      // Gather data
      const link = event.currentTarget;

      // Delegate tour
      switch ( link.dataset.tour ) {
        case "creatingAWorld":
          return game.tours.get("core.creatingAWorld").start();
        case "installingASystem":
          return game.tours.get("core.installingASystem").start();
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle click events on an action button.
     * @param {PointerEvent} event      The initiating click event
     */
    async #onClickAction(event) {
      event.preventDefault();

      // Gather data
      const button = event.currentTarget;
      const packageType = button.closest("[data-package-type]").dataset.packageType;
      const packageId = button.closest(".package")?.dataset.packageId;
      const pkg = packageId ? game[PACKAGE_TYPES[packageType].collection].get(packageId) : undefined;

      // Delegate action
      switch ( button.dataset.action ) {
        case "installPackage":
          await Setup.browsePackages(packageType, {search: button.dataset.query});
          break;
        case "moduleCreate":
          new ModuleConfigurationForm().render(true);
          break;
        case "updateAll":
          await this.#updateAll(packageType);
          break;
        case "updatePackage":
          await this.#updatePackage(pkg);
          break;
        case "viewMode":
          this.#onChangeViewMode(button);
          break;
        case "worldCreate":
          this.#createWorld();
          break;
        case "worldInstall":
          await Setup.browsePackages(packageType);
          break;
        case "worldLaunch":
          await this.#launchWorld(pkg);
          break;
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle toggling the view mode for a certain package type.
     * @param {HTMLElement} button    The clicked button element
     */
    #onChangeViewMode(button) {
      const tab = button.closest(".tab").dataset.tab;
      this.#viewModes[tab] = button.dataset.viewMode;
      game.settings.set("core", "setupViewModes", this.#viewModes);
      this.render();
    }

    /* -------------------------------------------- */

    /**
     * Handle lazy loading for world background images to only load them once they become observed.
     * @param {IntersectionObserverEntry[]} entries   The entries which are now observed
     * @param {IntersectionObserver} observer         The intersection observer instance
     */
    #onLazyLoadImages(entries, observer) {
      for ( const e of entries ) {
        if ( !e.isIntersecting ) continue;
        const li = e.target;
        const img = li.querySelector(".thumbnail");
        if ( img?.dataset.src ) {
          img.src = img.dataset.src;
          delete img.dataset.src;
        }
        observer.unobserve(li);
      }
    }

    /* -------------------------------------------- */

    /**
     * Display a confirmation dialog which warns the user that launching the world will trigger irreversible migration.
     * @param {World} world                                       The World being launched
     * @returns {Promise<{confirm: boolean, [backup]: boolean}>}  Did the user agree to proceed?
     */
    async #displayWorldMigrationInfo(world) {
      if ( !world ) return { confirm: false };
      const system = game.systems.get(world.system);
      const needsCoreMigration = foundry.utils.isNewerVersion(game.release.version, world.coreVersion);
      const needsSystemMigration = world.systemVersion
        && foundry.utils.isNewerVersion(system.version, world.systemVersion);

      if ( !needsCoreMigration && !needsSystemMigration ) return { confirm: true };
      if ( !needsCoreMigration && needsSystemMigration && game.data.options.noBackups ) return { confirm: true };

      // Prompt that world migration will be required
      const title = game.i18n.localize("SETUP.WorldMigrationRequiredTitle");
      const disableModules = game.release.isGenerationalChange(world.compatibility.verified);

      let content = [
        needsCoreMigration ? game.i18n.format("SETUP.WorldCoreMigrationRequired", {
          world: world.title,
          oldVersion: world.coreVersion,
          newVersion: game.release
        }) : game.i18n.format("SETUP.WorldSystemMigrationRequired", {
          oldVersion: world.systemVersion,
          newVersion: system.version
        }),
        system.availability !== CONST.PACKAGE_AVAILABILITY_CODES.VERIFIED
          ? game.i18n.format("SETUP.WorldMigrationSystemUnavailable", {
            system: system.title,
            systemVersion: system.version
          })
          : "",
        disableModules ? game.i18n.localize("SETUP.WorldMigrationDisableModules") : "",
        game.i18n.localize("SETUP.WorldMigrationBackupPrompt")
      ].filterJoin("");

      if ( !game.data.options.noBackups ) {
        content += `
        <label class="checkbox" id="create-backup">
          ${game.i18n.localize("SETUP.WorldMigrationCreateBackup")}
          <input type="checkbox" checked>
        </label>
      `;
      }

      // Present the confirmation dialog
      return Dialog.wait({
        title, content, default: "no",
        buttons: {
          yes: {
            icon: '<i class="fa-solid fa-laptop-arrow-down"></i>',
            label: game.i18n.localize("SETUP.WorldMigrationBegin"),
            callback: html => ({ confirm: true, backup: html.querySelector("#create-backup input")?.checked })
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("Cancel"),
            callback: () => ({ confirm: false })
          }
        },
        close: () => ({ confirm: false })
      }, { jQuery: false });
    }

    /* -------------------------------------------- */

    /**
     * Toggle the locked state of the interface.
     * @param {boolean} locked            Is the interface locked?
     * @param {object} [options]
     * @param {string} [options.message]  The message to display.
     */
    toggleLock(locked, { message }={}) {
      const element = this.element[0];
      if ( !element ) return;
      element.querySelectorAll(".tabs .item").forEach(el => el.classList.toggle("disabled", locked));
      element.querySelectorAll(".package-list").forEach(el => el.classList.toggle("hidden", locked));
      element.querySelectorAll(".controls :is(input, button)").forEach(el => el.disabled = locked);
      const status = element.querySelector(".tab.active .locked");
      status.classList.toggle("hidden", !locked);
      if ( message ) status.querySelector("h3").innerText = game.i18n.localize(message);
    }

    /* -------------------------------------------- */
    /*  Package Management Operations               */
    /* -------------------------------------------- */

    /**
     * Create a new World.
     */
    #createWorld() {
      if ( !game.systems.size ) return ui.notifications.warn(game.i18n.localize("SETUP.YouMustInstallASystem"));
      const world = new World({name: "1", title: "1", system: "1", coreVersion: game.release.version});
      world.id = world.title = world.system = "";
      new WorldConfig(world, {create: true}).render(true);
    }

    /* -------------------------------------------- */

    /**
     * Request to launch a World.
     * @param {World} world      The requested World to launch
     * @returns {Promise<void>}  A Promise that resolves when the World is launched or an error occurs.
     */
    async #launchWorld(world) {
      if ( world.locked ) return ui.notifications.error(game.i18n.format("PACKAGE.LaunchLocked", {id: world.id}));
      const { confirm, backup } = await this.#displayWorldMigrationInfo(world);
      if ( !confirm ) return;

      if ( backup ) await Setup.createBackup(world, { dialog: true });

      // Notify migration in progress.
      if ( foundry.utils.isNewerVersion(game.release.version, world.coreVersion) ) {
        const msg = game.i18n.format("SETUP.WorldMigrationInProcess", {version: game.release});
        ui.notifications.info(msg, {permanent: true});
      }

      // Show progress spinner and disable interaction with worlds.
      const worlds = document.getElementById("worlds-list");
      worlds.classList.add("disabled");
      const tile = worlds.querySelector(`.world[data-package-id="${world.id}"]`);
      tile.classList.add("loading");
      const icon = tile.querySelector(`.control.play > i`);
      icon.setAttribute("class", "fas fa-spinner fa-spin-pulse");

      const { ACTIONS } = CONST.SETUP_PACKAGE_PROGRESS;
      const response = await new ProgressReceiver(world.id, ACTIONS.LAUNCH_WORLD, { world: world.id }).listen();
      if ( response instanceof Error ) {
        ui.notifications.error(game.i18n.format("SETUP.WorldLaunchFailure", { message: response.message }), {
          console: false, permanent: true
        });
      }
      else location.href = foundry.utils.getRoute("/game");
    }

    /* -------------------------------------------- */

    /**
     * Toggle marking a package as a favorite.
     * @param {BasePackage} pkg       The requested Package to mark or unmark as a favorite
     */
    async #toggleFavorite(pkg) {
      const favorites = game.settings.get("core", Setup.FAVORITE_PACKAGES_SETTING);
      const collectionName = PACKAGE_TYPES[pkg.type].collection;
      if ( pkg.favorite ) favorites[collectionName].findSplice(f => f === pkg.id);
      else favorites[collectionName].push(pkg.id);
      game.settings.set("core", Setup.FAVORITE_PACKAGES_SETTING, favorites);
      pkg.favorite = !pkg.favorite;
      this.render();
    }

    /* -------------------------------------------- */

    /**
     * Toggle locking or unlocking a package.
     * @param {BasePackage} pkg       The requested Package to lock or unlock
     * @returns {Promise<object>}     Returned response from the server
     */
    async #toggleLock(pkg) {
      const shouldLock = !pkg.locked;
      await Setup.post({action: "lockPackage", type: pkg.type, id: pkg.id, shouldLock});
      pkg.locked = shouldLock;
      this.render();
    }

    /* -------------------------------------------- */

    /**
     * Handle update button press for a single Package.
     * @param {BasePackage} pkg       The requested Package to update
     * @param {object} [options]      Options which configure installation
     * @param {boolean} [options.notify=true]   Display a notification toast. Suppressed for "updateAll"
     * @returns {Promise<void>}
     */
    async #installPackageUpdate(pkg, {notify=true}={}) {
      return Setup.installPackage({type: pkg.type, id: pkg.id, manifest: pkg.manifest, notify});
    }

    /* -------------------------------------------- */

    /**
     * Update all package for a certain package type.
     * @param {string} packageType         The package type to update
     * @param {object} [options]
     * @param {Set<string>} [options.ids]  A fixed set of package IDs to update, rather than all of the given type.
     * @param {boolean} [options.force]    Update the packages without prompting the user to confirm in cases of
     *                                     incompatible systems.
     * @returns {Promise<void>}
     */
    async #updateAll(packageType, { ids, force }={}) {
      if ( this.#updatingAll ) return ui.notifications.warn("PACKAGE.UpdateAllInProgress", {localize: true});
      this.#updatingAll = packageType;

      // Disable the "Update All" button
      let button = this.element[0].querySelector(`[data-package-type="${packageType}"] [data-action="updateAll"]`);
      button.disabled = true;
      button.firstElementChild.className = "fas fa-spinner fa-spin";

      // Create two queues
      const max = SetupPackages.MAX_PROGRESS_BARS;
      const pending = game[PACKAGE_TYPES[packageType].collection].filter(p => {
        return p.manifest && !p.locked && (!ids || ids.has(p.id));
      });
      const active = new Set();
      const results = [];
      let requireReload = false;

      // Populate the package cache
      console.group(`${vtt} | Updating ${packageType.titleCase()}s`);
      await Setup.warmPackages({type: packageType});
      console.debug(`Warmed ${packageType} package cache`);

      // Store information on incompatible module updates.
      const incompatible = {};

      // A semaphore which updates a certain number of packages concurrently
      let complete;
      const next = () => {
        while ( (active.size < max) && pending.length ) {
          const pkg = pending.shift();
          active.add(pkg);
          update(pkg);
        }
        if ( !pending.length && !active.size ) complete();
      };

      // TODO #8732

      // Update function
      const update = async pkg => {
        console.debug(`Checking ${packageType} ${pkg.id} for updates`);
        const check = await this.#updateCheck(pkg);
        switch ( check.state ) {

          // Error
          case "error":
            results.push({
              package: pkg,
              action: game.i18n.localize("Error"),
              actionClass: "error",
              description: check.error
            });
            console.debug(`Checked ${packageType} ${pkg.id}: error`);
            break;

          // Warning
          case "warning":
            results.push({
              package: pkg,
              action: game.i18n.localize("Warning"),
              actionClass: "warning",
              description: check.warning
            });
            console.debug(`Checked ${packageType} ${pkg.id}: warning`);
            break;

          // Sidegrade
          case "sidegrade":
            requireReload = true;
            console.debug(`Checked ${packageType} ${pkg.id}: sidegrade`);
            break;

          // Track Change
          case "trackChange":
            const confirm = await this.#promptTrackChange(pkg, check.trackChange);
            if ( confirm ) {
              pkg.updateSource({manifest: check.trackChange.manifest});
              try {
                const trackChangeUpdate = await this.#installPackageUpdate(pkg, {notify: false});
                results.push({
                  package: trackChangeUpdate,
                  action: game.i18n.localize("Update"),
                  actionClass: "success",
                  description: `${pkg.version} ➞ ${trackChangeUpdate.version}`
                });
                console.debug(`${vtt} | Checked ${packageType} ${pkg.id}: track change success`);
              } catch(err) {
                results.push({
                  package: pkg,
                  action: game.i18n.localize("Error"),
                  actionClass: "error",
                  description: err.message
                });
                console.debug(`Checked ${packageType} ${pkg.id}: track change failed`);
              }
            }
            else console.debug(`Checked ${packageType} ${pkg.id}: track change declined`);
            break;

          // Standard Update
          case "update":
            if ( !force && Object.values(check.systemCompatibility ?? {}).some(({ compatible }) => !compatible) ) {
              incompatible[pkg.id] = { pkg, systemCompatibility: check.systemCompatibility };
              break;
            }
            try {
              const updated = await this.#installPackageUpdate(pkg, {notify: false});
              results.push({
                package: updated,
                action: game.i18n.localize("Update"),
                actionClass: "success",
                description: `${pkg.version} ➞ ${updated.version}`
              });
              console.debug(`Checked ${packageType} ${pkg.id}: update success`);
            } catch(err) {
              results.push({
                package: pkg,
                action: game.i18n.localize("Error"),
                actionClass: "error",
                description: err.message
              });
              console.debug(`Checked ${packageType} ${pkg.id}: update failed`);
            }
            break;

          case "current":
            console.debug(`Checked ${packageType} ${pkg.id}: current`);
            break;

          // Unknown
          default:
            console.warn(`Checked ${packageType} ${pkg.id}: unknown state`);
            break;
        }
        active.delete(pkg);
        next();
      };

      // Wait for completion
      await new Promise(resolve => {
        complete = resolve;
        next();
      });
      console.debug("Update check complete");

      // Display Update Log
      let response;
      if ( results.length || !isEmpty(incompatible) ) {
        const dialog = isEmpty(incompatible) ? Dialog.prompt.bind(Dialog) : Dialog.confirm.bind(Dialog);
        const incompatibleList = Object.values(incompatible ?? {}).map(({ pkg, systemCompatibility }) => {
          return game.i18n.format("SETUP.PackageIncompatibleWithSystems", {
            module: `<strong>${pkg.title}</strong>`,
            systems: Object.values(systemCompatibility).map(({ id, title, compatible }) => {
              return compatible ? null : `<strong>${title ?? id}</strong>`;
            }).filterJoin(", ")
          });
        });
        const content = await renderTemplate("templates/setup/updated-packages.html", {
          changed: results,
          incompatible: incompatibleList
        });
        response = await dialog({
          title: game.i18n.localize("SETUP.UpdatedPackages"),
          content: content,
          options: {width: 700},
          rejectClose: false
        });
      }

      // No results
      else ui.notifications.info(game.i18n.format("PACKAGE.AllUpdated", {
        type: game.i18n.localize(`PACKAGE.Type.${packageType}Pl`)
      }));
      console.groupEnd();

      // Reload package data
      if ( requireReload ) await Setup.reload();

      // Re-enable the "Update All" button
      button = this.element[0].querySelector(`[data-package-type="${packageType}"] [data-action="updateAll"]`);
      button.disabled = false;
      button.firstElementChild.className = "fas fa-cloud-download";

      this.#updatingAll = null;
      if ( response === true ) {
        return this.#updateAll(packageType, { ids: new Set(Object.keys(incompatible)), force: true });
      }
    }

    /* -------------------------------------------- */

    /**
     * Check for an available update for a specific package
     * @param {Package} pkg     The package to check
     */
    async #updatePackage(pkg) {
      // Disable the "Update" button
      let button = this.element[0].querySelector(`[data-package-id="${pkg.id}"] [data-action="updatePackage"]`);
      button.disabled = true;
      button.firstElementChild.className = "fas fa-spinner fa-spin";

      // TODO #8732

      const check = await this.#updateCheck(pkg);
      switch ( check.state ) {
        case "error":
          ui.notifications.error(check.error, {permanent: true});
          break;
        case "warning":
          ui.notifications.warn(check.warning);
          break;
        case "sidegrade":
          await Setup.reload();
          break;
        case "trackChange":
          const accepted = await this.#promptTrackChange(pkg, check.trackChange);
          if ( accepted ) {
            pkg.updateSource({manifest: check.trackChange.manifest});
            await this.#installPackageUpdate(pkg);
          }
          break;
        case "current":
          await ui.notifications.info(game.i18n.format("PACKAGE.AlreadyUpdated", {name: pkg.title}));
          break;
        case "update":
          if ( Object.values(check.systemCompatibility ?? {}).some(({ compatible }) => !compatible) ) {
            const proceed = await this.#promptIncompatibleSystems(check.systemCompatibility);
            if ( !proceed ) break;
          }
          await this.#installPackageUpdate(pkg);
          break;
      }

      // Re-enable the "Update" button
      button = this.element[0].querySelector(`[data-package-id="${pkg.id}"] [data-action="updatePackage"]`);
      button.disabled = false;
      button.firstElementChild.className = "fas fa-sync-alt";
    }

    /* -------------------------------------------- */

    /**
     * @typedef {object} PackageCheckResult
     * @property {BasePackage} package                                The checked package
     * @property {string} state                                       The State of the check, from [ "error", "sidegrade", "trackChange", "warning", "update", "current", "unknown" ]
     * @property {string} [error]                                     An error to display, if any
     * @property {string} [warning]                                   A warning to display, if any
     * @property {manifest: string, version: string} [trackChange]    The suggested track change, if any
     * @property {string} [manifest]                                  The manifest of the Update, if any
     * @property {Record<string, SystemCompatibility>} [systemCompatibility]  Compatibility information for this package's
     *                                                                        related systems.
     */

    /**
     * Execute upon an update check for a single Package
     * @param {BasePackage} pkg                  The Package to check
     * @returns {Promise<PackageCheckResult>}    The status of the update check
     */
    async #updateCheck(pkg) {
      const checkData = {package: pkg, state: "unknown"};
      let responseData;
      let manifestData;

      // Check whether an update is available
      try {
        responseData = await Setup.checkPackage({type: pkg.type, id: pkg.id});
        manifestData = responseData.remote;
      } catch(err) {
        checkData.state = "error";
        checkData.error = err.toString();
        return checkData;
      }

      // Metadata sidegrade performed
      if ( responseData.hasSidegraded ) {
        checkData.state = "sidegrade";
        return checkData;
      }

      // Track change suggested
      if ( responseData.trackChange ) {
        checkData.state = "trackChange";
        checkData.trackChange = responseData.trackChange;
        checkData.manifest = responseData.trackChange.manifest;
        return checkData;
      }

      // Verify remote manifest compatibility with current software
      const availability = responseData.availability;
      const codes = CONST.PACKAGE_AVAILABILITY_CODES;

      // Unsupported updates
      const wrongCore = [
        codes.REQUIRES_CORE_UPGRADE_STABLE, codes.REQUIRES_CORE_UPGRADE_UNSTABLE, codes.REQUIRES_CORE_DOWNGRADE
      ];
      if ( responseData.isUpgrade && wrongCore.includes(availability) ) {
        checkData.state = "warning";
        const message = { 7: "Insufficient", 8: "UpdateNeeded", 9: "Unstable" }[availability];
        checkData.warning = game.i18n.format(`SETUP.PackageUpdateCore${message}`, {
          id: manifestData.id,
          vmin: manifestData.compatibility.minimum,
          vmax: manifestData.compatibility.maximum,
          vcur: game.version
        });
        return checkData;
      }

      // TODO #8732

      // Available updates
      if ( responseData.isUpgrade && (availability <= codes.UNVERIFIED_GENERATION) ) {
        checkData.systemCompatibility = responseData.systemCompatibility;
        checkData.state = "update";
        checkData.manifest = manifestData.manifest;
        return checkData;
      }

      // Packages which are already current
      checkData.state = "current";
      return checkData;
    }

    /* -------------------------------------------- */

    /**
     * Prompt the user to use a new Package track it if they haven't previously declined.
     * @param {BasePackage} pkg                                     The Package being updated
     * @param {{manifest: string, version: string}} trackChange     A recommended track change provided by the server
     * @returns {Promise<boolean>}                                  Whether the recommended track change was accepted
     */
    async #promptTrackChange(pkg, trackChange) {

      // Verify that the user has not already declined a suggested track change
      const declinedManifestUpgrades = game.settings.get("core", "declinedManifestUpgrades");
      if ( declinedManifestUpgrades[pkg.id] === pkg.version ) return false;

      // Generate dialog HTML
      const content = await renderTemplate("templates/setup/manifest-update.html", {
        localManifest: pkg.manifest,
        localTitle: game.i18n.format("SETUP.PriorManifestUrl", {version: pkg.version}),
        remoteManifest: trackChange.manifest,
        remoteTitle: game.i18n.format("SETUP.UpdatedManifestUrl", {version: trackChange.version}),
        package: pkg.title
      });

      // Prompt for confirmation
      const accepted = await Dialog.confirm({
        title: `${pkg.title} ${game.i18n.localize("SETUP.ManifestUpdate")}`,
        content,
        yes: () => {
          delete declinedManifestUpgrades[pkg.id];
          return true;
        },
        no: () => {
          declinedManifestUpgrades[pkg.id] = pkg.version;
          return false;
        },
        defaultYes: true
      });
      await game.settings.set("core", "declinedManifestUpgrades", declinedManifestUpgrades);
      return accepted;
    }

    /* -------------------------------------------- */

    /**
     * Confirm that the user wishes to proceed with the update in cases where it would make the module incompatible with
     * one of its listed system relationships.
     * @param {Record<string, SystemCompatibility>} compatibility  System compatibility information.
     * @returns {Promise<boolean|null>}
     */
    #promptIncompatibleSystems(compatibility) {
      return DialogV2.confirm({
        modal: true,
        rejectClose: false,
        window: { title: "AreYouSure" },
        position: { width: 450 },
        content: `
        <p>${game.i18n.localize("SETUP.PackageIncompatibleSystemsPrompt")}</p>
        <ul>${Object.values(compatibility).map(({ id, title, compatible }) => {
          return compatible ? null : `<li>${title ?? id}</li>`;  
        }).filterJoin("")}</ul>
      `
      });
    }

    /* -------------------------------------------- */
    /*  Installation Progress Bar                   */
    /* -------------------------------------------- */

    /**
     * Update the UI progress bar in response to server progress ticks.
     * @param {ProgressReceiverPacket} [progress]  The incremental progress information.
     */
    onProgress({action, id, title, pct, step, message}={}) {
      const { STEPS } = CONST.SETUP_PACKAGE_PROGRESS;
      if ( !this.constructor.progressActions.has(action) ) return;
      if ( [STEPS.VEND, STEPS.COMPLETE].includes(step) ) return this.removeProgressBar(id);
      const bar = this.#getProgressBar(id);
      if ( bar && Number.isNumeric(pct) ) {
        const status = [message ? game.i18n.localize(message) : null, title ?? id, `${pct}%`].filterJoin(" ");
        bar.firstElementChild.style.maxWidth = `${pct}%`;
        bar.firstElementChild.firstElementChild.innerText = status;
      }
    }

    /* -------------------------------------------- */

    /**
     * Get the progress bar element used to track installation for a certain package ID.
     * @param {string} packageId        The package being installed
     * @returns {HTMLDivElement|null}   The progress bar element to use
     */
    #getProgressBar(packageId) {

      // Existing bar
      let bar = this.progress.get(packageId);
      if ( bar ) return bar;

      // Too many bars
      if ( this.progress.size >= SetupPackages.MAX_PROGRESS_BARS ) return null;

      // New Bar
      const d = document.createElement("div");
      d.innerHTML = `
    <div class="progress-bar">
        <div class="bar">
            <span class="pct"></span>
        </div>
    </div>`;
      bar = d.firstElementChild;
      this.progress.set(packageId, bar);

      // Add to DOM
      document.getElementById("progress").appendChild(bar);
      return bar;
    }

    /* -------------------------------------------- */

    /**
     * Remove a Progress Bar from the DOM and from the progress mapping.
     * @param {string} id  The operation ID that is no longer being tracked.
     */
    removeProgressBar(id) {
      const bar = this.progress.get(id);
      if ( bar ) {
        bar.remove();
        this.progress.delete(id);
      }
    }
  }

  /**
   * @typedef {Object} NewsItem
   * @property {string} title           The title of the featured item
   * @property {string} image           The background image URL
   * @property {string} url             The website URL where clicking on the link should lead
   * @property {string} [caption]       A caption used for featured content
   */
  const _app$1 = foundry.applications.api;

  /**
   * An application that renders the Setup sidebar containing News and Featured Content widgets
   * @extends ApplicationV2
   */
  class SetupSidebar extends _app$1.HandlebarsApplicationMixin(_app$1.ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      id: "setup-sidebar",
      tag: "aside",
      window: {
        frame: false,
        positioned: false
      }
    }, {inplace: false});

    /** @override */
    static PARTS = {
      news: {
        id: "news",
        template: "templates/setup/parts/setup-news.hbs",
        scrollable: ["#news-articles"]
      },
      featured: {
        id: "featured",
        template: "templates/setup/parts/setup-featured.hbs"
      }
    };

    /* -------------------------------------------- */

    /** @override */
    async _prepareContext(options) {
      return {
        featured: game.data.featuredContent,
        news: game.data.news
      };
    }
  }

  /**
   * @typedef {object} PreviewCompatibilitySummary
   * @property {string} icon                                   The icon.
   * @property {"success"|"neutral"|"warning"|"error"} status  The compatibility status.
   * @property {string} label                                  The compatibility label.
   * @property {number} count                                  The number of packages.
   */

  /**
   * An Application that allows for browsing the previewed compatibility state of packages in the next version of the core
   * software.
   */
  class CompatibilityChecker extends CategoryFilterApplication {
    /**
     * @param {ReleaseData} release                         The release to preview.
     * @param {CategoryFilterApplicationOptions} [options]  Options to configure this Application.
     */
    constructor(release, options={}) {
      super({}, options);
      this.#release = release;
    }

    /**
     * Options for filtering on compatibility.
     * @enum {number}
     */
    static #COMPATIBILITY_FILTERS = {
      NONE: 0,
      COMPATIBLE: 1,
      UNVERIFIED: 2,
      INCOMPATIBLE: 3
    };

    /**
     * The currently active filters.
     * @type {{types: Set<string>, compatibility: number}}
     */
    #filters = {
      types: new Set(["module", "system"]),
      compatibility: CompatibilityChecker.#COMPATIBILITY_FILTERS.NONE
    };

    /**
     * The release to preview.
     * @type {ReleaseData}
     */
    #release;

    /**
     * The previewed package compatibilities.
     * @type {PreviewCompatibilityDescriptor}
     */
    #preview;

    /* -------------------------------------------- */

    /** @inheritDoc */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "compatibility-checker",
        template: "templates/setup/compatibility-checker.hbs",
        inputs: ['[name="filter"]'],
        initialCategory: "all"
      });
    }

    /* -------------------------------------------- */

    /** @override */
    get title() {
      return game.i18n.format("SETUP.PreviewCompatibilityVersion", { version: this.#release.version });
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async _render(force=false, options={}) {
      await super._render(force, options);
      if ( !this.#preview ) this.#previewCompatibility();
      const tour = game.tours.get("core.compatOverview");
      if ( tour?.status === Tour.STATUS.UNSTARTED ) tour.start();
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    getData(options={}) {
      const context = super.getData(options);
      if ( !this.#preview ) context.progress = { label: "SETUP.PreviewingCompatibility", icon: "fas fa-spinner fa-spin" };
      const compat = CompatibilityChecker.#COMPATIBILITY_FILTERS;
      const codes = CONST.PACKAGE_AVAILABILITY_CODES;
      context.version = this.#release.version;
      context.summary = this.#prepareCompatibilitySummary();
      context.filters = {
        types:[],
        compatibility: ["compatible", "unverified", "incompatible"].map(id => ({
          id,
          active: this.#filters.compatibility === compat[id.toUpperCase()],
          label: `SETUP.PackageVis${id.capitalize()}`
        }))
      };
      if ( this.category === "all" ) context.filters.types = ["world", "system", "module"].map(id => ({
        id, active: this.#filters.types.has(id), label: `PACKAGE.Type.${id}Pl`
      }));
      context.entries = context.entries.filter(p => {
        if ( (this.category === "all") && this.#filters.types.size && !this.#filters.types.has(p.type) ) return false;
        if ( this.#filters.compatibility === compat.NONE ) return true;
        switch ( p.availability ) {
          case codes.VERIFIED:
            return this.#filters.compatibility === compat.COMPATIBLE;
          case codes.UNVERIFIED_BUILD: case codes.UNVERIFIED_GENERATION:
            return this.#filters.compatibility === compat.UNVERIFIED;
          default:
            return this.#filters.compatibility === compat.INCOMPATIBLE;
        }
      });
      return context;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-visibility]").on("click", this.#onToggleVisibility.bind(this));
      html.find("[data-compatibility]").on("click", this.#onToggleCompatibility.bind(this));
    }

    /* -------------------------------------------- */

    /** @override */
    _prepareCategoryData() {
      const total = this.#preview ? this.#preview.world.size + this.#preview.system.size + this.#preview.module.size : 0;
      const entries = [];

      ["world", "module", "system"].forEach(type => {
        if ( (this.category !== "all") && (this.category !== type) ) return;
        for ( const pkg of this.#preview?.[type].values() ?? [] ) {
          const { id, title, description, url, changelog, availability } = pkg;
          const tags = [
            this.#getVersionBadge(availability, pkg, {
              modules: this.#preview.module,
              systems: this.#preview.system
            })
          ];
          if ( type === "world" ) tags.unshift(this.#getSystemBadge(pkg, this.#preview.system.get(pkg.system)));
          entries.push({
            id, type, title, url, tags, changelog, availability,
            hasLink: type !== "world",
            description: TextEditor.previewHTML(description, 150)
          });
        }
      });

      const categories = ["all", "world", "module", "system"].map(id => ({
        id,
        count: id === "all" ? total : this.#preview?.[id]?.size ?? 0,
        active: this.category === id,
        label: game.i18n.localize(`PACKAGE.Type.${id}Pl`)
      }));

      return { categories, entries };
    }

    /* -------------------------------------------- */

    /**
     * Determine a version badge for the provided package.
     * @param {number} availability  The availability level.
     * @param {ClientPackage} pkg    The package.
     * @param {object} context
     * @param {Collection<string, Module>} context.modules  The collection of modules to test availability against.
     * @param {Collection<string, System>} context.systems  The collection of systems to test availability against.
     * @returns {PackageCompatibilityBadge|null}
     */
    #getVersionBadge(availability, pkg, { modules, systems }) {
      const codes = CONST.PACKAGE_AVAILABILITY_CODES;
      const badge = pkg.constructor.getVersionBadge(availability, pkg, { modules, systems });
      if ( !badge ) return badge;
      let level;

      switch ( availability ) {
        case codes.REQUIRES_CORE_DOWNGRADE: level = "INCOMPATIBLE"; break;
        case codes.UNVERIFIED_GENERATION: case codes.UNVERIFIED_BUILD: level = "RISK"; break;
        case codes.VERIFIED: level = "COMPATIBLE"; break;
      }

      if ( level ) {
        const isWorld = pkg.type === "world";
        const system = this.#preview.system.get(pkg.system);
        const i18n = `SETUP.COMPAT.${level}.${isWorld ? "World" : "Latest"}`;
        const verified = isWorld ? system?.compatibility.verified : pkg.compatibility.verified;
        badge.tooltip = game.i18n.format(i18n, { version: this.#release.version, verified });
      }

      return badge;
    }

    /* -------------------------------------------- */

    /**
     * Determine a version badge for a World's System.
     * @param {World} world    The world.
     * @param {System} system  The system.
     * @returns {PackageCompatibilityBadge|null}
     */
    #getSystemBadge(world, system) {
      if ( !system ) return {
        type: "error",
        tooltip: game.i18n.format("SETUP.COMPAT.INCOMPATIBLE.World", { version: this.#release.version }),
        label: world.system,
        icon: "fa fa-file-slash"
      };
      const badge = this.#getVersionBadge(system.availability, system, {
        modules: this.#preview.module,
        systems: this.#preview.system
      });
      if ( !badge ) return badge;
      badge.tooltip = `<p>${system.title}</p><p>${badge.tooltip}</p>`;
      badge.label = system.id;
      return badge;
    }

    /* -------------------------------------------- */

    /** @override */
    _sortEntries(a, b) {
      return a.title.localeCompare(b.title, game.i18n.lang);
    }

    /* -------------------------------------------- */

    /**
     * Summarize the results of the compatibility check.
     * @returns {PreviewCompatibilitySummary[]}
     */
    #prepareCompatibilitySummary() {
      if ( !this.#preview ) return [];
      const codes = CONST.PACKAGE_AVAILABILITY_CODES;
      const { compatible, incompatible, warning, unverified } = ["world", "system", "module"].reduce((obj, type) => {
        for ( const pkg of this.#preview[type]?.values() ) {
          if ( pkg.availability === codes.VERIFIED ) obj.compatible++;
          else if ( pkg.availability === codes.UNVERIFIED_BUILD ) obj.unverified++;
          else if ( pkg.availability === codes.UNVERIFIED_GENERATION ) obj.warning++;
          else obj.incompatible++;
        }
        return obj;
      }, { compatible: 0, incompatible: 0, warning: 0, unverified: 0 });
      return [
        {
          icon: "fas fa-circle-check",
          status: "success",
          count: compatible,
          label: "SETUP.COMPAT.Compatible",
          tooltip: "SETUP.COMPAT.CompatibleTooltip"
        },
        {
          icon: "fas fa-circle-question",
          status: "neutral",
          count: unverified,
          label: "SETUP.COMPAT.Unverified",
          tooltip: "SETUP.COMPAT.UnverifiedTooltip"
        },
        {
          icon: "fas fa-triangle-exclamation",
          status: "warning",
          count: warning,
          label: "SETUP.COMPAT.Warning",
          tooltip: "SETUP.COMPAT.WarningTooltip"
        },
        {
          icon: "fas fa-circle-xmark",
          status: "error",
          count: incompatible,
          label: "SETUP.COMPAT.Incompatible",
          tooltip: "SETUP.COMPAT.IncompatibleTooltip"
        }
      ];
    }

    /* -------------------------------------------- */

    /** @override */
    _getSearchFields(entry) {
      return [
        entry.dataset.packageId ?? "",
        entry.querySelector(".entry-title h3")?.textContent ?? ""
      ];
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _getHeaderButtons() {
      const buttons = super._getHeaderButtons();
      buttons.unshift({
        label: "",
        class: "info",
        icon: "fas fa-circle-question",
        tooltip: "SETUP.COMPAT.LearnMore",
        onclick: () => {
          const tour = game.tours.get("core.compatOverview");
          tour.reset();
          tour.start();
        }
      });
      return buttons;
    }

    /* -------------------------------------------- */

    /**
     * Handle toggling package compatibility filtering.
     * @param {PointerEvent} event  The triggering event.
     */
    #onToggleCompatibility(event) {
      const compat = CompatibilityChecker.#COMPATIBILITY_FILTERS;
      const value = compat[event.currentTarget.dataset.compatibility.toUpperCase()];
      if ( this.#filters.compatibility === value ) this.#filters.compatibility = compat.NONE;
      else this.#filters.compatibility = value;
      this.render();
    }

    /* -------------------------------------------- */

    /**
     * Handle toggling package type filtering.
     * @param {PointerEvent} event  The triggering event.
     */
    #onToggleVisibility(event) {
      const { visibility } = event.currentTarget.dataset;
      if ( this.#filters.types.has(visibility) ) this.#filters.types.delete(visibility);
      else this.#filters.types.add(visibility);
      this.render();
    }

    /* -------------------------------------------- */

    /**
     * Retrieve compatibility data for installed packages in the next version of the core software.
     */
    async #previewCompatibility() {
      const preview = await Setup.previewCompatibility(this.#release);
      if ( !preview ) return;
      this.#preview = {
        world: new Map(preview.world.map(w => [w.id, new World(foundry.utils.deepClone(w))])),
        system: new Map(preview.system.map(s => [s.id, new System(foundry.utils.deepClone(s))])),
        module: new Map(preview.module.map(m => [m.id, new Module(foundry.utils.deepClone(m))]))
      };
      this.render();
    }
  }

  /**
   * An application which displays Foundry Virtual Tabletop release notes to the user during the update progress.
   */
  class UpdateNotes extends Application {
    constructor(target, options) {
      super(options);
      this.target = target;
      this.candidateReleaseData = new foundry.config.ReleaseData(this.target);
      ui.updateNotes = this;
    }

    /* ----------------------------------------- */

    /** @override */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "update-notes",
        template: "templates/setup/update-notes.hbs",
        width: 720
      });
    }

    /* ----------------------------------------- */

    /** @override */
    get title() {
      return `Update Notes - ${this.candidateReleaseData.display}`;
    }

    /* ----------------------------------------- */

    /** @override */
    async getData(options={}) {
      return {
        notes: this.target.notes,
        requiresManualInstall: this.candidateReleaseData.isGenerationalChange(game.release),
        canCheckCompatibility: game.version !== this.candidateReleaseData.version,
        version: this.candidateReleaseData.version
      }
    }

    /* ----------------------------------------- */

    /** @override */
    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-action]").on("click", this.#onAction.bind(this));
    }

    /* -------------------------------------------- */

    /**
     * Handle clicking an action button.
     * @param {PointerEvent} event  The triggering event.
     */
    async #onAction(event) {
      const action = event.currentTarget.dataset.action;
      switch ( action ) {
        case "checkCompatibility":
          new CompatibilityChecker(this.candidateReleaseData).render(true);
          break;

        case "createSnapshot":
          this.toggleLock(true);
          await ui.setupUpdate._onCreateSnapshot();
          this.toggleLock(false);
          break;

        case "update":
          event.preventDefault();
          this.toggleLock(true);
          document.getElementById("update-core").click();
          break;
      }
    }

    /* -------------------------------------------- */

    /**
     * Toggle the locked state of the interface.
     * @param {boolean} locked  Is the interface locked?
     */
    toggleLock(locked) {
      const element = this.element[0];
      if ( !element ) return;
      element.querySelectorAll("[data-action]").forEach(el => el.disabled = locked);
    }

    /* ----------------------------------------- */

    /**
     * Update the button at the footer of the Update Notes application to reflect the current status of the workflow.
     * @param {object} progressData       Data supplied by SetupConfig#_onCoreUpdate
     */
    static updateButton(progressData) {
      const notes = ui.updateNotes;
      if ( !notes?.rendered ) return;
      const button = notes.element.find('[data-action="update"]')[0];
      if ( !button ) return;
      const icon = button.querySelector("i");
      icon.className = progressData.pct < 100 ? "fas fa-spinner fa-pulse" : "fas fa-check";
      const label = button.querySelector("label");
      label.textContent = game.i18n.localize(progressData.step);
    }
  }

  /**
   * The software update application.
   */
  class SetupUpdate extends Application {

    /** @override */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "setup-update",
        template: "templates/setup/setup-update.hbs",
        popOut: false,
      });
    }

    /**
     * The current update step. Either "updateCheck" or "updateDownload"
     * @type {string}
     */
    #action = "updateCheck";

    /**
     * The currently bound update progress listener
     * @type {function}
     */
    #onProgress;

    /* -------------------------------------------- */

    /** @override */
    getData(options={}) {
      const canReachInternet = game.data.addresses.remote;
      const couldReachWebsite = game.data.coreUpdate.couldReachWebsite;
      const updateChannels = { ...CONST.SOFTWARE_UPDATE_CHANNELS };
      delete updateChannels.prototype;
      return {
        updateChannels,
        coreVersion: game.version,
        release: game.release,
        coreVersionHint: game.i18n.format("SETUP.CoreVersionHint", {versionDisplay: game.release.display}),
        updateChannel: game.data.options.updateChannel,
        updateChannelHints: Object.entries(updateChannels).reduce((obj, [chan, label]) => {
          obj[chan] = game.i18n.localize(`${label}Hint`);
          return obj;
        }, {}),
        coreUpdate: game.data.coreUpdate.hasUpdate ? game.i18n.format("SETUP.UpdateAvailable", game.data.coreUpdate) : false,
        canReachInternet: canReachInternet,
        couldReachWebsite: couldReachWebsite,
        slowResponse: game.data.coreUpdate.slowResponse,
        updateButtonEnabled: canReachInternet && couldReachWebsite
      };
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
      super.activateListeners(html);
      html.find("select[name='updateChannel']").on("change", this.#onChangeChannel.bind(this));
      html.find("button[data-action]").on("click", this.#onClickButton.bind(this));
      html.submit(this.#onSubmit.bind(this));
    }

    /* -------------------------------------------- */

    /**
     * Handle update application button clicks.
     * @param {PointerEvent} event  The triggering click event.
     */
    #onClickButton(event) {
      event.preventDefault();
      const button = event.currentTarget;
      switch ( button.dataset.action ) {
        case "setup":
          window.location.href = foundry.utils.getRoute("setup");
          break;
      }
    }

    /* -------------------------------------------- */

    /**
     * When changing the software update channel, reset the state of the update button and "Force Update" checkbox.
     * Clear results from a prior check to ensure that users don't accidentally perform an update for some other channel.
     * @param {Event} event     The select change event
     */
    async #onChangeChannel(event) {
      this.#action = "updateCheck"; // reset the action
      const button = document.getElementById("update-core");
      button.children[1].textContent = game.i18n.localize("SETUP.UpdateCheckFor");
      const check = document.querySelector("input[name='forceUpdate']");
      check.checked = false;
    }

    /* -------------------------------------------- */

    /**
     * Handle button clicks to update the core VTT software
     * @param {Event} event
     */
    async #onSubmit(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("#update-core");
      const label = button.querySelector("label");

      // Disable the form
      button.disabled = true;
      form.disabled = true;

      // Prepare request data
      const requestData = {
        action: this.#action,
        updateChannel: form.updateChannel.value,
        forceUpdate: form.forceUpdate.checked
      };

      if ( this.#action === "updateDownload" ) {
        const { ACTIONS, STEPS } = CONST.SETUP_PACKAGE_PROGRESS;
        const progress = new ProgressReceiver(ACTIONS.UPDATE_CORE, ACTIONS.UPDATE_DOWNLOAD, requestData);
        progress.addEventListener("progress", ({ data }) => {
          if ( (data.step !== STEPS.ERROR) && (data.step !== STEPS.COMPLETE) ) UpdateNotes.updateButton(data);
          this.#updateProgressBar(data);
          this.#updateProgressButton(data);
        });
        progress.addEventListener("error", ({ data }) => {
          form.disabled = false;
          ui.updateNotes?.close();
          ui.notifications.error(data.error, { localize: true, permanent: true });
        });
        progress.addEventListener("complete", ({ data }) => {
          form.disabled = false;
          ui.updateNotes?.close();
          ui.notifications.info(data.message, { localize: true, permanent: true });
        });
        return progress.listen();
      }

      // Submit request
      let response;
      try {
        response = await Setup.post(requestData);
      } catch(err) {
        button.disabled = false;
        form.disabled = false;
        throw err;
      }

      // Display response info
      if ( response.info || response.warn ) {
        button.disabled = false;
        form.disabled = false;
        return response.info
          ? ui.notifications.info(response.info, {localize: true})
          : ui.notifications.warn(response.warn, {localize: true});
      }

      // Proceed to download step
      if ( this.#action === "updateCheck" ) {

        // Construct the release data
        const releaseData = new foundry.config.ReleaseData(response);
        ui.notifications.info(game.i18n.format("SETUP.UpdateInfoAvailable", {display: releaseData.display}));

        // Update the button
        if ( releaseData.isGenerationalChange(game.version) ) {
          label.textContent = game.i18n.localize("SETUP.UpdateNewGeneration");
        } else {
          this.#action = "updateDownload";
          label.textContent = game.i18n.format("SETUP.UpdateButtonDownload", {display: releaseData.display});
          button.disabled = false;
        }

        // Render release notes
        if ( response.notes ) new UpdateNotes(response).render(true);

        // Warn about module disabling
        if ( response.willDisableModules ) {
          ui.notifications.warn(game.i18n.format("SETUP.UpdateWarningWillDisable", {
            nIncompatible: game.modules.filter(m => m.incompatible).length,
            nModules: game.modules.size
          }), {permanent: true});
        }
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle creating a snapshot.
     * @internal
     */
    async _onCreateSnapshot() {
      const progress = this._updateProgressBar.bind(this);
      Setup._addProgressListener(progress);
      this.toggleLock(true);
      await Setup.createSnapshot({ dialog: true }, { packageList: false });
      this.toggleLock(false);
      Setup._removeProgressListener(progress);
    }

    /* -------------------------------------------- */

    /**
     * Toggle the locked state of the update interface.
     * @param {boolean} locked  Is the interface locked?
     */
    toggleLock(locked) {
      const element = this.element[0];
      if ( !element ) return;
      element.querySelectorAll("button").forEach(el => el.disabled = locked);
    }

    /* -------------------------------------------- */

    /**
     * Update the display of an installation progress bar for a particular progress packet
     * @param {object} data   The progress update data
     */
    #updateProgressBar(data) {
      const progress = document.getElementById("update-progress");

      // Update Bar
      const bar = progress.firstElementChild;
      bar.style.maxWidth = `${data.pct}%`;

      // Update Label
      const label = bar.firstElementChild;
      label.innerText = [game.i18n.localize(data.message), data.title, `${data.pct}%`].filterJoin(" ");
      const steps = CONST.SETUP_PACKAGE_PROGRESS.STEPS;
      progress.style.display = [steps.COMPLETE, steps.ERROR].includes(data.step) ? "" : "initial";
    }

    /* -------------------------------------------- */

    /**
     * Update installation progress for a particular button which triggered the action
     * @param {object} data   The progress update data
     */
    #updateProgressButton({ step, message }) {
      const { STEPS } = CONST.SETUP_PACKAGE_PROGRESS;
      const button = document.getElementById("update-core");
      button.disabled = (step !== STEPS.ERROR) && (step !== STEPS.COMPLETE);

      // Update Icon
      const icon = button.firstElementChild;
      if ( step === STEPS.ERROR ) icon.className = "fas fa-times";
      else if ( step === STEPS.COMPLETE ) icon.className = "fas fa-check";
      else icon.className = "fas fa-spinner fa-pulse";

      // Update label
      const label = icon.nextElementSibling;
      label.textContent = game.i18n.localize(message);
    }
  }

  const _app = foundry.applications.api;

  /**
   * The User Management setup application.
   * @extends ApplicationV2
   * @mixes HandlebarsApplication
   */
  class UserManagement extends _app.HandlebarsApplicationMixin(_app.ApplicationV2) {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
      id: "manage-players",
      classes: ["application", "framed"],
      tag: "form",
      window: {
        frame: false,
        positioned: false
      },
      actions: {
        createUser: UserManagement.#onUserCreate,
        configurePermissions: UserManagement.#onConfigurePermission,
        deleteUser: UserManagement.#onUserDelete,
        showPassword: UserManagement.#onShowPassword,
      },
      form: {
        handler: UserManagement.#onSubmitForm
      }
    }, {inplace: false});

    /**
     * The template path used to render a single user.
     * @type {string}
     */
    static USER_TEMPLATE = "templates/setup/parts/user-management-user.hbs";

    /** @override */
    static PARTS = {
      form: {
        id: "form",
        template: "templates/setup/parts/user-management-form.hbs",
        templates: [this.USER_TEMPLATE],
        scrollable: ["#player-list"],
      }
    };

    /* -------------------------------------------- */

    /** @override */
    async _prepareContext(options) {
      return {
        users: game.users,
        roles: UserManagement.#getRoleLabels(),
        canConfigurePermissions: game.user.hasRole("GAMEMASTER"),
        userTemplate: this.constructor.USER_TEMPLATE,
        passwordString: game.data.passwordString
      };
    }

    /* -------------------------------------------- */

    /**
     * Get a mapping of role IDs to labels that should be displayed
     */
    static #getRoleLabels() {
      return Object.entries(CONST.USER_ROLES).reduce((obj, e) => {
        obj[e[1]] = game.i18n.localize(`USER.Role${e[0].titleCase()}`);
        return obj;
      }, {});
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /** @inheritDoc */
    _attachPartListeners(partId, htmlElement, options) {
      super._attachPartListeners(partId, htmlElement, options);
      for ( const passwordInput of htmlElement.querySelectorAll("input[type=password]") ) {
        passwordInput.addEventListener("focus", UserManagement.#onPasswordFocus);
        passwordInput.addEventListener("keydown", UserManagement.#onPasswordKeydown);
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle focus in and out of the password field.
     * @param {PointerEvent} event     The initiating pointer event
     */
    static #onPasswordFocus(event) {
      event.currentTarget.select();
    }

    /* -------------------------------------------- */

    /**
     * Toggle visibility of the "Show Password" control.
     * @param {KeyboardEvent} event     The initiating keydown event
     */
    static #onPasswordKeydown(event) {
      if ( ["Shift", "Ctrl", "Alt", "Tab"].includes(event.key) ) return;
      const input = event.currentTarget;
      const show = input.parentElement.nextElementSibling;
      show.hidden = false;
    }

    /* -------------------------------------------- */

    /**
     * Reveal the password that is being configured so the user can verify they have typed it correctly.
     * @this {UserManagement}
     * @param {PointerEvent} event
     * @param {HTMLAnchorElement} button
     */
    static #onShowPassword(event, button) {
      const li = button.closest(".player");
      const label = li.querySelector(".password");
      const input = label.firstElementChild;
      input.type = input.type === "password" ? "text" : "password";
    }

    /* -------------------------------------------- */

    /**
     * Handle click events to display the permission configuration app.
     * @this {UserManagement}
     * @param {PointerEvent} event
     * @param {HTMLButtonElement} button
     */
    static #onConfigurePermission(event, button) {
      const config = new foundry.applications.apps.PermissionConfig();
      config.render({force: true});
    }

    /* -------------------------------------------- */

    /**
     * Handle creating a new User record in the form.
     * @this {UserManagement}
     * @param {PointerEvent} event
     * @param {HTMLButtonElement} button
     */
    static async #onUserCreate(event, button) {

      // Create the new User
      let newPlayerIndex = game.users.size + 1;
      while ( game.users.getName(`Player${newPlayerIndex}` )) { newPlayerIndex++; }
      const user = await User.create({
        name: `Player${newPlayerIndex}`,
        role: CONST.USER_ROLES.PLAYER
      });

      // Render the User's HTML
      const roles = UserManagement.#getRoleLabels();
      const html = await renderTemplate(UserManagement.USER_TEMPLATE, {user, roles});
      const playerList = this.element.querySelector("#player-list");
      playerList.insertAdjacentHTML("beforeend", html);

      // Attach listeners to new password input
      const newInput = playerList.lastElementChild.querySelector("input[type=password]");
      newInput.addEventListener("focus", UserManagement.#onPasswordFocus);
      newInput.addEventListener("keydown", UserManagement.#onPasswordKeydown);
    }

    /* -------------------------------------------- */

    /**
     * Handle user deletion event.
     * @param {PointerEvent} event
     * @param {HTMLAnchorElement} button
     */
    static #onUserDelete(event, button) {
      const li = button.closest(".player");
      const user = game.users.get(li.dataset.userId);

      // Craft a message
      let message = `<h4>${game.i18n.localize("AreYouSure")}</h4><p>${game.i18n.localize("USERS.DeleteWarning")}</p>`;
      if (user.isGM) message += `<p class="warning"><strong>${game.i18n.localize("USERS.DeleteGMWarning")}</strong></p>`;

      // Render a confirmation dialog
      new Dialog({
        title: `${game.i18n.localize("USERS.Delete")} ${user.name}?`,
        content: message,
        buttons: {
          yes: {
            icon: '<i class="fas fa-trash"></i>',
            label: game.i18n.localize("Delete"),
            callback: async () => {
              await user.delete();
              li.remove();
            }
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("Cancel")
          }
        },
        default: "yes"
      }).render(true);
    }

    /* -------------------------------------------- */

    /**
     * @this {UserManagement}
     * @param {SubmitEvent} event
     * @param {HTMLFormElement} form
     * @param {FormDataExtended} formData
     */
    static async #onSubmitForm(event, form, formData) {
      const userData = foundry.utils.expandObject(formData.object).users;
      const updates = Object.entries(userData).reduce((arr, e) => {
        const [id, data] = e;

        // Identify changes
        const user = game.users.get(id);
        const diff = foundry.utils.diffObject(user.toObject(), data);
        if ( data.password === game.data.passwordString ) delete diff.password;
        else diff.password = data.password;

        // Register changes for update
        if ( !foundry.utils.isEmpty(diff) ) {
          diff._id = id;
          arr.push(diff);
        }
        return arr;
      }, []);

      // The World must have at least one Gamemaster
      if ( !Object.values(userData).some(u => u.role === CONST.USER_ROLES.GAMEMASTER) ) {
        return ui.notifications.error("USERS.NoGMError", {localize: true});
      }

      // Update all users and redirect
      try {
        if ( updates.length ) await User.updateDocuments(updates, {diff: false});
        ui.notifications.info("USERS.UpdateSuccess", {localize: true});
        return setTimeout(() => window.location.href = foundry.utils.getRoute("game"), 1000);
      }
      catch(err) {
        await this.render();
      }
    }
  }

  /**
   * An Application that manages the browsing and installation of Packages.
   */
  class InstallPackage extends CategoryFilterApplication {
    constructor({packageType, search}={}, options) {
      super({}, options);
      this.#packageType = packageType;
      this.#initialSearch = search;
      ui.installPackages = this;
    }

    /**
     * The list of installable packages
     * @type {ClientPackage[]}
     */
    packages;

    /**
     * The list of Tags available
     * @type {object}
     */
    tags;

    /**
     * The type of package being installed, a value in PACKAGE_TYPES
     * @type {string}
     */
    #packageType;

    /**
     * The current package visibility filter that is applied
     * @type {string}
     */
    #visibility = "all";

    /**
     * An initial provided search filter value.
     * @type {string}
     */
    #initialSearch;

    /* -------------------------------------------- */

    /** @inheritdoc */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "install-package",
        template: "templates/setup/install-package.hbs",
        inputs: ['[name="filter"]', '[name="manifestURL"]'],
        initialCategory: "all"
      });
    }

    /* -------------------------------------------- */

    /** @override */
    get title() {
      return game.i18n.localize(`SETUP.Install${this.#packageType.titleCase()}`);
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    async _render(force=false, options={}) {
      await super._render(force, options);
      const type = this.#packageType;
      if ( Setup.cache[type].state === Setup.CACHE_STATES.COLD ) {
        Setup.warmPackages({type}).then(() => this.render(false));
      }
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    getData(options={}) {
      const data = super.getData(options);
      const type = data.packageType = this.#packageType;

      // Loading Progress
      if ( Setup.cache[type].state < Setup.CACHE_STATES.WARMED ) {
        data.progress = {label: "SETUP.PackagesLoading", icon: "fas fa-spinner fa-spin"};
      }
      else if ( !this.packages.length && Setup.cache[type].state === Setup.CACHE_STATES.WARMED ) {
        data.progress = {label: "SETUP.CouldntLoadPackages", icon: "fas fa-exclamation-triangle"};
      }

      // Visibility filters
      data.visibility = [
        { id: "inst", css: this.#visibility === "inst" ? " active" : "", label: "SETUP.PackageVisInst" },
        { id: "unin", css: this.#visibility === "unin" ? " active" : "", label: "SETUP.PackageVisUnin" },
        { id: "all", css: this.#visibility === "all" ? " active" : "", label: "SETUP.PackageVisAll" }
      ];

      // Filter packages
      const installed = new Set(game.data[`${type}s`].map(s => s.id));
      data.entries = this.packages.filter(p => {
        p.installed = installed.has(p.id);
        if ( (this.#visibility === "unin") && p.installed ) return false;
        if ( (this.#visibility === "inst") && !p.installed ) return false;
        p.cssClass = [p.installed ? "installed" : null, p.installable ? null: "locked"].filterJoin(" ");
        if ( this.category === "all" ) return true;
        if ( this.category === "premium" ) return p.protected;
        if ( this.category === "exclusive" ) return p.exclusive;
        return p.tags.includes(this.category);
      });
      return data;
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
      super.activateListeners(html);
      html[0].children[0].onsubmit = ev => ev.preventDefault();
      html.find(".entry-title a.website-link").click(this.#onClickPackageLink.bind(this));
      html.find("button.install").click(this.#onClickPackageInstall.bind(this));
      html.find("button[type='submit']").click(this.#onClickManifestInstall.bind(this));
      html.find(".visibilities .visibility").click(this.#onClickVisibilityFilter.bind(this));

      // Assign an initial search value
      const loading = Setup.cache[this.#packageType].state < Setup.CACHE_STATES.WARMED;
      if ( this.#initialSearch && !loading ) {
        this._inputs[0] = this.#initialSearch;
        this._searchFilters[0].filter(null, this.#initialSearch);
        this.#initialSearch = undefined;
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle a left-click event on the package website link.
     * @param {PointerEvent} event    The originating click event
     */
    #onClickPackageLink(event) {
      event.preventDefault();
      const li = event.currentTarget.closest(".package");
      const href = `https://foundryvtt.com/packages/${li.dataset.packageId}/`;
      return window.open(href, "_blank");
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    _onClickEntryTitle(event) {
      event.preventDefault();
      const li = event.currentTarget.closest(".package");
      if ( li.classList.contains("installed") || li.classList.contains("locked") ) return;
      const manifestURL = li.querySelector("button.install").dataset.manifest;
      const input = this.element.find("input[name='manifestURL']")[0];
      input.value = manifestURL;
    }

    /* -------------------------------------------- */

    /**
     * Handle left-click events to filter to a certain visibility state.
     * @param {PointerEvent} event    The originating click event
     */
    #onClickVisibilityFilter(event) {
      event.preventDefault();
      this.#visibility = event.target.dataset.visibility || "all";
      this.render();
    }

    /* -------------------------------------------- */

    /**
     * Handle a left-click event on the package "Install" button.
     * @param {PointerEvent} event    The originating click event
     */
    async #onClickPackageInstall(event) {
      event.preventDefault();
      const button = event.currentTarget;
      button.disabled = true;
      let manifest = button.dataset.manifest;
      if ( !manifest ) return;
      await Setup.installPackage({type: this.#packageType, manifest});
      button.disabled = false;
    }

    /* -------------------------------------------- */

    /**
     * Handle a left-click event on the button to install by manifest URL.
     * @param {PointerEvent} event    The originating click event
     */
    async #onClickManifestInstall(event) {
      event.preventDefault();
      const button = event.currentTarget;
      button.disabled = true;
      const input = button.previousElementSibling;
      if ( !input.value ) {
        button.disabled = false;
        return;
      }
      // noinspection ES6MissingAwait
      Setup.installPackage({type: this.#packageType, manifest: input.value.trim()});
      input.value = "";
      button.disabled = false;
    }

    /* -------------------------------------------- */

    /** @override */
    _getSearchFields(entry) {
      return [
        entry.dataset.packageId ?? "",
        entry.querySelector(".entry-title h3")?.textContent ?? "",
        entry.querySelector(".tag.author")?.textContent ?? ""
      ];
    }

    /* -------------------------------------------- */

    /** @override */
    _prepareCategoryData() {
      if ( !this.packages?.length || !this.tags?.length ) {
        const {packages, tags} = InstallPackage.getTaggedPackages(this.#packageType);
        this.packages = packages;
        this.tags = tags;
      }

      const categories = Object.entries(this.tags).reduce((acc, [k, v]) => {
        v.id = k;
        v.active = this.category === k;
        v.css = v.active ? " active" : "";
        acc.push(v);
        return acc;
      }, []);

      return { categories, entries: this.packages ?? [] };
    }

    /* -------------------------------------------- */

    /**
     * Organize package data and cache it to the application
     * @param {string} type  The type of packages being retrieved
     * @returns {object}     The retrieved or cached packages
     */
    static getTaggedPackages(type) {

      // Identify package tags and counts
      const packages = [];
      const counts = {premium: 0, exclusive: 0};
      const unorderedTags = {};
      const codes = CONST.PACKAGE_AVAILABILITY_CODES;

      // Prepare package data
      for ( const pack of Setup.cache[type].packages.values() ) {
        const p = pack.toObject();
        const availability = pack.availability;

        // Skip packages which require downgrading or upgrading to an unstable version
        if ( [codes.REQUIRES_CORE_DOWNGRADE, codes.REQUIRES_CORE_UPGRADE_UNSTABLE].includes(availability) ) continue;

        // Create the array of package tags
        const tags = pack.tags.map(t => {
          const [k, v] = t;
          if ( !unorderedTags[k] ) unorderedTags[k] = {label: v, count: 0, [type]: true};
          unorderedTags[k].count++;
          return k;
        });

        // Structure package data
        foundry.utils.mergeObject(p, {
          cssClass: "",
          author: Array.from(pack.authors).map(a => a.name).join(", "),
          tags: tags,
          installable: availability !== codes.REQUIRES_CORE_UPGRADE_STABLE
        });
        if ( pack.protected ) {
          if ( !pack.owned ) p.installable = false;
          counts.premium++;
        }
        if ( pack.exclusive ) counts.exclusive++;
        packages.push(p);
      }

      // Organize category tags
      const orderedTags = Array.from(Object.keys(unorderedTags)).sort();
      const tags = orderedTags.reduce((obj, k) => {
        obj[k] = unorderedTags[k];
        return obj;
      }, {
        all: { label: game.i18n.localize("SETUP.PackageVisAll"), count: packages.length, [type]: true},
        premium: { label: game.i18n.localize("SETUP.PremiumContent"), count: counts.premium, [type]: true},
        exclusive: { label: game.i18n.localize("SETUP.ExclusiveContent"), count: counts.exclusive, [type]: true }
      });
      return { packages: packages, tags: tags };
    }

    /* -------------------------------------------- */

    /** @inheritdoc */
    _restoreInputs() {
      super._restoreInputs();
      if ( this.element.length ) {
        this.element[0].querySelector('[name="filter"]')?.focus();
      }
    }
  }

  /**
   * A class responsible for managing snapshot progress events that include a side-track for individual backup progress
   * events.
   */
  class SnapshotProgressReceiver extends ProgressReceiver {
    /**
     * @param {string} operationId   A unique identifier for the operation.
     * @param {string} action        The operation action.
     * @param {string} backupAction  The individual backup operation action.
     * @param {object} [context]     Additional context to send with the request.
     * @param {ProgressReceiverOptions} [options]
     */
    constructor(operationId, action, backupAction, context={}, options={}) {
      super(operationId, action, context, options);
      this.#backupAction = backupAction;
    }

    /**
     * The individual backup operation action to listen to.
     * @type {string}
     */
    #backupAction;

    /**
     * The passive backup progress listener.
     * @type {function}
     */
    #backupProgressListener = this.#onBackupProgress.bind(this);

    /* -------------------------------------------- */

    /**
     * Handle progress ticks on individual backup operations.
     * @param {ProgressReceiverPacket} data  Progress event data.
     */
    #onBackupProgress(data) {
      if ( data.action === this.#backupAction ) ui.setupPackages?.onProgress(data);
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _onComplete(data) {
      Setup._removeProgressListener(this.#backupProgressListener);
      super._onComplete(data);
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    _onError(data) {
      for ( const id of ui.setupPackages?.progress.keys() ?? [] ) ui.setupPackages.removeProgressBar(id);
      Setup._removeProgressListener(this.#backupProgressListener);
      super._onError(data);
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    listen() {
      Setup._addProgressListener(this.#backupProgressListener);
      return super.listen();
    }
  }

  /**
   * @typedef {DialogOptions} SnapshotOperationDialogOptions
   * @property {boolean} [warning]            Whether the dialog contains a warning.
   * @property {boolean} [note]               Whether the dialog should prompt the user for a note.
   * @property {boolean} [confirmCode]        Whether the dialog should prompt the user for a confirmation code.
   * @property {boolean} [packageList]        Whether the dialog should include a list of currently-installed packages.
   * @property {SnapshotData} [snapshotData]  A snapshot associated with this operation.
   * @property {string} diskSpaceAction       The action value to send to /setup to request disk space information for
   *                                          this operation.
   * @property {string} message               The dialog message.
   * @property {string} [confirm]             An additional confirmation message.
   */

  /**
   * An application that prompts the user to confirm a snapshot operation.
   */
  class SnapshotOperationDialog extends Dialog {
    /**
     * @param {function} resolve  The function to invoke when the dialog is closed.
     * @param {DialogData} data
     * @param {SnapshotOperationDialogOptions} [options]
     */
    constructor(resolve, data, options={}) {
      const buttons = { confirm: { id: "confirm" }, cancel: { id: "cancel" } };
      super({ ...data, buttons, default: "confirm" }, options);
      this.#resolve = resolve;
      if ( options.confirmCode ) this.#confirmCode = (Math.random() + 1).toString(36).substring(7, 11);
    }

    /**
     * The code the user must enter to confirm the operation.
     * @type {string}
     */
    #confirmCode;

    /**
     * The disk space requirements for the operation.
     * @type {{required: string, available: string, enough: boolean}}
     */
    #diskSpace;

    /**
     * The function to invoke when the dialog is closed.
     * @type {function}
     */
    #resolve;

    /* -------------------------------------------- */

    /** @override */
    static wait(data={}, options={}, renderOptions={}) {
      return new Promise(resolve => new this(resolve, data, options).render(true, renderOptions));
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["dialog", "snapshot-dialog"],
        width: 480,
        jQuery: false
      });
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async _render(force=false, options={}) {
      let input;
      if ( this.element ) input = this.element.find("input").val();
      await super._render(force, options);
      if ( input ) this.element.find("input").val(input).focus();
      if ( !this.#diskSpace ) this.#checkDiskSpace().then(() => this.render());
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    getData(options={}) {
      const context = super.getData(options);
      context.content = this.#buildContent();
      context.buttons = this.#buildButtons();
      return context;
    }

    /* -------------------------------------------- */

    /**
     * Build the dialog button descriptors.
     * @returns {Record<string, Partial<DialogButton>>}
     */
    #buildButtons() {
      let yesLabel = "SETUP.BACKUPS.DiskSpaceChecking";
      if ( this.#diskSpace ) yesLabel = this.#diskSpace.enough ? "Yes" : "SETUP.BACKUPS.DiskSpaceInsufficient";
      return {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize(yesLabel),
          cssClass: "yes default bright",
          disabled: !this.#diskSpace?.enough
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("No"),
          cssClass: "no"
        }
      };
    }

    /* -------------------------------------------- */

    /**
     * Build the content for this dialog based on the passed options.
     * @returns {string}
     */
    #buildContent() {
      const unchanged = this.#getUnchangedPackageCount();
      return `
      <p ${this.options.warning ? 'class="notification warning"' : ""}>${game.i18n.localize(this.options.message)}</p>
      ${this.options.packageList ? `
        <p>${game.i18n.localize("SETUP.BACKUPS.CreateSnapshotPackageList")}</p>
        <ul>
          <li>${game.i18n.format("SETUP.BACKUPS.WorldCount", { count: game.worlds.size })}</li>
          <li>${game.i18n.format("SETUP.BACKUPS.ModuleCount", { count: game.modules.size })}</li>
          <li>${game.i18n.format("SETUP.BACKUPS.SystemCount", { count: game.systems.size })}</li>
        </ul>
      ` : ""}
      ${unchanged ? `
        <p>${game.i18n.format(`SETUP.BACKUPS.RestoreSnapshotUnchangedPackages${unchanged === 1 ? "" : "Pl"}`, {
          count: unchanged
        })}</p>
      ` : ""}
      <div class="disk-space">
        <em>${game.i18n.localize("SETUP.BACKUPS.DiskSpace")}:</em>
        <span>
          ${this.#diskSpace ? `
            ${game.i18n.format("SETUP.BACKUPS.DiskSpaceRequired", { required: this.#diskSpace.required })}
            &sol;
            ${game.i18n.format("SETUP.BACKUPS.DiskSpaceAvailable", { available: this.#diskSpace.available })}
          ` : '<i class="fas fa-spinner fa-spin"></i>'}
        </span>
      </div>
      ${this.options.note ? `
        <p>${game.i18n.localize("SETUP.BACKUPS.NoteHint")}</p>
        <input class="dark" type="text" autocomplete="off" name="note">
      ` : ""}
      ${this.#confirmCode ? `
        <p>${game.i18n.localize("SETUP.WorldDeleteConfirmCode")}</p>
        <p id="confirm-code"><span class="reference">${this.#confirmCode}</span></p>
        <input id="delete-confirm" name="code" class="dark" type="text" autocomplete="off" required autofocus
               placeholder="${this.#confirmCode}"
               aria-label="${game.i18n.format("SETUP.ConfirmCodeLabel", { code: this.#confirmCode })}">
      ` : ""}
      ${this.options.confirm ? `<p>${game.i18n.localize(this.options.confirm)}</p>` : ""}
    `;
    }

    /* -------------------------------------------- */

    /**
     * Determine the number of installed packages that are not included in the snapshot and will not be affected by the
     * snapshot restoration.
     * @returns {number}
     */
    #getUnchangedPackageCount() {
      if ( !this.options.snapshotData ) return 0;
      const packages = { world: new Set(), module: new Set(), system: new Set() };
      for ( const backupId of this.options.snapshotData.backups ) {
        const [type, id] = backupId.split(".");
        packages[type].add(id);
      }
      let count = 0;
      for ( const [type, cls] of Object.entries(PACKAGE_TYPES) ) {
        for ( const pkg of game[cls.collection] ) {
          if ( !packages[type].has(pkg.id) ) count++;
        }
      }
      return count;
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async close(options = {}) {
      this.#resolve({ confirm: false });
      return super.close(options);
    }

    /* -------------------------------------------- */

    /**
     * Request disk space information for the given operation from the /setup endpoint.
     */
    async #checkDiskSpace() {
      const data = { action: this.options.diskSpaceAction };
      if ( this.options.snapshotData ) data.snapshotData = this.options.snapshotData;
      const { required, available } = await Setup.post(data, { timeoutMs: null });
      this.#diskSpace = {
        required: foundry.utils.formatFileSize(required, { decimalPlaces: 0 }),
        available: foundry.utils.formatFileSize(available, { decimalPlaces: 0 }),
        enough: available > required
      };
    }

    /* -------------------------------------------- */

    /** @override */
    submit(button, event) {
      const el = this.element[0].querySelector(`[data-button="${button.id}"]`);
      if ( el.disabled ) return;
      switch ( button.id ) {
        case "confirm":
          this.#onConfirm();
          break;

        case "cancel":
          this.close();
          break;
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle confirming the action.
     */
    #onConfirm() {
      const element = this.element[0];
      if ( this.options.confirmCode ) {
        const code = element.querySelector('input[name="code"]').value;
        if ( code !== this.#confirmCode ) {
          ui.notifications.error("SETUP.PackageDeleteWorldConfirm", { localize: true });
          this.#resolve({ confirm: false });
          return this.close();
        }
      }
      if ( this.options.note ) this.#resolve({ note: element.querySelector('input[name="note"]').value, confirm: true });
      this.#resolve({ confirm: true });
      return this.close();
    }
  }

  /**
   * A library of package management commands which are used by various interfaces around the software.
   */
  let Setup$1 = class Setup extends Game {

    /**
     * An enum that indicates a state the Cache is in
     * @enum {number}
     */
    static CACHE_STATES = {
      COLD: 0,
      WARMING: 1,
      WARMED: 2
    };

    /**
     * The name of the setting used to persist package favorites.
     * @type {string}
     */
    static FAVORITE_PACKAGES_SETTING = "setupPackageFavorites";

    /**
     * A cached object of retrieved packages from the web server
     * @type {{
     *   world: {packages: Map<string,World>, state: Setup.CACHE_STATES},
     *   system: {packages: Map<string,System>, state: Setup.CACHE_STATES},
     *   module: {packages: Map<string,Module>, state: Setup.CACHE_STATES}
     * }}
     */
    static cache = {
      world: { packages: new Map(), state: Setup.CACHE_STATES.COLD },
      module: { packages: new Map(), state: Setup.CACHE_STATES.COLD },
      system: { packages: new Map(), state: Setup.CACHE_STATES.COLD }
    };

    /**
     * A cached list of the user's backups.
     * @type {BackupsListing|null}
     */
    static backups = null;

    /**
     * Store a reference to any in-flight request to list backups.
     * @type {Promise|null}
     */
    static #listingBackups = null;

    /**
     * Cached compatibility preview data.
     * @type {PreviewCompatibilityDescriptor|null}
     */
    static #compatibilityPreview = null;

    /**
     * Store a reference to any in-flight request to check package compatibility.
     * @type {Promise|null}
     */
    static #checkingCompatibility = null;

    /**
     * A reference to the setup URL used under the current route prefix, if any
     * @type {string}
     */
    static get setupURL() {
      return foundry.utils.getRoute("setup");
    }

    /* -------------------------------------------- */

    /**
     * Register core game settings
     * @override
     */
    registerSettings() {
      super.registerSettings();
      game.settings.register("core", "declinedManifestUpgrades", {
        scope: "client",
        config: false,
        type: Object,
        default: {}
      });
      game.settings.register("core", Setup.FAVORITE_PACKAGES_SETTING, {
        scope: "client",
        config: false,
        type: Object,
        default: {worlds: [], systems: [], modules: []}
      });
      game.settings.register("core", "setupViewModes", {
        scope: "client",
        config: false,
        type: Object,
        default: {worlds: "GALLERY", systems: "GALLERY", modules: "TILES"}
      });
    }

    /* -------------------------------------------- */

    /** @override */
    setupPackages(data) {
      super.setupPackages(data);
      const Collection = foundry.utils.Collection;
      if ( data.worlds ) {
        this.worlds = new Collection(data.worlds.map(m => [m.id, new World(m)]));
      }
      if ( data.systems ) {
        this.systems = new Collection(data.systems.map(m => [m.id, new System(m)]));
      }
    }

    /* -------------------------------------------- */

    /** @override */
    static async getData(socket, view) {
      let req;
      switch (view) {
        case "auth": case "license": req = "getAuthData"; break;
        case "join": req = "getJoinData"; break;
        case "players": req = "getPlayersData"; break;
        case "setup": req = "getSetupData"; break;
        case "update": req = "getUpdateData"; break;
      }
      return new Promise(resolve => {
        socket.emit(req, resolve);
      });
    }

    /* -------------------------------------------- */
    /*  View Handlers                               */
    /* -------------------------------------------- */

    /** @override */
    async _initializeView() {
      switch (this.view) {
        case "auth":
          return this.#authView();
        case "license":
          return this.#licenseView();
        case "setup":
          return this.#setupView();
        case "players":
          return this.#playersView();
        case "join":
          return this.#joinView();
        case "update":
          return this.#updateView();
        default:
          throw new Error(`Unknown view URL ${this.view} provided`);
      }
    }

    /* -------------------------------------------- */

    /**
     * The application view which displays the End User License Agreement (EULA).
     */
    #licenseView() {
      ui.notifications = new Notifications().render(true);

      // Render EULA
      const form = document.getElementById("license-key");
      if ( !form ) {
        new EULA().render(true);
        return;
      }

      // Allow right-clicks specifically in the key field
      const input = document.getElementById("key");
      input?.addEventListener("contextmenu", ev => ev.stopPropagation());
    }

    /* -------------------------------------------- */

    /**
     * The application view which displays the admin authentication application.
     */
    #authView() {
      if ( !globalThis.SIGNED_EULA ) window.location.href = foundry.utils.getRoute("license");
      ui.notifications = new Notifications().render(true);
      new SetupAuthenticationForm().render(true);
    }

    /* -------------------------------------------- */

    /**
     * The application view which displays the application Setup and Configuration.
     */
    async #setupView() {
      if ( !globalThis.SIGNED_EULA ) window.location.href = foundry.utils.getRoute("license");
      this.issueCount = Setup.#logPackageWarnings(this.data.packageWarnings, {notify: false});

      // Data Architecture
      Setup._activateSocketListeners();

      // Interface Elements
      // noinspection ES6MissingAwait
      FontConfig._loadFonts();
      ui.notifications = (new Notifications()).render(true);
      ui.setupMenu = await (new SetupMenu()).render(true);
      ui.setupPackages = (new SetupPackages()).render(true);
      ui.setupSidebar = await (new SetupSidebar()).render(true);

      // User Interaction
      this.initializeKeyboard();
      ContextMenu.eventListeners();
      ProseMirror.ProseMirrorMenu.eventListeners();

      // Initial prompts
      await SetupApplicationConfiguration.telemetryRequestDialog();
      if ( !game.data.options.noBackups ) {
        const tour = game.tours.get("core.backupsOverview");
        if ( tour?.status === Tour.STATUS.UNSTARTED ) tour.start();
        // noinspection ES6MissingAwait
        Setup.listBackups();
      }
    }

    /* -------------------------------------------- */

    /**
     * Log server-provided package warnings so that they are discoverable on the client-side.
     * @param {object} packageWarnings         An object of package warnings and errors by package ID.
     * @param {object} [options]               Additional options to configure logging behaviour.
     * @param {boolean} [options.notify=true]  Whether to create UI notifications in addition to logging.
     * @returns {{error: number, warning: number, total: number}}  A count of the number of warnings and errors
     */
    static #logPackageWarnings(packageWarnings, {notify=true}={}) {
      const counts = {
        error: 0,
        warning: 0
      };
      for ( const pkg of Object.values(packageWarnings) ) {
        for ( const error of pkg.error ) {
          counts.error++;
          console.error(`[${pkg.id}] ${error}`);
        }
        for ( const warning of pkg.warning ) {
          counts.warning++;
          console.warn(`[${pkg.id}] ${warning}`);
        }
      }

      // Notify
      if ( notify && counts.errors ) {
        const err = game.i18n.format("PACKAGE.SetupErrors", {number: counts.errors});
        ui.notifications.error(err, {permanent: true, console: false});
      }
      if ( notify && counts.warnings ) {
        const warn = game.i18n.format("PACKAGE.SetupWarnings", {number: counts.warnings});
        ui.notifications.warn(warn, {permanent: true, console: false});
      }

      // Return total count
      counts.total = counts.error + counts.warning;
      return counts;
    }

    /* -------------------------------------------- */

    /**
     * The application view which displays the User Configuration.
     */
    #playersView() {
      if ( !globalThis.SIGNED_EULA ) window.location.href = foundry.utils.getRoute("license");
      this.users = new Users(this.data.users);
      this.collections.set("User", this.users);
      this.collections.set("Setting", this.settings.storage.get("world"));

      // Render applications
      ui.notifications = new Notifications().render(true);
      ui.players = new UserManagement();
      ui.players.render(true);

      // Game is ready for use
      this.ready = true;
    }

    /* -------------------------------------------- */

    /**
     * The application view which displays the Game join and authentication screen.
     */
    #joinView() {
      if ( !globalThis.SIGNED_EULA ) window.location.href = foundry.utils.getRoute("license");

      // Configure Join view data
      this.users = new Users(this.data.users);
      this.collections.set("User", this.users);

      // Activate Join view socket listeners
      Users._activateSocketListeners(this.socket);

      // Render Join view applications
      ui.notifications = new Notifications();
      ui.notifications.render(true);
      ui.join = new JoinGameForm();
      ui.join.render(true);
    }

    /* -------------------------------------------- */

    /**
     * The application update view which allows for updating the Foundry Virtual Tabletop software.
     */
    #updateView() {
      ui.notifications = new Notifications().render(true);
      ui.setupUpdate = new SetupUpdate().render(true);
      Setup._activateSocketListeners();
    }

    /* -------------------------------------------- */
    /*  Package Management                          */
    /* -------------------------------------------- */

    /**
     * Check with the server whether a package of a certain type may be installed or updated.
     * @param {object} options    Options which affect how the check is performed
     * @param {string} options.type       The package type to check
     * @param {string} options.id         The package id to check
     * @param {string} [options.manifest] The manifest URL to check
     * @param {number} [options.timeout]  A timeout in milliseconds after which the check will fail
     * @returns {Promise<PackageManifestData>} The resulting manifest if an update is available
     */
    static async checkPackage({type="module", id, manifest, timeout=20000}={}) {
      return this.post({action: "checkPackage", strict: false, type, id, manifest}, timeout);
    }

    /* -------------------------------------------- */

    /**
     * Prepares the cache of available and owned packages
     * @param {object} options          Options which configure how the cache is warmed
     * @param {string} options.type     The type of package being cached
     * @returns {Promise<void>}
     */
    static async warmPackages({type="system"}={}) {
      if ( Setup.cache[type].state > Setup.CACHE_STATES.COLD ) return;
      Setup.cache[type].state = Setup.CACHE_STATES.WARMING;
      await this.getPackages({type});
      Setup.cache[type].state = Setup.CACHE_STATES.WARMED;
    }

    /* -------------------------------------------- */

    /**
     * Get a Map of available packages of a given type which may be installed
     * @param {string} type
     * @returns {Promise<Map<string, ClientPackage>>}
     */
    static async getPackages({type="system"}={}) {

      // Return from cache
      if ( this.cache[type].packages?.size > 0 ) return this.cache[type].packages;

      // Request from server
      const packages = new Map();
      let response;
      try {
        response = await this.post({action: "getPackages", type: type});
      }
      catch(err) {
        ui.notifications.error(err.message, {localize: true});
        return packages;
      }

      // Populate the cache
      response.packages.forEach(p => {
        const pkg = new PACKAGE_TYPES[type](p);
        packages.set(p.id, pkg);
      });
      this.cache[type].packages = packages;
      this.cache[type].owned = response.owned;
      return packages;
    }

    /* -------------------------------------------- */

    /**
     * List the user's current backups.
     * @returns {Promise<BackupsListing|null>}
     */
    static async listBackups() {
      let backups = null;
      try {
        if ( !Setup.#listingBackups ) Setup.#listingBackups = this.post({ action: "listBackups" });
        backups = await Setup.#listingBackups;
      } catch ( err ) {
        ui.notifications.error(err.message, { localize: true });
      }
      this.backups = backups;
      Setup.#listingBackups = null;
      return backups;
    }

    /* -------------------------------------------- */

    /**
     * Open the Package Browser application
     * @param {string} packageType        The type of package being installed, in ["module", "system", "world"]
     * @param {string} [search]           An optional search string to filter packages
     * @returns {Promise<void>}
     */
    static async browsePackages(packageType, options={}) {
      return new InstallPackage({packageType, ...options})._render(true);
    }

    /* -------------------------------------------- */

    /**
     * Install a Package
     * @param {object} options              Options which affect how the package is installed
     * @param {string} options.type           The type of package being installed, in ["module", "system", "world"]
     * @param {string} options.id             The package id
     * @param {string} options.manifest       The package manifest URL
     * @param {boolean} [options.notify=true] Display a notification toast?
     * @returns {Promise<foundry.packages.BasePackage>} A Promise which resolves to the installed package
     */
    static async installPackage({type="module", id, manifest, notify=true}={}) {
      const { ACTIONS } = CONST.SETUP_PACKAGE_PROGRESS;
      const response = await new ProgressReceiver(manifest, ACTIONS.INSTALL_PKG, {
        type, id, manifest
      }, { notify: false }).listen();

      if ( response instanceof Error ) {
        if ( response.context.packageWarnings ) {
          ui.notifications.error(game.i18n.localize(response.message));
          Setup.#logPackageWarnings(response.context.packageWarnings, { notify: false });
        } else if ( notify ) {
          const [message] = response.error.split("\n");
          ui.notifications.error(game.i18n.format("SETUP.InstallFailure", { message }), { console: false });
        }
        ui.setupPackages?.render();
        throw response;
      }

      const pkg = new PACKAGE_TYPES[type](response.pkg);
      if ( notify ) {
        ui.notifications.info(game.i18n.format("SETUP.InstallSuccess", {
          type: game.i18n.localize(`PACKAGE.Type.${type}`), id: pkg.id }));
      }

      // Trigger dependency installation (asynchronously)
      if ( pkg.relationships ) {
        // noinspection ES6MissingAwait
        this.installDependencies(pkg, { notify });
      }

      // Add the created package to game data
      pkg.install();
      await this.reload();
      return pkg;
    }

    /* -------------------------------------------- */

    /**
     * Install a set of dependency modules which are required by an installed package
     * @param {ClientPackage} pkg   The package which was installed that requested dependencies
     * @param {object} options      Options which modify dependency installation, forwarded to installPackage
     * @returns {Promise<void>}
     */
    static async installDependencies(pkg, options={}) {
      const dependencyChecks = new Map();

      // Check required Relationships
      for ( let d of pkg.relationships?.requires ?? [] ) {
        await this.#checkDependency(d, dependencyChecks);
      }
      // Check recommended Relationships
      for ( let d of pkg.relationships?.recommends ?? [] ) {
        await this.#checkDependency(d, dependencyChecks, false);
      }

      const uninstalled = Array.from(dependencyChecks.values()).filter(d => d.installNeeded);
      if ( !uninstalled.length ) return;

      // Prepare data for rendering
      const categories = uninstalled.reduce((obj, dep) => {
        if ( dep.canInstall && dep.required ) obj.canInstallRequired.push(dep);
        if ( dep.canInstall && !dep.required ) obj.canInstallOptional.push(dep);
        if ( !dep.canInstall && dep.required ) obj.cantInstallRequired.push(dep);
        if ( !dep.canInstall && !dep.required ) obj.cantInstallOptional.push(dep);
        return obj;
      }, { canInstallRequired: [], canInstallOptional: [], cantInstallRequired: [], cantInstallOptional: [] });
      const { canInstallRequired, canInstallOptional, cantInstallRequired, cantInstallOptional } = categories;
      const data = {
        title: pkg.title,
        totalDependencies: uninstalled.length,
        canInstallRequired,
        canInstallOptional,
        cantInstallRequired,
        cantInstallOptional
      };

      // Handle pluralization
      const singleDependency = data.totalDependencies === 1;
      const canInstall = data.canInstallRequired.length + data.canInstallOptional.length;
      const cantInstall = data.cantInstallRequired.length + data.cantInstallOptional.length;
      data.hasDependenciesLabel = singleDependency
        ? game.i18n.format("SETUP.PackageHasDependenciesSingular", {title: pkg.title})
        : game.i18n.format("SETUP.PackageHasDependenciesPlural", {title: pkg.title, number: data.totalDependencies});
      data.autoInstallLabel = canInstall === 1
        ? game.i18n.localize("SETUP.PackageDependenciesCouldInstallSingular")
        : game.i18n.format("SETUP.PackageDependenciesCouldInstallPlural", {number: canInstall});
      data.manualInstallLabel = cantInstall === 1
        ? game.i18n.localize("SETUP.PackageDependenciesCouldNotInstallSingular")
        : game.i18n.format("SETUP.PackageDependenciesCouldNotInstallPlural", {number: cantInstall});
      // Prompt the user to confirm installation of dependency packages
      const html = await renderTemplate("templates/setup/install-dependencies.html", data);
      new Dialog(
        {
          title: game.i18n.localize("SETUP.PackageDependenciesTitle"),
          content: html,
          buttons: {
            automatic: {
              icon: '<i class="fas fa-bolt-auto"></i>',
              label: canInstall === 1
                ? game.i18n.localize("SETUP.PackageDependenciesAutomaticSingular")
                : game.i18n.format("SETUP.PackageDependenciesAutomaticPlural"),
              disabled: canInstall === 0,
              callback: async (event) => {
                // Install selected dependency packages
                const inputs = Array.from(event[0].querySelectorAll("input"));
                let installed = 0;
                for ( let d of dependencyChecks.values() ) {
                  if ( !d.installNeeded ) continue;

                  // Only install the package if the input is checked
                  if ( !inputs.find(i => i.name === d.id)?.checked ) continue;
                  await this.installPackage({type: d.type, id: d.id, manifest: d.manifest, ...options});
                  installed++;
                }
                return ui.notifications.info(game.i18n.format("SETUP.PackageDependenciesSuccess", {
                  title: pkg.title,
                  number: installed
                }));
              }
            },
            manual: {
              icon: '<i class="fas fa-wrench"></i>',
              label: game.i18n.localize(`SETUP.PackageDependenciesManual${singleDependency ? "Singular" : "Plural"}`),
              callback: () => {
                if ( canInstallRequired.length ) {
                  ui.notifications.warn(game.i18n.format("SETUP.PackageDependenciesDecline", { title: pkg.title }));
                }
              }
            }
          },
          default: "automatic"
        }, {
          id: "setup-install-dependencies",
          width: 600
        }).render(true);
    }


    /* -------------------------------------------- */

    /**
     * @typedef {Object} PackageDependencyCheck
     * @property {string} id                The package id
     * @property {string} type              The package type
     * @property {string} manifest          The package manifest URL
     * @property {boolean} installNeeded    Whether the package is already installed
     * @property {boolean} canInstall       Whether the package can be installed
     * @property {string} message           An error message to display to the user
     * @property {string} url               The URL to the package
     * @property {string} version           The package version
     */

    /**
     * Checks a dependency to see if it needs to be installed
     * @param {RelatedPackage} relatedPackage                                   The dependency
     * @param {Map<string, PackageDependencyCheck>} dependencyChecks            The current map of dependencies to install
     * @returns {Promise<void>}
     * @private
     */
    static async #checkDependency(relatedPackage, dependencyChecks, required = true) {
      if ( !relatedPackage.id || dependencyChecks.has(relatedPackage.id) ) return;
      relatedPackage.type = relatedPackage.type || "module";

      let dependencyCheck = {
        id: relatedPackage.id,
        type: relatedPackage.type,
        manifest: "",
        installNeeded: true,
        canInstall: false,
        message: "",
        url: "",
        version: "",
        required: required,
        note: required ? game.i18n.localize("SETUP.RequiredPackageNote") : game.i18n.localize("SETUP.RecommendedPackageNote"),
        reason: relatedPackage.reason
      };

      const installed = game.data[`${relatedPackage.type}s`].find(p => p.id === relatedPackage.id);
      if ( installed ) {
        const msg = `Dependency ${relatedPackage.type} ${relatedPackage.id} is already installed.`;
        console.debug(msg);
        dependencyCheck.installNeeded = false;
        dependencyCheck.message = msg;
        dependencyChecks.set(dependencyCheck.id, dependencyCheck);
        return;
      }

      // Manifest URL provided
      let dependency;
      if ( relatedPackage.manifest ) {
        dependencyCheck.manifest = relatedPackage.manifest;
        dependencyCheck.url = relatedPackage.manifest;
        dependency = await PACKAGE_TYPES[relatedPackage.type].fromRemoteManifest(relatedPackage.manifest);
        if ( !dependency ) {
          const msg = `Requested dependency "${relatedPackage.id}" not found at ${relatedPackage.manifest}.`;
          console.warn(msg);
          dependencyCheck.message = msg;
          dependencyChecks.set(dependencyCheck.id, dependencyCheck);
          return;
        }
      }
      else {
        // Discover from package listing
        const packages = await Setup.getPackages({type: relatedPackage.type});
        dependency = packages.get(relatedPackage.id);
        if ( !dependency ) {
          const msg = `Requested dependency "${relatedPackage.id}" not found in ${relatedPackage.type} directory.`;
          console.warn(msg);
          dependencyCheck.message = msg;
          dependencyChecks.set(dependencyCheck.id, dependencyCheck);
          return;
        }

        // Prefer linking to Readme over Project URL over Manifest
        if ( dependency.readme ) dependencyCheck.url = dependency.readme;
        else if ( dependency.url ) dependencyCheck.url = dependency.url;
        else dependencyCheck.url = dependency.manifest;
        dependencyCheck.manifest = dependency.manifest;
      }
      dependencyCheck.version = dependency.version;

      /**
       * Test whether a package dependency version matches the defined compatibility criteria of its dependant package.
       * @param {string} dependencyVersion                 The version string of the dependency package
       * @param {PackageCompatibility} compatibility       Compatibility criteria defined by the dependant package
       * @param {string} [compatibility.minimum]           A minimum version of the dependency which is required
       * @param {string} [compatibility.maximum]           A maximum version of the dependency which is allowed
       * @returns {boolean}
       */
      function isDependencyCompatible(dependencyVersion, {minimum, maximum}={}) {
        if ( minimum && foundry.utils.isNewerVersion(minimum, dependencyVersion) ) return false;
        return !( maximum && foundry.utils.isNewerVersion(dependencyVersion, maximum) );
      }

      // Validate that the dependency is compatible
      if ( !isDependencyCompatible(dependency.version, relatedPackage.compatibility) ) {
        const range = [
          relatedPackage.compatibility?.minimum ? `>= ${relatedPackage.compatibility.minimum}` : "",
          relatedPackage.compatibility?.maximum && relatedPackage.compatibility?.maximum ? " and " : "",
          relatedPackage.compatibility?.maximum ? `<= ${relatedPackage.compatibility.maximum}` : ""
        ].join("");
        const msg = `No version of dependency "${relatedPackage.id}" found matching required range of ${range}.`;
        console.warn(msg);
        dependencyCheck.message = msg;
        dependencyChecks.set(dependencyCheck.id, dependencyCheck);
        return;
      }
      dependencyCheck.canInstall = true;
      dependencyChecks.set(dependencyCheck.id, dependencyCheck);

      // If the dependency has dependencies itself, take a fun trip down recursion lane
      for ( let d of dependency.relationships?.requires ?? [] ) {
        await this.#checkDependency(d, dependencyChecks);
      }
      for ( let d of dependency.relationships?.recommends ?? [] ) {
        await this.#checkDependency(d, dependencyChecks, false);
      }
    }

    /* -------------------------------------------- */

    /**
     * Handle requests to uninstall a package.
     * @param {BasePackage} pkg       The package to uninstall
     * @returns {Promise<void>}
     */
    static async uninstallPackage(pkg) {
      const typeLabel = game.i18n.localize(`PACKAGE.Type.${pkg.type}`);
      if ( pkg.locked ) {
        return ui.notifications.error(game.i18n.format("PACKAGE.UninstallLocked", {type: typeLabel, id: pkg.id}));
      }

      // TODO #8555 #10102

      // Provide a deletion confirmation warning
      // For worlds, require the user to provide a deletion code
      const title = game.i18n.format("SETUP.PackageDeleteTitle", {type: typeLabel, title: pkg.title ?? pkg.id});
      let content = `
      <p>${game.i18n.format("SETUP.PackageDeleteConfirm", {type: typeLabel, title: pkg.title ?? pkg.id})}</p>
    `;
      let confirm;
      if ( pkg.type === "world" ) {
        content += `<p class="notification warning">${game.i18n.localize("SETUP.WorldDeleteConfirmWarning")}</p>`;
        confirm = await this.confirmCodeDialog({ title, content });
      } else {
        if ( pkg.hasStorage ) content += `<p>${game.i18n.localize("SETUP.PackageDeletePersistent")}</p>`;
        content += `<p class="notification warning">${game.i18n.localize("SETUP.PackageDeleteNoUndo")}</p>`;
        confirm = await Dialog.confirm({ title, content, options: { focus: false, width: 480 } });
      }
      if ( !confirm ) return;
      // Submit the server request
      try {
        await this.post({action: "uninstallPackage", type: pkg.type, id: pkg.id});
      } catch(err) {
        ui.notifications.error(`${game.i18n.localize("SETUP.UninstallFailure")}: ${err.message}`);
        throw err;
      }

      // Finalize the uninstallation
      PACKAGE_TYPES[pkg.type].uninstall(pkg.id);
      ui.notifications.info(`${typeLabel} ${pkg.id} ${game.i18n.localize("SETUP.UninstallSuccess")}.`);
      return this.reload();
    }

    /* -------------------------------------------- */

    /**
     * Retrieve compatibility data for installed packages in the next version of the core software.
     * @param {ReleaseData} release  The release to check against.
     * @returns {Promise<PreviewCompatibilityDescriptor>}
     */
    static async previewCompatibility(release) {
      if ( Setup.#compatibilityPreview?.version === release.version ) return Setup.#compatibilityPreview;
      let preview = null;
      try {
        if ( !Setup.#checkingCompatibility ) {
          Setup.#checkingCompatibility = this.post({ action: "previewCompatibility", release }, { timeoutMs: null });
        }
        preview = await Setup.#checkingCompatibility;
      } catch {
        // Ignored as notification is already raised inside the post method.
      }
      if ( preview ) Setup.#compatibilityPreview = preview;
      Setup.#checkingCompatibility = null;
      return preview;
    }

    /* -------------------------------------------- */
    /*  Backup Management                           */
    /* -------------------------------------------- */

    /**
     * Create a backup of a given package.
     * @param {BasePackage} pkg           The package.
     * @param {object} [options]
     * @param {string} [options.note]     An optional note for the backup. Ignored if dialog is true.
     * @param {boolean} [options.dialog]  Spawn a dialog to prompt the user for a note.
     * @returns {Promise<void>}
     */
    static async createBackup({ type, id, title }, { note, dialog=false }={}) {
      if ( dialog ) {
        const result = await Setup.#createBackupDialog(title);
        if ( !result.confirm ) return;
        note = result.note;
      }

      const { ACTIONS, STEPS } = CONST.SETUP_PACKAGE_PROGRESS;
      const now = new Date();
      const backupId = `${type}.${id}.${now.toDateInputString()}.${now.valueOf()}`;
      const backups = [{ type, packageId: id, note, id: backupId }];
      this.toggleLock(true, { message: "SETUP.BACKUPS.BackingUp" });
      let packet;
      setTimeout(() => {
        if ( (packet?.step === STEPS.ARCHIVE) && (packet?.pct === 0) ) {
          ui.notifications.info("SETUP.BACKUPS.LargePackageWarning", { localize: true, permanent: true });
        }
      }, 15000);
      const progress = new ProgressReceiver(backupId, ACTIONS.CREATE_BACKUP, { backups }, {
        successMessage: game.i18n.format("SETUP.BACKUPS.CreateBackupComplete", { title }),
        failureMessage: game.i18n.format("SETUP.BACKUPS.CreateBackupFailure", { title })
      });
      progress.addEventListener("progress", ({ data }) => packet = data);
      const response = await progress.listen();
      if ( Setup.backups && !(response instanceof Error) ) {
        Setup.backups[type] ??= {};
        Setup.backups[type][id] ??= [];
        Setup.backups[type][id].unshift(response.backupData);
      }
      this.toggleLock(false);
    }

    /* -------------------------------------------- */

    /**
     * Create a snapshot of the current installation state.
     * @param {object} [options]
     * @param {string} [options.note]     An optional note for the snapshot. Ignored if dialog is true.
     * @param {boolean} [options.dialog]  Spawn a dialog to prompt the user to confirm, and to supply a note.
     * @param {Partial<SnapshotOperationDialogOptions>} [dialogOptions]  Options to forward to the dialog.
     * @returns {Promise<void>}
     */
    static async createSnapshot({ note, dialog=false }={}, dialogOptions={}) {
      const { CREATE_SNAPSHOT, CREATE_BACKUP } = CONST.SETUP_PACKAGE_PROGRESS.ACTIONS;
      if ( dialog ) {
        const result = await SnapshotOperationDialog.wait({
          title: game.i18n.localize("SETUP.BACKUPS.CreateSnapshot")
        }, {
          message: "SETUP.BACKUPS.CreateSnapshotHint",
          confirm: "SETUP.BACKUPS.CreateSnapshotConfirm",
          packageList: true,
          note: true,
          diskSpaceAction: "checkCreateSnapshotDiskSpace",
          ...dialogOptions
        });
        if ( !result.confirm ) return;
        note = result.note;
      }

      this.toggleLock(true, { message: "SETUP.BACKUPS.BackingUp" });
      const now = new Date();
      const id = `snapshot.${now.toDateInputString()}.${now.valueOf()}`;
      await new SnapshotProgressReceiver(id, CREATE_SNAPSHOT, CREATE_BACKUP, { note, id }, {
        title: "",
        successMessage: game.i18n.localize("SETUP.BACKUPS.CreateSnapshotComplete"),
        failureMessage: game.i18n.localize("SETUP.BACKUPS.CreateSnapshotFailure")
      }).listen();
      Setup.backups = null;
      this.toggleLock(false);
    }

    /* -------------------------------------------- */

    /**
     * Delete backups.
     * @param {BasePackage} pkg           The package whose backups are being deleted.
     * @param {string[]} backupIds        The IDs of the backups to delete.
     * @param {object} [options]
     * @param {boolean} [options.dialog]  Spawn a warning dialog and ask the user to confirm the action.
     * @returns {Promise<void>}
     */
    static async deleteBackups({ type, id, title }, backupIds, { dialog=false }={}) {
      const count = backupIds.length;
      if ( !count ) return;
      if ( dialog ) {
        const confirm = await this.confirmCodeDialog({
          title: game.i18n.format("SETUP.BACKUPS.DeleteBackupTitle", { title }),
          content: `<p>${game.i18n.format(`SETUP.BACKUPS.DeleteBackupWarning${count === 1 ? "" : "Pl"}`, { count })}</p>`
        });
        if ( !confirm ) return;
      }

      const { DELETE_BACKUP } = CONST.SETUP_PACKAGE_PROGRESS.ACTIONS;
      const ids = new Set(backupIds);
      const backups = Setup.backups[type][id].filter(backupData => ids.has(backupData.id));
      this.toggleLock(true, { message: "SETUP.BACKUPS.DeletingBackup" });
      await new ProgressReceiver(DELETE_BACKUP, DELETE_BACKUP, { backups }, {
        failureMessage: game.i18n.format("SETUP.BACKUPS.DeleteBackupFailure", { title }),
        successMessage: game.i18n.format(`SETUP.BACKUPS.DeleteBackupComplete${count === 1 ? "" : "Pl"}`, { title, count })
      }).listen();
      if ( Setup.backups ) {
        Setup.backups[type][id] = Setup.backups[type][id].filter(backupData => !ids.has(backupData.id));
      }
      this.toggleLock(false);
    }

    /* -------------------------------------------- */

    /**
     * Delete snapshots.
     * @param {string[]} snapshotIds      The IDs of the snapshots to delete.
     * @param {object} [options]
     * @param {boolean} [options.dialog]  Spawn a warning dialog and ask the user to confirm the action.
     * @returns {Promise<void>}
     */
    static async deleteSnapshots(snapshotIds, { dialog=false }={}) {
      const count = snapshotIds.length;
      if ( !count ) return;
      if ( dialog ) {
        const confirm = await this.confirmCodeDialog({
          title: game.i18n.localize("SETUP.BACKUPS.DeleteSnapshotTitle"),
          content: `
          <p>${game.i18n.format(`SETUP.BACKUPS.DeleteSnapshotWarning${count === 1 ? "" : "Pl"}`, { count })}</p>
        `
        });
        if ( !confirm ) return;
      }

      const { DELETE_SNAPSHOT, DELETE_BACKUP } = CONST.SETUP_PACKAGE_PROGRESS.ACTIONS;
      const snapshots = snapshotIds.map(id => Setup.backups.snapshots[id]);
      this.toggleLock(true, { message: "SETUP.BACKUPS.DeletingSnapshot" });
      await new SnapshotProgressReceiver(DELETE_SNAPSHOT, DELETE_SNAPSHOT, DELETE_BACKUP, { snapshots }, {
        failureMessage: game.i18n.localize("SETUP.BACKUPS.DeleteSnapshotFailure"),
        successMessage: game.i18n.format(`SETUP.BACKUPS.DeleteSnapshotComplete${count === 1 ? "" : "Pl"}`, { count })
      }).listen();
      Setup.backups = null;
      this.toggleLock(false);
    }

    /* -------------------------------------------- */

    /**
     * Restore a backup.
     * @param {BackupData} backupData     The backup to restore.
     * @param {object} [options]
     * @param {boolean} [options.dialog]  Spawn a warning dialog and ask the user to confirm the action.
     * @returns {Promise<void>}
     */
    static async restoreBackup(backupData, { dialog=false }={}) {
      const { title, id } = backupData;
      if ( dialog ) {
        const confirm = await this.confirmCodeDialog({
          title: game.i18n.format("SETUP.BACKUPS.RestoreBackupTitle", { title }),
          content: `<p class="notification warning">${game.i18n.localize("SETUP.BACKUPS.RestoreBackupWarning")}</p>`
        });
        if ( !confirm ) return;
      }

      const backups = [backupData];
      const dateFormatter = new Intl.DateTimeFormat(game.i18n.lang, { dateStyle: "full", timeStyle: "short" });
      this.toggleLock(true, { message: "SETUP.BACKUPS.Restoring" });
      await new ProgressReceiver(id, CONST.SETUP_PACKAGE_PROGRESS.ACTIONS.RESTORE_BACKUP, { backups }, {
        failureMessage: game.i18n.format("SETUP.BACKUPS.RestoreBackupFailure", { title }),
        successMessage: game.i18n.format("SETUP.BACKUPS.RestoreBackupComplete", {
          title,
          date: dateFormatter.format(backupData.createdAt)
        })
      }).listen();
      await Setup.reload();
      this.toggleLock(false);
    }

    /* -------------------------------------------- */

    /**
     * Restore a snapshot.
     * @param {SnapshotData} snapshotData  The snapshot to restore.
     * @param {object} [options]
     * @param {boolean} [options.dialog]   Spawn a warning dialog and ask the user to confirm the action.
     * @returns {Promise<void>}
     */
    static async restoreSnapshot(snapshotData, { dialog=false }={}) {
      if ( dialog ) {
        const { confirm } = await SnapshotOperationDialog.wait({
          title: game.i18n.localize("SETUP.BACKUPS.RestoreSnapshotTitle")
        }, {
          snapshotData,
          message: "SETUP.BACKUPS.RestoreSnapshotWarning",
          warning: true,
          confirmCode: true,
          diskSpaceAction: "checkRestoreSnapshotDiskSpace"
        });
        if ( !confirm ) return;
      }

      const { id, createdAt } = snapshotData;
      const { ACTIONS } = CONST.SETUP_PACKAGE_PROGRESS;
      const dateFormatter = new Intl.DateTimeFormat(game.i18n.lang, { dateStyle: "full", timeStyle: "short" });

      this.toggleLock(true, { message: "SETUP.BACKUPS.Restoring" });
      await new SnapshotProgressReceiver(id, ACTIONS.RESTORE_SNAPSHOT, ACTIONS.RESTORE_BACKUP, { snapshotData }, {
        title: "",
        failureMessage: game.i18n.localize("SETUP.BACKUPS.RestoreSnapshotFailure"),
        successMessage: game.i18n.format("SETUP.BACKUPS.RestoreSnapshotComplete", {
          date: dateFormatter.format(createdAt)
        })
      }).listen();
      await Setup.reload();
      this.toggleLock(false);
    }

    /* -------------------------------------------- */

    /**
     * Restore the latest backup for a given package.
     * @param {BasePackage} pkg           The package.
     * @param {object} [options]
     * @param {boolean} [options.dialog]  Spawn a warning dialog and ask the user to confirm the action.
     * @returns {Promise<void>}
     */
    static async restoreLatestBackup({ id, type }, options={}) {
      if ( !this.backups ) await this.listBackups();
      const [backupData] = this.backups?.[type]?.[id] ?? [];
      if ( backupData ) return this.restoreBackup(backupData, options);
    }

    /* -------------------------------------------- */
    /*  Socket Listeners and Handlers               */
    /* -------------------------------------------- */

    /**
     * Activate socket listeners related to the Setup view.
     */
    static _activateSocketListeners() {
      game.socket.on("progress", Setup._onProgress);
    }

    /* --------------------------------------------- */

    /**
     * A list of functions to call on progress events.
     * @type {Function[]}
     */
    static _progressListeners = [];

    /* --------------------------------------------- */

    /**
     * Handle a progress event from the server.
     * @param {object} data  The progress update data.
     * @private
     */
    static _onProgress(data) {
      Setup._progressListeners.forEach(l => l(data));
    }

    /* --------------------------------------------- */

    /**
     * Add a function to be called on a progress event.
     * @param {Function} listener
     * @internal
     */
    static _addProgressListener(listener) {
      Setup._progressListeners.push(listener);
    }

    /* --------------------------------------------- */

    /**
     * Stop sending progress events to a given function.
     * @param {Function} listener
     * @internal
     */
    static _removeProgressListener(listener) {
      Setup._progressListeners = Setup._progressListeners.filter(l => l !== listener);
    }

    /* --------------------------------------------- */

    /**
     * Reload package data from the server and update its display
     * @returns {Promise<Object>}
     */
    static async reload() {
      return this.getData(game.socket, game.view).then(setupData => {
        foundry.utils.mergeObject(game.data, setupData);
        game.setupPackages(setupData);
        ui.setupPackages.render();
        ui.installPackages?.render();
      });
    }

    /* -------------------------------------------- */
    /*  Helper Functions                            */
    /* -------------------------------------------- */

    /**
     * Post to the Setup endpoint.
     * @param {object} requestData    An object of data which should be included with the POST request
     * @param {object} [options]      An object of options passed to the fetchWithTimeout method
     * @param {boolean} [requestOptions.notify]  Whether to spawn notification dialogs when errors are encountered.
     * @returns {Promise<object>}     A Promise resolving to the returned response data
     * @throws                        An error if the request was not successful
     */
    static async post(requestData, { notify=true, ...requestOptions }={}) {
      if ( game.ready ) {
        throw new Error("You may not submit POST requests to the setup page while a game world is currently active.");
      }

      // Post the request and handle redirects
      const url = foundry.utils.getRoute(game.view);
      let responseData;
      try {
        const response = await foundry.utils.fetchWithTimeout(url, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(requestData)
        }, requestOptions);

        // Handle redirect
        if ( response.redirected ) return window.location.href = response.url;

        // Process response
        responseData = await response.json();
      } catch(error) {
        const annotatedError = new Error(`[${requestData.id}] ${game.i18n.localize(error)}`);
        if ( notify ) ui.notifications.error(annotatedError, {permanent: true});
        throw annotatedError;
      }

      // Handle server-side errors
      if ( responseData.error ) {
        const { error, ...data } = responseData;
        const err = new Error(`[${requestData.id}] ${game.i18n.localize(error)}`);
        Object.assign(err, data);
        if ( notify ) ui.notifications.error(err, {permanent: true});
        throw err;
      }
      return responseData;
    }

    /* -------------------------------------------- */

    /**
     * Create a confirmation dialog that prompts the user to enter a code to proceed.
     * Base on https://stackoverflow.com/a/8084248
     * @param {object} [options]
     * @param {string} [options.title]    The dialog title.
     * @param {string} [options.content]  Additional dialog content.
     * @returns {Promise<boolean|null>}   Returns true if the user chose to proceed and the code was correct. Returns
     *                                    false if the code was incorrect or the user chose to not proceed. Returns null
     *                                    if the user dismissed the dialog.
     */
    static confirmCodeDialog({ title, content }={}) {
      const code = (Math.random() + 1).toString(36).substring(7, 11);
      content = `
      ${content ?? ""}
      <p>${game.i18n.localize("SETUP.WorldDeleteConfirmCode")}</p>
      <p id="confirm-code"><span class="reference">${code}</span></p>
      <input id="delete-confirm" class="dark" type="text" autocomplete="off" placeholder="${code}"
             aria-label="${game.i18n.format("SETUP.ConfirmCodeLabel", { code })}" required autofocus>
    `;
      return Dialog.confirm({
        title, content,
        options: {
          jQuery: false,
          focus: false,
          width: 480
        },
        yes: html => {
          const confirm = html.querySelector("#delete-confirm")?.value;
          if ( confirm === code ) return true;
          ui.notifications.error("SETUP.PackageDeleteWorldConfirm", { localize: true });
          return false;
        }
      });
    }

    /* -------------------------------------------- */

    /**
     * @typedef {object} BackupNoteConfirmation
     * @property {string} [note]    The user-supplied backup note.
     * @property {boolean} confirm  Whether the user wishes to proceed.
     */

    /**
     * Spawn the backup creation confirmation dialog.
     * @param {string} title  The package title.
     * @returns {Promise<BackupNoteConfirmation>}
     */
    static async #createBackupDialog(title) {
      const result = await Dialog.prompt({
        title: game.i18n.format("SETUP.BACKUPS.CreateBackup", { title }),
        content: `
        <p>${game.i18n.localize("SETUP.BACKUPS.NoteHint")}</p>
        <input class="dark" type="text" autocomplete="off" autofocus>
      `,
        label: game.i18n.localize("SETUP.BACKUPS.Backup"),
        rejectClose: false,
        callback: html => html.querySelector("input").value,
        options: {
          width: 480,
          jQuery: false
        }
      });
      if ( result === null ) return { confirm: false };
      return { note: result, confirm: true };
    }

    /* -------------------------------------------- */

    /**
     * Toggle the locked state of the interface.
     * @param {boolean} locked  Is the interface locked?
     * @param {object} [options]
     */
    static toggleLock(locked, options={}) {
      ui.setupMenu?.toggleLock(locked, options);
      ui.setupPackages?.toggleLock(locked, options);
      Object.values(ui.windows).forEach(app => app.toggleLock?.(locked, options));
    }
  };

  var applications = /*#__PURE__*/Object.freeze({
    __proto__: null,
    EULA: EULA,
    JoinGameForm: JoinGameForm,
    SetupAuthenticationForm: SetupAuthenticationForm,
    SetupMenu: SetupMenu,
    SetupPackages: SetupPackages,
    UserManagement: UserManagement
  });

  // Add Global Exports
  globalThis.Setup = Setup$1;
  Setup$1.applications = applications;
  foundry.setup = {
    Setup: Setup$1,
    applications
  };

})();
