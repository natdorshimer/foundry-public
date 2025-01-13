/**
 * A class responsible for prompting the user about dependency resolution for their modules.
 */
class DependencyResolution extends FormApplication {
  /**
   * @typedef {object} DependencyResolutionInfo
   * @property {Module} module       The module.
   * @property {boolean} checked     Has the user toggled the checked state of this dependency in this application.
   * @property {string} [reason]     Some reason associated with the dependency.
   * @property {boolean} [required]  Whether this module is a hard requirement and cannot be unchecked.
   */

  /**
   * @typedef {FormApplicationOptions} DependencyResolutionAppOptions
   * @property {boolean} enabling  Whether the root dependency is being enabled or disabled.
   */

  /**
   * @param {ModuleManagement} manager  The module management application.
   * @param {Module} root               The module that is the root of the dependency resolution.
   * @param {DependencyResolutionAppOptions} [options]  Additional options that configure resolution behavior.
   */
  constructor(manager, root, options={}) {
    super(root, options);
    this.#manager = manager;

    // Always include the root module.
    this.#modules.set(root.id, root);

    // Determine initial state.
    if ( options.enabling ) this.#initializeEnabling();
    else this.#initializeDisabling();
  }

  /**
   * The full set of modules considered for dependency resolution stemming from the root module.
   * @type {Set<Module>}
   */
  #candidates = new Set();

  /**
   * The set of all modules dependent on a given module.
   * @type {Map<Module, Set<Module>>}
   */
  #dependents = new Map();

  /**
   * The module management application.
   * @type {ModuleManagement}
   */
  #manager;

  /**
   * A subset of the games modules that are currently active in the module manager.
   * @type {Map<string, Module>}
   */
  #modules = new Map();

  /**
   * Track the changes being made by the user as part of dependency resolution.
   * @type {Map<Module, DependencyResolutionInfo>}
   */
  #resolution = new Map();

  /* -------------------------------------------- */

