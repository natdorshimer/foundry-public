import Color from "./color.mjs";
import {COMPENDIUM_DOCUMENT_TYPES} from "../constants.mjs";

/** @module helpers */

/**
 * Benchmark the performance of a function, calling it a requested number of iterations.
 * @param {Function} func       The function to benchmark
 * @param {number} iterations   The number of iterations to test
 * @param {...any} args         Additional arguments passed to the benchmarked function
 */
export async function benchmark(func, iterations, ...args) {
  const start = performance.now();
  for ( let i=0; i<iterations; i++ ) {
    await func(...args, i);
  }
  const end = performance.now();
  const t = Math.round((end - start) * 100) / 100;
  const name = func.name ?? "Evaluated Function"
  console.log(`${name} | ${iterations} iterations | ${t}ms | ${t / iterations}ms per`);
}

/* -------------------------------------------- */

/**
 * A debugging function to test latency or timeouts by forcibly locking the thread for an amount of time.
 * @param {number} ms        A number of milliseconds to lock
 * @returns {Promise<void>}
 */
export async function threadLock(ms, debug=false) {
  const t0 = performance.now();
  let d = 0;
  while ( d < ms ) {
    d = performance.now() - t0;
    if ( debug && (d % 1000 === 0) ) {
      console.debug(`Thread lock for ${d / 1000} of ${ms / 1000} seconds`);
    }
  }
}

/* -------------------------------------------- */

/**
 * Wrap a callback in a debounced timeout.
 * Delay execution of the callback function until the function has not been called for delay milliseconds
 * @param {Function} callback       A function to execute once the debounced threshold has been passed
 * @param {number} delay            An amount of time in milliseconds to delay
 * @return {Function}               A wrapped function which can be called to debounce execution
 */
export function debounce(callback, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback.apply(this, args)
    }, delay);
  }
}

/* -------------------------------------------- */

/**
 * Wrap a callback in a throttled timeout.
 * Delay execution of the callback function when the last time the function was called was delay milliseconds ago
 * @param {Function} callback       A function to execute once the throttled threshold has been passed
 * @param {number} delay            A maximum amount of time in milliseconds between to execution
 * @return {Function}               A wrapped function which can be called to throttle execution
 */
export function throttle(callback, delay) {
  let pending;
  let lastTime = -delay;
  return function(...args) {
    if ( pending ) {
      pending.thisArg = this;
      pending.args = args;
      return;
    }
    pending = {thisArg: this, args};
    setTimeout(() => {
      const {thisArg, args} = pending;
      pending = null;
      callback.apply(thisArg, args);
      lastTime = performance.now();
    }, Math.max(delay - (performance.now() - lastTime), 0));
  }
}

/* -------------------------------------------- */

/**
 * A utility function to reload the page with a debounce.
 * @callback debouncedReload
 */
export const debouncedReload = debounce( () => window.location.reload(), 250);

/* -------------------------------------------- */

/**
 * Quickly clone a simple piece of data, returning a copy which can be mutated safely.
 * This method DOES support recursive data structures containing inner objects or arrays.
 * This method DOES NOT support advanced object types like Set, Map, or other specialized classes.
 * @param {*} original                     Some sort of data
 * @param {object} [options]               Options to configure the behaviour of deepClone
 * @param {boolean} [options.strict=false]  Throw an Error if deepClone is unable to clone something instead of
 *                                          returning the original
 * @param {number} [options._d]             An internal depth tracker
 * @return {*}                             The clone of that data
 */
export function deepClone(original, {strict=false, _d=0}={}) {
  if ( _d > 100 ) {
    throw new Error("Maximum depth exceeded. Be sure your object does not contain cyclical data structures.");
  }
  _d++;

  // Simple types
  if ( (typeof original !== "object") || (original === null) ) return original;

  // Arrays
  if ( original instanceof Array ) return original.map(o => deepClone(o, {strict, _d}));

  // Dates
  if ( original instanceof Date ) return new Date(original);

  // Unsupported advanced objects
  if ( original.constructor && (original.constructor !== Object) ) {
    if ( strict ) throw new Error("deepClone cannot clone advanced objects");
    return original;
  }

  // Other objects
  const clone = {};
  for ( let k of Object.keys(original) ) {
    clone[k] = deepClone(original[k], {strict, _d});
  }
  return clone;
}

/* -------------------------------------------- */

