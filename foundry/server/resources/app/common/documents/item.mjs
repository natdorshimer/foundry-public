import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as documents from "./_module.mjs";
import * as fields from "../data/fields.mjs";

/**
 * @typedef {import("./_types.mjs").ItemData} ItemData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Item Document.
 * Defines the DataSchema and common behaviors for a Item which are shared between both client and server.
 * @mixes ItemData
 */
export default class BaseItem extends Document {
  /**
   * Construct a Item document using provided data and context.
   * @param {Partial<ItemData>} data                Initial data from which to construct the Item
   * @param {DocumentConstructionContext} context   Construction context options
   */
  constructor(data, context) {
    super(data, context);
  }

  /* -------------------------------------------- */
  /*  Model Configuration                         */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static metadata = Object.freeze(mergeObject(super.metadata, {
    name: "Item",
    collection: "items",
    hasTypeData: true,
    indexed: true,
    compendiumIndexFields: ["_id", "name", "img", "type", "sort", "folder"],
    embedded: {ActiveEffect: "effects"},
    label: "DOCUMENT.Item",
    labelPlural: "DOCUMENT.Items",
    permissions: {create: "ITEM_CREATE"},
    schemaVersion: "12.324"
  }, {inplace: false}));

  /* ---------------------------------------- */

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: false, textSearch: true}),
      type: new fields.DocumentTypeField(this),
      img: new fields.FilePathField({categories: ["IMAGE"], initial: data => {
        return this.implementation.getDefaultArtwork(data).img;
      }}),
      system: new fields.TypeDataField(this),
      effects: new fields.EmbeddedCollectionField(documents.BaseActiveEffect),
      folder: new fields.ForeignDocumentField(documents.BaseFolder),
      sort: new fields.IntegerSortField(),
      ownership: new fields.DocumentOwnershipField(),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    }
  }

  /* ---------------------------------------- */

  /**
   * The default icon used for newly created Item documents
   * @type {string}
   */
  static DEFAULT_ICON = "icons/svg/item-bag.svg";

  /* -------------------------------------------- */

  /**
   * Determine default artwork based on the provided item data.
   * @param {ItemData} itemData  The source item data.
   * @returns {{img: string}}    Candidate item image.
   */
  static getDefaultArtwork(itemData) {
    return { img: this.DEFAULT_ICON };
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  canUserModify(user, action, data={}) {
    if ( this.isEmbedded ) return this.parent.canUserModify(user, "update");
    return super.canUserModify(user, action, data);
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  testUserPermission(user, permission, {exact=false}={}) {
    if ( this.isEmbedded ) return this.parent.testUserPermission(user, permission, {exact});
    return super.testUserPermission(user, permission, {exact});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(source) {
    /**
     * Migrate sourceId.
     * @deprecated since v12
     */
    this._addDataFieldMigration(source, "flags.core.sourceId", "_stats.compendiumSource");

    return super.migrateData(source);
  }
}