  /**
   * Whether there are additional dependencies that need resolving by the user.
   * @type {boolean}
   */
  get needsResolving() {
    if ( this.options.enabling ) return this.#candidates.size > 0;
    return (this.#candidates.size > 1) || !!this.#getUnavailableSubtypes();
  }

  /* -------------------------------------------- */

  /**
   * @inheritdoc
   * @returns {DependencyResolutionAppOptions}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      enabling: true,
      template: "templates/setup/impacted-dependencies.html"
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options={}) {
    const required = [];
    const optional = [];
    let subtypes;

    if ( this.options.enabling ) {
      const context = this.#getDependencyContext();
      required.push(...context.required);
      optional.push(...context.optional);
    } else {
      optional.push(...this.#getUnusedContext());
      subtypes = this.#getUnavailableSubtypes();
    }

    return {
      required, optional, subtypes,
      enabling: this.options.enabling
    };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('input[type="checkbox"]').on("change", this._onChangeCheckbox.bind(this));
    html.find("[data-action]").on("click", this._onAction.bind(this));
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _render(force, options) {
    await super._render(force, options);
    this.setPosition({ height: "auto" });
  }

  /* -------------------------------------------- */

  /**
   * Handle the user toggling a dependency.
   * @param {Event} event  The checkbox change event.
   * @protected
   */
  _onChangeCheckbox(event) {
    const target = event.currentTarget;
    const module = this.#modules.get(target.name);
    const checked = target.checked;
    const resolution = this.#resolution.get(module);
    resolution.checked = checked;
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle button presses.
   * @param {PointerEvent} event  The triggering event.
   * @protected
   */
  _onAction(event) {
    const action = event.currentTarget.dataset.action;
    switch ( action ) {
      case "cancel":
        this.close();
        break;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _getSubmitData(updateData={}) {
    const fd = new FormDataExtended(this.form, { disabled: true });
    return foundry.utils.mergeObject(fd.object, updateData);
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    formData[this.object.id] = true;
    this.#manager._onSelectDependencies(formData, this.options.enabling);
  }

  /* -------------------------------------------- */

  /**
   * Return any modules that the root module is required by.
   * @returns {Set<Module>}
   * @internal
   */
  _getRootRequiredBy() {
    const requiredBy = new Set();
    if ( this.options.enabling ) return requiredBy;
    const dependents = this.#dependents.get(this.object);
    for ( const dependent of (dependents ?? []) ) {
      if ( dependent.relationships.requires.find(({ id }) => id === this.object.id) ) {
        requiredBy.add(dependent);
      }
    }
    return requiredBy;
  }

  /* -------------------------------------------- */

  /**
   * Build the structure of modules that are dependent on other modules.
   */
  #buildDependents() {
    const addDependent = (module, dep) => {
      dep = this.#modules.get(dep.id);
      if ( !dep ) return;
      if ( !this.#dependents.has(dep) ) this.#dependents.set(dep, new Set());
      const dependents = this.#dependents.get(dep);
      dependents.add(module);
    };

    for ( const module of this.#modules.values() ) {
      for ( const dep of module.relationships.requires ) addDependent(module, dep);
      for ( const dep of module.relationships.recommends ) addDependent(module, dep);
    }
  }

  /* -------------------------------------------- */

  /**
   * Recurse down the dependency tree and gather modules that are required or optional.
   * @param {Set<Module>} [skip]  If any of these modules are encountered in the graph, skip them.
   * @returns {Map<Module, DependencyResolutionInfo>}
   */
  #getDependencies(skip=new Set()) {
    const resolution = new Map();

    const addDependency = (module, { required=false, reason, dependent }={}) => {
      if ( !resolution.has(module) ) resolution.set(module, { module, checked: true });
      const info = resolution.get(module);
      if ( !info.required ) info.required = required;
      if ( reason ) {
        if ( info.reason ) info.reason += "<br>";
        info.reason += `${dependent.title}: ${reason}`;
      }
    };

    const addDependencies = (module, deps, required=false) => {
      for ( const { id, reason } of deps ) {
        const dep = this.#modules.get(id);
        if ( !dep ) continue;
        const info = resolution.get(dep);

        // Avoid cycles in the dependency graph.
        if ( info && (info.required === true || info.required === required) ) continue;

        // Add every dependency we see so tha user can toggle them on and off, but do not traverse the graph any further
        // if we have indicated this dependency should be skipped.
        addDependency(dep, { reason, required, dependent: module });
        if ( skip.has(dep) ) continue;

        addDependencies(dep, dep.relationships.requires, true);
        addDependencies(dep, dep.relationships.recommends);
      }
    };

    addDependencies(this.object, this.object.relationships.requires, true);
    addDependencies(this.object, this.object.relationships.recommends);
    return resolution;
  }

  /* -------------------------------------------- */

  /**
   * Get the set of all modules that would be unused (i.e. have no dependents) if the given set of modules were
   * disabled.
   * @param {Set<Module>} disabling  The set of modules that are candidates for disablement.
   * @returns {Set<Module>}
   */
  #getUnused(disabling) {
    const unused = new Set();
    for ( const module of this.#modules.values() ) {
      const dependents = this.#dependents.get(module);
      if ( !dependents ) continue;

      // What dependents are left if we remove the set of to-be-disabled modules?
      const remaining = dependents.difference(disabling);
      if ( !remaining.size ) unused.add(module);
    }
    return unused;
  }

  /* -------------------------------------------- */

  /**
   * Find the maximum dependents that can be pruned if the root module is disabled.
   * Starting at the root module, add all modules that would become unused to the set of modules to disable. For each
   * module added in this way, check again for new modules that would become unused. Repeat until there are no more
   * unused modules.
   */
  #initializeDisabling() {
    const disabling = new Set([this.object]);

    // Initialize modules.
    for ( const module of game.modules ) {
      if ( this.#manager._isModuleChecked(module.id) ) this.#modules.set(module.id, module);
    }

    // Initialize dependents.
    this.#buildDependents();

    // Set a maximum iteration limit of 100 to prevent accidental infinite recursion.
    for ( let i = 0; i < 100; i++ ) {
      const unused = this.#getUnused(disabling);
      if ( !unused.size ) break;
      unused.forEach(disabling.add, disabling);
    }

    this.#candidates = disabling;

    // Initialize resolution state.
    for ( const module of disabling ) {
      this.#resolution.set(module, { module, checked: true, required: false });
    }
  }

  /* -------------------------------------------- */

  /**
   * Find the full list of recursive dependencies for the root module.
   */
  #initializeEnabling() {
    // Initialize modules.
    for ( const module of game.modules ) {
      if ( !this.#manager._isModuleChecked(module.id) ) this.#modules.set(module.id, module);
    }

    // Traverse the dependency graph and locate dependencies that need activation.
    this.#resolution = this.#getDependencies();
    for ( const module of this.#resolution.keys() ) this.#candidates.add(module);
  }

  /* -------------------------------------------- */

  /**
   * The list of modules that the user currently has selected, including the root module.
   * @returns {Set<Module>}
   */
  #getSelectedModules() {
    const selected = new Set([this.object]);
    for ( const module of this.#candidates ) {
      const { checked } = this.#resolution.get(module);
      if ( checked ) selected.add(module);
    }
    return selected;
  }

  /* -------------------------------------------- */

  /**
   * After the user has adjusted their choices, re-calculate the dependency graph.
   * Display all modules which are still in the set of reachable dependencies, preserving their checked states. If a
   * module is no longer reachable in the dependency graph (because there are no more checked modules that list it as
   * a dependency), do not display it to the user.
   * @returns {{required: DependencyResolutionInfo[], optional: DependencyResolutionInfo[]}}
   */
  #getDependencyContext() {
    const skip = Array.from(this.#resolution.values()).reduce((acc, info) => {
      if ( info.checked === false ) acc.add(info.module);
      return acc;
    }, new Set());

    const dependencies = this.#getDependencies(skip);
    const required = [];
    const optional = [];

    for ( const module of this.#candidates ) {
      if ( !dependencies.has(module) ) continue;
      const info = this.#resolution.get(module);
      if ( info.required ) required.push(info);
      else optional.push(info);
    }

    return { required, optional };
  }

  /* -------------------------------------------- */

  /**
   * After the user has adjusted their choices, re-calculate which modules are still unused.
   * Display all modules which are still unused, preserving their checked states. If a module is no longer unused
   * (because a module that uses it was recently unchecked), do not display it to the user.
   * @returns {DependencyResolutionInfo[]}
   */
  #getUnusedContext() {
    // Re-calculate unused modules after we remove those the user unchecked.
    const unused = this.#getUnused(this.#getSelectedModules());
    const context = [];
    for ( const module of this.#candidates ) {
      if ( unused.has(module) ) context.push(this.#resolution.get(module));
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Get a formatted string of the Documents that would be rendered unavailable if the currently-selected modules were
   * to be disabled.
   * @returns {string}
   */
  #getUnavailableSubtypes() {
    const allCounts = {};
    for ( const module of this.#getSelectedModules() ) {
      const counts = game.issues.getSubTypeCountsFor(module);
      if ( !counts ) continue;
      Object.entries(counts).forEach(([documentName, subtypes]) => {
        const documentCounts = allCounts[documentName] ??= {};
        Object.entries(subtypes).forEach(([subtype, count]) => {
          documentCounts[subtype] = (documentCounts[subtype] ?? 0) + count;
        });
      });
    }
    return this.#manager._formatDocumentSummary(allCounts, true);
  }
}
