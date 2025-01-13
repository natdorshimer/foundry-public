/**
 * The client-side Token document which extends the common BaseToken document model.
 * @extends foundry.documents.BaseToken
 * @mixes CanvasDocumentMixin
 *
 * @see {@link Scene}                     The Scene document type which contains Token documents
 * @see {@link TokenConfig}               The Token configuration application
 */
class TokenDocument extends CanvasDocumentMixin(foundry.documents.BaseToken) {

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * A singleton collection which holds a reference to the synthetic token actor by its base actor's ID.
   * @type {Collection<Actor>}
   */
  actors = (function() {
    const collection = new foundry.utils.Collection();
    collection.documentClass = Actor.implementation;
    return collection;
  })();

  /* -------------------------------------------- */

  /**
   * A reference to the Actor this Token modifies.
   * If actorLink is true, then the document is the primary Actor document.
   * Otherwise, the Actor document is a synthetic (ephemeral) document constructed using the Token's ActorDelta.
   * @returns {Actor|null}
   */
  get actor() {
    return (this.isLinked ? this.baseActor : this.delta?.syntheticActor) ?? null;
  }

  /* -------------------------------------------- */

  /**
   * A reference to the base, World-level Actor this token represents.
   * @returns {Actor}
   */
  get baseActor() {
    return game.actors.get(this.actorId);
  }

  /* -------------------------------------------- */

  /**
   * An indicator for whether the current User has full control over this Token document.
   * @type {boolean}
   */
  get isOwner() {
    if ( game.user.isGM ) return true;
    return this.actor?.isOwner ?? false;
  }

  /* -------------------------------------------- */

  /**
   * A convenient reference for whether this TokenDocument is linked to the Actor it represents, or is a synthetic copy
   * @type {boolean}
   */
  get isLinked() {
    return this.actorLink;
  }

  /* -------------------------------------------- */

  /**
   * Does this TokenDocument have the SECRET disposition and is the current user lacking the necessary permissions
   * that would reveal this secret?
   * @type {boolean}
   */
  get isSecret() {
    return (this.disposition === CONST.TOKEN_DISPOSITIONS.SECRET) && !this.testUserPermission(game.user, "OBSERVER");
  }

  /* -------------------------------------------- */

  /**
   * Return a reference to a Combatant that represents this Token, if one is present in the current encounter.
   * @type {Combatant|null}
   */
  get combatant() {
    return game.combat?.combatants.find(c => c.tokenId === this.id) || null;
  }

  /* -------------------------------------------- */

  /**
   * An indicator for whether this Token is currently involved in the active combat encounter.
   * @type {boolean}
   */
  get inCombat() {
    return !!this.combatant;
  }

  /* -------------------------------------------- */

