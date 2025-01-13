/**
 * The client-side Item document which extends the common BaseItem model.
 * @extends foundry.documents.BaseItem
 * @mixes ClientDocumentMixin
 *
 * @see {@link Items}            The world-level collection of Item documents
 * @see {@link ItemSheet}     The Item configuration application
 */
class Item extends ClientDocumentMixin(foundry.documents.BaseItem) {

  /**
   * A convenience alias of Item#parent which is more semantically intuitive
   * @type {Actor|null}
   */
  get actor() {
    return this.parent instanceof Actor ? this.parent : null;
  }

  /* -------------------------------------------- */

  /**
   * Provide a thumbnail image path used to represent this document.
   * @type {string}
   */
  get thumbnail() {
    return this.img;
  }

  /* -------------------------------------------- */

  /**
   * A legacy alias of Item#isEmbedded
   * @type {boolean}
   */
  get isOwned() {
    return this.isEmbedded;
  }

  /* -------------------------------------------- */

  /**
   * Return an array of the Active Effect instances which originated from this Item.
   * The returned instances are the ActiveEffect instances which exist on the Item itself.
   * @type {ActiveEffect[]}
   */
  get transferredEffects() {
    return this.effects.filter(e => e.transfer === true);
  }

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /**
   * Return a data object which defines the data schema against which dice rolls can be evaluated.
   * By default, this is directly the Item's system data, but systems may extend this to include additional properties.
   * If overriding or extending this method to add additional properties, care must be taken not to mutate the original
   * object.
   * @returns {object}
   */
  getRollData() {
    return this.system;
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _preCreate(data, options, user) {
    if ( (this.parent instanceof Actor) && !CONFIG.ActiveEffect.legacyTransferral ) {
      for ( const effect of this.effects ) {
        if ( effect.transfer ) effect.updateSource(ActiveEffect.implementation.getInitialDuration());
      }
    }
    return super._preCreate(data, options, user);
  }

  /* -------------------------------------------- */

  /** @override */
  static async _onCreateOperation(documents, operation, user) {
    if ( !(operation.parent instanceof Actor) || !CONFIG.ActiveEffect.legacyTransferral || !user.isSelf ) return;
    const cls = getDocumentClass("ActiveEffect");

    // Create effect data
    const toCreate = [];
    for ( let item of documents ) {
      for ( let e of item.effects ) {
        if ( !e.transfer ) continue;
        const effectData = e.toJSON();
        effectData.origin = item.uuid;
        toCreate.push(effectData);
      }
    }

    // Asynchronously create transferred Active Effects
    operation = {...operation};
    delete operation.data;
    operation.renderSheet = false;
    // noinspection ES6MissingAwait
    cls.createDocuments(toCreate, operation);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  static async _onDeleteOperation(documents, operation, user) {
    const actor = operation.parent;
    const cls = getDocumentClass("ActiveEffect");
    if ( !(actor instanceof Actor) || !CONFIG.ActiveEffect.legacyTransferral || !user.isSelf ) return;

    // Identify effects that should be deleted
    const deletedUUIDs = new Set(documents.map(i => {
      if ( actor.isToken ) return i.uuid.split(".").slice(-2).join(".");
      return i.uuid;
    }));
    const toDelete = [];
    for ( const e of actor.effects ) {
      let origin = e.origin || "";
      if ( actor.isToken ) origin = origin.split(".").slice(-2).join(".");
      if ( deletedUUIDs.has(origin) ) toDelete.push(e.id);
    }

    // Asynchronously delete transferred Active Effects
    operation = {...operation};
    delete operation.ids;
    delete operation.deleteAll;
    // noinspection ES6MissingAwait
    cls.deleteDocuments(toDelete, operation);
  }
}
