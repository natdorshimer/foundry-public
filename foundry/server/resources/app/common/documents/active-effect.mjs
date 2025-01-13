import Document from "../abstract/document.mjs";
import * as CONST from "../constants.mjs";
import * as documents from "./_module.mjs";
import * as fields from "../data/fields.mjs";
import {mergeObject} from "../utils/helpers.mjs";

/**
 * @typedef {import("./_types.mjs").ActiveEffectData} ActiveEffectData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The ActiveEffect Document.
 * Defines the DataSchema and common behaviors for an ActiveEffect which are shared between both client and server.
 * @mixes {@link ActiveEffectData}
 */
export default class BaseActiveEffect extends Document {
  /**
   * Construct an ActiveEffect document using provided data and context.
   * @param {Partial<ActiveEffectData>} data        Initial data from which to construct the ActiveEffect
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
    name: "ActiveEffect",
    collection: "effects",
    hasTypeData: true,
    label: "DOCUMENT.ActiveEffect",
    labelPlural: "DOCUMENT.ActiveEffects",
    schemaVersion: "12.324"
  }, {inplace: false}));

  /* -------------------------------------------- */

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: false, label: "EFFECT.Name", textSearch: true}),
      img: new fields.FilePathField({categories: ["IMAGE"], label: "EFFECT.Image"}),
      type: new fields.DocumentTypeField(this, {initial: CONST.BASE_DOCUMENT_TYPE}),
      system: new fields.TypeDataField(this),
      changes: new fields.ArrayField(new fields.SchemaField({
        key: new fields.StringField({required: true, label: "EFFECT.ChangeKey"}),
        value: new fields.StringField({required: true, label: "EFFECT.ChangeValue"}),
        mode: new fields.NumberField({integer: true, initial: CONST.ACTIVE_EFFECT_MODES.ADD,
          label: "EFFECT.ChangeMode"}),
        priority: new fields.NumberField()
      })),
      disabled: new fields.BooleanField(),
      duration: new fields.SchemaField({
        startTime: new fields.NumberField({initial: null, label: "EFFECT.StartTime"}),
        seconds: new fields.NumberField({integer: true, min: 0, label: "EFFECT.DurationSecs"}),
        combat: new fields.ForeignDocumentField(documents.BaseCombat, {label: "EFFECT.Combat"}),
        rounds: new fields.NumberField({integer: true, min: 0}),
        turns: new fields.NumberField({integer: true, min: 0, label: "EFFECT.DurationTurns"}),
        startRound: new fields.NumberField({integer: true, min: 0}),
        startTurn: new fields.NumberField({integer: true, min: 0, label: "EFFECT.StartTurns"})
      }),
      description: new fields.HTMLField({label: "EFFECT.Description", textSearch: true}),
      origin: new fields.StringField({nullable: true, blank: false, initial: null, label: "EFFECT.Origin"}),
      tint: new fields.ColorField({nullable: false, initial: "#ffffff", label: "EFFECT.Tint"}),
      transfer: new fields.BooleanField({initial: true, label: "EFFECT.Transfer"}),
      statuses: new fields.SetField(new fields.StringField({required: true, blank: false})),
      sort: new fields.IntegerSortField(),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    }
  }

  /* -------------------------------------------- */
  /*  Model Methods                               */
  /* -------------------------------------------- */

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
  /*  Database Event Handlers                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if ( allowed === false ) return false;
    if ( this.parent instanceof documents.BaseActor ) {
      this.updateSource({transfer: false});
    }
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(data) {
    /**
     * label -> name
     * @deprecated since v11
     */
    this._addDataFieldMigration(data, "label", "name", d => d.label || "Unnamed Effect");
    /**
     * icon -> img
     * @deprecated since v12
     */
    this._addDataFieldMigration(data, "icon", "img");
    return super.migrateData(data);
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  static shimData(data, options) {
    this._addDataFieldShim(data, "label", "name", {since: 11, until: 13});
    this._addDataFieldShim(data, "icon", "img", {since: 12, until: 14});
    return super.shimData(data, options);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v11
   * @ignore
   */
  get label() {
    this.constructor._logDataFieldMigration("label", "name", {since: 11, until: 13, once: true});
    return this.name;
  }

  /**
   * @deprecated since v11
   * @ignore
   */
  set label(value) {
    this.constructor._logDataFieldMigration("label", "name", {since: 11, until: 13, once: true});
    this.name = value;
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get icon() {
    this.constructor._logDataFieldMigration("icon", "img", {since: 12, until: 14, once: true});
    return this.img;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  set icon(value) {
    this.constructor._logDataFieldMigration("icon", "img", {since: 12, until: 14, once: true});
    this.img = value;
  }
}
