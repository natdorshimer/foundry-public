import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as fields from "../data/fields.mjs";
import * as CONST from "../constants.mjs";
import * as documents from "./_module.mjs";

/**
 * @typedef {import("./_types.mjs").ChatMessageData} ChatMessageData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The ChatMessage Document.
 * Defines the DataSchema and common behaviors for a ChatMessage which are shared between both client and server.
 * @mixes ChatMessageData
 */
export default class BaseChatMessage extends Document {
  /**
   * Construct a Cards document using provided data and context.
   * @param {Partial<ChatMessageData>} data         Initial data from which to construct the ChatMessage
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
    name: "ChatMessage",
    collection: "messages",
    label: "DOCUMENT.ChatMessage",
    labelPlural: "DOCUMENT.ChatMessages",
    hasTypeData: true,
    isPrimary: true,
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
      type: new fields.DocumentTypeField(this, {initial: CONST.BASE_DOCUMENT_TYPE}),
      system: new fields.TypeDataField(this),
      style: new fields.NumberField({required: true, choices: Object.values(CONST.CHAT_MESSAGE_STYLES),
        initial: CONST.CHAT_MESSAGE_STYLES.OTHER, validationError: "must be a value in CONST.CHAT_MESSAGE_STYLES"}),
      author: new fields.ForeignDocumentField(documents.BaseUser, {nullable: false, initial: () => game?.user?.id}),
      timestamp: new fields.NumberField({required: true, nullable: false, initial: Date.now}),
      flavor: new fields.HTMLField(),
      content: new fields.HTMLField({textSearch: true}),
      speaker: new fields.SchemaField({
        scene: new fields.ForeignDocumentField(documents.BaseScene, {idOnly: true}),
        actor: new fields.ForeignDocumentField(documents.BaseActor, {idOnly: true}),
        token: new fields.ForeignDocumentField(documents.BaseToken, {idOnly: true}),
        alias: new fields.StringField()
      }),
      whisper: new fields.ArrayField(new fields.ForeignDocumentField(documents.BaseUser, {idOnly: true})),
      blind: new fields.BooleanField(),
      rolls: new fields.ArrayField(new fields.JSONField({validate: BaseChatMessage.#validateRoll})),
      sound: new fields.FilePathField({categories: ["AUDIO"]}),
      emote: new fields.BooleanField(),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    };
  }

  /**
   * Is a user able to create a new chat message?
   */
  static #canCreate(user, doc) {
    if ( user.isGM ) return true;
    if ( user.id !== doc._source.author ) return false; // You cannot impersonate a different user
    return user.hasRole("PLAYER");                      // Any player can create messages
  }

  /**
   * Is a user able to update an existing chat message?
   */
  static #canUpdate(user, doc, data) {
    if ( user.isGM ) return true;                       // GM users can do anything
    if ( user.id !== doc._source.author ) return false; // Otherwise, message authors
    if ( ("author" in data) && (data.author !== user.id) ) return false; // Message author is immutable
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Validate that Rolls belonging to the ChatMessage document are valid
   * @param {string} rollJSON     The serialized Roll data
   */
  static #validateRoll(rollJSON) {
    const roll = JSON.parse(rollJSON);
    if ( !roll.evaluated ) throw new Error(`Roll objects added to ChatMessage documents must be evaluated`);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  testUserPermission(user, permission, {exact=false}={}) {
    if ( !exact && (user.id === this._source.author) ) return true; // The user who created the chat message
    return super.testUserPermission(user, permission, {exact});
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static migrateData(data) {
    /**
     * V12 migration from user to author
     * @deprecated since v12
     */
    this._addDataFieldMigration(data, "user", "author");
    BaseChatMessage.#migrateTypeToStyle(data);
    return super.migrateData(data);
  }

  /* ---------------------------------------- */

  /**
   * Migrate the type field to the style field in order to allow the type field to be used for system sub-types.
   * @param {Partial<ChatMessageData>} data
   */
  static #migrateTypeToStyle(data) {
    if ( (typeof data.type !== "number") || ("style" in data) ) return;
    // WHISPER, ROLL, and any other invalid style are redirected to OTHER
    data.style = Object.values(CONST.CHAT_MESSAGE_STYLES).includes(data.type) ? data.type : 0;
    data.type = CONST.BASE_DOCUMENT_TYPE;
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  static shimData(data, options) {
    this._addDataFieldShim(data, "user", "author", {since: 12, until: 14})
    return super.shimData(data, options);
  }

  /* ---------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get user() {
    this.constructor._logDataFieldMigration("user", "author", {since: 12, until: 14});
    return this.author;
  }
}
