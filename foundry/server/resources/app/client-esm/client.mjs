/**
 * The Foundry Virtual Tabletop client-side ESModule API.
 * @module foundry
 */

/* ----------------------------------------- */
/*  Imports for JavaScript Usage             */
/* ----------------------------------------- */

// Import Commons Modules
import * as primitives from "../common/primitives/module.mjs";
import * as CONST from "../common/constants.mjs";
import * as abstract from "../common/abstract/module.mjs";
import * as documents from "../common/documents/_module.mjs";
import * as packages from "../common/packages/module.mjs";
import * as utils from "../common/utils/module.mjs";
import * as config from "../common/config.mjs";
import * as prosemirror from "../common/prosemirror/_module.mjs"
import * as grid from "../common/grid/_module.mjs";

// Import Client Modules
import * as applications from "./applications/_module.mjs";
import * as audio from "./audio/_module.mjs";
import * as canvas from "./canvas/_module.mjs";
import * as helpers from "./helpers/_module.mjs";
import * as data from "./data/_module.mjs";
import * as dice from "./dice/_module.mjs";
import {AmbientLightConfig} from "./applications/sheets/_module.mjs";

/* ----------------------------------------- */
/*  Exports for ESModule and Typedoc Usage   */
/* ----------------------------------------- */

/**
 * Constant definitions used throughout the Foundry Virtual Tabletop framework.
 */
export * as CONST from "../common/constants.mjs";

/**
 * Abstract class definitions for fundamental concepts used throughout the Foundry Virtual Tabletop framework.
 */
export * as abstract from "../common/abstract/module.mjs";

/**
 * Application configuration options
 */
export * as config from "../common/config.mjs";

/**
 * Document definitions used throughout the Foundry Virtual Tabletop framework.
 */
export * as documents from "../common/documents/_module.mjs";

/**
 * Package data definitions, validations, and schema.
 */
export * as packages from "../common/packages/module.mjs";

/**
 * Utility functions providing helpful functionality.
 */
export * as utils from "../common/utils/module.mjs";

/**
 * A library for providing rich text editing using ProseMirror within the Foundry Virtual Tabletop game client.
 */
export * as prosemirror from "../common/prosemirror/_module.mjs";

/**
 * Grid classes.
 */
export * as grid from "../common/grid/_module.mjs";

/**
 * A library for rendering and managing HTML user interface elements within the Foundry Virtual Tabletop game client.
 */
export * as applications from "./applications/_module.mjs";

/**
 * A library for controlling audio playback within the Foundry Virtual Tabletop game client.
 */
export * as audio from "./audio/_module.mjs";

/**
 * A submodule defining concepts related to canvas rendering.
 */
export * as canvas from "./canvas/_module.mjs";

/**
 * A submodule containing core helper classes.
 */
export * as helpers from "./helpers/_module.mjs";

/**
 * A module which defines data architecture components.
 */
export * as data from "./data/_module.mjs";

/**
 * A module for parsing and executing dice roll syntax.
 */
export * as dice from "./dice/_module.mjs";

/**
 * Shared importable types.
 */
export * as types from "../common/types.mjs";

/* ----------------------------------------- */
/*  Client-Side Globals                      */
/* ----------------------------------------- */

// Global foundry namespace
globalThis.foundry = {
  CONST,            // Commons
  abstract,
  utils,
  documents,
  packages,
  config,
  prosemirror,
  grid,
  applications,     // Client
  audio,
  canvas,
  helpers,
  data,
  dice
};
globalThis.CONST = CONST;

// Specifically expose some global classes
Object.assign(globalThis, {
  Color: utils.Color,
  Collection: utils.Collection,
  ProseMirror: prosemirror,
  Roll: dice.Roll
});

// Immutable constants
for ( const c of Object.values(CONST) ) {
  Object.freeze(c);
}

/* ----------------------------------------- */
/*  Backwards Compatibility                  */
/* ----------------------------------------- */

/** @deprecated since v12 */
addBackwardsCompatibilityReferences({
  AudioHelper: "audio.AudioHelper",
  AmbientSoundConfig: "applications.sheets.AmbientSoundConfig",
  AmbientLightConfig: "applications.sheets.AmbientLightConfig",
  Sound: "audio.Sound",
  RollTerm: "dice.terms.RollTerm",
  MersenneTwister: "dice.MersenneTwister",
  DiceTerm: "dice.terms.DiceTerm",
  MathTerm: "dice.terms.FunctionTerm",
  NumericTerm: "dice.terms.NumericTerm",
  OperatorTerm: "dice.terms.OperatorTerm",
  ParentheticalTerm: "dice.terms.ParentheticalTerm",
  PoolTerm: "dice.terms.PoolTerm",
  StringTerm: "dice.terms.StringTerm",
  Coin: "dice.terms.Coin",
  Die: "dice.terms.Die",
  FateDie: "dice.terms.FateDie",
  twist: "dice.MersenneTwister",
  LightSource: "canvas.sources.PointLightSource",
  DarknessSource: "canvas.sources.PointDarknessSource",
  GlobalLightSource: "canvas.sources.GlobalLightSource",
  VisionSource: "canvas.sources.PointVisionSource",
  SoundSource: "canvas.sources.PointSoundSource",
  MovementSource: "canvas.sources.PointMovementSource",
  PermissionConfig: "applications.apps.PermissionConfig",
  BaseGrid: "grid.GridlessGrid",
  SquareGrid: "grid.SquareGrid",
  HexagonalGrid: "grid.HexagonalGrid",
  GridHex: "grid.GridHex",
  UserConfig: "applications.sheets.UserConfig",
  WordTree: "utils.WordTree"
}, {since: 12, until: 14});

/** @deprecated since v12 */
for ( let [k, v] of Object.entries(utils) ) {
  if ( !(k in globalThis) ) {
    Object.defineProperty(globalThis, k, {
      get() {
        foundry.utils.logCompatibilityWarning(`You are accessing globalThis.${k} which must now be accessed via `
          + `foundry.utils.${k}`, {since: 12, until: 14, once: true});
        return v;
      }
    });
  }
}

/**
 * Add Foundry Virtual Tabletop ESModule exports to the global scope for backwards compatibility
 * @param {object} mapping      A mapping of class name to ESModule export path
 * @param {object} [options]    Options which modify compatible references
 * @param {number} [options.since]  Deprecated since generation
 * @param {number} [options.until]  Backwards compatibility provided until generation
 */
function addBackwardsCompatibilityReferences(mapping, {since, until}={}) {
  const properties = Object.fromEntries(Object.entries(mapping).map(([name, path]) => {
    return [name, {
      get() {
        foundry.utils.logCompatibilityWarning(`You are accessing the global "${name}" which is now namespaced under `
          + `foundry.${path}`, {since, until, once: true});
        return foundry.utils.getProperty(globalThis.foundry, path);
      }
    }]
  }));
  Object.defineProperties(globalThis, properties);
}

/* ----------------------------------------- */
/*  Dispatch Ready Event                     */
/* ----------------------------------------- */

if ( globalThis.window ) {
  console.log(`${CONST.vtt} | Foundry Virtual Tabletop ESModule loaded`);
  const ready = new Event("FoundryFrameworkLoaded");
  globalThis.dispatchEvent(ready);
}
