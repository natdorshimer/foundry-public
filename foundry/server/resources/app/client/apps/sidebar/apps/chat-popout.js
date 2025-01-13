/**
 * A simple application which supports popping a ChatMessage out to a separate UI window.
 * @extends {Application}
 * @param {ChatMessage} object            The {@link ChatMessage} object that is being popped out.
 * @param {ApplicationOptions} [options]  Application configuration options.
 */
class ChatPopout extends Application {
  constructor(message, options) {
    super(options);

    /**
     * The displayed Chat Message document
     * @type {ChatMessage}
     */
    this.message = message;

    // Register the application
    this.message.apps[this.appId] = this;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 300,
      height: "auto",
      classes: ["chat-popout"]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  get id() {
    return `chat-popout-${this.message.id}`;
  }

  /* -------------------------------------------- */

  /** @override */
  get title() {
    let title = this.message.flavor ?? this.message.speaker.alias;
    return TextEditor.previewHTML(title, 32);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _renderInner(_data) {
    const html = await this.message.getHTML();
    html.find(".message-delete").remove();
    return html;
  }
}
