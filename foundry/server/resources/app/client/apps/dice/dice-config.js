/**
 * An application responsible for configuring how dice are rolled and evaluated.
 */
class DiceConfig extends FormApplication {
  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "dice-config",
      template: "templates/dice/config.html",
      title: "DICE.CONFIG.Title",
      width: 500
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getData(options={}) {
    const context = super.getData(options);
    const { methods, dice } = CONFIG.Dice.fulfillment;
    if ( !game.user.hasPermission("MANUAL_ROLLS") ) delete methods.manual;
    const config = game.settings.get("core", "diceConfiguration");
    context.methods = methods;
    context.dice = Object.entries(dice).map(([k, { label, icon }]) => {
      return { label, icon, denomination: k, method: config[k] || "" };
    });
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    const config = game.settings.get("core", "diceConfiguration");
    foundry.utils.mergeObject(config, formData);
    return game.settings.set("core", "diceConfiguration", config);
  }
}
