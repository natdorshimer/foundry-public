import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as CONST from "../constants.mjs";
import * as documents from "./_module.mjs";
import * as fields from "../data/fields.mjs";

/**
 * @typedef {import("./_types.mjs").PlaylistData} PlaylistData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Playlist Document.
 * Defines the DataSchema and common behaviors for a Playlist which are shared between both client and server.
 * @mixes PlaylistData
 */
export default class BasePlaylist extends Document {
  /**
   * Construct a Playlist document using provided data and context.
   * @param {Partial<PlaylistData>} data            Initial data from which to construct the Playlist
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
    name: "Playlist",
    collection: "playlists",
    indexed: true,
    compendiumIndexFields: ["_id", "name", "description", "sort", "folder"],
    embedded: {PlaylistSound: "sounds"},
    label: "DOCUMENT.Playlist",
    labelPlural: "DOCUMENT.Playlists",
    permissions: {
      create: "PLAYLIST_CREATE"
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: false, textSearch: true}),
      description: new fields.StringField({textSearch: true}),
      sounds: new fields.EmbeddedCollectionField(documents.BasePlaylistSound),
      channel: new fields.StringField({choices: CONST.AUDIO_CHANNELS, initial: "music", blank: false}),
      mode: new fields.NumberField({required: true, choices: Object.values(CONST.PLAYLIST_MODES),
        initial: CONST.PLAYLIST_MODES.SEQUENTIAL, validationError: "must be a value in CONST.PLAYLIST_MODES"}),
      playing: new fields.BooleanField(),
      fade: new fields.NumberField({positive: true}),
      folder: new fields.ForeignDocumentField(documents.BaseFolder),
      sorting: new fields.StringField({required: true, choices: Object.values(CONST.PLAYLIST_SORT_MODES),
        initial: CONST.PLAYLIST_SORT_MODES.ALPHABETICAL,
        validationError: "must be a value in CONST.PLAYLIST_SORTING_MODES"}),
      seed: new fields.NumberField({integer: true, min: 0}),
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
