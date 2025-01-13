/**
 * @typedef {Object} PackageCompatibilityBadge
 * @property {string} type        A type in "safe", "unsafe", "warning", "neutral" applied as a CSS class
 * @property {string} tooltip     A tooltip string displayed when hovering over the badge
 * @property {string} [label]     An optional text label displayed in the badge
 * @property {string} [icon]      An optional icon displayed in the badge
 */


/**
 * A client-side mixin used for all Package types.
 * @param {typeof BasePackage} BasePackage    The parent BasePackage class being mixed
 * @returns {typeof ClientPackage}            A BasePackage subclass mixed with ClientPackage features
 * @category - Mixins
 */
function ClientPackageMixin(BasePackage) {
  class ClientPackage extends BasePackage {

    /**
     * Is this package marked as a favorite?
     * This boolean is currently only populated as true in the /setup view of the software.
     * @type {boolean}
     */
    favorite = false;

    /**
     * Associate package availability with certain badge for client-side display.
     * @returns {PackageCompatibilityBadge|null}
     */
    getVersionBadge() {
      return this.constructor.getVersionBadge(this.availability, this);
    }

    /* -------------------------------------------- */

    /**
     * Determine a version badge for the provided compatibility data.
     * @param {number} availability                The availability level.
     * @param {Partial<PackageManifestData>} data  The compatibility data.
     * @param {object} [options]
     * @param {Collection<string, Module>} [options.modules]  A specific collection of modules to test availability
     *                                                        against. Tests against the currently installed modules by
     *                                                        default.
     * @param {Collection<string, System>} [options.systems]  A specific collection of systems to test availability
     *                                                        against. Tests against the currently installed systems by
     *                                                        default.
     * @returns {PackageCompatibilityBadge|null}
     */
    static getVersionBadge(availability, data, { modules, systems }={}) {
      modules ??= game.modules;
      systems ??= game.systems;
      const codes = CONST.PACKAGE_AVAILABILITY_CODES;
      const { compatibility, version, relationships } = data;
      switch ( availability ) {

        // Unsafe
        case codes.UNKNOWN:
        case codes.REQUIRES_CORE_DOWNGRADE:
        case codes.REQUIRES_CORE_UPGRADE_STABLE:
        case codes.REQUIRES_CORE_UPGRADE_UNSTABLE:
          const labels = {
            [codes.UNKNOWN]: "SETUP.CompatibilityUnknown",
            [codes.REQUIRES_CORE_DOWNGRADE]: "SETUP.RequireCoreDowngrade",
            [codes.REQUIRES_CORE_UPGRADE_STABLE]: "SETUP.RequireCoreUpgrade",
            [codes.REQUIRES_CORE_UPGRADE_UNSTABLE]: "SETUP.RequireCoreUnstable"
          };
          return {
            type: "error",
            tooltip: game.i18n.localize(labels[availability]),
            label: version,
            icon: "fa fa-file-slash"
          };

        case codes.MISSING_SYSTEM:
          return {
            type: "error",
            tooltip: game.i18n.format("SETUP.RequireDep", { dependencies: data.system }),
            label: version,
            icon: "fa fa-file-slash"
          };

        case codes.MISSING_DEPENDENCY:
        case codes.REQUIRES_DEPENDENCY_UPDATE:
          return {
            type: "error",
            label: version,
            icon: "fa fa-file-slash",
            tooltip: this._formatBadDependenciesTooltip(availability, data, relationships.requires, {
              modules, systems
            })
          };

        // Warning
        case codes.UNVERIFIED_GENERATION:
          return {
            type: "warning",
            tooltip: game.i18n.format("SETUP.CompatibilityRiskWithVersion", { version: compatibility.verified }),
            label: version,
            icon: "fas fa-exclamation-triangle"
          };

        case codes.UNVERIFIED_SYSTEM:
          return {
            type: "warning",
            label: version,
            icon: "fas fa-exclamation-triangle",
            tooltip: this._formatIncompatibleSystemsTooltip(data, relationships.systems, { systems })
          };

        // Neutral
        case codes.UNVERIFIED_BUILD:
          return {
            type: "neutral",
            tooltip: game.i18n.format("SETUP.CompatibilityRiskWithVersion", { version: compatibility.verified }),
            label: version,
            icon: "fas fa-code-branch"
          };

        // Safe
        case codes.VERIFIED:
          return {
            type: "success",
            tooltip: game.i18n.localize("SETUP.Verified"),
            label: version,
            icon: "fas fa-code-branch"
          };
      }
      return null;
    }

    /* -------------------------------------------- */

    /**
     * List missing dependencies and format them for display.
     * @param {number} availability                The availability value.
     * @param {Partial<PackageManifestData>} data  The compatibility data.
     * @param {Iterable<RelatedPackage>} deps      The dependencies to format.
     * @param {object} [options]
     * @param {Collection<string, Module>} [options.modules]  A specific collection of modules to test availability
     *                                                        against. Tests against the currently installed modules by
     *                                                        default.
     * @param {Collection<string, System>} [options.systems]  A specific collection of systems to test availability
     *                                                        against. Tests against the currently installed systems by
     *                                                        default.
     * @returns {string}
     * @protected
     */
    static _formatBadDependenciesTooltip(availability, data, deps, { modules, systems }={}) {
      modules ??= game.modules;
      systems ??= game.systems;
      const codes = CONST.PACKAGE_AVAILABILITY_CODES;
      const checked = new Set();
      const bad = [];
      for ( const dep of deps ) {
        if ( (dep.type !== "module") || checked.has(dep.id) ) continue;
        if ( !modules.has(dep.id) ) bad.push(dep.id);
        else if ( availability === codes.REQUIRES_DEPENDENCY_UPDATE ) {
          const module = modules.get(dep.id);
          if ( module.availability !== codes.VERIFIED ) bad.push(dep.id);
        }
        checked.add(dep.id);
      }
      const label = availability === codes.MISSING_DEPENDENCY ? "SETUP.RequireDep" : "SETUP.IncompatibleDep";
      const formatter = game.i18n.getListFormatter({ style: "short", type: "unit" });
      return game.i18n.format(label, { dependencies: formatter.format(bad) });
    }

    /* -------------------------------------------- */

    /**
     * List any installed systems that are incompatible with this module's systems relationship, and format them for
     * display.
     * @param {Partial<PackageManifestData>} data             The compatibility data.
     * @param {Iterable<RelatedPackage>} relationships        The system relationships.
     * @param {object} [options]
     * @param {Collection<string, System>} [options.systems]  A specific collection of systems to test against. Tests
     *                                                        against the currently installed systems by default.
     * @returns {string}
     * @protected
     */
    static _formatIncompatibleSystemsTooltip(data, relationships, { systems }={}) {
      systems ??= game.systems;
      const incompatible = [];
      for ( const { id, compatibility } of relationships ) {
        const system = systems.get(id);
        if ( !system ) continue;
        if ( !this.testDependencyCompatibility(compatibility, system) || system.unavailable ) incompatible.push(id);
      }
      const label = incompatible.length ? "SETUP.IncompatibleSystems" : "SETUP.NoSupportedSystem";
      const formatter = game.i18n.getListFormatter({ style: "short", type: "unit" });
      return game.i18n.format(label, { systems: formatter.format(incompatible) });
    }

    /* ----------------------------------------- */

    /**
     * When a package has been installed, add it to the local game data.
     */
    install() {
      const collection = this.constructor.collection;
      game.data[collection].push(this.toObject());
      game[collection].set(this.id, this);
    }

    /* ----------------------------------------- */

    /**
     * When a package has been uninstalled, remove it from the local game data.
     */
    uninstall() {
      this.constructor.uninstall(this.id);
    }

    /* -------------------------------------------- */

    /**
     * Remove a package from the local game data when it has been uninstalled.
     * @param {string} id  The package ID.
     */
    static uninstall(id) {
      game.data[this.collection].findSplice(p => p.id === id);
      game[this.collection].delete(id);
    }

    /* -------------------------------------------- */

    /**
     * Retrieve the latest Package manifest from a provided remote location.
     * @param {string} manifest                 A remote manifest URL to load
     * @param {object} options                  Additional options which affect package construction
     * @param {boolean} [options.strict=true]   Whether to construct the remote package strictly
     * @returns {Promise<ClientPackage|null>}   A Promise which resolves to a constructed ServerPackage instance
     * @throws                                  An error if the retrieved manifest data is invalid
     */
    static async fromRemoteManifest(manifest, {strict=false}={}) {
      try {
        const data = await Setup.post({action: "getPackageFromRemoteManifest", type: this.type, manifest});
        return new this(data, {installed: false, strict: strict});
      }
      catch(e) {
        return null;
      }
    }
  }
  return ClientPackage;
}

