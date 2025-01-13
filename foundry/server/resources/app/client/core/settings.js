/**
 * A class responsible for managing defined game settings or settings menus.
 * Each setting is a string key/value pair belonging to a certain namespace and a certain store scope.
 *
 * When Foundry Virtual Tabletop is initialized, a singleton instance of this class is constructed within the global
 * Game object as game.settings.
 *
 * @see {@link Game#settings}
 * @see {@link Settings}
 * @see {@link SettingsConfig}
 */
class ClientSettings {
  constructor(worldSettings) {

    /**
     * A object of registered game settings for this scope
     * @type {Map<string, SettingsConfig>}
     */
    this.settings = new Map();

    /**
     * Registered settings menus which trigger secondary applications
     * @type {Map}
     */
    this.menus = new Map();

    /**
     * The storage interfaces used for persisting settings
     * Each storage interface shares the same API as window.localStorage
     */
    this.storage = new Map([
      ["client", window.localStorage],
      ["world", new WorldSettings(worldSettings)]
    ]);
  }

  /* -------------------------------------------- */

  /**
   * Return a singleton instance of the Game Settings Configuration app
   * @returns {SettingsConfig}
   */
  get sheet() {
    if ( !this._sheet ) this._sheet = new SettingsConfig();
    return this._sheet;
  }

  /* -------------------------------------------- */

  /**
   * Register a new game setting under this setting scope
   *
   * @param {string} namespace    The namespace under which the setting is registered
   * @param {string} key          The key name for the setting under the namespace
   * @param {SettingConfig} data  Configuration for setting data
   *
   * @example Register a client setting
   * ```js
   * game.settings.register("myModule", "myClientSetting", {
   *   name: "Register a Module Setting with Choices",
   *   hint: "A description of the registered setting and its behavior.",
   *   scope: "client",     // This specifies a client-stored setting
   *   config: true,        // This specifies that the setting appears in the configuration view
   *   requiresReload: true // This will prompt the user to reload the application for the setting to take effect.
   *   type: String,
   *   choices: {           // If choices are defined, the resulting setting will be a select menu
   *     "a": "Option A",
   *     "b": "Option B"
   *   },
   *   default: "a",        // The default value for the setting
   *   onChange: value => { // A callback function which triggers when the setting is changed
   *     console.log(value)
   *   }
   * });
   * ```
   *
   * @example Register a world setting
   * ```js
   * game.settings.register("myModule", "myWorldSetting", {
   *   name: "Register a Module Setting with a Range slider",
   *   hint: "A description of the registered setting and its behavior.",
   *   scope: "world",      // This specifies a world-level setting
   *   config: true,        // This specifies that the setting appears in the configuration view
   *   requiresReload: true // This will prompt the GM to have all clients reload the application for the setting to
   *                        // take effect.
   *   type: new foundry.fields.NumberField({nullable: false, min: 0, max: 100, step: 10}),
   *   default: 50,         // The default value for the setting
   *   onChange: value => { // A callback function which triggers when the setting is changed
   *     console.log(value)
   *   }
   * });
   * ```
   */
  register(namespace, key, data) {
    if ( !namespace || !key ) throw new Error("You must specify both namespace and key portions of the setting");
    data.key = key;
    data.namespace = namespace;
    data.scope = ["client", "world"].includes(data.scope) ? data.scope : "client";
    key = `${namespace}.${key}`;

    // Validate type
    if ( data.type ) {
      const allowedTypes = [foundry.data.fields.DataField, foundry.abstract.DataModel, Function];
      if ( !allowedTypes.some(t => data.type instanceof t) ) {
        throw new Error(`Setting ${key} type must be a DataField, DataModel, or callable function`);
      }

      // Sync some setting data with the DataField
      if ( data.type instanceof foundry.data.fields.DataField ) {
        data.default ??= data.type.initial;
        data.type.name = key;
        data.type.label ??= data.label;
        data.type.hint ??= data.hint;
      }
    }

    // Setting values may not be undefined, only null, so the default should also adhere to this behavior
    data.default ??= null;

    // Store the setting configuration
    this.settings.set(key, data);

    // Reinitialize to cast the value of the Setting into its defined type
    if ( data.scope === "world" ) this.storage.get("world").getSetting(key)?.reset();
  }

  /* -------------------------------------------- */

