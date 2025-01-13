import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";
import * as documents from "./_module.mjs";
import * as CONST from "../constants.mjs";

/**
 * @typedef {import("./_types.mjs").CardsData} CardsData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Cards Document.
 * Defines the DataSchema and common behaviors for a Cards Document which are shared between both client and server.
 * @mixes CardsData
 */
export default class BaseCards extends Document {
  /**
   * Construct a Cards document using provided data and context.
   * @param {Partial<CardsData>} data               Initial data from which to construct the Cards
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
    name: "Cards",
    collection: "cards",
    indexed: true,
    compendiumIndexFields: ["_id", "name", "description", "img", "type", "sort", "folder"],
    embedded: {Card: "cards"},
    hasTypeData: true,
    label: "DOCUMENT.Cards",
    labelPlural: "DOCUMENT.CardsPlural",
    permissions: {create: "CARDS_CREATE"},
    coreTypes: ["deck", "hand", "pile"],
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: false, label: "CARDS.Name", textSearch: true}),
      type: new fields.DocumentTypeField(this),
      description: new fields.HTMLField({label: "CARDS.Description", textSearch: true}),
      img: new fields.FilePathField({categories: ["IMAGE", "VIDEO"], initial: () => this.DEFAULT_ICON,
        label: "CARDS.Image"}),
      system: new fields.TypeDataField(this),
      cards: new fields.EmbeddedCollectionField(documents.BaseCard),
      width: new fields.NumberField({integer: true, positive: true, label: "Width"}),
      height: new fields.NumberField({integer: true, positive: true, label: "Height"}),
      rotation: new fields.AngleField({label: "Rotation"}),
      displayCount: new fields.BooleanField(),
      folder: new fields.ForeignDocumentField(documents.BaseFolder),
      sort: new fields.IntegerSortField(),
      ownership: new fields.DocumentOwnershipField(),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    }
  }

  /**
   * The default icon used for a cards stack that does not have a custom image set
   * @type {string}
   */
  static DEFAULT_ICON = "icons/svg/card-hand.svg";

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