/**
 * @extends foundry.packages.BaseModule
 * @mixes ClientPackageMixin
 * @category - Packages
 */
class Module extends ClientPackageMixin(foundry.packages.BaseModule) {
  constructor(data, options = {}) {
    const {active} = data;
    super(data, options);

    /**
     * Is this package currently active?
     * @type {boolean}
     */
    Object.defineProperty(this, "active", {value: active, writable: false});
  }
}

/* ---------------------------------------- */

/**
 * @extends foundry.packages.BaseSystem
 * @mixes ClientPackageMixin
 * @category - Packages
 */
class System extends ClientPackageMixin(foundry.packages.BaseSystem) {
  constructor(data, options={}) {
    options.strictDataCleaning = data.strictDataCleaning;
    super(data, options);
  }

  /** @inheritDoc */
  _configure(options) {
    super._configure(options);
    this.strictDataCleaning = !!options.strictDataCleaning;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  get template() {
    foundry.utils.logCompatibilityWarning("System#template is deprecated in favor of System#documentTypes",
      {since: 12, until: 14});
    return game.model;
  }
}

/* ---------------------------------------- */

/**
 * @extends foundry.packages.BaseWorld
 * @mixes ClientPackageMixin
 * @category - Packages
 */
class World extends ClientPackageMixin(foundry.packages.BaseWorld) {

