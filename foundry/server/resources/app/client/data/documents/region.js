/**
 * @typedef {object} RegionEvent
 * @property {string} name                The name of the event
 * @property {object} data                The data of the event
 * @property {RegionDocument} region      The Region the event was triggered on
 * @property {User} user                  The User that triggered the event
 */

/**
 * @typedef {object} SocketRegionEvent
 * @property {string} regionUuid          The UUID of the Region the event was triggered on
 * @property {string} userId              The ID of the User that triggered the event
 * @property {string} eventName           The name of the event
 * @property {object} eventData           The data of the event
 * @property {string[]} eventDataUuids    The keys of the event data that are Documents
 */

/**
 * The client-side Region document which extends the common BaseRegion model.
 * @extends foundry.documents.BaseRegion
 * @mixes CanvasDocumentMixin
 */
class RegionDocument extends CanvasDocumentMixin(foundry.documents.BaseRegion) {

  /**
   * Activate the Socket event listeners.
   * @param {Socket} socket    The active game socket
   * @internal
   */
  static _activateSocketListeners(socket) {
    socket.on("regionEvent", this.#onSocketEvent.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle the Region event received via the socket.
   * @param {SocketRegionEvent} socketEvent    The socket Region event
   */
  static async #onSocketEvent(socketEvent) {
    const {regionUuid, userId, eventName, eventData, eventDataUuids} = socketEvent;
    const region = await fromUuid(regionUuid);
    if ( !region ) return;
    for ( const key of eventDataUuids ) {
      const uuid = foundry.utils.getProperty(eventData, key);
      const document = await fromUuid(uuid);
      foundry.utils.setProperty(eventData, key, document);
    }
    const event = {name: eventName, data: eventData, region, user: game.users.get(userId)};
    await region._handleEvent(event);
  }

  /* -------------------------------------------- */

  /**
   * Update the tokens of the given regions.
   * @param {RegionDocument[]} regions           The Regions documents, which must be all in the same Scene
   * @param {object} [options={}]                Additional options
   * @param {boolean} [options.deleted=false]    Are the Region documents deleted?
   * @param {boolean} [options.reset=true]       Reset the Token document if animated?
   *   If called during Region/Scene create/update/delete workflows, the Token documents are always reset and
   *   so never in an animated state, which means the reset option may be false. It is important that the
   *   containment test is not done in an animated state.
   * @internal
   */
  static async _updateTokens(regions, {deleted=false, reset=true}={}) {
    if ( regions.length === 0 ) return;
    const updates = [];
    const scene = regions[0].parent;
    for ( const region of regions ) {
      if ( !deleted && !region.object ) continue;
      for ( const token of scene.tokens ) {
        if ( !deleted && !token.object ) continue;
        if ( !deleted && reset && (token.object.animationContexts.size !== 0) ) token.reset();
        const inside = !deleted && token.object.testInsideRegion(region.object);
        if ( inside ) {
          if ( !token._regions.includes(region.id) ) {
            updates.push({_id: token.id, _regions: [...token._regions, region.id].sort()});
          }
        } else {
          if ( token._regions.includes(region.id) ) {
            updates.push({_id: token.id, _regions: token._regions.filter(id => id !== region.id)});
          }
        }
      }
    }
    await scene.updateEmbeddedDocuments("Token", updates);
  }

  /* -------------------------------------------- */

  /** @override */
  static async _onCreateOperation(documents, operation, user) {
    if ( user.isSelf ) {
      // noinspection ES6MissingAwait
      RegionDocument._updateTokens(documents, {reset: false});
    }
    for ( const region of documents ) {
      const status = {active: true};
      if ( region.parent.isView ) status.viewed = true;
      // noinspection ES6MissingAwait
      region._handleEvent({name: CONST.REGION_EVENTS.BEHAVIOR_STATUS, data: status, region, user});
    }
  }

  /* -------------------------------------------- */

  /** @override */
  static async _onUpdateOperation(documents, operation, user) {
    const changedRegions = [];
    for ( let i = 0; i < documents.length; i++ ) {
      const changed = operation.updates[i];
      if ( ("shapes" in changed) || ("elevation" in changed) ) changedRegions.push(documents[i]);
    }
    if ( user.isSelf ) {
      // noinspection ES6MissingAwait
      RegionDocument._updateTokens(changedRegions, {reset: false});
    }
    for ( const region of changedRegions ) {
      // noinspection ES6MissingAwait
      region._handleEvent({
        name: CONST.REGION_EVENTS.REGION_BOUNDARY,
        data: {},
        region,
        user
      });
    }
  }

  /* -------------------------------------------- */

  /** @override */
  static async _onDeleteOperation(documents, operation, user) {
    if ( user.isSelf ) {
      // noinspection ES6MissingAwait
      RegionDocument._updateTokens(documents, {deleted: true});
    }
    const regionEvents = [];
    for ( const region of documents ) {
      for ( const token of region.tokens ) {
        region.tokens.delete(token);
        regionEvents.push({
          name: CONST.REGION_EVENTS.TOKEN_EXIT,
          data: {token},
          region,
          user
        });
      }
      region.tokens.clear();
    }
    for ( const region of documents ) {
      const status = {active: false};
      if ( region.parent.isView ) status.viewed = false;
      regionEvents.push({name: CONST.REGION_EVENTS.BEHAVIOR_STATUS, data: status, region, user});
    }
    for ( const event of regionEvents ) {
      // noinspection ES6MissingAwait
      event.region._handleEvent(event);
    }
  }

  /* -------------------------------------------- */

  /**
   * The tokens inside this region.
   * @type {Set<TokenDocument>}
   */
  tokens = new Set();

  /* -------------------------------------------- */

  /**
   * Trigger the Region event.
   * @param {string} eventName        The event name
   * @param {object} eventData        The event data
   * @returns {Promise<void>}
   * @internal
   */
  async _triggerEvent(eventName, eventData) {

    // Serialize Documents in the event data as UUIDs
    eventData = foundry.utils.deepClone(eventData);
    const eventDataUuids = [];
    const serializeDocuments = (object, key, path=key) => {
      const value = object[key];
      if ( (value === null) || (typeof value !== "object") ) return;
      if ( !value.constructor || (value.constructor === Object) ) {
        for ( const key in value ) serializeDocuments(value, key, `${path}.${key}`);
      } else if ( Array.isArray(value) ) {
        for ( let i = 0; i < value.length; i++ ) serializeDocuments(value, i, `${path}.${i}`);
      } else if ( value instanceof foundry.abstract.Document ) {
        object[key] = value.uuid;
        eventDataUuids.push(path);
      }
    };
    for ( const key in eventData ) serializeDocuments(eventData, key);

    // Emit socket event
    game.socket.emit("regionEvent", {
      regionUuid: this.uuid,
      userId: game.user.id,
      eventName,
      eventData,
      eventDataUuids
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle the Region event.
   * @param {RegionEvent} event    The Region event
   * @returns {Promise<void>}
   * @internal
   */
  async _handleEvent(event) {
    const results = await Promise.allSettled(this.behaviors.filter(b => !b.disabled)
      .map(b => b._handleRegionEvent(event)));
    for ( const result of results ) {
      if ( result.status === "rejected" ) console.error(result.reason);
    }
  }

  /* -------------------------------------------- */
  /*  Database Event Handlers                     */
  /* -------------------------------------------- */

  /**
   * When behaviors are created within the region, dispatch events for Tokens that are already inside the region.
   * @inheritDoc
   */
  _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
    super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
    if ( collection !== "behaviors" ) return;

    // Trigger events
    const user = game.users.get(userId);
    for ( let i = 0; i < documents.length; i++ ) {
      const behavior = documents[i];
      if ( behavior.disabled ) continue;

      // Trigger status event
      const status = {active: true};
      if ( this.parent.isView ) status.viewed = true;
      behavior._handleRegionEvent({name: CONST.REGION_EVENTS.BEHAVIOR_STATUS, data: status, region: this, user});

      // Trigger enter events
      for ( const token of this.tokens ) {
        const deleted = !this.parent.tokens.has(token.id);
        if ( deleted ) continue;
        behavior._handleRegionEvent({
          name: CONST.REGION_EVENTS.TOKEN_ENTER,
          data: {token},
          region: this,
          user
        });
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * When behaviors are updated within the region, dispatch events for Tokens that are already inside the region.
   * @inheritDoc
   */
  _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
    super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);
    if ( collection !== "behaviors" ) return;

    // Trigger status events
    const user = game.users.get(userId);
    for ( let i = 0; i < documents.length; i++ ) {
      const disabled = changes[i].disabled;
      if ( disabled === undefined ) continue;
      const behavior = documents[i];

      // Trigger exit events
      if ( disabled ) {
        for ( const token of this.tokens ) {
          behavior._handleRegionEvent({
            name: CONST.REGION_EVENTS.TOKEN_EXIT,
            data: {token},
            region: this,
            user
          });
        }
      }

      // Triger status event
      const status = {active: !disabled};
      if ( this.parent.isView ) status.viewed = !disabled;
      behavior._handleRegionEvent({name: CONST.REGION_EVENTS.BEHAVIOR_STATUS, data: status, region: this, user});

      // Trigger enter events
      if ( !disabled ) {
        for ( const token of this.tokens ) {
          const deleted = !this.parent.tokens.has(token.id);
          if ( deleted ) continue;
          behavior._handleRegionEvent({
            name: CONST.REGION_EVENTS.TOKEN_ENTER,
            data: {token},
            region: this,
            user
          });
        }
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * When behaviors are deleted within the region, dispatch events for Tokens that were previously inside the region.
   * @inheritDoc
   */
  _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
    super._onDeleteDescendantDocuments(parent, collection, ids, options, userId);
    if ( collection !== "behaviors" ) return;

    // Trigger events
    const user = game.users.get(userId);
    for ( let i = 0; i < documents.length; i++ ) {
      const behavior = documents[i];
      if ( behavior.disabled ) continue;

      // Trigger exit events
      for ( const token of this.tokens ) {
        const deleted = !this.parent.tokens.has(token.id);
        if ( deleted ) continue;
        behavior._handleRegionEvent({
          name: CONST.REGION_EVENTS.TOKEN_EXIT,
          data: {token},
          region: this,
          user
        });
      }

      // Trigger status event
      const status = {active: false};
      if ( this.parent.isView ) status.viewed = false;
      behavior._handleRegionEvent({name: CONST.REGION_EVENTS.BEHAVIOR_STATUS, data: status, region: this, user});
    }
  }
}
