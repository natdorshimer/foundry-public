/**
 * An implementation of the PlaceableHUD base class which renders a heads-up-display interface for Token objects.
 * This interface provides controls for visibility, attribute bars, elevation, status effects, and more.
 * The TokenHUD implementation can be configured and replaced via {@link CONFIG.Token.hudClass}.
 * @extends {BasePlaceableHUD<Token, TokenDocument, TokenLayer>}
 */
class TokenHUD extends BasePlaceableHUD {

  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "token-hud",
      template: "templates/hud/token-hud.html"
    });
  }

  /* -------------------------------------------- */

  /**
   * Track whether the status effects control palette is currently expanded or hidden
   * @type {boolean}
   */
  #statusTrayActive = false;

  /* -------------------------------------------- */

  /**
   * Convenience reference to the Actor modified by this TokenHUD.
   * @type {Actor}
   */
  get actor() {
    return this.document?.actor;
  }

  /* -------------------------------------------- */

  /** @override */
  bind(object) {
    this.#statusTrayActive = false;
    return super.bind(object);
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(_position) {
    const b = this.object.bounds;
    const {width, height} = this.document;
    const ratio = canvas.dimensions.size / 100;
    const position = {width: width * 100, height: height * 100, left: b.left, top: b.top};
    if ( ratio !== 1 ) position.transform = `scale(${ratio})`;
    this.element.css(position);
    this.element[0].classList.toggle("large", height >= 2);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getData(options={}) {
    let data = super.getData(options);
    const bar1 = this.document.getBarAttribute("bar1");
    const bar2 = this.document.getBarAttribute("bar2");
    data = foundry.utils.mergeObject(data, {
      canConfigure: game.user.can("TOKEN_CONFIGURE"),
      canToggleCombat: ui.combat !== null,
      displayBar1: bar1 && (bar1.type !== "none"),
      bar1Data: bar1,
      displayBar2: bar2 && (bar2.type !== "none"),
      bar2Data: bar2,
      visibilityClass: data.hidden ? "active" : "",
      effectsClass: this.#statusTrayActive ? "active" : "",
      combatClass: this.object.inCombat ? "active" : "",
      targetClass: this.object.targeted.has(game.user) ? "active" : ""
    });
    data.statusEffects = this._getStatusEffectChoices();
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Get an array of icon paths which represent valid status effect choices.
   * @protected
   */
  _getStatusEffectChoices() {

    // Include all HUD-enabled status effects
    const choices = {};
    for ( const status of CONFIG.statusEffects ) {
      if ( (status.hud === false) || ((foundry.utils.getType(status.hud) === "Object")
        && (status.hud.actorTypes?.includes(this.document.actor.type) === false)) ) {
        continue;
      }
      choices[status.id] = {
        _id: status._id,
        id: status.id,
        title: game.i18n.localize(status.name ?? /** @deprecated since v12 */ status.label),
        src: status.img ?? /** @deprecated since v12 */ status.icon,
        isActive: false,
        isOverlay: false
      };
    }

    // Update the status of effects which are active for the token actor
    const activeEffects = this.actor?.effects || [];
    for ( const effect of activeEffects ) {
      for ( const statusId of effect.statuses ) {
        const status = choices[statusId];
        if ( !status ) continue;
        if ( status._id ) {
          if ( status._id !== effect.id ) continue;
        } else {
          if ( effect.statuses.size !== 1 ) continue;
        }
        status.isActive = true;
        if ( effect.getFlag("core", "overlay") ) status.isOverlay = true;
        break;
      }
    }

    // Flag status CSS class
    for ( const status of Object.values(choices) ) {
      status.cssClass = [
        status.isActive ? "active" : null,
        status.isOverlay ? "overlay" : null
      ].filterJoin(" ");
    }
    return choices;
  }

  /* -------------------------------------------- */

  /**
   * Toggle the expanded state of the status effects selection tray.
   * @param {boolean} [active]        Force the status tray to be active or inactive
   */
  toggleStatusTray(active) {
    active ??= !this.#statusTrayActive;
    this.#statusTrayActive = active;
    const button = this.element.find('.control-icon[data-action="effects"]')[0];
    button.classList.toggle("active", active);
    const palette = this.element[0].querySelector(".status-effects");
    palette.classList.toggle("active", active);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  activateListeners(html) {
    super.activateListeners(html);
    this.toggleStatusTray(this.#statusTrayActive);
    const effectsTray = html.find(".status-effects");
    effectsTray.on("click", ".effect-control", this.#onToggleEffect.bind(this));
    effectsTray.on("contextmenu", ".effect-control", event => this.#onToggleEffect(event, {overlay: true}));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClickControl(event) {
    super._onClickControl(event);
    if ( event.defaultPrevented ) return;
    const button = event.currentTarget;
    switch ( button.dataset.action ) {
      case "config":
        return this.#onTokenConfig(event);
      case "combat":
        return this.#onToggleCombat(event);
      case "target":
        return this.#onToggleTarget(event);
      case "effects":
        return this.#onToggleStatusEffects(event);
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _updateAttribute(name, input) {
    const attr = this.document.getBarAttribute(name);
    if ( !attr ) return super._updateAttribute(name, input);
    const {value, delta, isDelta, isBar} = this._parseAttributeInput(name, attr, input);
    await this.actor?.modifyTokenAttribute(attr.attribute, isDelta ? delta : value, isDelta, isBar);
  }

  /* -------------------------------------------- */

  /**
   * Toggle the combat state of all controlled Tokens.
   * @param {PointerEvent} event
   */
  async #onToggleCombat(event) {
    event.preventDefault();
    const tokens = canvas.tokens.controlled.map(t => t.document);
    if ( !this.object.controlled ) tokens.push(this.document);
    try {
      if ( this.document.inCombat ) await TokenDocument.implementation.deleteCombatants(tokens);
      else await TokenDocument.implementation.createCombatants(tokens);
    } catch(err) {
      ui.notifications.warn(err.message);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle Token configuration button click.
   * @param {PointerEvent} event
   */
  #onTokenConfig(event) {
    event.preventDefault();
    this.object.sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle left-click events to toggle the displayed state of the status effect selection palette
   * @param {PointerEvent} event
   */
  #onToggleStatusEffects(event) {
    event.preventDefault();
    this.toggleStatusTray(!this.#statusTrayActive);
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling a token status effect icon
   * @param {PointerEvent} event      The click event to toggle the effect
   * @param {object} [options]        Options which modify the toggle
   * @param {boolean} [options.overlay]   Toggle the overlay effect?
   */
  #onToggleEffect(event, {overlay=false}={}) {
    event.preventDefault();
    event.stopPropagation();
    if ( !this.actor ) return ui.notifications.warn("HUD.WarningEffectNoActor", {localize: true});
    const statusId = event.currentTarget.dataset.statusId;
    this.actor.toggleStatusEffect(statusId, {overlay});
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the target state for this Token
   * @param {PointerEvent} event      The click event to toggle the target
   */
  #onToggleTarget(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const token = this.object;
    const targeted = !token.isTargeted;
    token.setTarget(targeted, {releaseOthers: false});
    btn.classList.toggle("active", targeted);
  }
}
