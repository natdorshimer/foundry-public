import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";
import * as documents from "./_module.mjs";

/**
 * @typedef {import("./_types.mjs").JournalEntryData} JournalEntryData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The JournalEntry Document.
 * Defines the DataSchema and common behaviors for a JournalEntry which are shared between both client and server.
 * @mixes JournalEntryData
 */
export default class BaseJournalEntry extends Document {
  /**
   * Construct a JournalEntry document using provided data and context.
   * @param {Partial<JournalEntryData>} data        Initial data from which to construct the JournalEntry
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
    name: "JournalEntry",
    collection: "journal",
    indexed: true,
    compendiumIndexFields: ["_id", "name", "sort", "folder"],
    embedded: {JournalEntryPage: "pages"},
    label: "DOCUMENT.JournalEntry",
    labelPlural: "DOCUMENT.JournalEntries",
    permissions: {
      create: "JOURNAL_CREATE"
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: false, textSearch: true}),
      pages: new fields.EmbeddedCollectionField(documents.BaseJournalEntryPage),
      folder: new fields.ForeignDocumentField(documents.BaseFolder),
      sort: new fields.IntegerSortField(),
      ownership: new fields.DocumentOwnershipField(),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    }
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
