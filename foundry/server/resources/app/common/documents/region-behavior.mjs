import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";

/**
 * @typedef {import("./_types.mjs").RegionBehaviorData} RegionBehaviorData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The RegionBehavior Document.
 * Defines the DataSchema and common behaviors for a RegionBehavior which are shared between both client and server.
 * @mixes SceneRegionData
 */
export default class BaseRegionBehavior extends Document {
  /**
   * Construct a RegionBehavior document using provided data and context.
   * @param {Partial<RegionBehaviorData>} data    Initial data from which to construct the RegionBehavior
   * @param {DocumentConstructionContext} context      Construction context options
   */
  constructor(data, context) {
    super(data, context);
  }

  /* -------------------------------------------- */
  /*  Model Configuration                         */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static metadata = Object.freeze(mergeObject(super.metadata, {
    name: "RegionBehavior",
    collection: "behaviors",
    label: "DOCUMENT.RegionBehavior",
    labelPlural: "DOCUMENT.RegionBehaviors",
    coreTypes: ["adjustDarknessLevel", "displayScrollingText", "executeMacro", "executeScript", "pauseGame", "suppressWeather", "teleportToken", "toggleBehavior"],
    hasTypeData: true,
    isEmbedded: true,
    permissions: {
      create: this.#canCreate,
      update: this.#canUpdate
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: true, label: "Name", textSearch: true}),
      type: new fields.DocumentTypeField(this),
      system: new fields.TypeDataField(this),
      disabled: new fields.BooleanField({label: "BEHAVIOR.FIELDS.disabled.label", hint: "BEHAVIOR.FIELDS.disabled.hint"}),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    };
  }

  /* -------------------------------------------- */

  /** @override */
  static canUserCreate(user) {
    return user.isGM;
  }

  /* ---------------------------------------- */

  /**
   * Is a user able to create the RegionBehavior document?
   */
  static #canCreate(user, doc) {
    if ( (doc._source.type === "executeScript") && !user.hasPermission("MACRO_SCRIPT") ) return false;
    return user.isGM;
  }

  /* ---------------------------------------- */

  /**
   * Is a user able to update the RegionBehavior document?
   */
  static #canUpdate(user, doc, data) {
    if ( (((doc._source.type === "executeScript") && ("system" in data) && ("source" in data.system))
      || (data.type === "executeScript")) && !user.hasPermission("MACRO_SCRIPT") ) return false;
    return user.isGM;
  }
}
