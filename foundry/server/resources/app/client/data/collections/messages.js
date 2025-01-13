/**
 * The singleton collection of ChatMessage documents which exist within the active World.
 * This Collection is accessible within the Game object as game.messages.
 * @extends {WorldCollection}
 *
 * @see {@link ChatMessage} The ChatMessage document
 * @see {@link ChatLog} The ChatLog sidebar directory
 */
class Messages extends WorldCollection {

  /** @override */
  static documentName = "ChatMessage";

  /* -------------------------------------------- */

  /**
   * @override
   * @returns {SidebarTab}
   * */
  get directory() {
    return ui.chat;
  }

  /* -------------------------------------------- */

  /** @override */
  render(force=false) {}

  /* -------------------------------------------- */

  /**
   * If requested, dispatch a Chat Bubble UI for the newly created message
   * @param {ChatMessage} message     The ChatMessage document to say
   * @private
   */
  sayBubble(message) {
    const {content, style, speaker} = message;
    if ( speaker.scene === canvas.scene.id ) {
      const token = canvas.tokens.get(speaker.token);
      if ( token ) canvas.hud.bubbles.say(token, content, {
        cssClasses: style === CONST.CHAT_MESSAGE_STYLES.EMOTE ? ["emote"] : []
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle export of the chat log to a text file
   * @private
   */
  export() {
    const log = this.contents.map(m => m.export()).join("\n---------------------------\n");
    let date = new Date().toDateString().replace(/\s/g, "-");
    const filename = `fvtt-log-${date}.txt`;
    saveDataToFile(log, "text/plain", filename);
  }

  /* -------------------------------------------- */

  /**
   * Allow for bulk deletion of all chat messages, confirm first with a yes/no dialog.
   * @see {@link Dialog.confirm}
   */
  async flush() {
    return Dialog.confirm({
      title: game.i18n.localize("CHAT.FlushTitle"),
      content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>${game.i18n.localize("CHAT.FlushWarning")}</p>`,
      yes: async () => {
        await this.documentClass.deleteDocuments([], {deleteAll: true});
        const jumpToBottomElement = document.querySelector(".jump-to-bottom");
        jumpToBottomElement.classList.add("hidden");
      },
      options: {
        top: window.innerHeight - 150,
        left: window.innerWidth - 720
      }
    });
  }
}
