/**
 * @typedef {Object} CombatHistoryData
 * @property {number|null} round
 * @property {number|null} turn
 * @property {string|null} tokenId
 * @property {string|null} combatantId
 */

/**
 * The client-side Combat document which extends the common BaseCombat model.
 *
 * @extends foundry.documents.BaseCombat
 * @mixes ClientDocumentMixin
 *
 * @see {@link Combats}             The world-level collection of Combat documents
 * @see {@link Combatant}                     The Combatant embedded document which exists within a Combat document
 * @see {@link CombatConfig}                  The Combat configuration application
 */
class Combat extends ClientDocumentMixin(foundry.documents.BaseCombat) {

  /**
   * Track the sorted turn order of this combat encounter
   * @type {Combatant[]}
   */
  turns = this.turns || [];

  /**
   * Record the current round, turn, and tokenId to understand changes in the encounter state
   * @type {CombatHistoryData}
   */
  current = this._getCurrentState();

  /**
   * Track the previous round, turn, and tokenId to understand changes in the encounter state
   * @type {CombatHistoryData}
   */
  previous = undefined;

  /**
   * The configuration setting used to record Combat preferences
   * @type {string}
   */
  static CONFIG_SETTING = "combatTrackerConfig";

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Get the Combatant who has the current turn.
   * @type {Combatant}
   */
  get combatant() {
    return this.turns[this.turn];
  }

  /* -------------------------------------------- */

  /**
   * Get the Combatant who has the next turn.
   * @type {Combatant}
   */
  get nextCombatant() {
    if ( this.turn === this.turns.length - 1 ) return this.turns[0];
    return this.turns[this.turn + 1];
  }

  /* -------------------------------------------- */

  /**
   * Return the object of settings which modify the Combat Tracker behavior
   * @type {object}
   */
  get settings() {
    return CombatEncounters.settings;
  }

  /* -------------------------------------------- */

