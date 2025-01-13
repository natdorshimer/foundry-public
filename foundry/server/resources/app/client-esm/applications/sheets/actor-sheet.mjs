import DocumentSheetV2 from "../api/document-sheet.mjs";

/**
 * A base class for providing Actor Sheet behavior using ApplicationV2.
 */
export default class ActorSheetV2 extends DocumentSheetV2 {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      width: 600
    },
    window: {
      controls: [
        {
          action: "configurePrototypeToken",
          icon: "fa-solid fa-user-circle",
          label: "TOKEN.TitlePrototype",
          ownership: "OWNER"
        },
        {
          action: "showPortraitArtwork",
          icon: "fa-solid fa-image",
          label: "SIDEBAR.CharArt",
          ownership: "OWNER"
        },
        {
          action: "showTokenArtwork",
          icon: "fa-solid fa-image",
          label: "SIDEBAR.TokenArt",
          ownership: "OWNER"
        }
      ]
    },
    actions: {
      configurePrototypeToken: ActorSheetV2.#onConfigurePrototypeToken,
      showPortraitArtwork: ActorSheetV2.#onShowPortraitArtwork,
      showTokenArtwork: ActorSheetV2.#onShowTokenArtwork,
    }
  };

  /**
   * The Actor document managed by this sheet.
   * @type {ClientDocument}
   */
  get actor() {
    return this.document;
  }

  /* -------------------------------------------- */

  /**
   * If this sheet manages the ActorDelta of an unlinked Token, reference that Token document.
   * @type {TokenDocument|null}
   */
  get token() {
    return this.document.token || null;
  }

  /* -------------------------------------------- */

  /** @override */
  _getHeaderControls() {
    const controls = this.options.window.controls;

    // Portrait image
    const img = this.actor.img;
    if ( img === CONST.DEFAULT_TOKEN ) controls.findSplice(c => c.action === "showPortraitArtwork");

    // Token image
    const pt = this.actor.prototypeToken;
    const tex = pt.texture.src;
    if ( pt.randomImg || [null, undefined, CONST.DEFAULT_TOKEN].includes(tex) ) {
      controls.findSplice(c => c.action === "showTokenArtwork");
    }
    return controls;
  }

  /* -------------------------------------------- */

  async _renderHTML(context, options) {
    return `<p>TESTING</p>`;
  }

  _replaceHTML(result, content, options) {
    content.insertAdjacentHTML("beforeend", result);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle header control button clicks to render the Prototype Token configuration sheet.
   * @this {ActorSheetV2}
   * @param {PointerEvent} event
   */
  static #onConfigurePrototypeToken(event) {
    event.preventDefault();
    const renderOptions = {
      left: Math.max(this.position.left - 560 - 10, 10),
      top: this.position.top
    };
    new CONFIG.Token.prototypeSheetClass(this.actor.prototypeToken, renderOptions).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle header control button clicks to display actor portrait artwork.
   * @this {ActorSheetV2}
   * @param {PointerEvent} event
   */
  static #onShowPortraitArtwork(event) {
    const {img, name, uuid} = this.actor;
    new ImagePopout(img, {title: name, uuid: uuid}).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle header control button clicks to display actor portrait artwork.
   * @this {ActorSheetV2}
   * @param {PointerEvent} event
   */
  static #onShowTokenArtwork(event) {
    const {prototypeToken, name, uuid} = this.actor;
    new ImagePopout(prototypeToken.texture.src, {title: name, uuid: uuid}).render(true);
  }
}
