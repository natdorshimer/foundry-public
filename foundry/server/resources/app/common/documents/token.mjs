import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as CONST from "../constants.mjs";
import * as documents from "./_module.mjs";
import * as fields from "../data/fields.mjs";
import {LightData, TextureData} from "../data/data.mjs";

/**
 * @typedef {import("./_types.mjs").TokenData} TokenData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Token Document.
 * Defines the DataSchema and common behaviors for a Token which are shared between both client and server.
 * @mixes TokenData
 */
export default class BaseToken extends Document {
  /**
   * Construct a Token document using provided data and context.
   * @param {Partial<TokenData>} data               Initial data from which to construct the Token
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
    name: "Token",
    collection: "tokens",
    label: "DOCUMENT.Token",
    labelPlural: "DOCUMENT.Tokens",
    isEmbedded: true,
    embedded: {
      ActorDelta: "delta"
    },
    permissions: {
      create: "TOKEN_CREATE",
      update: this.#canUpdate,
      delete: "TOKEN_DELETE"
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: true, textSearch: true}),
      displayName: new fields.NumberField({required: true, initial: CONST.TOKEN_DISPLAY_MODES.NONE,
        choices: Object.values(CONST.TOKEN_DISPLAY_MODES),
        validationError: "must be a value in CONST.TOKEN_DISPLAY_MODES"
      }),
      actorId: new fields.ForeignDocumentField(documents.BaseActor, {idOnly: true}),
      actorLink: new fields.BooleanField(),
      delta: new ActorDeltaField(documents.BaseActorDelta),
      appendNumber: new fields.BooleanField(),
      prependAdjective: new fields.BooleanField(),
      width: new fields.NumberField({nullable: false, positive: true, initial: 1, step: 0.5, label: "Width"}),
      height: new fields.NumberField({nullable: false, positive: true, initial: 1, step: 0.5, label: "Height"}),
      texture: new TextureData({}, {initial: {src: () => this.DEFAULT_ICON, anchorX: 0.5, anchorY: 0.5, fit: "contain",
        alphaThreshold: 0.75}, wildcard: true}),
      hexagonalShape: new fields.NumberField({initial: CONST.TOKEN_HEXAGONAL_SHAPES.ELLIPSE_1,
        choices: Object.values(CONST.TOKEN_HEXAGONAL_SHAPES)}),
      x: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0, label: "XCoord"}),
      y: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0, label: "YCoord"}),
      elevation: new fields.NumberField({required: true, nullable: false, initial: 0}),
      sort: new fields.NumberField({required: true, integer: true, nullable: false, initial: 0}),
      locked: new fields.BooleanField(),
      lockRotation: new fields.BooleanField(),
      rotation: new fields.AngleField(),
      alpha: new fields.AlphaField(),
      hidden: new fields.BooleanField(),
      disposition: new fields.NumberField({required: true, choices: Object.values(CONST.TOKEN_DISPOSITIONS),
        initial: CONST.TOKEN_DISPOSITIONS.HOSTILE,
        validationError: "must be a value in CONST.TOKEN_DISPOSITIONS"
      }),
      displayBars: new fields.NumberField({required: true, choices: Object.values(CONST.TOKEN_DISPLAY_MODES),
        initial: CONST.TOKEN_DISPLAY_MODES.NONE,
        validationError: "must be a value in CONST.TOKEN_DISPLAY_MODES"
      }),
      bar1: new fields.SchemaField({
        attribute: new fields.StringField({required: true, nullable: true, blank: false,
          initial: () => game?.system.primaryTokenAttribute || null})
      }),
      bar2: new fields.SchemaField({
        attribute: new fields.StringField({required: true, nullable: true, blank: false,
          initial: () => game?.system.secondaryTokenAttribute || null})
      }),
      light: new fields.EmbeddedDataField(LightData),
      sight: new fields.SchemaField({
        enabled: new fields.BooleanField({initial: data => Number(data?.sight?.range) > 0}),
        range: new fields.NumberField({required: true, nullable: true, min: 0, step: 0.01, initial: 0}),
        angle: new fields.AngleField({initial: 360, normalize: false}),
        visionMode: new fields.StringField({required: true, blank: false, initial: "basic",
          label: "TOKEN.VisionMode", hint: "TOKEN.VisionModeHint"}),
        color: new fields.ColorField({label: "TOKEN.VisionColor"}),
        attenuation: new fields.AlphaField({initial: 0.1, label: "TOKEN.VisionAttenuation", hint: "TOKEN.VisionAttenuationHint"}),
        brightness: new fields.NumberField({required: true, nullable: false, initial: 0, min: -1, max: 1,
          label: "TOKEN.VisionBrightness", hint: "TOKEN.VisionBrightnessHint"}),
        saturation: new fields.NumberField({required: true, nullable: false, initial: 0, min: -1, max: 1,
          label: "TOKEN.VisionSaturation", hint: "TOKEN.VisionSaturationHint"}),
        contrast: new fields.NumberField({required: true, nullable: false, initial: 0, min: -1, max: 1,
          label: "TOKEN.VisionContrast", hint: "TOKEN.VisionContrastHint"})
      }),
      detectionModes: new fields.ArrayField(new fields.SchemaField({
        id: new fields.StringField(),
        enabled: new fields.BooleanField({initial: true}),
        range: new fields.NumberField({required: true, min: 0, step: 0.01})
      }), {
        validate: BaseToken.#validateDetectionModes
      }),
      occludable: new fields.SchemaField({
        radius: new fields.NumberField({nullable: false, min: 0, step: 0.01, initial: 0})
      }),
      ring: new fields.SchemaField({
        enabled: new fields.BooleanField(),
        colors: new fields.SchemaField({
          ring: new fields.ColorField(),
          background: new fields.ColorField()
        }),
        effects: new fields.NumberField({initial: 1, min: 0, max: 8388607, integer: true}),
        subject: new fields.SchemaField({
          scale: new fields.NumberField({initial: 1, min: 0.5}),
          texture: new fields.FilePathField({categories: ["IMAGE"]})
        })
      }),
      /** @internal */
      _regions: new fields.ArrayField(new fields.ForeignDocumentField(documents.BaseRegion, {idOnly: true})),
      flags: new fields.ObjectField()
    }
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["TOKEN"];

  /* -------------------------------------------- */

  /**
   * Validate the structure of the detection modes array
   * @param {object[]} modes    Configured detection modes
   * @throws                    An error if the array is invalid
   */
  static #validateDetectionModes(modes) {
    const seen = new Set();
    for ( const mode of modes ) {
      if ( mode.id === "" ) continue;
      if ( seen.has(mode.id) ) {
        throw new Error(`may not have more than one configured detection mode of type "${mode.id}"`);
      }
      seen.add(mode.id);
    }
  }

  /* -------------------------------------------- */

  /**
   * The default icon used for newly created Token documents
   * @type {string}
   */
  static DEFAULT_ICON = CONST.DEFAULT_TOKEN;

  /**
   * Is a user able to update an existing Token?
   * @private
   */
  static #canUpdate(user, doc, data) {
    if ( user.isGM ) return true;                     // GM users can do anything
    if ( doc.actor ) {                                // You can update Tokens for Actors you control
      return doc.actor.canUserModify(user, "update", data);
    }
    return !!doc.actorId;                             // It would be good to harden this in the future
  }

  /** @override */
  testUserPermission(user, permission, {exact=false} = {}) {
    if ( this.actor ) return this.actor.testUserPermission(user, permission, {exact});
    else return super.testUserPermission(user, permission, {exact});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  updateSource(changes={}, options={}) {
    const diff = super.updateSource(changes, options);

    // A copy of the source data is taken for the _backup in updateSource. When this backup is applied as part of a dry-
    // run, if a child singleton embedded document was updated, the reference to its source is broken. We restore it
    // here.
    if ( options.dryRun && ("delta" in changes) ) this._source.delta = this.delta._source;

    return diff;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  toObject(source=true) {
    const obj = super.toObject(source);
    obj.delta = this.delta ? this.delta.toObject(source) : null;
    return obj;
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static migrateData(data) {

    // Remember that any migrations defined here may also be required for the PrototypeToken model.

    /**
     * Migration of actorData field to ActorDelta document.
     * @deprecated since v11
     */
    if ( ("actorData" in data) && !("delta" in data) ) {
      data.delta = data.actorData;
      if ( "_id" in data ) data.delta._id = data._id;
    }
    return super.migrateData(data);
  }

  /* ----------------------------------------- */

  /** @inheritdoc */
  static shimData(data, options) {

    // Remember that any shims defined here may also be required for the PrototypeToken model.

    this._addDataFieldShim(data, "actorData", "delta", {value: data.delta, since: 11, until: 13});
    this._addDataFieldShim(data, "effects", undefined, {value: [], since: 12, until: 14,
      warning: "TokenDocument#effects is deprecated in favor of using ActiveEffect"
        + " documents on the associated Actor"});
    this._addDataFieldShim(data, "overlayEffect", undefined, {value: "", since: 12, until: 14,
      warning: "TokenDocument#overlayEffect is deprecated in favor of using" +
        " ActiveEffect documents on the associated Actor"});
    return super.shimData(data, options);
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  get effects() {
    foundry.utils.logCompatibilityWarning("TokenDocument#effects is deprecated in favor of using ActiveEffect"
      + " documents on the associated Actor", {since: 12, until: 14, once: true});
    return [];
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  get overlayEffect() {
    foundry.utils.logCompatibilityWarning("TokenDocument#overlayEffect is deprecated in favor of using" +
      " ActiveEffect documents on the associated Actor", {since: 12, until: 14, once: true});
    return "";
  }
}

/* -------------------------------------------- */

/**
 * A special subclass of EmbeddedDocumentField which allows construction of the ActorDelta to be lazily evaluated.
 */
export class ActorDeltaField extends fields.EmbeddedDocumentField {
  /** @inheritdoc */
  initialize(value, model, options = {}) {
    if ( !value ) return value;
    const descriptor = Object.getOwnPropertyDescriptor(model, this.name);
    if ( (descriptor === undefined) || (!descriptor.get && !descriptor.value) ) {
      return () => {
        const m = new this.model(value, {...options, parent: model, parentCollection: this.name});
        Object.defineProperty(m, "schema", {value: this});
        Object.defineProperty(model, this.name, {
          value: m,
          configurable: true,
          writable: true
        });
        return m;
      };
    }
    else if ( descriptor.get instanceof Function ) return descriptor.get;
    model[this.name]._initialize(options);
    return model[this.name];
  }
}
