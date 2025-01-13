import ApplicationV2 from "./application.mjs";
import {mergeObject} from "../../../common/utils/helpers.mjs";

/**
 * @typedef {import("../_types.mjs").ApplicationConfiguration} ApplicationConfiguration
 */

/**
 * @typedef {Object} DialogV2Button
 * @property {string} action                      The button action identifier.
 * @property {string} label                       The button label. Will be localized.
 * @property {string} [icon]                      FontAwesome icon classes.
 * @property {string} [class]                     CSS classes to apply to the button.
 * @property {boolean} [default]                  Whether this button represents the default action to take if the user
 *                                                submits the form without pressing a button, i.e. with an Enter
 *                                                keypress.
 * @property {DialogV2ButtonCallback} [callback]  A function to invoke when the button is clicked. The value returned
 *                                                from this function will be used as the dialog's submitted value.
 *                                                Otherwise, the button's identifier is used.
 */

/**
 * @callback DialogV2ButtonCallback
 * @param {PointerEvent|SubmitEvent} event        The button click event, or a form submission event if the dialog was
 *                                                submitted via keyboard.
 * @param {HTMLButtonElement} button              If the form was submitted via keyboard, this will be the default
 *                                                button, otherwise the button that was clicked.
 * @param {HTMLDialogElement} dialog              The dialog element.
 * @returns {Promise<any>}
 */

/**
 * @typedef {Object} DialogV2Configuration
 * @property {boolean} [modal]                    Modal dialogs prevent interaction with the rest of the UI until they
 *                                                are dismissed or submitted.
 * @property {DialogV2Button[]} buttons           Button configuration.
 * @property {string} [content]                   The dialog content.
 * @property {DialogV2SubmitCallback} [submit]    A function to invoke when the dialog is submitted. This will not be
 *                                                called if the dialog is dismissed.
 */

/**
 * @callback DialogV2RenderCallback
 * @param {Event} event                           The render event.
 * @param {HTMLDialogElement} dialog              The dialog element.
 */

/**
 * @callback DialogV2CloseCallback
 * @param {Event} event                           The close event.
 * @param {DialogV2} dialog                       The dialog instance.
 */

/**
 * @callback DialogV2SubmitCallback
 * @param {any} result                            Either the identifier of the button that was clicked to submit the
 *                                                dialog, or the result returned by that button's callback.
 * @returns {Promise<void>}
 */

/**
 * @typedef {object} DialogV2WaitOptions
 * @property {DialogV2RenderCallback} [render]    A synchronous function to invoke whenever the dialog is rendered.
 * @property {DialogV2CloseCallback} [close]      A synchronous function to invoke when the dialog is closed under any
 *                                                circumstances.
 * @property {boolean} [rejectClose=true]         Throw a Promise rejection if the dialog is dismissed.
 */

/**
 * A lightweight Application that renders a dialog containing a form with arbitrary content, and some buttons.
 * @extends {ApplicationV2<ApplicationConfiguration & DialogV2Configuration>}
 *
 * @example Prompt the user to confirm an action.
 * ```js
 * const proceed = await foundry.applications.api.DialogV2.confirm({
 *   content: "Are you sure?",
 *   rejectClose: false,
 *   modal: true
 * });
 * if ( proceed ) console.log("Proceed.");
 * else console.log("Do not proceed.");
 * ```
 *
 * @example Prompt the user for some input.
 * ```js
 * let guess;
 * try {
 *   guess = await foundry.applications.api.DialogV2.prompt({
 *     window: { title: "Guess a number between 1 and 10" },
 *     content: '<input name="guess" type="number" min="1" max="10" step="1" autofocus>',
 *     ok: {
 *       label: "Submit Guess",
 *       callback: (event, button, dialog) => button.form.elements.guess.valueAsNumber
 *     }
 *   });
 * } catch {
 *   console.log("User did not make a guess.");
 *   return;
 * }
 * const n = Math.ceil(CONFIG.Dice.randomUniform() * 10);
 * if ( n === guess ) console.log("User guessed correctly.");
 * else console.log("User guessed incorrectly.");
 * ```
 *
 * @example A custom dialog.
 * ```js
 * new foundry.applications.api.DialogV2({
 *   window: { title: "Choose an option" },
 *   content: `
 *     <label><input type="radio" name="choice" value="one" checked> Option 1</label>
 *     <label><input type="radio" name="choice" value="two"> Option 2</label>
 *     <label><input type="radio" name="choice" value="three"> Options 3</label>
 *   `,
 *   buttons: [{
 *     action: "choice",
 *     label: "Make Choice",
 *     default: true,
 *     callback: (event, button, dialog) => button.form.elements.choice.value
 *   }, {
 *     action: "all",
 *     label: "Take All"
 *   }],
 *   submit: result => {
 *     if ( result === "all" ) console.log("User picked all options.");
 *     else console.log(`User picked option: ${result}`);
 *   }
 * }).render({ force: true });
 * ```
 */