  /** @inheritDoc */
  static getVersionBadge(availability, data, { modules, systems }={}) {
    modules ??= game.modules;
    systems ??= game.systems;
    const badge = super.getVersionBadge(availability, data, { modules, systems });
    if ( !badge ) return badge;
    const codes = CONST.PACKAGE_AVAILABILITY_CODES;
    if ( availability === codes.VERIFIED ) {
      const system = systems.get(data.system);
      if ( system.availability !== codes.VERIFIED ) badge.type = "neutral";
    }
    if ( !data.manifest ) badge.label = "";
    return badge;
  }

  /* -------------------------------------------- */

  /**
   * Provide data for a system badge displayed for the world which reflects the system ID and its availability
   * @param {System} [system]  A specific system to use, otherwise use the installed system.
   * @returns {PackageCompatibilityBadge|null}
   */
  getSystemBadge(system) {
    system ??= game.systems.get(this.system);
    if ( !system ) return {
      type: "error",
      tooltip: game.i18n.format("SETUP.RequireSystem", { system: this.system }),
      label: this.system,
      icon: "fa fa-file-slash"
    };
    const badge = system.getVersionBadge();
    if ( badge.type === "safe" ) {
      badge.type = "neutral";
      badge.icon = null;
    }
    badge.tooltip = `<p>${system.title}</p><p>${badge.tooltip}</p>`;
    badge.label = system.id;
    return badge;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  static _formatBadDependenciesTooltip(availability, data, deps) {
    const system = game.systems.get(data.system);
    if ( system ) deps ??= [...data.relationships.requires.values(), ...system.relationships.requires.values()];
    return super._formatBadDependenciesTooltip(availability, data, deps);
  }
}

/* ---------------------------------------- */

/**
 * A mapping of allowed package types and the classes which implement them.
 * @type {{world: World, system: System, module: Module}}
 */
const PACKAGE_TYPES = {
  world: World,
  system: System,
  module: Module
};
