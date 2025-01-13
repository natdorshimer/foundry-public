import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";
import * as documents from "./_module.mjs";

/**
 * @typedef {import("./_types.mjs").FogExplorationData} FogExplorationData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The FogExploration Document.
 * Defines the DataSchema and common behaviors for a FogExploration which are shared between both client and server.
 * @mixes FogExplorationData
 */
export default class BaseFogExploration extends Document {
  /**
   * Construct a FogExploration document using provided data and context.
   * @param {Partial<FogExplorationData>} data      Initial data from which to construct the FogExploration
   * @param {DocumentConstructionContext} context   Construction context options
   */
  constructor(data, context) {
    super(data, context);
  }

  /* ---------------------------------------- */
  /*  Model Configuration                     */
  /* ---------------------------------------- */

  /** @inheritdoc */
  static metadata = Object.freeze(mergeObject(super.metadata, {
    name: "FogExploration",
    collection: "fog",
    label: "DOCUMENT.FogExploration",
    labelPlural: "DOCUMENT.FogExplorations",
    isPrimary: true,
    permissions: {
      create: "PLAYER",
      update: this.#canModify,
      delete: this.#canModify
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      scene: new fields.ForeignDocumentField(documents.BaseScene, {initial: () => canvas?.scene?.id}),
      user: new fields.ForeignDocumentField(documents.BaseUser, {initial: () => game?.user?.id}),
      explored: new fields.FilePathField({categories: ["IMAGE"], required: true, base64: true}),
      positions: new fields.ObjectField(),
      timestamp: new fields.NumberField({nullable: false, initial: Date.now}),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    }
  }

  /**
   * Test whether a User can modify a FogExploration document.
   */
  static #canModify(user, doc) {
    return (user.id === doc._source.user) || user.hasRole("ASSISTANT");
  }

  /* ---------------------------------------- */
  /*  Database Event Handlers                 */
  /* ---------------------------------------- */

  /** @inheritDoc */
  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if ( allowed === false ) return false;
    changed.timestamp = Date.now();
  }
}