/**
 * Deeply difference an object against some other, returning the update keys and values.
 * @param {object} original       An object comparing data against which to compare
 * @param {object} other          An object containing potentially different data
 * @param {object} [options={}]   Additional options which configure the diff operation
 * @param {boolean} [options.inner=false]  Only recognize differences in other for keys which also exist in original
 * @param {boolean} [options.deletionKeys=false] Apply special logic to deletion keys. They will only be kept if the
 *                                               original object has a corresponding key that could be deleted.
 * @param {number} [options._d]           An internal depth tracker
 * @return {object}               An object of the data in other which differs from that in original
 */
export function diffObject(original, other, {inner=false, deletionKeys=false, _d=0}={}) {
  if ( _d > 100 ) {
    throw new Error("Maximum depth exceeded. Be careful that your object does not contain a cyclical data structure.")
  }
  _d++;

  function _difference(v0, v1) {

    // Eliminate differences in types
    let t0 = getType(v0);
    let t1 = getType(v1);
    if ( t0 !== t1 ) return [true, v1];

    // null and undefined
    if ( ["null", "undefined"].includes(t0) ) return [v0 !== v1, v1];

    // If the prototype explicitly exposes an equality-testing method, use it
    if ( v0?.equals instanceof Function ) return [!v0.equals(v1), v1];

    // Recursively diff objects
    if ( t0 === "Object" ) {
      if ( isEmpty(v1) ) return [false, {}];
      if ( isEmpty(v0) ) return [true, v1];
      let d = diffObject(v0, v1, {inner, deletionKeys, _d});
      return [!isEmpty(d), d];
    }

    // Differences in primitives
    return [v0.valueOf() !== v1.valueOf(), v1];
  }

  // Recursively call the _difference function
  return Object.keys(other).reduce((obj, key) => {
    const isDeletionKey = key.startsWith("-=");
    if ( isDeletionKey && deletionKeys ) {
      const otherKey = key.substring(2);
      if ( otherKey in original ) obj[key] = other[key];
      return obj;
    }
    if ( inner && !(key in original) ) return obj;
    let [isDifferent, difference] = _difference(original[key], other[key]);
    if ( isDifferent ) obj[key] = difference;
    return obj;
  }, {});
}

/* -------------------------------------------- */

/**
 * Test if two objects contain the same enumerable keys and values.
 * @param {object} a  The first object.
 * @param {object} b  The second object.
 * @returns {boolean}
 */
export function objectsEqual(a, b) {
  if ( (a == null) || (b == null) ) return a === b;
  if ( (getType(a) !== "Object") || (getType(b) !== "Object") ) return a === b;
  if ( Object.keys(a).length !== Object.keys(b).length ) return false;
  return Object.entries(a).every(([k, v0]) => {
    const v1 = b[k];
    const t0 = getType(v0);
    const t1 = getType(v1);
    if ( t0 !== t1 ) return false;
    if ( v0?.equals instanceof Function ) return v0.equals(v1);
    if ( t0 === "Object" ) return objectsEqual(v0, v1);
    return v0 === v1;
  });
}

/* -------------------------------------------- */

/**
 * A cheap data duplication trick which is relatively robust.
 * For a subset of cases the deepClone function will offer better performance.
 * @param {Object} original   Some sort of data
 */
export function duplicate(original) {
  return JSON.parse(JSON.stringify(original));
}

/* -------------------------------------------- */

/**
 * Test whether some class is a subclass of a parent.
 * Returns true if the classes are identical.
 * @param {Function} cls        The class to test
 * @param {Function} parent     Some other class which may be a parent
 * @returns {boolean}           Is the class a subclass of the parent?
 */
export function isSubclass(cls, parent) {
  if ( typeof cls !== "function" ) return false;
  if ( cls === parent ) return true;
  return parent.isPrototypeOf(cls);
}

/* -------------------------------------------- */

/**
 * Search up the prototype chain and return the class that defines the given property.
 * @param {Object|Constructor} obj    A class instance or class definition which contains a property.
 *                                    If a class instance is passed the property is treated as an instance attribute.
 *                                    If a class constructor is passed the property is treated as a static attribute.
 * @param {string} property           The property name
 * @returns {Constructor}             The class that defines the property
 */
export function getDefiningClass(obj, property) {
  const isStatic = obj.hasOwnProperty("prototype");
  let target = isStatic ? obj : Object.getPrototypeOf(obj);
  while ( target ) {
    if ( target.hasOwnProperty(property) ) return isStatic ? target : target.constructor;
    target = Object.getPrototypeOf(target);
  }
}

/* -------------------------------------------- */

