import BasePackage from "./base-package.mjs";
import * as fields from "../data/fields.mjs";
import AdditionalTypesField from "./sub-types.mjs";

/**
 * @typedef {import("./sub-types.mjs").DocumentTypesConfiguration} DocumentTypesConfiguration
 */

/**
 * The data schema used to define System manifest files.
 * Extends the basic PackageData schema with some additional system-specific fields.
 * @property {DocumentTypesConfiguration} [documentTypes]  Additional document subtypes provided by this system.
 * @property {string} [background]        A web URL or local file path which provides a default background banner for
 *                                        worlds which are created using this system
 * @property {string} [initiative]        A default initiative formula used for this system
 * @property {number} [grid]              The default grid settings to use for Scenes in this system
 * @property {number} [grid.type]         A default grid type to use for Scenes in this system
 * @property {number} [grid.distance]     A default distance measurement to use for Scenes in this system
 * @property {string} [grid.units]        A default unit of measure to use for distance measurement in this system
 * @property {number} [grid.diagonals]    The default rule used by this system for diagonal measurement on square grids
 * @property {string} [primaryTokenAttribute] An Actor data attribute path to use for Token primary resource bars
 * @property {string} [secondaryTokenAttribute] An Actor data attribute path to use for Token secondary resource bars
 */
export default class BaseSystem extends BasePackage {

  /** @inheritDoc */
  static defineSchema() {
    return Object.assign({}, super.defineSchema(), {
      documentTypes: new AdditionalTypesField(),
      background: new fields.StringField({required: false, blank: false}),
      initiative: new fields.StringField(),
      grid: new fields.SchemaField({
        type: new fields.NumberField({required: true, choices: Object.values(CONST.GRID_TYPES),
          initial: CONST.GRID_TYPES.SQUARE, validationError: "must be a value in CONST.GRID_TYPES"}),
        distance: new fields.NumberField({required: true, nullable: false, positive: true, initial: 1}),
        units: new fields.StringField({required: true}),
        diagonals: new fields.NumberField({required: true, choices: Object.values(CONST.GRID_DIAGONALS),
          initial: CONST.GRID_DIAGONALS.EQUIDISTANT, validationError: "must be a value in CONST.GRID_DIAGONALS"}),
      }),
      primaryTokenAttribute: new fields.StringField(),
      secondaryTokenAttribute: new fields.StringField()
    });
  }

  /** @inheritdoc */
  static type = "system";

  /**
   * The default icon used for this type of Package.
   * @type {string}
   */
  static icon = "fa-dice";

  /**
   * Does the system template request strict type checking of data compared to template.json inferred types.
   * @type {boolean}
   */
  strictDataCleaning = false;

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * Static initializer block for deprecated properties.
   */
  static {
    /**
     * Shim grid distance and units.
     * @deprecated since v12
     */
    Object.defineProperties(this.prototype, Object.fromEntries(
      Object.entries({
        gridDistance: "grid.distance",
        gridUnits: "grid.units"
      }).map(([o, n]) => [o, {
        get() {
          const msg = `You are accessing BasePackage#${o} which has been migrated to BasePackage#${n}.`;
          foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14});
          return foundry.utils.getProperty(this, n);
        },
        set(v) {
          const msg = `You are accessing BasePackage#${o} which has been migrated to BasePackage#${n}.`;
          foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14});
          return foundry.utils.setProperty(this, n, v);
        },
        configurable: true
      }])
    ));
  }

  /* -------------------------------------------- */

  /** @override */
  static migratedKeys = (function() {
    return BasePackage.migratedKeys.union(new Set([
      /** @deprecated since 12 until 14 */
      "gridDistance", "gridUnits"
    ]));
  })();

  /* ---------------------------------------- */

  /** @inheritdoc */
  static migrateData(data, options) {
    /**
     * Migrate grid distance and units.
     * @deprecated since v12
     */
    for ( const [oldKey, [newKey, apply]] of Object.entries({
      gridDistance: ["grid.distance", d => Math.max(d.gridDistance || 0, 1)],
      gridUnits: ["grid.units", d => d.gridUnits || ""]
    })) {
      if ( (oldKey in data) && !foundry.utils.hasProperty(data, newKey) ) {
        foundry.utils.setProperty(data, newKey, apply(data));
        delete data[oldKey];
        const warning = `The ${this.type} "${data.id}" is using "${oldKey}" which is deprecated in favor of "${newKey}".`;
        this._logWarning(data.id, warning, {since: 12, until: 14, stack: false, installed: options.installed});
      }
    }
    return super.migrateData(data, options);
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  static shimData(data, options) {
    /**
     * Shim grid distance and units.
     * @deprecated since v12
     */
    for ( const [oldKey, newKey] of Object.entries({
      gridDistance: "grid.distance",
      gridUnits: "grid.units"
    })) {
      if ( !data.hasOwnProperty(oldKey) && foundry.utils.hasProperty(data, newKey) ) {
        Object.defineProperty(data, oldKey, {
          get: () => {
            const msg = `You are accessing BasePackage#${oldKey} which has been migrated to BasePackage#${newKey}.`;
            foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14});
            return foundry.utils.getProperty(data, newKey);
          },
          set: value => foundry.utils.setProperty(data, newKey, value),
          configurable: true
        });
      }
    }
    return super.shimData(data, options);
  }
}