  /**
   * Has this combat encounter been started?
   * @type {boolean}
   */
  get started() {
    return this.round > 0;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  get visible() {
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Is this combat active in the current scene?
   * @type {boolean}
   */
  get isActive() {
    if ( !this.scene ) return this.active;
    return this.scene.isView && this.active;
  }

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /**
   * Set the current Combat encounter as active within the Scene.
   * Deactivate all other Combat encounters within the viewed Scene and set this one as active
   * @param {object} [options] Additional context to customize the update workflow
   * @returns {Promise<Combat>}
   */
  async activate(options) {
    const updates = this.collection.reduce((arr, c) => {
      if ( c.isActive ) arr.push({_id: c.id, active: false});
      return arr;
    }, []);
    updates.push({_id: this.id, active: true});
    return this.constructor.updateDocuments(updates, options);
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    if ( this.combatants.size && !this.turns?.length ) this.setupTurns();
  }

  /* -------------------------------------------- */

  /**
   * Get a Combatant using its Token id
   * @param {string|TokenDocument} token    A Token ID or a TokenDocument instance
   * @returns {Combatant[]}                 An array of Combatants which represent the Token
   */
  getCombatantsByToken(token) {
    const tokenId = token instanceof TokenDocument ? token.id : token;
    return this.combatants.filter(c => c.tokenId === tokenId);
  }

  /* -------------------------------------------- */

  /**
   * Get a Combatant that represents the given Actor or Actor ID.
   * @param {string|Actor} actor              An Actor ID or an Actor instance
   * @returns {Combatant[]}
   */
  getCombatantsByActor(actor) {
    const isActor = actor instanceof Actor;
    if ( isActor && actor.isToken ) return this.getCombatantsByToken(actor.token);
    const actorId = isActor ? actor.id : actor;
    return this.combatants.filter(c => c.actorId === actorId);
  }

  /* -------------------------------------------- */

  /**
   * Begin the combat encounter, advancing to round 1 and turn 1
   * @returns {Promise<Combat>}
   */
  async startCombat() {
    this._playCombatSound("startEncounter");
    const updateData = {round: 1, turn: 0};
    Hooks.callAll("combatStart", this, updateData);
    return this.update(updateData);
  }

  /* -------------------------------------------- */

  /**
   * Advance the combat to the next round
   * @returns {Promise<Combat>}
   */
  async nextRound() {
    let turn = this.turn === null ? null : 0; // Preserve the fact that it's no-one's turn currently.
    if ( this.settings.skipDefeated && (turn !== null) ) {
      turn = this.turns.findIndex(t => !t.isDefeated);
      if (turn === -1) {
        ui.notifications.warn("COMBAT.NoneRemaining", {localize: true});
        turn = 0;
      }
    }
    let advanceTime = Math.max(this.turns.length - this.turn, 0) * CONFIG.time.turnTime;
    advanceTime += CONFIG.time.roundTime;
    let nextRound = this.round + 1;

    // Update the document, passing data through a hook first
    const updateData = {round: nextRound, turn};
    const updateOptions = {direction: 1, worldTime: {delta: advanceTime}};
    Hooks.callAll("combatRound", this, updateData, updateOptions);
    return this.update(updateData, updateOptions);
  }

  /* -------------------------------------------- */

  /**
   * Rewind the combat to the previous round
   * @returns {Promise<Combat>}
   */
  async previousRound() {
    let turn = ( this.round === 0 ) ? 0 : Math.max(this.turns.length - 1, 0);
    if ( this.turn === null ) turn = null;
    let round = Math.max(this.round - 1, 0);
    if ( round === 0 ) turn = null;
    let advanceTime = -1 * (this.turn || 0) * CONFIG.time.turnTime;
    if ( round > 0 ) advanceTime -= CONFIG.time.roundTime;

    // Update the document, passing data through a hook first
    const updateData = {round, turn};
    const updateOptions = {direction: -1, worldTime: {delta: advanceTime}};
    Hooks.callAll("combatRound", this, updateData, updateOptions);
    return this.update(updateData, updateOptions);
  }

  /* -------------------------------------------- */

  /**
   * Advance the combat to the next turn
   * @returns {Promise<Combat>}
   */
  async nextTurn() {
    let turn = this.turn ?? -1;
    let skip = this.settings.skipDefeated;

    // Determine the next turn number
    let next = null;
    if ( skip ) {
      for ( let [i, t] of this.turns.entries() ) {
        if ( i <= turn ) continue;
        if ( t.isDefeated ) continue;
        next = i;
        break;
      }
    }
    else next = turn + 1;

    // Maybe advance to the next round
    let round = this.round;
    if ( (this.round === 0) || (next === null) || (next >= this.turns.length) ) {
      return this.nextRound();
    }

    // Update the document, passing data through a hook first
    const updateData = {round, turn: next};
    const updateOptions = {direction: 1, worldTime: {delta: CONFIG.time.turnTime}};
    Hooks.callAll("combatTurn", this, updateData, updateOptions);
    return this.update(updateData, updateOptions);
  }

  /* -------------------------------------------- */

  /**
   * Rewind the combat to the previous turn
   * @returns {Promise<Combat>}
   */
  async previousTurn() {
    if ( (this.turn === 0) && (this.round === 0) ) return this;
    else if ( (this.turn <= 0) && (this.turn !== null) ) return this.previousRound();
    let previousTurn = (this.turn ?? this.turns.length) - 1;

    // Update the document, passing data through a hook first
    const updateData = {round: this.round, turn: previousTurn};
    const updateOptions = {direction: -1, worldTime: {delta: -1 * CONFIG.time.turnTime}};
    Hooks.callAll("combatTurn", this, updateData, updateOptions);
    return this.update(updateData, updateOptions);
  }

  /* -------------------------------------------- */

  /**
   * Display a dialog querying the GM whether they wish to end the combat encounter and empty the tracker
   * @returns {Promise<Combat>}
   */
  async endCombat() {
    return Dialog.confirm({
      title: game.i18n.localize("COMBAT.EndTitle"),
      content: `<p>${game.i18n.localize("COMBAT.EndConfirmation")}</p>`,
      yes: () => this.delete()
    });
  }

  /* -------------------------------------------- */

  /**
   * Toggle whether this combat is linked to the scene or globally available.
   * @returns {Promise<Combat>}
   */
  async toggleSceneLink() {
    const scene = this.scene ? null : (game.scenes.current?.id || null);
    if ( (scene !== null) && this.combatants.some(c => c.sceneId && (c.sceneId !== scene)) ) {
      ui.notifications.error("COMBAT.CannotLinkToScene", {localize: true});
      return this;
    }
    return this.update({scene});
  }

  /* -------------------------------------------- */

  /**
   * Reset all combatant initiative scores, setting the turn back to zero
   * @returns {Promise<Combat>}
   */
  async resetAll() {
    for ( let c of this.combatants ) {
      c.updateSource({initiative: null});
    }
    return this.update({turn: this.started ? 0 : null, combatants: this.combatants.toObject()}, {diff: false});
  }

  /* -------------------------------------------- */

  /**
   * Roll initiative for one or multiple Combatants within the Combat document
   * @param {string|string[]} ids     A Combatant id or Array of ids for which to roll
   * @param {object} [options={}]     Additional options which modify how initiative rolls are created or presented.
   * @param {string|null} [options.formula]         A non-default initiative formula to roll. Otherwise, the system
   *                                                default is used.
   * @param {boolean} [options.updateTurn=true]     Update the Combat turn after adding new initiative scores to
   *                                                keep the turn on the same Combatant.
   * @param {object} [options.messageOptions={}]    Additional options with which to customize created Chat Messages
   * @returns {Promise<Combat>}       A promise which resolves to the updated Combat document once updates are complete.
   */
  async rollInitiative(ids, {formula=null, updateTurn=true, messageOptions={}}={}) {

    // Structure input data
    ids = typeof ids === "string" ? [ids] : ids;
    const currentId = this.combatant?.id;
    const chatRollMode = game.settings.get("core", "rollMode");

    // Iterate over Combatants, performing an initiative roll for each
    const updates = [];
    const messages = [];
    for ( let [i, id] of ids.entries() ) {

      // Get Combatant data (non-strictly)
      const combatant = this.combatants.get(id);
      if ( !combatant?.isOwner ) continue;

      // Produce an initiative roll for the Combatant
      const roll = combatant.getInitiativeRoll(formula);
      await roll.evaluate();
      updates.push({_id: id, initiative: roll.total});

      // Construct chat message data
      let messageData = foundry.utils.mergeObject({
        speaker: ChatMessage.getSpeaker({
          actor: combatant.actor,
          token: combatant.token,
          alias: combatant.name
        }),
        flavor: game.i18n.format("COMBAT.RollsInitiative", {name: combatant.name}),
        flags: {"core.initiativeRoll": true}
      }, messageOptions);
      const chatData = await roll.toMessage(messageData, {create: false});

      // If the combatant is hidden, use a private roll unless an alternative rollMode was explicitly requested
      chatData.rollMode = "rollMode" in messageOptions ? messageOptions.rollMode
        : (combatant.hidden ? CONST.DICE_ROLL_MODES.PRIVATE : chatRollMode );

      // Play 1 sound for the whole rolled set
      if ( i > 0 ) chatData.sound = null;
      messages.push(chatData);
    }
    if ( !updates.length ) return this;

    // Update multiple combatants
    await this.updateEmbeddedDocuments("Combatant", updates);

    // Ensure the turn order remains with the same combatant
    if ( updateTurn && currentId ) {
      await this.update({turn: this.turns.findIndex(t => t.id === currentId)});
    }

    // Create multiple chat messages
    await ChatMessage.implementation.create(messages);
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Roll initiative for all combatants which have not already rolled
   * @param {object} [options={}]   Additional options forwarded to the Combat.rollInitiative method
   */
  async rollAll(options) {
    const ids = this.combatants.reduce((ids, c) => {
      if ( c.isOwner && (c.initiative === null) ) ids.push(c.id);
      return ids;
    }, []);
    return this.rollInitiative(ids, options);
  }

  /* -------------------------------------------- */

  /**
   * Roll initiative for all non-player actors who have not already rolled
   * @param {object} [options={}]   Additional options forwarded to the Combat.rollInitiative method
   */
  async rollNPC(options={}) {
    const ids = this.combatants.reduce((ids, c) => {
      if ( c.isOwner && c.isNPC && (c.initiative === null) ) ids.push(c.id);
      return ids;
    }, []);
    return this.rollInitiative(ids, options);
  }

  /* -------------------------------------------- */

  /**
   * Assign initiative for a single Combatant within the Combat encounter.
   * Update the Combat turn order to maintain the same combatant as the current turn.
   * @param {string} id         The combatant ID for which to set initiative
   * @param {number} value      A specific initiative value to set
   */
  async setInitiative(id, value) {
    const combatant = this.combatants.get(id, {strict: true});
    await combatant.update({initiative: value});
  }

  /* -------------------------------------------- */

  /**
   * Return the Array of combatants sorted into initiative order, breaking ties alphabetically by name.
   * @returns {Combatant[]}
   */
  setupTurns() {
    this.turns ||= [];

    // Determine the turn order and the current turn
    const turns = this.combatants.contents.sort(this._sortCombatants);
    if ( this.turn !== null) this.turn = Math.clamp(this.turn, 0, turns.length-1);

    // Update state tracking
    let c = turns[this.turn];
    this.current = this._getCurrentState(c);

    // One-time initialization of the previous state
    if ( !this.previous ) this.previous = this.current;

    // Return the array of prepared turns
    return this.turns = turns;
  }

  /* -------------------------------------------- */

  /**
   * Debounce changes to the composition of the Combat encounter to de-duplicate multiple concurrent Combatant changes.
   * If this is the currently viewed encounter, re-render the CombatTracker application.
   * @type {Function}
   */
  debounceSetup = foundry.utils.debounce(() => {
    this.current.round = this.round;
    this.current.turn = this.turn;
    this.setupTurns();
    if ( ui.combat.viewed === this ) ui.combat.render();
  }, 50);

  /* -------------------------------------------- */

  /**
   * Update active effect durations for all actors present in this Combat encounter.
   */
  updateCombatantActors() {
    for ( const combatant of this.combatants ) combatant.actor?.render(false, {renderContext: "updateCombat"});
  }

  /* -------------------------------------------- */

  /**
   * Loads the registered Combat Theme (if any) and plays the requested type of sound.
   * If multiple exist for that type, one is chosen at random.
   * @param {string} announcement     The announcement that should be played: "startEncounter", "nextUp", or "yourTurn".
   * @protected
   */
  _playCombatSound(announcement) {
    if ( !CONST.COMBAT_ANNOUNCEMENTS.includes(announcement) ) {
      throw new Error(`"${announcement}" is not a valid Combat announcement type`);
    }
    const theme = CONFIG.Combat.sounds[game.settings.get("core", "combatTheme")];
    if ( !theme || theme === "none" ) return;
    const sounds = theme[announcement];
    if ( !sounds ) return;
    const src = sounds[Math.floor(Math.random() * sounds.length)];
    game.audio.play(src, {context: game.audio.interface});
  }

  /* -------------------------------------------- */

  /**
   * Define how the array of Combatants is sorted in the displayed list of the tracker.
   * This method can be overridden by a system or module which needs to display combatants in an alternative order.
   * The default sorting rules sort in descending order of initiative using combatant IDs for tiebreakers.
   * @param {Combatant} a     Some combatant
   * @param {Combatant} b     Some other combatant
   * @protected
   */
  _sortCombatants(a, b) {
    const ia = Number.isNumeric(a.initiative) ? a.initiative : -Infinity;
    const ib = Number.isNumeric(b.initiative) ? b.initiative : -Infinity;
    return (ib - ia) || (a.id > b.id ? 1 : -1);
  }

  /* -------------------------------------------- */

  /**
   * Refresh the Token HUD under certain circumstances.
   * @param {Combatant[]} documents  A list of Combatant documents that were added or removed.
   * @protected
   */
  _refreshTokenHUD(documents) {
    if ( documents.some(doc => doc.token?.object?.hasActiveHUD) ) canvas.tokens.hud.render();
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if ( !this.collection.viewed && this.collection.combats.includes(this) ) {
      ui.combat.initialize({combat: this, render: false});
    }
    this._manageTurnEvents();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    const priorState = foundry.utils.deepClone(this.current);
    if ( !this.previous ) this.previous = priorState; // Just in case

    // Determine the new turn order
    if ( "combatants" in changed ) this.setupTurns(); // Update all combatants
    else this.current = this._getCurrentState();      // Update turn or round

    // Record the prior state and manage turn events
    const stateChanged = this.#recordPreviousState(priorState);
    if ( stateChanged && (options.turnEvents !== false) ) this._manageTurnEvents();

    // Render applications for Actors involved in the Combat
    this.updateCombatantActors();

    // Render the CombatTracker sidebar
    if ( (changed.active === true) && this.isActive ) ui.combat.initialize({combat: this});
    else if ( "scene" in changed ) ui.combat.initialize();

    // Trigger combat sound cues in the active encounter
    if ( this.active && this.started && priorState.round ) {
      const play = c => c && (game.user.isGM ? !c.hasPlayerOwner : c.isOwner);
      if ( play(this.combatant) ) this._playCombatSound("yourTurn");
      else if ( play(this.nextCombatant) ) this._playCombatSound("nextUp");
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    if ( this.collection.viewed === this ) ui.combat.initialize();
    if ( userId === game.userId ) this.collection.viewed?.activate();
  }

  /* -------------------------------------------- */
  /*  Combatant Management Workflows              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
    super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
    this.#onModifyCombatants(parent, documents, options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
    super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);
    this.#onModifyCombatants(parent, documents, options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
    super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);
    this.#onModifyCombatants(parent, documents, options);
  }

  /* -------------------------------------------- */

  /**
   * Shared actions taken when Combatants are modified within this Combat document.
   * @param {Document} parent         The direct parent of the created Documents, may be this Document or a child
   * @param {Document[]} documents    The array of created Documents
   * @param {object} options          Options which modified the operation
   */
  #onModifyCombatants(parent, documents, options) {
    const {combatTurn, turnEvents, render} = options;
    if ( parent === this ) this._refreshTokenHUD(documents);
    const priorState = foundry.utils.deepClone(this.current);
    if ( typeof combatTurn === "number" ) this.updateSource({turn: combatTurn});
    this.setupTurns();
    const turnChange = this.#recordPreviousState(priorState);
    if ( turnChange && (turnEvents !== false) ) this._manageTurnEvents();
    if ( (ui.combat.viewed === parent) && (render !== false) ) ui.combat.render();
  }

  /* -------------------------------------------- */

  /**
   * Get the current history state of the Combat encounter.
   * @param {Combatant} [combatant]       The new active combatant
   * @returns {CombatHistoryData}
   * @protected
   */
  _getCurrentState(combatant) {
    combatant ||= this.combatant;
    return {
      round: this.round,
      turn: this.turn ?? null,
      combatantId: combatant?.id || null,
      tokenId: combatant?.tokenId || null
    };
  }

  /* -------------------------------------------- */

  /**
   * Update the previous turn data.
   * Compare the state with the new current state. Only update the previous state if there is a difference.
   * @param {CombatHistoryData} priorState    A cloned copy of the current history state before changes
   * @returns {boolean}                       Has the combat round or current combatant changed?
   */
  #recordPreviousState(priorState) {
    const {round, combatantId} = this.current;
    const turnChange = (combatantId !== priorState.combatantId) || (round !== priorState.round);
    Object.assign(this.previous, priorState);
    return turnChange;
  }

  /* -------------------------------------------- */
  /*  Turn Events                                 */
  /* -------------------------------------------- */

  /**
   * Manage the execution of Combat lifecycle events.
   * This method orchestrates the execution of four events in the following order, as applicable:
   * 1. End Turn
   * 2. End Round
   * 3. Begin Round
   * 4. Begin Turn
   * Each lifecycle event is an async method, and each is awaited before proceeding.
   * @returns {Promise<void>}
   * @protected
   */
  async _manageTurnEvents() {
    if ( !this.started ) return;

    // Gamemaster handling only
    if ( game.users.activeGM?.isSelf ) {
      const advanceRound = this.current.round > (this.previous.round ?? -1);
      const advanceTurn = advanceRound || (this.current.turn > (this.previous.turn ?? -1));
      const changeCombatant = this.current.combatantId !== this.previous.combatantId;
      if ( !(advanceTurn || advanceRound || changeCombatant) ) return;

      // Conclude the prior Combatant turn
      const prior = this.combatants.get(this.previous.combatantId);
      if ( (advanceTurn || changeCombatant) && prior ) await this._onEndTurn(prior);

      // Conclude the prior round
      if ( advanceRound && this.previous.round ) await this._onEndRound();

      // Begin the new round
      if ( advanceRound ) await this._onStartRound();

      // Begin a new Combatant turn
      const next = this.combatant;
      if ( (advanceTurn || changeCombatant) && next ) await this._onStartTurn(this.combatant);
    }

    // Hooks handled by all clients
    Hooks.callAll("combatTurnChange", this, this.previous, this.current);
  }

  /* -------------------------------------------- */

  /**
   * A workflow that occurs at the end of each Combat Turn.
   * This workflow occurs after the Combat document update, prior round information exists in this.previous.
   * This can be overridden to implement system-specific combat tracking behaviors.
   * This method only executes for one designated GM user. If no GM users are present this method will not be called.
   * @param {Combatant} combatant     The Combatant whose turn just ended
   * @returns {Promise<void>}
   * @protected
   */
  async _onEndTurn(combatant) {
    if ( CONFIG.debug.combat ) {
      console.debug(`${vtt} | Combat End Turn: ${this.combatants.get(this.previous.combatantId).name}`);
    }
    // noinspection ES6MissingAwait
    this.#triggerRegionEvents(CONST.REGION_EVENTS.TOKEN_TURN_END, [combatant]);
  }

  /* -------------------------------------------- */

  /**
   * A workflow that occurs at the end of each Combat Round.
   * This workflow occurs after the Combat document update, prior round information exists in this.previous.
   * This can be overridden to implement system-specific combat tracking behaviors.
   * This method only executes for one designated GM user. If no GM users are present this method will not be called.
   * @returns {Promise<void>}
   * @protected
   */
  async _onEndRound() {
    if ( CONFIG.debug.combat ) console.debug(`${vtt} | Combat End Round: ${this.previous.round}`);
    // noinspection ES6MissingAwait
    this.#triggerRegionEvents(CONST.REGION_EVENTS.TOKEN_ROUND_END, this.combatants);
  }

  /* -------------------------------------------- */

  /**
   * A workflow that occurs at the start of each Combat Round.
   * This workflow occurs after the Combat document update, new round information exists in this.current.
   * This can be overridden to implement system-specific combat tracking behaviors.
   * This method only executes for one designated GM user. If no GM users are present this method will not be called.
   * @returns {Promise<void>}
   * @protected
   */
  async _onStartRound() {
    if ( CONFIG.debug.combat ) console.debug(`${vtt} | Combat Start Round: ${this.round}`);
    // noinspection ES6MissingAwait
    this.#triggerRegionEvents(CONST.REGION_EVENTS.TOKEN_ROUND_START, this.combatants);
  }

  /* -------------------------------------------- */

  /**
   * A workflow that occurs at the start of each Combat Turn.
   * This workflow occurs after the Combat document update, new turn information exists in this.current.
   * This can be overridden to implement system-specific combat tracking behaviors.
   * This method only executes for one designated GM user. If no GM users are present this method will not be called.
   * @param {Combatant} combatant     The Combatant whose turn just started
   * @returns {Promise<void>}
   * @protected
   */
  async _onStartTurn(combatant) {
    if ( CONFIG.debug.combat ) console.debug(`${vtt} | Combat Start Turn: ${this.combatant.name}`);
    // noinspection ES6MissingAwait
    this.#triggerRegionEvents(CONST.REGION_EVENTS.TOKEN_TURN_START, [combatant]);
  }

  /* -------------------------------------------- */

  /**
   * Trigger Region events for Combat events.
   * @param {string} eventName                  The event name
   * @param {Iterable<Combatant>} combatants    The combatants to trigger the event for
   * @returns {Promise<void>}
   */
  async #triggerRegionEvents(eventName, combatants) {
    const promises = [];
    for ( const combatant of combatants ) {
      const token = combatant.token;
      if ( !token ) continue;
      for ( const region of token.regions ) {
        promises.push(region._triggerEvent(eventName, {token, combatant}));
      }
    }
    await Promise.allSettled(promises);
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v11
   * @ignore
   */
  updateEffectDurations() {
    const msg = "Combat#updateEffectDurations is renamed to Combat#updateCombatantActors";
    foundry.utils.logCompatibilityWarning(msg, {since: 11, until: 13});
    return this.updateCombatantActors();
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getCombatantByActor(actor) {
    const combatants = this.getCombatantsByActor(actor);
    return combatants?.[0] || null;
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getCombatantByToken(token) {
    const combatants = this.getCombatantsByToken(token);
    return combatants?.[0] || null;
  }
}