/**
 * Encode a url-like string by replacing any characters which need encoding
 * To reverse this encoding, the native decodeURIComponent can be used on the whole encoded string, without adjustment.
 * @param {string} path     A fully-qualified URL or url component (like a relative path)
 * @return {string}         An encoded URL string
 */
export function encodeURL(path) {

  // Determine whether the path is a well-formed URL
  const url = URL.parseSafe(path);

  // If URL, remove the initial protocol
  if ( url ) path = path.replace(url.protocol, "");

  // Split and encode each URL part
  path = path.split("/").map(p => encodeURIComponent(p).replace(/'/g, "%27")).join("/");

  // Return the encoded URL
  return url ? url.protocol + path : path;
}

/* -------------------------------------------- */

/**
 * Expand a flattened object to be a standard nested Object by converting all dot-notation keys to inner objects.
 * Only simple objects will be expanded. Other Object types like class instances will be retained as-is.
 * @param {object} obj      The object to expand
 * @return {object}         An expanded object
 */
export function expandObject(obj) {
  function _expand(value, depth) {
    if ( depth > 32 ) throw new Error("Maximum object expansion depth exceeded");
    if ( !value ) return value;
    if ( Array.isArray(value) ) return value.map(v => _expand(v, depth+1)); // Map arrays
    if ( value.constructor?.name !== "Object" ) return value;               // Return advanced objects directly
    const expanded = {};                                                    // Expand simple objects
    for ( let [k, v] of Object.entries(value) ) {
      setProperty(expanded, k, _expand(v, depth+1));
    }
    return expanded;
  }
  return _expand(obj, 0);
}

/* -------------------------------------------- */

/**
 * Filter the contents of some source object using the structure of a template object.
 * Only keys which exist in the template are preserved in the source object.
 *
 * @param {object} source           An object which contains the data you wish to filter
 * @param {object} template         An object which contains the structure you wish to preserve
 * @param {object} [options={}]     Additional options which customize the filtration
 * @param {boolean} [options.deletionKeys=false]    Whether to keep deletion keys
 * @param {boolean} [options.templateValues=false]  Instead of keeping values from the source, instead draw values from the template
 *
 * @example Filter an object
 * ```js
 * const source = {foo: {number: 1, name: "Tim", topping: "olives"}, bar: "baz"};
 * const template = {foo: {number: 0, name: "Mit", style: "bold"}, other: 72};
 * filterObject(source, template); // {foo: {number: 1, name: "Tim"}};
 * filterObject(source, template, {templateValues: true}); // {foo: {number: 0, name: "Mit"}};
 * ```
 */
export function filterObject(source, template, {deletionKeys=false, templateValues=false}={}) {

  // Validate input
  const ts = getType(source);
  const tt = getType(template);
  if ( (ts !== "Object") || (tt !== "Object")) throw new Error("One of source or template are not Objects!");

  // Define recursive filtering function
  const _filter = function(s, t, filtered) {
    for ( let [k, v] of Object.entries(s) ) {
      let has = t.hasOwnProperty(k);
      let x = t[k];

      // Case 1 - inner object
      if ( has && (getType(v) === "Object") && (getType(x) === "Object") ) {
        filtered[k] = _filter(v, x, {});
      }

      // Case 2 - inner key
      else if ( has ) {
        filtered[k] = templateValues ? x : v;
      }

      // Case 3 - special key
      else if ( deletionKeys && k.startsWith("-=") ) {
        filtered[k] = v;
      }
    }
    return filtered;
  };

  // Begin filtering at the outer-most layer
  return _filter(source, template, {});
}

/* -------------------------------------------- */

/**
 * Flatten a possibly multi-dimensional object to a one-dimensional one by converting all nested keys to dot notation
 * @param {object} obj        The object to flatten
 * @param {number} [_d=0]     Track the recursion depth to prevent overflow
 * @return {object}           A flattened object
 */
export function flattenObject(obj, _d=0) {
  const flat = {};
  if ( _d > 100 ) {
    throw new Error("Maximum depth exceeded");
  }
  for ( let [k, v] of Object.entries(obj) ) {
    let t = getType(v);
    if ( t === "Object" ) {
      if ( isEmpty(v) ) flat[k] = v;
      let inner = flattenObject(v, _d+1);
      for ( let [ik, iv] of Object.entries(inner) ) {
        flat[`${k}.${ik}`] = iv;
      }
    }
    else flat[k] = v;
  }
  return flat;
}

/* -------------------------------------------- */

/**
 * Obtain references to the parent classes of a certain class.
 * @param {Function} cls            An class definition
 * @return {Array<typeof Object>}   An array of parent classes which the provided class extends
 */
export function getParentClasses(cls) {
  if ( typeof cls !== "function" ) {
    throw new Error("The provided class is not a type of Function");
  }
  const parents = [];
  let parent = Object.getPrototypeOf(cls);
  while ( parent ) {
    parents.push(parent);
    parent = Object.getPrototypeOf(parent);
  }
  return parents.slice(0, -2)
}

/* -------------------------------------------- */

/**
 * Get the URL route for a certain path which includes a path prefix, if one is set
 * @param {string} path             The Foundry URL path
 * @param {string|null} [prefix]    A path prefix to apply
 * @returns {string}                The absolute URL path
 */
export function getRoute(path, {prefix}={}) {
  prefix = prefix === undefined ? globalThis.ROUTE_PREFIX : prefix || null;
  path = path.replace(/(^[\/]+)|([\/]+$)/g, ""); // Strip leading and trailing slashes
  let paths = [""];
  if ( prefix ) paths.push(prefix);
  paths = paths.concat([path.replace(/(^\/)|(\/$)/g, "")]);
  return paths.join("/");
}

/* -------------------------------------------- */

/**
 * Learn the underlying data type of some variable. Supported identifiable types include:
 * undefined, null, number, string, boolean, function, Array, Set, Map, Promise, Error,
 * HTMLElement (client side only), Object (catchall for other object types)
 * @param {*} variable  A provided variable
 * @return {string}     The named type of the token
 */
export function getType(variable) {

  // Primitive types, handled with simple typeof check
  const typeOf = typeof variable;
  if ( typeOf !== "object" ) return typeOf;

  // Special cases of object
  if ( variable === null ) return "null";
  if ( !variable.constructor ) return "Object"; // Object with the null prototype.
  if ( variable.constructor.name === "Object" ) return "Object";  // simple objects

  // Match prototype instances
  const prototypes = [
    [Array, "Array"],
    [Set, "Set"],
    [Map, "Map"],
    [Promise, "Promise"],
    [Error, "Error"],
    [Color, "number"]
  ];
  if ( "HTMLElement" in globalThis ) prototypes.push([globalThis.HTMLElement, "HTMLElement"]);
  for ( const [cls, type] of prototypes ) {
    if ( variable instanceof cls ) return type;
  }

  // Unknown Object type
  return "Object";
}

/* -------------------------------------------- */

/**
 * A helper function which tests whether an object has a property or nested property given a string key.
 * The method also supports arrays if the provided key is an integer index of the array.
 * The string key supports the notation a.b.c which would return true if object[a][b][c] exists
 * @param {object} object   The object to traverse
 * @param {string} key      An object property with notation a.b.c
 * @returns {boolean}       An indicator for whether the property exists
 */
export function hasProperty(object, key) {
  if ( !key || !object ) return false;
  if ( key in object ) return true;
  let target = object;
  for ( let p of key.split('.') ) {
    if ( !target || (typeof target !== "object") ) return false;
    if ( p in target ) target = target[p];
    else return false;
  }
  return true;
}

/* -------------------------------------------- */

/**
 * A helper function which searches through an object to retrieve a value by a string key.
 * The method also supports arrays if the provided key is an integer index of the array.
 * The string key supports the notation a.b.c which would return object[a][b][c]
 * @param {object} object   The object to traverse
 * @param {string} key      An object property with notation a.b.c
 * @return {*}              The value of the found property
 */
export function getProperty(object, key) {
  if ( !key || !object ) return undefined;
  if ( key in object ) return object[key];
  let target = object;
  for ( let p of key.split('.') ) {
    if ( !target || (typeof target !== "object") ) return undefined;
    if ( p in target ) target = target[p];
    else return undefined;
  }
  return target;
}

/* -------------------------------------------- */

/**
 * A helper function which searches through an object to assign a value using a string key
 * This string key supports the notation a.b.c which would target object[a][b][c]
 * @param {object} object   The object to update
 * @param {string} key      The string key
 * @param {*} value         The value to be assigned
 * @return {boolean}        Whether the value was changed from its previous value
 */
export function setProperty(object, key, value) {
  if ( !key ) return false;

  // Convert the key to an object reference if it contains dot notation
  let target = object;
  if ( key.indexOf('.') !== -1 ) {
    let parts = key.split('.');
    key = parts.pop();
    target = parts.reduce((o, i) => {
      if ( !o.hasOwnProperty(i) ) o[i] = {};
      return o[i];
    }, object);
  }

  // Update the target
  if ( !(key in target) || (target[key] !== value) ) {
    target[key] = value;
    return true;
  }
  return false;
}

/* -------------------------------------------- */

/**
 * Invert an object by assigning its values as keys and its keys as values.
 * @param {object} obj    The original object to invert
 * @returns {object}      The inverted object with keys and values swapped
 */
export function invertObject(obj) {
  const inverted = {};
  for ( let [k, v] of Object.entries(obj) ) {
    if ( v in inverted ) throw new Error("The values of the provided object must be unique in order to invert it.");
    inverted[v] = k;
  }
  return inverted;
}

/* -------------------------------------------- */

/**
 * Return whether a target version (v1) is more advanced than some other reference version (v0).
 * Supports either numeric or string version comparison with version parts separated by periods.
 * @param {number|string} v1    The target version
 * @param {number|string} v0    The reference version
 * @return {boolean}            Is v1 a more advanced version than v0?
 */
export function isNewerVersion(v1, v0) {

  // Handle numeric versions
  if ( (typeof v1 === "number") && (typeof v0 === "number") ) return v1 > v0;

  // Handle string parts
  let v1Parts = String(v1).split(".");
  let v0Parts = String(v0).split(".");

  // Iterate over version parts
  for ( let [i, p1] of v1Parts.entries() ) {
    let p0 = v0Parts[i];

    // If the prior version doesn't have a part, v1 wins
    if ( p0 === undefined ) return true;

    // If both parts are numbers, use numeric comparison to avoid cases like "12" < "5"
    if ( Number.isNumeric(p0) && Number.isNumeric(p1) ) {
      if ( Number(p1) !== Number(p0) ) return Number(p1) > Number(p0);
    }

    // Otherwise, compare as strings
    if ( p1 !== p0 ) return p1 > p0;
  }

  // If there are additional parts to v0, it is not newer
  if ( v0Parts.length > v1Parts.length ) return false;

  // If we have not returned false by now, it's either newer or the same
  return !v1Parts.equals(v0Parts);
}

/* -------------------------------------------- */

/**
 * Test whether a value is empty-like; either undefined or a content-less object.
 * @param {*} value       The value to test
 * @returns {boolean}     Is the value empty-like?
 */
export function isEmpty(value) {
  const t = getType(value);
  switch ( t ) {
    case "undefined":
      return true;
    case "null":
      return true;
    case "Array":
      return !value.length;
    case "Object":
      return !Object.keys(value).length;
    case "Set":
    case "Map":
      return !value.size;
    default:
      return false;
  }
}

/* -------------------------------------------- */

/**
 * Update a source object by replacing its keys and values with those from a target object.
 *
 * @param {object} original                           The initial object which should be updated with values from the
 *                                                    target
 * @param {object} [other={}]                         A new object whose values should replace those in the source
 * @param {object} [options={}]                       Additional options which configure the merge
 * @param {boolean} [options.insertKeys=true]         Control whether to insert new top-level objects into the resulting
 *                                                    structure which do not previously exist in the original object.
 * @param {boolean} [options.insertValues=true]       Control whether to insert new nested values into child objects in
 *                                                    the resulting structure which did not previously exist in the
 *                                                    original object.
 * @param {boolean} [options.overwrite=true]          Control whether to replace existing values in the source, or only
 *                                                    merge values which do not already exist in the original object.
 * @param {boolean} [options.recursive=true]          Control whether to merge inner-objects recursively (if true), or
 *                                                    whether to simply replace inner objects with a provided new value.
 * @param {boolean} [options.inplace=true]            Control whether to apply updates to the original object in-place
 *                                                    (if true), otherwise the original object is duplicated and the
 *                                                    copy is merged.
 * @param {boolean} [options.enforceTypes=false]      Control whether strict type checking requires that the value of a
 *                                                    key in the other object must match the data type in the original
 *                                                    data to be merged.
 * @param {boolean} [options.performDeletions=false]  Control whether to perform deletions on the original object if
 *                                                    deletion keys are present in the other object.
 * @param {number} [_d=0]                             A privately used parameter to track recursion depth.
 * @returns {object}                                  The original source object including updated, inserted, or
 *                                                    overwritten records.
 *
 * @example Control how new keys and values are added
 * ```js
 * mergeObject({k1: "v1"}, {k2: "v2"}, {insertKeys: false}); // {k1: "v1"}
 * mergeObject({k1: "v1"}, {k2: "v2"}, {insertKeys: true});  // {k1: "v1", k2: "v2"}
 * mergeObject({k1: {i1: "v1"}}, {k1: {i2: "v2"}}, {insertValues: false}); // {k1: {i1: "v1"}}
 * mergeObject({k1: {i1: "v1"}}, {k1: {i2: "v2"}}, {insertValues: true}); // {k1: {i1: "v1", i2: "v2"}}
 * ```
 *
 * @example Control how existing data is overwritten
 * ```js
 * mergeObject({k1: "v1"}, {k1: "v2"}, {overwrite: true}); // {k1: "v2"}
 * mergeObject({k1: "v1"}, {k1: "v2"}, {overwrite: false}); // {k1: "v1"}
 * ```
 *
 * @example Control whether merges are performed recursively
 * ```js
 * mergeObject({k1: {i1: "v1"}}, {k1: {i2: "v2"}}, {recursive: false}); // {k1: {i2: "v2"}}
 * mergeObject({k1: {i1: "v1"}}, {k1: {i2: "v2"}}, {recursive: true}); // {k1: {i1: "v1", i2: "v2"}}
 * ```
 *
 * @example Deleting an existing object key
 * ```js
 * mergeObject({k1: "v1", k2: "v2"}, {"-=k1": null}, {performDeletions: true});   // {k2: "v2"}
 * ```
 */
export function mergeObject(original, other={}, {
    insertKeys=true, insertValues=true, overwrite=true, recursive=true, inplace=true, enforceTypes=false,
    performDeletions=false
  }={}, _d=0) {
  other = other || {};
  if (!(original instanceof Object) || !(other instanceof Object)) {
    throw new Error("One of original or other are not Objects!");
  }
  const options = {insertKeys, insertValues, overwrite, recursive, inplace, enforceTypes, performDeletions};

  // Special handling at depth 0
  if ( _d === 0 ) {
    if ( Object.keys(other).some(k => /\./.test(k)) ) other = expandObject(other);
    if ( Object.keys(original).some(k => /\./.test(k)) ) {
      const expanded = expandObject(original);
      if ( inplace ) {
        Object.keys(original).forEach(k => delete original[k]);
        Object.assign(original, expanded);
      }
      else original = expanded;
    }
    else if ( !inplace ) original = deepClone(original);
  }

  // Iterate over the other object
  for ( let k of Object.keys(other) ) {
    const v = other[k];
    if ( original.hasOwnProperty(k) ) _mergeUpdate(original, k, v, options, _d+1);
    else _mergeInsert(original, k, v, options, _d+1);
  }
  return original;
}

/**
 * A helper function for merging objects when the target key does not exist in the original
 * @private
 */
function _mergeInsert(original, k, v, {insertKeys, insertValues, performDeletions}={}, _d) {
  // Delete a key
  if ( k.startsWith("-=") && performDeletions ) {
    delete original[k.slice(2)];
    return;
  }

  const canInsert = ((_d <= 1) && insertKeys) || ((_d > 1) && insertValues);
  if ( !canInsert ) return;

  // Recursively create simple objects
  if ( v?.constructor === Object ) {
    original[k] = mergeObject({}, v, {insertKeys: true, inplace: true, performDeletions});
    return;
  }

  // Insert a key
  original[k] = v;
}

/**
 * A helper function for merging objects when the target key exists in the original
 * @private
 */
function _mergeUpdate(original, k, v, {
    insertKeys, insertValues, enforceTypes, overwrite, recursive, performDeletions
  }={}, _d) {
  const x = original[k];
  const tv = getType(v);
  const tx = getType(x);

  // Recursively merge an inner object
  if ( (tv === "Object") && (tx === "Object") && recursive) {
    return mergeObject(x, v, {
      insertKeys, insertValues, overwrite, enforceTypes, performDeletions,
      inplace: true
    }, _d);
  }

  // Overwrite an existing value
  if ( overwrite ) {
    if ( (tx !== "undefined") && (tv !== tx) && enforceTypes ) {
      throw new Error(`Mismatched data types encountered during object merge.`);
    }
    original[k] = v;
  }
}

/* -------------------------------------------- */

/**
 * Parse an S3 key to learn the bucket and the key prefix used for the request.
 * @param {string} key  A fully qualified key name or prefix path.
 * @returns {{bucket: string|null, keyPrefix: string}}
 */
export function parseS3URL(key) {
  const url = URL.parseSafe(key);
  if ( url ) return {
    bucket: url.host.split(".").shift(),
    keyPrefix: url.pathname.slice(1)
  };
  return {
    bucket: null,
    keyPrefix: ""
  };
}

/* -------------------------------------------- */

/**
 * Generate a random alphanumeric string ID of a given requested length using `crypto.getRandomValues()`.
 * @param {number} length    The length of the random string to generate, which must be at most 16384.
 * @return {string}          A string containing random letters (A-Z, a-z) and numbers (0-9).
 */
export function randomID(length=16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const cutoff = 0x100000000 - (0x100000000 % chars.length);
  const random = new Uint32Array(length);
  do {
    crypto.getRandomValues(random);
  } while ( random.some(x => x >= cutoff) );
  let id = "";
  for ( let i = 0; i < length; i++ ) id += chars[random[i] % chars.length];
  return id;
}

/* -------------------------------------------- */

/**
 * Express a timestamp as a relative string
 * @param {Date|string} timeStamp   A timestamp string or Date object to be formatted as a relative time
 * @return {string}                 A string expression for the relative time
 */
export function timeSince(timeStamp) {
  timeStamp = new Date(timeStamp);
  const now = new Date();
  const secondsPast = (now - timeStamp) / 1000;
  let since = "";

  // Format the time
  if (secondsPast < 60) {
    since = secondsPast;
    if ( since < 1 ) return game.i18n.localize("TIME.Now");
    else since = Math.round(since) + game.i18n.localize("TIME.SecondsAbbreviation");
  }
  else if (secondsPast < 3600) since = Math.round(secondsPast / 60) + game.i18n.localize("TIME.MinutesAbbreviation");
  else if (secondsPast <= 86400) since = Math.round(secondsPast / 3600) + game.i18n.localize("TIME.HoursAbbreviation");
  else {
    const hours = Math.round(secondsPast / 3600);
    const days = Math.floor(hours / 24);
    since = `${days}${game.i18n.localize("TIME.DaysAbbreviation")} ${hours % 24}${game.i18n.localize("TIME.HoursAbbreviation")}`;
  }

  // Return the string
  return game.i18n.format("TIME.Since", {since: since});
}

/* -------------------------------------------- */

/**
 * Format a file size to an appropriate order of magnitude.
 * @param {number} size  The size in bytes.
 * @param {object} [options]
 * @param {number} [options.decimalPlaces=2]  The number of decimal places to round to.
 * @param {2|10} [options.base=10]            The base to use. In base 10 a kilobyte is 1000 bytes. In base 2 it is
 *                                            1024 bytes.
 * @returns {string}
 */
export function formatFileSize(size, { decimalPlaces=2, base=10 }={}) {
  const units = ["B", "kB", "MB", "GB", "TB"];
  const divisor = base === 2 ? 1024 : 1000;
  let iterations = 0;
  while ( (iterations < units.length) && (size > divisor) ) {
    size /= divisor;
    iterations++;
  }
  return `${size.toFixed(decimalPlaces)} ${units[iterations]}`;
}

/* -------------------------------------------- */

/**
 * @typedef {object} ResolvedUUID
 * @property {string} uuid                      The original UUID.
 * @property {string} [type]                    The type of Document referenced. Legacy compendium UUIDs will not
 *                                              populate this field if the compendium is not active in the World.
 * @property {string} id                        The ID of the Document referenced.
 * @property {string} [primaryType]             The primary Document type of this UUID. Only present if the Document
 *                                              is embedded.
 * @property {string} [primaryId]               The primary Document ID of this UUID. Only present if the Document
 *                                              is embedded.
 * @property {DocumentCollection} [collection]  The collection that the primary Document belongs to.
 * @property {string[]} embedded                Additional Embedded Document parts.
 * @property {Document} [doc]                   An already-resolved parent Document.
 * @property {string} [documentType]            Either the document type or the parent type. Retained for backwards
 *                                              compatibility.
 * @property {string} [documentId]              Either the document id or the parent id. Retained for backwards
 *                                              compatibility.
 */

/**
 * Parse a UUID into its constituent parts, identifying the type and ID of the referenced document.
 * The ResolvedUUID result also identifies a "primary" document which is a root-level document either in the game
 * World or in a Compendium pack which is a parent of the referenced document.
 * @param {string} uuid                  The UUID to parse.
 * @param {object} [options]             Options to configure parsing behavior.
 * @param {foundry.abstract.Document} [options.relative]  A document to resolve relative UUIDs against.
 * @returns {ResolvedUUID}               Returns the Collection, Document Type, and Document ID to resolve the parent
 *                                       document, as well as the remaining Embedded Document parts, if any.
 * @throws {Error}                       An error if the provided uuid string is incorrectly structured
 */
export function parseUuid(uuid, {relative}={}) {
  if ( !uuid ) throw new Error("A uuid string is required");
  const packs = game.packs;

  // Relative UUID
  if ( uuid.startsWith(".") && relative ) return _resolveRelativeUuid(uuid, relative);

  // Split UUID parts
  const parts = uuid.split(".");

  // Check for redirects.
  if ( game.compendiumUUIDRedirects ) {
    const node = game.compendiumUUIDRedirects.nodeAtPrefix(parts, { hasLeaves: true });
    const [redirect] = node?.[foundry.utils.StringTree.leaves];
    if ( redirect?.length ) parts.splice(0, redirect.length, ...redirect);
  }

  let id;
  let type;
  let primaryId;
  let primaryType;
  let collection;

  // Compendium Documents.
  if ( parts[0] === "Compendium" ) {
    const [, scope, packName] = parts.splice(0, 3);
    collection = packs.get(`${scope}.${packName}`);

    // Re-interpret legacy compendium UUIDs which did not explicitly include their parent document type
    if ( !(COMPENDIUM_DOCUMENT_TYPES.includes(parts[0]) || (parts[0] === "Folder")) ) {
      const type = collection?.documentName;
      parts.unshift(type);
      if ( type ) uuid = ["Compendium", scope, packName, ...parts].filterJoin(".");
    }
    [primaryType, primaryId] = parts.splice(0, 2);
  }

  // World Documents
  else {
    [primaryType, primaryId] = parts.splice(0, 2);
    collection = globalThis.db?.[primaryType] ?? CONFIG[primaryType]?.collection?.instance;
  }

  // Embedded Documents
  if ( parts.length ) {
    if ( parts.length % 2 ) throw new Error("Invalid number of embedded UUID parts");
    id = parts.at(-1);
    type = parts.at(-2);
  }

  // Primary Documents
  else {
    id = primaryId;
    type = primaryType;
    primaryId = primaryType = undefined;
  }

  // Return resolved UUID
  return {uuid, type, id, collection, embedded: parts, primaryType, primaryId,
    documentType: primaryType ?? type, documentId: primaryId ?? id};
}

/* -------------------------------------------- */

/**
 * Resolve a UUID relative to another document.
 * The general-purpose algorithm for resolving relative UUIDs is as follows:
 * 1. If the number of parts is odd, remove the first part and resolve it against the current document and update the
 *    current document.
 * 2. If the number of parts is even, resolve embedded documents against the current document.
 * @param {string} uuid        The UUID to resolve.
 * @param {foundry.abstract.Document} relative  The document to resolve against.
 * @returns {ResolvedUUID}     A resolved UUID object
 * @private
 */
function _resolveRelativeUuid(uuid, relative) {
  if ( !(relative instanceof foundry.abstract.Document) ) {
    throw new Error("A relative Document instance must be provided to _resolveRelativeUuid");
  }
  uuid = uuid.substring(1);
  const parts = uuid.split(".");
  if ( !parts.length ) throw new Error("Invalid relative UUID");
  let id;
  let type;
  let root;
  let primaryType;
  let primaryId;
  let collection;

  // Identify the root document and its collection
  const getRoot = (doc) => {
    if ( doc.parent ) parts.unshift(doc.documentName, doc.id);
    return doc.parent ? getRoot(doc.parent) : doc;
  }

  // Even-numbered parts include an explicit child document type
  if ( (parts.length % 2) === 0 ) {
    root = getRoot(relative);
    id = parts.at(-1);
    type = parts.at(-2);
    primaryType = root.documentName;
    primaryId = root.id;
    uuid = [primaryType, primaryId, ...parts].join(".");
  }

  // Relative Embedded Document
  else if ( relative.parent ) {
    root = getRoot(relative.parent);
    id = parts.at(-1);
    type = relative.documentName;
    parts.unshift(type);
    primaryType = root.documentName;
    primaryId = root.id;
    uuid = [primaryType, primaryId, ...parts].join(".");
  }

  // Relative Document
  else {
    root = relative;
    id = parts.pop();
    type = relative.documentName;
    uuid = [type, id].join(".");
  }

  // Recreate fully-qualified UUID and return the resolved result
  collection = root.pack ? root.compendium : root.collection;
  if ( root.pack ) uuid = `Compendium.${root.pack}.${uuid}`;
  return {uuid, type, id, collection, primaryType, primaryId, embedded: parts,
    documentType: primaryType ?? type, documentId: primaryId ?? id};
}
