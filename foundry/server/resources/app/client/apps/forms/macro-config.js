/**
 * A Macro configuration sheet
 * @extends {DocumentSheet}
 *
 * @param {Macro} object                    The Macro Document which is being configured
 * @param {DocumentSheetOptions} [options]  Application configuration options.
 */
class MacroConfig extends DocumentSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sheet", "macro-sheet"],
      template: "templates/sheets/macro-config.html",
      width: 560,
      height: 480,
      resizable: true
    });
  }

  /**
   * Should this Macro be created in a specific hotbar slot?
   * @internal
   */
  _hotbarSlot;

  /* -------------------------------------------- */

  /** @override */
  getData(options={}) {
    const data = super.getData();
    data.macroTypes = game.documentTypes.Macro.map(t => ({
      value: t,
      label: game.i18n.localize(CONFIG.Macro.typeLabels[t]),
      disabled: (t === "script") && !game.user.can("MACRO_SCRIPT")
    }));
    data.macroScopes = CONST.MACRO_SCOPES.map(s => ({value: s, label: s}));
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("button.execute").click(this.#onExecute.bind(this));
    html.find('select[name="type"]').change(this.#updateCommandDisabled.bind(this));
    this.#updateCommandDisabled();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _disableFields(form) {
    super._disableFields(form);
    if ( this.object.canExecute ) form.querySelector("button.execute").disabled = false;
  }

  /* -------------------------------------------- */

  /**
   * Update the disabled state of the command textarea.
   */
  #updateCommandDisabled() {
    const type = this.element[0].querySelector('select[name="type"]').value;
    this.element[0].querySelector('textarea[name="command"]').disabled = (type === "script") && !game.user.can("MACRO_SCRIPT");
  }

  /* -------------------------------------------- */

  /**
   * Save and execute the macro using the button on the configuration sheet
   * @param {MouseEvent} event      The originating click event
   * @returns {Promise<void>}
   */
  async #onExecute(event) {
    event.preventDefault();
    await this._updateObject(event, this._getSubmitData()); // Submit pending changes
    this.object.execute(); // Execute the macro
  }

  /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    const updateData = foundry.utils.expandObject(formData);
    try {
      if ( this.object.id ) {
        this.object.updateSource(updateData, { dryRun: true, fallback: false });
        return await super._updateObject(event, formData);
      } else {
        const macro = await Macro.implementation.create(new Macro.implementation(updateData));
        if ( !macro ) throw new Error("Failed to create Macro");
        this.object = macro;
        await game.user.assignHotbarMacro(macro, this._hotbarSlot);
      }
    } catch(err) {
      Hooks.onError("MacroConfig#_updateObject", err, { notify: "error" });
      throw err;
    }
  }
}