  /**
   * The Regions this Token is currently in.
   * @type {Set<RegionDocument>}
   */
  regions = game._documentsReady ? new Set() : null;

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /** @inheritdoc */
  _initialize(options = {}) {
    super._initialize(options);
    this.baseActor?._registerDependentToken(this);
  }

  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {

    // Initialize regions
    if ( this.regions === null ) {
      this.regions = new Set();
      if ( !this.parent ) return;
      for ( const id of this._regions ) {
        const region = this.parent.regions.get(id);
        if ( !region ) continue;
        this.regions.add(region);
        region.tokens.add(this);
      }
    }

    this.name ||= this.actor?.name || "Unknown";
    if ( this.hidden ) this.alpha = Math.min(this.alpha, game.user.isGM ? 0.5 : 0);
    this._prepareDetectionModes();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  prepareEmbeddedDocuments() {
    if ( game._documentsReady && !this.delta ) this.updateSource({ delta: { _id: this.id } });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  prepareDerivedData() {
    if ( this.ring.enabled && !this.ring.subject.texture ) {
      this.ring.subject.texture = this._inferRingSubjectTexture();
    }
  }

  /* -------------------------------------------- */

  /**
   * Infer the subject texture path to use for a token ring.
   * @returns {string}
   * @protected
   */
  _inferRingSubjectTexture() {
    let tex = this.texture.src;
    for ( const [prefix, replacement] of Object.entries(CONFIG.Token.ring.subjectPaths) ) {
      if ( tex.startsWith(prefix) ) return tex.replace(prefix, replacement);
    }
    return tex;
  }

  /* -------------------------------------------- */

  /**
   * Prepare detection modes which are available to the Token.
   * Ensure that every Token has the basic sight detection mode configured.
   * @protected
   */
  _prepareDetectionModes() {
    if ( !this.sight.enabled ) return;
    const lightMode = this.detectionModes.find(m => m.id === "lightPerception");
    if ( !lightMode ) this.detectionModes.push({id: "lightPerception", enabled: true, range: null});
    const basicMode = this.detectionModes.find(m => m.id === "basicSight");
    if ( !basicMode ) this.detectionModes.push({id: "basicSight", enabled: true, range: this.sight.range});
  }

  /* -------------------------------------------- */

  /**
   * A helper method to retrieve the underlying data behind one of the Token's attribute bars
   * @param {string} barName                The named bar to retrieve the attribute for
   * @param {object} [options]
   * @param {string} [options.alternative]  An alternative attribute path to get instead of the default one
   * @returns {object|null}                 The attribute displayed on the Token bar, if any
   */
  getBarAttribute(barName, {alternative}={}) {
    const attribute = alternative || this[barName]?.attribute;
    if ( !attribute || !this.actor ) return null;
    const system = this.actor.system;
    const isSystemDataModel = system instanceof foundry.abstract.DataModel;
    const templateModel = game.model.Actor[this.actor.type];

    // Get the current attribute value
    const data = foundry.utils.getProperty(system, attribute);
    if ( (data === null) || (data === undefined) ) return null;

    // Single values
    if ( Number.isNumeric(data) ) {
      let editable = foundry.utils.hasProperty(templateModel, attribute);
      if ( isSystemDataModel ) {
        const field = system.schema.getField(attribute);
        if ( field ) editable = field instanceof foundry.data.fields.NumberField;
      }
      return {type: "value", attribute, value: Number(data), editable};
    }

    // Attribute objects
    else if ( ("value" in data) && ("max" in data) ) {
      let editable = foundry.utils.hasProperty(templateModel, `${attribute}.value`);
      if ( isSystemDataModel ) {
        const field = system.schema.getField(`${attribute}.value`);
        if ( field ) editable = field instanceof foundry.data.fields.NumberField;
      }
      return {type: "bar", attribute, value: parseInt(data.value || 0), max: parseInt(data.max || 0), editable};
    }

    // Otherwise null
    return null;
  }

  /* -------------------------------------------- */

  /**
   * Test whether a Token has a specific status effect.
   * @param {string} statusId     The status effect ID as defined in CONFIG.statusEffects
   * @returns {boolean}           Does the Actor of the Token have this status effect?
   */
  hasStatusEffect(statusId) {
    return this.actor?.statuses.has(statusId) ?? false;
  }

  /* -------------------------------------------- */
  /*  Combat Operations                           */
  /* -------------------------------------------- */

  /**
   * Add or remove this Token from a Combat encounter.
   * @param {object} [options={}]         Additional options passed to TokenDocument.createCombatants or
   *                                      TokenDocument.deleteCombatants
   * @param {boolean} [options.active]      Require this token to be an active Combatant or to be removed.
   *                                        Otherwise, the current combat state of the Token is toggled.
   * @returns {Promise<boolean>}          Is this Token now an active Combatant?
   */
  async toggleCombatant({active, ...options}={}) {
    active ??= !this.inCombat;
    if ( active ) await this.constructor.createCombatants([this], options);
    else await this.constructor.deleteCombatants([this], options);
    return this.inCombat;
  }

  /* -------------------------------------------- */

  /**
   * Create or remove Combatants for an array of provided Token objects.
   * @param {TokenDocument[]} tokens      The tokens which should be added to the Combat
   * @param {object} [options={}]         Options which modify the toggle operation
   * @param {Combat} [options.combat]       A specific Combat instance which should be modified. If undefined, the
   *                                        current active combat will be modified if one exists. Otherwise, a new
   *                                        Combat encounter will be created if the requesting user is a Gamemaster.
   * @returns {Promise<Combatant[]>}      An array of created Combatant documents
   */
  static async createCombatants(tokens, {combat}={}) {

    // Identify the target Combat encounter
    combat ??= game.combats.viewed;
    if ( !combat ) {
      if ( game.user.isGM ) {
        const cls = getDocumentClass("Combat");
        combat = await cls.create({scene: canvas.scene.id, active: true}, {render: false});
      }
      else throw new Error(game.i18n.localize("COMBAT.NoneActive"));
    }

    // Add tokens to the Combat encounter
    const createData = new Set(tokens).reduce((arr, token) => {
      if ( token.inCombat ) return arr;
      arr.push({tokenId: token.id, sceneId: token.parent.id, actorId: token.actorId, hidden: token.hidden});
      return arr;
    }, []);
    return combat.createEmbeddedDocuments("Combatant", createData);
  }

  /* -------------------------------------------- */

  /**
   * Remove Combatants for the array of provided Tokens.
   * @param {TokenDocument[]} tokens      The tokens which should removed from the Combat
   * @param {object} [options={}]         Options which modify the operation
   * @param {Combat} [options.combat]       A specific Combat instance from which Combatants should be deleted
   * @returns {Promise<Combatant[]>}      An array of deleted Combatant documents
   */
  static async deleteCombatants(tokens, {combat}={}) {
    combat ??= game.combats.viewed;
    const tokenIds = new Set(tokens.map(t => t.id));
    const combatantIds = combat.combatants.reduce((ids, c) => {
      if ( tokenIds.has(c.tokenId) ) ids.push(c.id);
      return ids;
    }, []);
    return combat.deleteEmbeddedDocuments("Combatant", combatantIds);
  }

  /* -------------------------------------------- */
  /*  Actor Data Operations                       */
  /* -------------------------------------------- */

  /**
   * Convenience method to change a token vision mode.
   * @param {string} visionMode       The vision mode to apply to this token.
   * @param {boolean} [defaults=true] If the vision mode should be updated with its defaults.
   * @returns {Promise<*>}
   */
  async updateVisionMode(visionMode, defaults=true) {
    if ( !(visionMode in CONFIG.Canvas.visionModes) ) {
      throw new Error("The provided vision mode does not exist in CONFIG.Canvas.visionModes");
    }
    let update = {sight: {visionMode: visionMode}};
    if ( defaults ) {
      const defaults = CONFIG.Canvas.visionModes[visionMode].vision.defaults;
      for ( const [key, value] of Object.entries(defaults)) {
        if ( value === undefined ) continue;
        update.sight[key] = value;
      }
    }
    return this.update(update);
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getEmbeddedCollection(embeddedName) {
    if ( this.isLinked ) return super.getEmbeddedCollection(embeddedName);
    switch ( embeddedName ) {
      case "Actor":
        this.actors.set(this.actorId, this.actor);
        return this.actors;
      case "Item":
        return this.actor.items;
      case "ActiveEffect":
        return this.actor.effects;
    }
    return super.getEmbeddedCollection(embeddedName);
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {

    // Initialize the regions of this token
    for ( const id of this._regions ) {
      const region = this.parent.regions.get(id);
      if ( !region ) continue;
      this.regions.add(region);
      region.tokens.add(this);
    }

    super._onCreate(data, options, userId);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if ( allowed === false ) return false;
    if ( "actorId" in changed ) options.previousActorId = this.actorId;
    if ( "actorData" in changed ) {
      foundry.utils.logCompatibilityWarning("This update operation includes an update to the Token's actorData "
        + "property, which is deprecated. Please perform updates via the synthetic Actor instead, accessible via the "
        + "'actor' getter.", {since: 11, until: 13});
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    const configs = Object.values(this.apps).filter(app => app instanceof TokenConfig);
    configs.forEach(app => {
      if ( app.preview ) options.animate = false;
      app._previewChanges(changed);
    });

    // If the Actor association has changed, expire the cached Token actor
    if ( ("actorId" in changed) || ("actorLink" in changed) ) {
      const previousActor = game.actors.get(options.previousActorId);
      if ( previousActor ) {
        Object.values(previousActor.apps).forEach(app => app.close({submit: false}));
        previousActor._unregisterDependentToken(this);
      }
      this.delta._createSyntheticActor({ reinitializeCollections: true });
    }

    // Handle region changes
    const priorRegionIds = options._priorRegions?.[this.id];
    if ( priorRegionIds ) this.#onUpdateRegions(priorRegionIds);

    // Handle movement
    if ( game.user.id === userId ) {
      const origin = options._priorPosition?.[this.id];
      if ( origin ) this.#triggerMoveRegionEvents(origin, options.teleport === true, options.forced === true);
    }

    // Post-update the Token itself
    super._onUpdate(changed, options, userId);
    configs.forEach(app => app._previewChanges());
  }

  /* -------------------------------------------- */

  /**
   * Handle changes to the regions this token is in.
   * @param {string[]} priorRegionIds    The IDs of the prior regions
   */
  #onUpdateRegions(priorRegionIds) {

    // Update the regions of this token
    this.regions.clear();
    for ( const id of this._regions ) {
      const region = this.parent.regions.get(id);
      if ( !region ) continue;
      this.regions.add(region);
    }

    // Update tokens of regions
    const priorRegions = new Set();
    for ( const id of priorRegionIds ) {
      const region = this.parent.regions.get(id);
      if ( region ) priorRegions.add(region);
    }
    for ( const region of priorRegions ) region.tokens.delete(this);
    for ( const region of this.regions ) region.tokens.add(this);
  }

  /* -------------------------------------------- */

  /**
   * Trigger TOKEN_MOVE, TOKEN_MOVE_IN, and TOKEN_MOVE_OUT events.
   * @param {{x: number, y: number, elevation: number}} [origin]    The origin of movement
   * @param {boolean} teleport                                      Teleporation?
   * @param {boolean} forced                                        Forced movement?
   */
  #triggerMoveRegionEvents(origin, teleport, forced) {
    if ( !this.parent.isView || !this.object ) return;
    const E = CONST.REGION_EVENTS;
    const elevation = this.elevation;
    const destination = {x: this.x, y: this.y, elevation};
    for ( const region of this.parent.regions ) {
      if ( !region.object ) continue;
      if ( !region.behaviors.some(b => !b.disabled && (b.hasEvent(E.TOKEN_MOVE)
        || b.hasEvent(E.TOKEN_MOVE_IN) || b.hasEvent(E.TOKEN_MOVE_OUT))) ) continue;
      const segments = this.object.segmentizeRegionMovement(region.object, [origin, destination], {teleport});
      if ( segments.length === 0 ) continue;
      const T = Region.MOVEMENT_SEGMENT_TYPES;
      const first = segments[0].type;
      const last = segments.at(-1).type;
      const eventData = {token: this, origin, destination, teleport, forced, segments};
      if ( (first === T.ENTER) && (last !== T.EXIT) ) region._triggerEvent(E.TOKEN_MOVE_IN, eventData);
      region._triggerEvent(E.TOKEN_MOVE, eventData);
      if ( (first !== T.ENTER) && (last === T.EXIT) ) region._triggerEvent(E.TOKEN_MOVE_OUT, eventData);
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    if ( game.user.id === userId ) {
      // noinspection ES6MissingAwait
      game.combats._onDeleteToken(this.parent.id, this.id);
    }
    super._onDelete(options, userId);
    this.baseActor?._unregisterDependentToken(this);
  }

  /* -------------------------------------------- */

  /**
   * Identify the Regions the Token currently is or is going to be in after the changes are applied.
   * @param {object} [changes]    The changes.
   * @returns {string[]|void}     The Region IDs the token is (sorted), if it could be determined.
   */
  #identifyRegions(changes={}) {
    if ( !this.parent?.isView ) return;
    const regionIds = [];
    let token;
    for ( const region of this.parent.regions ) {
      if ( !region.object ) continue;
      token ??= this.clone(changes);
      const isInside = token.object.testInsideRegion(region.object);
      if ( isInside ) regionIds.push(region.id);
    }
    token?.object.destroy({children: true});
    return regionIds.sort();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  static async _preCreateOperation(documents, operation, user) {
    const allowed = await super._preCreateOperation(documents, operation, user);
    if ( allowed === false ) return false;

    // Identify and set the regions the token is in
    for ( const document of documents ) document.updateSource({_regions: document.#identifyRegions() ?? []});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  static async _preUpdateOperation(documents, operation, user) {
    const allowed = await super._preUpdateOperation(documents, operation, user);
    if ( allowed === false ) return false;
    await TokenDocument.#preUpdateMovement(documents, operation, user);
    TokenDocument.#preUpdateRegions(documents, operation, user);
  }

  /* -------------------------------------------- */

  /**
   * Handle Regions potentially stopping movement.
   * @param {TokenDocument[]} documents           Document instances to be updated
   * @param {DatabaseUpdateOperation} operation   Parameters of the database update operation
   * @param {User} user                           The User requesting the update operation
   */
  static async #preUpdateMovement(documents, operation, user) {
    if ( !operation.parent.isView ) return;

    // Handle regions stopping movement
    const teleport = operation.teleport === true;
    for ( let i = 0; i < documents.length; i++ ) {
      const document = documents[i];
      if ( !document.object ) continue;
      const changes = operation.updates[i];

      // No action need unless position/elevation is changed
      if ( !(("x" in changes) || ("y" in changes) || ("elevation" in changes)) ) continue;

      // Prepare origin and destination
      const {x: originX, y: originY, elevation: originElevation} = document;
      const origin = {x: originX, y: originY, elevation: originElevation};
      const destinationX = changes.x ?? originX;
      const destinationY = changes.y ?? originY;
      const destinationElevation = changes.elevation ?? originElevation;
      const destination = {x: destinationX, y: destinationY, elevation: destinationElevation};

      // We look for the closest position to the origin where movement is broken
      let stopDestination;
      let stopDistance;

      // Iterate regions and test movement
      for ( const region of document.parent.regions ) {
        if ( !region.object ) continue;

        // Collect behaviors that can break movement
        const behaviors = region.behaviors.filter(b => !b.disabled && b.hasEvent(CONST.REGION_EVENTS.TOKEN_PRE_MOVE));
        if ( behaviors.length === 0 ) continue;

        // Reset token so that it isn't in an animated state
        if ( document.object.animationContexts.size !== 0 ) document.reset();

        // Break the movement into its segments
        const segments = document.object.segmentizeRegionMovement(region.object, [origin, destination], {teleport});
        if ( segments.length === 0 ) continue;

        // Create the TOKEN_PRE_MOVE event
        const event = {
          name: CONST.REGION_EVENTS.TOKEN_PRE_MOVE,
          data: {token: document, origin, destination, teleport, segments},
          region,
          user
        };

        // Find the closest destination where movement is broken
        for ( const behavior of behaviors ) {

          // Dispatch event
          try {
            await behavior._handleRegionEvent(event);
          } catch(e) {
            console.error(e);
          }

          // Check if the destination of the event data was modified
          const destination = event.data.destination;
          if ( (destination.x === destinationX) && (destination.y === destinationY)
            && (destination.elevation === destinationElevation) ) continue;

          // Choose the closer destination
          const distance = Math.hypot(
            destination.x - origin.x,
            destination.y - origin.y,
            (destination.elevation - origin.elevation) * canvas.dimensions.distancePixels
          );
          if ( !stopDestination || (distance < stopDistance) ) {
            stopDestination = {x: destination.x, y: destination.y, elevation: destination.elevation};
            stopDistance = distance;
          }

          // Reset the destination
          event.data.destination = {x: destinationX, y: destinationY, elevation: destinationElevation};
        }
      }

      // Update the destination to the stop position if the movement is broken
      if ( stopDestination ) {
        changes.x = stopDestination.x;
        changes.y = stopDestination.y;
        changes.elevation = stopDestination.elevation;
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Identify and update the regions this Token is going to be in if necessary.
   * @param {TokenDocument[]} documents           Document instances to be updated
   * @param {DatabaseUpdateOperation} operation   Parameters of the database update operation
   */
  static #preUpdateRegions(documents, operation) {
    if ( !operation.parent.isView ) return;

    // Update the regions the token is in
    for ( let i = 0; i < documents.length; i++ ) {
      const document = documents[i];
      const changes = operation.updates[i];
      if ( document._couldRegionsChange(changes) ) changes._regions = document.#identifyRegions(changes);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  static async _onCreateOperation(documents, operation, user) {
    for ( const token of documents ) {
      for ( const region of token.regions ) {
        // noinspection ES6MissingAwait
        region._handleEvent({
          name: CONST.REGION_EVENTS.TOKEN_ENTER,
          data: {token},
          region,
          user
        });
      }
    }
  }

  /* -------------------------------------------- */

  /** @override */
  static async _onUpdateOperation(documents, operation, user) {
    if ( !operation._priorRegions ) return;
    for ( const token of documents ) {
      const priorRegionIds = operation._priorRegions[token.id];
      if ( !priorRegionIds ) continue;
      const priorRegions = new Set();
      for ( const id of priorRegionIds ) {
        const region = token.parent.regions.get(id);
        if ( region ) priorRegions.add(region);
      }
      const addedRegions = token.regions.difference(priorRegions);
      const removedRegions = priorRegions.difference(token.regions);
      for ( const region of removedRegions ) {
        // noinspection ES6MissingAwait
        region._handleEvent({
          name: CONST.REGION_EVENTS.TOKEN_EXIT,
          data: {token},
          region,
          user
        });
      }
      for ( const region of addedRegions ) {
        // noinspection ES6MissingAwait
        region._handleEvent({
          name: CONST.REGION_EVENTS.TOKEN_ENTER,
          data: {token},
          region,
          user
        });
      }
    }
  }

  /* -------------------------------------------- */

  /** @override */
  static async _onDeleteOperation(documents, operation, user) {
    const regionEvents = [];
    for ( const token of documents ) {
      for ( const region of token.regions ) {
        region.tokens.delete(token);
        regionEvents.push({
          name: CONST.REGION_EVENTS.TOKEN_EXIT,
          data: {token},
          region,
          user
        });
      }
      token.regions.clear();
    }
    for ( const event of regionEvents ) {
      // noinspection ES6MissingAwait
      event.region._handleEvent(event);
    }
  }

  /* -------------------------------------------- */

  /**
   * Is to Token document updated such that the Regions the Token is contained in may change?
   * Called as part of the preUpdate workflow.
   * @param {object} changes    The changes.
   * @returns {boolean}         Could this Token update change Region containment?
   * @protected
   */
  _couldRegionsChange(changes) {
    const positionChange = ("x" in changes) || ("y" in changes);
    const elevationChange = "elevation" in changes;
    const sizeChange = ("width" in changes) || ("height" in changes);
    const shapeChange = this.parent.grid.isHexagonal && ("hexagonalShape" in changes);
    return positionChange || elevationChange || sizeChange || shapeChange;
  }

  /* -------------------------------------------- */
  /*  Actor Delta Operations                      */
  /* -------------------------------------------- */

  /**
   * Support the special case descendant document changes within an ActorDelta.
   * The descendant documents themselves are configured to have a synthetic Actor as their parent.
   * We need this to ensure that the ActorDelta receives these events which do not bubble up.
   * @inheritDoc
   */
  _preCreateDescendantDocuments(parent, collection, data, options, userId) {
    if ( parent !== this.delta ) this.delta?._handleDeltaCollectionUpdates(parent);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _preUpdateDescendantDocuments(parent, collection, changes, options, userId) {
    if ( parent !== this.delta ) this.delta?._handleDeltaCollectionUpdates(parent);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _preDeleteDescendantDocuments(parent, collection, ids, options, userId) {
    if ( parent !== this.delta ) this.delta?._handleDeltaCollectionUpdates(parent);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
    super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
    this._onRelatedUpdate(data, options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
    super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);
    this._onRelatedUpdate(changes, options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
    super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);
    this._onRelatedUpdate({}, options);
  }

  /* -------------------------------------------- */

  /**
   * When the base Actor for a TokenDocument changes, we may need to update its Actor instance
   * @param {object} update
   * @param {object} options
   * @internal
   */
  _onUpdateBaseActor(update={}, options={}) {

    // Update synthetic Actor data
    if ( !this.isLinked && this.delta ) {
      this.delta.updateSyntheticActor();
      for ( const collection of Object.values(this.delta.collections) ) collection.initialize({ full: true });
      this.actor.sheet.render(false, {renderContext: "updateActor"});
    }

    this._onRelatedUpdate(update, options);
  }

  /* -------------------------------------------- */

  /**
   * Whenever the token's actor delta changes, or the base actor changes, perform associated refreshes.
   * @param {object} [update]                               The update delta.
   * @param {Partial<DatabaseUpdateOperation>} [operation]  The database operation that was performed
   * @protected
   */
  _onRelatedUpdate(update={}, operation={}) {
    // Update tracked Combat resource
    const c = this.combatant;
    if ( c && foundry.utils.hasProperty(update.system || {}, game.combat.settings.resource) ) {
      c.updateResource();
    }
    if ( this.inCombat ) ui.combat.render();

    // Trigger redraws on the token
    if ( this.parent.isView ) {
      if ( this.object?.hasActiveHUD ) canvas.tokens.hud.render();
      this.object?.renderFlags.set({refreshBars: true, redrawEffects: true});
      const configs = Object.values(this.apps).filter(app => app instanceof TokenConfig);
      configs.forEach(app => {
        app.preview?.updateSource({delta: this.toObject().delta}, {diff: false, recursive: false});
        app.preview?.object?.renderFlags.set({refreshBars: true, redrawEffects: true});
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * @typedef {object} TrackedAttributesDescription
   * @property {string[][]} bar    A list of property path arrays to attributes with both a value and a max property.
   * @property {string[][]} value  A list of property path arrays to attributes that have only a value property.
   */

  /**
   * Get an Array of attribute choices which could be tracked for Actors in the Combat Tracker
   * @param {object|DataModel|typeof DataModel|SchemaField|string} [data]  The object to explore for attributes, or an
   *                                                                       Actor type.
   * @param {string[]} [_path]
   * @returns {TrackedAttributesDescription}
   */
  static getTrackedAttributes(data, _path=[]) {
    // Case 1 - Infer attributes from schema structure.
    if ( (data instanceof foundry.abstract.DataModel) || foundry.utils.isSubclass(data, foundry.abstract.DataModel) ) {
      return this._getTrackedAttributesFromSchema(data.schema, _path);
    }
    if ( data instanceof foundry.data.fields.SchemaField ) return this._getTrackedAttributesFromSchema(data, _path);

    // Case 2 - Infer attributes from object structure.
    if ( ["Object", "Array"].includes(foundry.utils.getType(data)) ) {
      return this._getTrackedAttributesFromObject(data, _path);
    }

    // Case 3 - Retrieve explicitly configured attributes.
    if ( !data || (typeof data === "string") ) {
      const config = this._getConfiguredTrackedAttributes(data);
      if ( config ) return config;
      data = undefined;
    }

    // Track the path and record found attributes
    if ( data !== undefined ) return {bar: [], value: []};

    // Case 4 - Infer attributes from system template.
    const bar = new Set();
    const value = new Set();
    for ( let [type, model] of Object.entries(game.model.Actor) ) {
      const dataModel = CONFIG.Actor.dataModels?.[type];
      const inner = this.getTrackedAttributes(dataModel ?? model, _path);
      inner.bar.forEach(attr => bar.add(attr.join(".")));
      inner.value.forEach(attr => value.add(attr.join(".")));
    }

    return {
      bar: Array.from(bar).map(attr => attr.split(".")),
      value: Array.from(value).map(attr => attr.split("."))
    };
  }

  /* -------------------------------------------- */

  /**
   * Retrieve an Array of attribute choices from a plain object.
   * @param {object} data  The object to explore for attributes.
   * @param {string[]} _path
   * @returns {TrackedAttributesDescription}
   * @protected
   */
  static _getTrackedAttributesFromObject(data, _path=[]) {
    const attributes = {bar: [], value: []};
    // Recursively explore the object
    for ( let [k, v] of Object.entries(data) ) {
      let p = _path.concat([k]);

      // Check objects for both a "value" and a "max"
      if ( v instanceof Object ) {
        if ( k === "_source" ) continue;
        const isBar = ("value" in v) && ("max" in v);
        if ( isBar ) attributes.bar.push(p);
        else {
          const inner = this.getTrackedAttributes(data[k], p);
          attributes.bar.push(...inner.bar);
          attributes.value.push(...inner.value);
        }
      }

      // Otherwise, identify values which are numeric or null
      else if ( Number.isNumeric(v) || (v === null) ) {
        attributes.value.push(p);
      }
    }
    return attributes;
  }

  /* -------------------------------------------- */

  /**
   * Retrieve an Array of attribute choices from a SchemaField.
   * @param {SchemaField} schema  The schema to explore for attributes.
   * @param {string[]} _path
   * @returns {TrackedAttributesDescription}
   * @protected
   */
  static _getTrackedAttributesFromSchema(schema, _path=[]) {
    const attributes = {bar: [], value: []};
    for ( const [name, field] of Object.entries(schema.fields) ) {
      const p = _path.concat([name]);
      if ( field instanceof foundry.data.fields.NumberField ) attributes.value.push(p);
      const isSchema = field instanceof foundry.data.fields.SchemaField;
      const isModel = field instanceof foundry.data.fields.EmbeddedDataField;
      if ( isSchema || isModel ) {
        const schema = isModel ? field.model.schema : field;
        const isBar = schema.has("value") && schema.has("max");
        if ( isBar ) attributes.bar.push(p);
        else {
          const inner = this.getTrackedAttributes(schema, p);
          attributes.bar.push(...inner.bar);
          attributes.value.push(...inner.value);
        }
      }
    }
    return attributes;
  }

  /* -------------------------------------------- */

  /**
   * Retrieve any configured attributes for a given Actor type.
   * @param {string} [type]  The Actor type.
   * @returns {TrackedAttributesDescription|void}
   * @protected
   */
  static _getConfiguredTrackedAttributes(type) {

    // If trackable attributes are not configured fallback to the system template
    if ( foundry.utils.isEmpty(CONFIG.Actor.trackableAttributes) ) return;

    // If the system defines trackableAttributes per type
    let config = foundry.utils.deepClone(CONFIG.Actor.trackableAttributes[type]);

    // Otherwise union all configured trackable attributes
    if ( foundry.utils.isEmpty(config) ) {
      const bar = new Set();
      const value = new Set();
      for ( const attrs of Object.values(CONFIG.Actor.trackableAttributes) ) {
        attrs.bar.forEach(bar.add, bar);
        attrs.value.forEach(value.add, value);
      }
      config = { bar: Array.from(bar), value: Array.from(value) };
    }

    // Split dot-separate attribute paths into arrays
    Object.keys(config).forEach(k => config[k] = config[k].map(attr => attr.split(".")));
    return config;
  }

  /* -------------------------------------------- */

  /**
   * Inspect the Actor data model and identify the set of attributes which could be used for a Token Bar.
   * @param {object} attributes       The tracked attributes which can be chosen from
   * @returns {object}                A nested object of attribute choices to display
   */
  static getTrackedAttributeChoices(attributes) {
    attributes = attributes || this.getTrackedAttributes();
    const barGroup = game.i18n.localize("TOKEN.BarAttributes");
    const valueGroup = game.i18n.localize("TOKEN.BarValues");
    const bars = attributes.bar.map(v => {
      const a = v.join(".");
      return {group: barGroup, value: a, label: a};
    });
    bars.sort((a, b) => a.value.compare(b.value));
    const values = attributes.value.map(v => {
      const a = v.join(".");
      return {group: valueGroup, value: a, label: a};
    });
    values.sort((a, b) => a.value.compare(b.value));
    return bars.concat(values);
  }

  /* -------------------------------------------- */
  /*  Deprecations                                */
  /* -------------------------------------------- */

  /**
   * @deprecated since v11
   * @ignore
   */
  getActor() {
    foundry.utils.logCompatibilityWarning("TokenDocument#getActor has been deprecated. Please use the "
      + "TokenDocument#actor getter to retrieve the Actor instance that the TokenDocument represents, or use "
      + "TokenDocument#delta#apply to generate a new synthetic Actor instance.");
    return this.delta?.apply() ?? this.baseActor ?? null;
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v11
   * @ignore
   */
  get actorData() {
    foundry.utils.logCompatibilityWarning("You are accessing TokenDocument#actorData which is deprecated. Source data "
      + "may be retrieved via TokenDocument#delta but all modifications/access should be done via the synthetic Actor "
      + "at TokenDocument#actor if possible.", {since: 11, until: 13});
    return this.delta.toObject();
  }

  set actorData(actorData) {
    foundry.utils.logCompatibilityWarning("You are accessing TokenDocument#actorData which is deprecated. Source data "
      + "may be retrieved via TokenDocument#delta but all modifications/access should be done via the synthetic Actor "
      + "at TokenDocument#actor if possible.", {since: 11, until: 13});
    const id = this.delta.id;
    this.delta = new ActorDelta.implementation({...actorData, _id: id}, {parent: this});
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  async toggleActiveEffect(effectData, {overlay=false, active}={}) {
    foundry.utils.logCompatibilityWarning("TokenDocument#toggleActiveEffect is deprecated in favor of "
      + "Actor#toggleStatusEffect", {since: 12, until: 14});
    if ( !this.actor || !effectData.id ) return false;
    return !!(await this.actor.toggleStatusEffect(effectData.id, {active, overlay}));
  }
}

/* -------------------------------------------- */
/*  Proxy Prototype Token Methods               */
/* -------------------------------------------- */

foundry.data.PrototypeToken.prototype.getBarAttribute = TokenDocument.prototype.getBarAttribute;
