/** @module types */
export * from "./documents/_types.mjs";

/* ----------------------------------------- */
/*  Data Model                               */
/* ----------------------------------------- */

/**
 * @typedef {Object} DocumentConstructionContext
 * @property {Document|null} [parent=null]    The parent Document of this one, if this one is embedded
 * @property {string|null} [pack=null]        The compendium collection ID which contains this Document, if any
 * @property {boolean} [strict=true]          Whether to validate initial data strictly?
 */

/* ----------------------------------------- */
/*  Reusable Type Definitions                */
/* ----------------------------------------- */

/**
 * Make all properties in T recursively readonly.
 * @template T
 * @typedef {Readonly<{
 *   [K in keyof T]:
 *     T[K] extends (undefined | null | boolean | number | string | symbol | bigint | Function) ? T[K] :
 *     T[K] extends Array<infer V> ? ReadonlyArray<DeepReadonly<V>> :
 *     T[K] extends Map<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> :
 *     T[K] extends Set<infer V> ? ReadonlySet<DeepReadonly<V>> : DeepReadonly<T[K]>
 * }>} DeepReadonly
 */

/**
 * A class constructor.
 * Used for functions with generic class constructor parameters.
 * @typedef {new (...args: any[]) => any} Constructor
 */

/**
 * A single point, expressed as an object {x, y}
 * @typedef {PIXI.Point|{x: number, y: number}} Point
 */

/**
 * A single point, expressed as an array [x,y]
 * @typedef {number[]} PointArray
 */

/**
 * A standard rectangle interface.
 * @typedef {{x: number, y: number, width: number, height: number}} Rectangle
 */

/**
 * @typedef {typeof Number|typeof String|typeof Boolean} BuiltinTypes
 */

/**
 * @typedef {number|[red: number, green: number, blue: number]|string|Color} ColorSource
 */

/* ----------------------------------------- */
/*  Settings Type Definitions                */
/* ----------------------------------------- */

/**
 * A Client Setting
 * @typedef {Object} SettingConfig
 * @property {string} key             A unique machine-readable id for the setting
 * @property {string} namespace       The namespace the setting belongs to
 * @property {string} name            The human-readable name
 * @property {string} hint            An additional human-readable hint
 * @property {string} scope           The scope the Setting is stored in, either World or Client
 * @property {boolean} config         Indicates if this Setting should render in the Config application
 * @property {BuiltinTypes|DataField|DataModel} type  The type of data stored by this Setting
 * @property {Object} [choices]       For string Types, defines the allowable values
 * @property {Object} [range]         For numeric Types, defines the allowable range
 * @property {any} [default]          The default value
 * @property {function} [onChange]    Executes when the value of this Setting changes
 * @property {CustomFormInput} [input] A custom form field input used in conjunction with a DataField type
 */

/**
 * A Client Setting Submenu
 * @typedef {Object} SettingSubmenuConfig
 * @property {string} name             The human readable name
 * @property {string} label            The human readable label
 * @property {string} hint             An additional human readable hint
 * @property {string} icon             The classname of an Icon to render
 * @property {any} type                 The FormApplication class to render TODO better typing
 * @property {boolean} restricted      If true, only a GM can edit this Setting
 */

/**
 * A Client Keybinding Action Configuration
 * @typedef {Object} KeybindingActionConfig
 * @property {string} [namespace]                       The namespace within which the action was registered
 * @property {string} name                              The human-readable name
 * @property {string} [hint]                            An additional human-readable hint
 * @property {KeybindingActionBinding[]} [uneditable]   The default bindings that can never be changed nor removed.
 * @property {KeybindingActionBinding[]} [editable]     The default bindings that can be changed by the user.
 * @property {Function} [onDown]                        A function to execute when a key down event occurs. If True is returned, the event is consumed and no further keybinds execute.
 * @property {Function} [onUp]                          A function to execute when a key up event occurs. If True is returned, the event is consumed and no further keybinds execute.
 * @property {boolean} [repeat=false]                   If True, allows Repeat events to execute the Action's onDown. Defaults to false.
 * @property {boolean} [restricted=false]               If true, only a GM can edit and execute this Action
 * @property {string[]} [reservedModifiers]             Modifiers such as [ "CONTROL" ] that can be also pressed when executing this Action. Prevents using one of these modifiers as a Binding.
 * @property {number} [precedence=0]                    The preferred precedence of running this Keybinding Action
 * @property {number} [order]                           The recorded registration order of the action
 */

/**
 * A Client Keybinding Action Binding
 * @typedef {Object} KeybindingActionBinding
 * @property {number} [index]           A numeric index which tracks this bindings position during form rendering
 * @property {string} key               The KeyboardEvent#code value from https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values
 * @property {string[]} [modifiers]     An array of modifiers keys from KeyboardManager.MODIFIER_KEYS which are required for this binding to be activated
 */

/**
* @typedef {Object} KeybindingAction      An action that can occur when a key is pressed
* @property {string} action               The namespaced machine identifier of the Action
* @property {string} key                  The Keyboard key
* @property {string} name                 The human-readable name
* @property {string[]} requiredModifiers  Required modifiers
* @property {string[]} optionalModifiers  Optional (reserved) modifiers
* @property {Function} onDown             The handler that executes onDown
* @property {Function} onUp               The handler that executes onUp
* @property {boolean} repeat              If True, allows Repeat events to execute this Action's onDown
* @property {boolean} restricted          If true, only a GM can execute this Action
* @property {number} precedence           The registration precedence
* @property {number} order                The registration order
*/

/**
 * Keyboard event context
 * @typedef {Object} KeyboardEventContext
 * @property {string} key                  The normalized string key, such as "A"
 * @property {KeyboardEvent} event         The originating keypress event
 * @property {boolean} isShift             Is the Shift modifier being pressed
 * @property {boolean} isControl           Is the Control or Meta modifier being processed
 * @property {boolean} isAlt               Is the Alt modifier being pressed
 * @property {boolean} hasModifier         Are any of the modifiers being pressed
 * @property {string[]} modifiers          A list of string modifiers applied to this context, such as [ "CONTROL" ]
 * @property {boolean} up                  True if the Key is Up, else False if down
 * @property {boolean} repeat              True if the given key is being held down such that it is automatically repeating.
 * @property {string} [action]             The executing Keybinding Action. May be undefined until the action is known.
 */

/**
 * Connected Gamepad info
 * @typedef {Object} ConnectedGamepad
 * @property {Map<string, Number>} axes         A map of axes values
 * @property {Set.<string>} activeButtons       The Set of pressed Buttons
 */

/* ----------------------------------------- */
/*  Socket Requests and Responses            */
/* ----------------------------------------- */

/**
 * @typedef {object|object[]|string|string[]} RequestData
 */

/**
 * @typedef {Object} SocketRequest
 * @property {object} [options]
 * @property {boolean} [broadcast]
 */

/**
 * @typedef {Object} SocketResponse
 * @property {SocketRequest} request  The initial request
 * @property {Error} [error]          An error, if one occurred
 * @property {string} [status]        The status of the request
 * @property {string} [userId]        The ID of the requesting User
 * @property {RequestData} [data]     Data returned as a result of the request
 */
