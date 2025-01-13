import Document from "../abstract/document.mjs";
import {deepClone, mergeObject} from "../utils/helpers.mjs";
import * as documents from "./_module.mjs";
import * as fields from "../data/fields.mjs";
import BaseActor from "./actor.mjs";

/**
 * @typedef {import("./_types.mjs").ActorDeltaData} ActorDeltaData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The ActorDelta Document.
 * Defines the DataSchema and common behaviors for an ActorDelta which are shared between both client and server.
 * ActorDeltas store a delta that can be applied to a particular Actor in order to produce a new Actor.
 * @mixes ActorDeltaData
 */
export default class BaseActorDelta extends Document {
  /**
   * Construct an ActorDelta document using provided data and context.
   * @param {Partial<ActorDeltaData>} data         Initial data used to construct the ActorDelta.
   * @param {DocumentConstructionContext} context  Construction context options.
   */
  constructor(data, context) {
    super(data, context);
  }

  /* -------------------------------------------- */
  /*  Model Configuration                         */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static metadata = Object.freeze(mergeObject(super.metadata, {
    name: "ActorDelta",
    collection: "delta",
    label: "DOCUMENT.ActorDelta",
    labelPlural: "DOCUMENT.ActorDeltas",
    isEmbedded: true,
    embedded: {
      Item: "items",
      ActiveEffect: "effects"
    },
    schemaVersion: "12.324"
  }, {inplace: false}));

  /** @override */
  static defineSchema() {
    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: false, nullable: true, initial: null}),
      type: new fields.StringField({required: false, nullable: true, initial: null}),
      img: new fields.FilePathField({categories: ["IMAGE"], nullable: true, initial: null, required: false}),
      system: new fields.ObjectField(),
      items: new fields.EmbeddedCollectionDeltaField(documents.BaseItem),
      effects: new fields.EmbeddedCollectionDeltaField(documents.BaseActiveEffect),
      ownership: new fields.DocumentOwnershipField({required: false, nullable: true, initial: null}),
      flags: new fields.ObjectField()
    };
  }

  /* -------------------------------------------- */

  /** @override */
  canUserModify(user, action, data={}) {
    return this.parent.canUserModify(user, action, data);
  }

  /* -------------------------------------------- */

  /** @override */
  testUserPermission(user, permission, { exact=false }={}) {
    return this.parent.testUserPermission(user, permission, { exact });
  }

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /**
   * Retrieve the base actor's collection, if it exists.
   * @param {string} collectionName  The collection name.
   * @returns {Collection}
   */
  getBaseCollection(collectionName) {
    const baseActor = this.parent?.baseActor;
    return baseActor?.getEmbeddedCollection(collectionName);
  }

  /* -------------------------------------------- */

  /**
   * Apply an ActorDelta to an Actor and return the resultant synthetic Actor.
   * @param {ActorDelta} delta  The ActorDelta.
   * @param {Actor} baseActor   The base Actor.
   * @param {object} [context]  Context to supply to synthetic Actor instantiation.
   * @returns {Actor|null}
   */
  static applyDelta(delta, baseActor, context={}) {
    if ( !baseActor ) return null;
    if ( delta.parent?.isLinked ) return baseActor;

    // Get base actor data.
    const cls = game?.actors?.documentClass ?? db.Actor;
    const actorData = baseActor.toObject();
    const deltaData = delta.toObject();
    delete deltaData._id;

    // Merge embedded collections.
    BaseActorDelta.#mergeEmbeddedCollections(cls, actorData, deltaData);

    // Merge the rest of the delta.
    mergeObject(actorData, deltaData);
    return new cls(actorData, {parent: delta.parent, ...context});
  }

  /* -------------------------------------------- */

  /**
   * Merge delta Document embedded collections with the base Document.
   * @param {typeof Document} documentClass  The parent Document class.
   * @param {object} baseData                The base Document data.
   * @param {object} deltaData               The delta Document data.
   */
  static #mergeEmbeddedCollections(documentClass, baseData, deltaData) {
    for ( const collectionName of Object.keys(documentClass.hierarchy) ) {
      const baseCollection = baseData[collectionName];
      const deltaCollection = deltaData[collectionName];
      baseData[collectionName] = BaseActorDelta.#mergeEmbeddedCollection(baseCollection, deltaCollection);
      delete deltaData[collectionName];
    }
  }

  /* -------------------------------------------- */

  /**
   * Apply an embedded collection delta.
   * @param {object[]} base   The base embedded collection.
   * @param {object[]} delta  The delta embedded collection.
   * @returns {object[]}
   */
  static #mergeEmbeddedCollection(base=[], delta=[]) {
    const deltaIds = new Set();
    const records = [];
    for ( const record of delta ) {
      if ( !record._tombstone ) records.push(record);
      deltaIds.add(record._id);
    }
    for ( const record of base ) {
      if ( !deltaIds.has(record._id) ) records.push(record);
    }
    return records;
  }

  /* -------------------------------------------- */

  /** @override */
  static migrateData(source) {
    return BaseActor.migrateData(source);
  }

  /* -------------------------------------------- */
  /*  Serialization                               */
  /* -------------------------------------------- */

  /** @override */
  toObject(source=true) {
    const data = {};
    const value = source ? this._source : this;
    for ( const [name, field] of this.schema.entries() ) {
      const v = value[name];
      if ( !field.required && ((v === undefined) || (v === null)) ) continue; // Drop optional fields
      data[name] = source ? deepClone(value[name]) : field.toObject(value[name]);
    }
    return data;
  }
}