  /**
   * Register a new sub-settings menu
   *
   * @param {string} namespace           The namespace under which the menu is registered
   * @param {string} key                 The key name for the setting under the namespace
   * @param {SettingSubmenuConfig} data  Configuration for setting data
   *
   * @example Define a settings submenu which handles advanced configuration needs
   * ```js
   * game.settings.registerMenu("myModule", "mySettingsMenu", {
   *   name: "My Settings Submenu",
   *   label: "Settings Menu Label",      // The text label used in the button
   *   hint: "A description of what will occur in the submenu dialog.",
   *   icon: "fas fa-bars",               // A Font Awesome icon used in the submenu button
   *   type: MySubmenuApplicationClass,   // A FormApplication subclass which should be created
   *   restricted: true                   // Restrict this submenu to gamemaster only?
   * });
   * ```
   */
  registerMenu(namespace, key, data) {
    if ( !namespace || !key ) throw new Error("You must specify both namespace and key portions of the menu");
    data.key = `${namespace}.${key}`;
    data.namespace = namespace;
    if ( !((data.type?.prototype instanceof FormApplication)
        || (data.type?.prototype instanceof foundry.applications.api.ApplicationV2) )) {
      throw new Error("You must provide a menu type that is a FormApplication or ApplicationV2 instance or subclass");
    }
    this.menus.set(data.key, data);
  }

  /* -------------------------------------------- */

  /**
   * Get the value of a game setting for a certain namespace and setting key
   *
   * @param {string} namespace   The namespace under which the setting is registered
   * @param {string} key         The setting key to retrieve
   *
   * @example Retrieve the current setting value
   * ```js
   * game.settings.get("myModule", "myClientSetting");
   * ```
   */
  get(namespace, key) {
    key = this.#assertKey(namespace, key);
    const config = this.settings.get(key);
    const storage = this.storage.get(config.scope);

    // Get the Setting instance
    let setting;
    switch ( config.scope ) {
      case "client":
        setting = new Setting({key, value: storage.getItem(key) ?? config.default});
        break;
      case "world":
        setting = storage.getSetting(key);
        if ( !setting ) setting = new Setting({key, value: config.default});
        break;
    }
    return setting.value;
  }

  /* -------------------------------------------- */

  /**
   * Set the value of a game setting for a certain namespace and setting key
   *
   * @param {string} namespace    The namespace under which the setting is registered
   * @param {string} key          The setting key to retrieve
   * @param {*} value             The data to assign to the setting key
   * @param {object} [options]    Additional options passed to the server when updating world-scope settings
   * @returns {*}                 The assigned setting value
   *
   * @example Update the current value of a setting
   * ```js
   * game.settings.set("myModule", "myClientSetting", "b");
   * ```
   */
  async set(namespace, key, value, options={}) {
    key = this.#assertKey(namespace, key);
    const setting = this.settings.get(key);
    if ( value === undefined ) value = setting.default;

    // Assign using DataField
    if ( setting.type instanceof foundry.data.fields.DataField ) {
      const err = setting.type.validate(value, {fallback: false});
      if ( err instanceof foundry.data.validation.DataModelValidationFailure ) throw err.asError();
    }

    // Assign using DataModel
    if ( foundry.utils.isSubclass(setting.type, foundry.abstract.DataModel) ) {
      value = setting.type.fromSource(value, {strict: true});
    }

    // Save the setting change
    if ( setting.scope === "world" ) await this.#setWorld(key, value, options);
    else this.#setClient(key, value, setting.onChange);
    return value;
  }

  /* -------------------------------------------- */

  /**
   * Assert that the namespace and setting name were provided and form a valid key.
   * @param {string} namespace    The setting namespace
   * @param {string} settingName  The setting name
   * @returns {string}            The combined setting key
   */
  #assertKey(namespace, settingName) {
    const key = `${namespace}.${settingName}`;
    if ( !namespace || !settingName ) throw new Error("You must specify both namespace and key portions of the"
      + `setting, you provided "${key}"`);
    if ( !this.settings.has(key) ) throw new Error(`"${key}" is not a registered game setting`);
    return key;
  }

  /* -------------------------------------------- */

  /**
   * Create or update a Setting document in the World database.
   * @param {string} key          The setting key
   * @param {*} value             The desired setting value
   * @param {object} [options]    Additional options which are passed to the document creation or update workflows
   * @returns {Promise<Setting>}  The created or updated Setting document
   */
  async #setWorld(key, value, options) {
    if ( !game.ready ) throw new Error("You may not set a World-level Setting before the Game is ready.");
    const current = this.storage.get("world").getSetting(key);
    const json = JSON.stringify(value);
    if ( current ) return current.update({value: json}, options);
    else return Setting.create({key, value: json}, options);
  }

  /* -------------------------------------------- */

  /**
   * Create or update a Setting document in the browser client storage.
   * @param {string} key          The setting key
   * @param {*} value             The desired setting value
   * @param {Function} onChange   A registered setting onChange callback
   * @returns {Setting}           A Setting document which represents the created setting
   */
  #setClient(key, value, onChange) {
    const storage = this.storage.get("client");
    const json = JSON.stringify(value);
    let setting;
    if ( key in storage ) {
      setting = new Setting({key, value: storage.getItem(key)});
      const diff = setting.updateSource({value: json});
      if ( foundry.utils.isEmpty(diff) ) return setting;
    }
    else setting = new Setting({key, value: json});
    storage.setItem(key, json);
    if ( onChange instanceof Function ) onChange(value);
    return setting;
  }
}
