/**
 * The client-side Macro document which extends the common BaseMacro model.
 * @extends foundry.documents.BaseMacro
 * @mixes ClientDocumentMixin
 *
 * @see {@link Macros}                       The world-level collection of Macro documents
 * @see {@link MacroConfig}                  The Macro configuration application
 */
class Macro extends ClientDocumentMixin(foundry.documents.BaseMacro) {

  /* -------------------------------------------- */
  /*  Model Properties                            */
  /* -------------------------------------------- */

  /**
   * Is the current User the author of this macro?
   * @type {boolean}
   */
  get isAuthor() {
    return game.user === this.author;
  }

  /* -------------------------------------------- */

  /**
   * Test whether the current User is capable of executing this Macro.
   * @type {boolean}
   */
  get canExecute() {
    return this.canUserExecute(game.user);
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
  /*  Model Methods                               */
  /* -------------------------------------------- */

  /**
   * Test whether the given User is capable of executing this Macro.
   * @param {User} user    The User to test.
   * @returns {boolean}    Can this User execute this Macro?
   */
  canUserExecute(user) {
    if ( !this.testUserPermission(user, "LIMITED") ) return false;
    return this.type === "script" ? user.can("MACRO_SCRIPT") : true;
  }

  /* -------------------------------------------- */

  /**
   * Execute the Macro command.
   * @param {object} [scope={}]     Macro execution scope which is passed to script macros
   * @param {ChatSpeakerData} [scope.speaker]   The speaker data
   * @param {Actor} [scope.actor]     An Actor who is the protagonist of the executed action
   * @param {Token} [scope.token]     A Token which is the protagonist of the executed action
   * @param {Event|RegionEvent} [scope.event]   An optional event passed to the executed macro
   * @returns {Promise<unknown>|void} A promising containing a created {@link ChatMessage} (or `undefined`) if a chat
   *                                  macro or the return value if a script macro. A void return is possible if the user
   *                                  is not permitted to execute macros or a script macro execution fails.
   */
  execute(scope={}) {
    if ( !this.canExecute ) {
      ui.notifications.warn(`You do not have permission to execute Macro "${this.name}".`);
      return;
    }
    switch ( this.type ) {
      case "chat":
        return this.#executeChat(scope.speaker);
      case "script":
        if ( foundry.utils.getType(scope) !== "Object" ) {
          throw new Error("Invalid scope parameter passed to Macro#execute which must be an object");
        }
        return this.#executeScript(scope);
    }
  }

  /* -------------------------------------------- */

  /**
   * Execute the command as a chat macro.
   * Chat macros simulate the process of the command being entered into the Chat Log input textarea.
   * @param {ChatSpeakerData} [speaker]   The speaker data
   * @returns {Promise<ChatMessage|void>} A promising that resolves to either a created chat message or void in case an
   *                                      error is thrown or the message's creation is prevented by some other means
   *                                      (e.g., a hook).
   */
  #executeChat(speaker) {
    return ui.chat.processMessage(this.command, {speaker}).catch(err => {
      Hooks.onError("Macro#_executeChat", err, {
        msg: "There was an error in your chat message syntax.",
        log: "error",
        notify: "error",
        command: this.command
      });
    });
  }

  /* -------------------------------------------- */

  /**
   * Execute the command as a script macro.
   * Script Macros are wrapped in an async IIFE to allow the use of asynchronous commands and await statements.
   * @param {object} [scope={}]     Macro execution scope which is passed to script macros
   * @param {ChatSpeakerData} [scope.speaker]   The speaker data
   * @param {Actor} [scope.actor]     An Actor who is the protagonist of the executed action
   * @param {Token} [scope.token]     A Token which is the protagonist of the executed action
   * @returns {Promise<unknown>|void} A promise containing the return value of the macro, if any, or nothing if the
   *                                  macro execution throws an error.
   */
  #executeScript({speaker, actor, token, ...scope}={}) {

    // Add variables to the evaluation scope
    speaker = speaker || ChatMessage.implementation.getSpeaker({actor, token});
    const character = game.user.character;
    token = token || (canvas.ready ? canvas.tokens.get(speaker.token) : null) || null;
    actor = actor || token?.actor || game.actors.get(speaker.actor) || null;

    // Unpack argument names and values
    const argNames = Object.keys(scope);
    if ( argNames.some(k => Number.isNumeric(k)) ) {
      throw new Error("Illegal numeric Macro parameter passed to execution scope.");
    }
    const argValues = Object.values(scope);

    // Define an AsyncFunction that wraps the macro content
    // eslint-disable-next-line no-new-func
    const fn = new foundry.utils.AsyncFunction("speaker", "actor", "token", "character", "scope", ...argNames,
      `{${this.command}\n}`);

    // Attempt macro execution
    try {
      return fn.call(this, speaker, actor, token, character, scope, ...argValues);
    } catch(err) {
      ui.notifications.error("MACRO.Error", { localize: true });
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onClickDocumentLink(event) {
    return this.execute({event});
  }
}