export default class DialogV2 extends ApplicationV2 {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "dialog-{id}",
    classes: ["dialog"],
    tag: "dialog",
    form: {
      closeOnSubmit: true
    },
    window: {
      frame: true,
      positioned: true,
      minimizable: false
    }
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    if ( !options.buttons?.length ) throw new Error("You must define at least one entry in options.buttons");
    options.buttons = options.buttons.reduce((obj, button) => {
      options.actions[button.action] = this.constructor._onClickButton;
      obj[button.action] = button;
      return obj;
    }, {});
    return options;
  }

  /* -------------------------------------------- */

  /** @override */
  async _renderHTML(_context, _options) {
    const form = document.createElement("form");
    form.className = "dialog-form standard-form";
    form.autocomplete = "off";
    form.innerHTML = `
      ${this.options.content ? `<div class="dialog-content standard-form">${this.options.content}</div>` : ""}
      <footer class="form-footer">${this._renderButtons()}</footer>
    `;
    form.addEventListener("submit", event => this._onSubmit(event.submitter, event));
    return form;
  }

  /* -------------------------------------------- */

  /**
   * Render configured buttons.
   * @returns {string}
   * @protected
   */
  _renderButtons() {
    return Object.values(this.options.buttons).map(button => {
      const { action, label, icon, default: isDefault, class: cls="" } = button;
      return `
        <button type="${isDefault ? "submit" : "button"}" data-action="${action}" class="${cls}"
                ${isDefault ? "autofocus" : ""}>
          ${icon ? `<i class="${icon}"></i>` : ""}
          <span>${game.i18n.localize(label)}</span>
        </button>
      `;
    }).join("");
  }

  /* -------------------------------------------- */

  /**
   * Handle submitting the dialog.
   * @param {HTMLButtonElement} target        The button that was clicked or the default button.
   * @param {PointerEvent|SubmitEvent} event  The triggering event.
   * @returns {Promise<DialogV2>}
   * @protected
   */
  async _onSubmit(target, event) {
    event.preventDefault();
    const button = this.options.buttons[target?.dataset.action];
    const result = (await button?.callback?.(event, target, this.element)) ?? button?.action;
    await this.options.submit?.(result);
    return this.options.form.closeOnSubmit ? this.close() : this;
  }

  /* -------------------------------------------- */

  /** @override */
  _onFirstRender(_context, _options) {
    if ( this.options.modal ) this.element.showModal();
    else this.element.show();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _attachFrameListeners() {
    super._attachFrameListeners();
    this.element.addEventListener("keydown", this._onKeyDown.bind(this));
  }

  /* -------------------------------------------- */

  /** @override */
  _replaceHTML(result, content, _options) {
    content.replaceChildren(result);
  }

  /* -------------------------------------------- */

  /**
   * Handle keypresses within the dialog.
   * @param {KeyboardEvent} event  The triggering event.
   * @protected
   */
  _onKeyDown(event) {
    // Capture Escape keypresses for dialogs to ensure that close is called properly.
    if ( event.key === "Escape" ) {
      event.preventDefault(); // Prevent default browser dialog dismiss behavior.
      event.stopPropagation();
      this.close();
    }
  }

  /* -------------------------------------------- */

  /**
   * @this {DialogV2}
   * @param {PointerEvent} event        The originating click event.
   * @param {HTMLButtonElement} target  The button element that was clicked.
   * @protected
   */
  static _onClickButton(event, target) {
    this._onSubmit(target, event);
  }

  /* -------------------------------------------- */
  /*  Factory Methods                             */
  /* -------------------------------------------- */

  /**
   * A utility helper to generate a dialog with yes and no buttons.
   * @param {Partial<ApplicationConfiguration & DialogV2Configuration & DialogV2WaitOptions>} [options]
   * @param {DialogV2Button} [options.yes]  Options to overwrite the default yes button configuration.
   * @param {DialogV2Button} [options.no]   Options to overwrite the default no button configuration.
   * @returns {Promise<any>}                Resolves to true if the yes button was pressed, or false if the no button
   *                                        was pressed. If additional buttons were provided, the Promise resolves to
   *                                        the identifier of the one that was pressed, or the value returned by its
   *                                        callback. If the dialog was dismissed, and rejectClose is false, the
   *                                        Promise resolves to null.
   */
  static async confirm({ yes={}, no={}, ...options }={}) {
    options.buttons ??= [];
    options.buttons.unshift(mergeObject({
      action: "yes", label: "Yes", icon: "fas fa-check", callback: () => true
    }, yes), mergeObject({
      action: "no", label: "No", icon: "fas fa-xmark", default: true, callback: () => false
    }, no));
    return this.wait(options);
  }

  /* -------------------------------------------- */

  /**
   * A utility helper to generate a dialog with a single confirmation button.
   * @param {Partial<ApplicationConfiguration & DialogV2Configuration & DialogV2WaitOptions>} [options]
   * @param {Partial<DialogV2Button>} [options.ok]  Options to overwrite the default confirmation button configuration.
   * @returns {Promise<any>}                        Resolves to the identifier of the button used to submit the dialog,
   *                                                or the value returned by that button's callback. If the dialog was
   *                                                dismissed, and rejectClose is false, the Promise resolves to null.
   */
  static async prompt({ ok={}, ...options }={}) {
    options.buttons ??= [];
    options.buttons.unshift(mergeObject({
      action: "ok", label: "Confirm", icon: "fas fa-check", default: true
    }, ok));
    return this.wait(options);
  }

  /* -------------------------------------------- */

  /**
   * Spawn a dialog and wait for it to be dismissed or submitted.
   * @param {Partial<ApplicationConfiguration & DialogV2Configuration>} [options]
   * @param {DialogV2RenderCallback} [options.render]  A function to invoke whenever the dialog is rendered.
   * @param {DialogV2CloseCallback} [options.close]    A function to invoke when the dialog is closed under any
   *                                                   circumstances.
   * @param {boolean} [options.rejectClose=true]       Throw a Promise rejection if the dialog is dismissed.
   * @returns {Promise<any>}                           Resolves to the identifier of the button used to submit the
   *                                                   dialog, or the value returned by that button's callback. If the
   *                                                   dialog was dismissed, and rejectClose is false, the Promise
   *                                                   resolves to null.
   */
  static async wait({ rejectClose=true, close, render, ...options }={}) {
    return new Promise((resolve, reject) => {
      // Wrap submission handler with Promise resolution.
      const originalSubmit = options.submit;
      options.submit = async result => {
        await originalSubmit?.(result);
        resolve(result);
      };

      const dialog = new this(options);
      dialog.addEventListener("close", event => {
        if ( close instanceof Function ) close(event, dialog);
        if ( rejectClose ) reject(new Error("Dialog was dismissed without pressing a button."));
        else resolve(null);
      }, { once: true });
      if ( render instanceof Function ) {
        dialog.addEventListener("render", event => render(event, dialog.element));
      }
      dialog.render({ force: true });
    });
  }
}
