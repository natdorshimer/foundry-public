import Document from "../abstract/document.mjs";
import {mergeObject} from "../utils/helpers.mjs";
import * as CONST from "../constants.mjs";
import * as documents from "./_module.mjs";
import * as fields from "../data/fields.mjs";
import {TextureData} from "../data/data.mjs";

/**
 * @typedef {import("./_types.mjs").SceneData} SceneData
 * @typedef {import("../types.mjs").DocumentConstructionContext} DocumentConstructionContext
 */

/**
 * The Scene Document.
 * Defines the DataSchema and common behaviors for a Scene which are shared between both client and server.
 * @mixes SceneData
 */
export default class BaseScene extends Document {
  /**
   * Construct a Scene document using provided data and context.
   * @param {Partial<SceneData>} data               Initial data from which to construct the Scene
   * @param {DocumentConstructionContext} context   Construction context options
   */
  constructor(data, context) {
    super(data, context);
  }

  /* -------------------------------------------- */
  /*  Model Configuration                         */
  /* -------------------------------------------- */

  /** @inheritdoc */
  static metadata = Object.freeze(mergeObject(super.metadata, {
    name: "Scene",
    collection: "scenes",
    indexed: true,
    compendiumIndexFields: ["_id", "name", "thumb", "sort", "folder"],
    embedded: {
      AmbientLight: "lights",
      AmbientSound: "sounds",
      Drawing: "drawings",
      MeasuredTemplate: "templates",
      Note: "notes",
      Region: "regions",
      Tile: "tiles",
      Token: "tokens",
      Wall: "walls"
    },
    label: "DOCUMENT.Scene",
    labelPlural: "DOCUMENT.Scenes",
    preserveOnImport: [...super.metadata.preserveOnImport, "active"],
    schemaVersion: "12.325"
  }, {inplace: false}));

  /** @inheritdoc */
  static defineSchema() {
    // Define reusable ambience schema for environment
    const environmentData = defaults => new fields.SchemaField({
      hue: new fields.HueField({required: true, initial: defaults.hue,
        label: "SCENES.ENVIRONMENT.Hue", hint: "SCENES.ENVIRONMENT.HueHint"}),
      intensity: new fields.AlphaField({required: true, nullable: false, initial: defaults.intensity,
        label: "SCENES.ENVIRONMENT.Intensity", hint: "SCENES.ENVIRONMENT.IntensityHint"}),
      luminosity: new fields.NumberField({required: true, nullable: false, initial: defaults.luminosity, min: -1, max: 1,
        label: "SCENES.ENVIRONMENT.Luminosity", hint: "SCENES.ENVIRONMENT.LuminosityHint"}),
      saturation: new fields.NumberField({required: true, nullable: false, initial: defaults.saturation, min: -1, max: 1,
        label: "SCENES.ENVIRONMENT.Saturation", hint: "SCENES.ENVIRONMENT.SaturationHint"}),
      shadows: new fields.NumberField({required: true, nullable: false, initial: defaults.shadows, min: 0, max: 1,
        label: "SCENES.ENVIRONMENT.Shadows", hint: "SCENES.ENVIRONMENT.ShadowsHint"})
    });
    // Reuse parts of the LightData schema for the global light
    const lightDataSchema = foundry.data.LightData.defineSchema();

    return {
      _id: new fields.DocumentIdField(),
      name: new fields.StringField({required: true, blank: false, textSearch: true}),

      // Navigation
      active: new fields.BooleanField(),
      navigation: new fields.BooleanField({initial: true}),
      navOrder: new fields.NumberField({required: true, nullable: false, integer: true, initial: 0}),
      navName: new fields.HTMLField({textSearch: true}),

      // Canvas Dimensions
      background: new TextureData(),
      foreground: new fields.FilePathField({categories: ["IMAGE", "VIDEO"]}),
      foregroundElevation: new fields.NumberField({required: true, positive: true, integer: true}),
      thumb: new fields.FilePathField({categories: ["IMAGE"]}),
      width: new fields.NumberField({integer: true, positive: true, initial: 4000}),
      height: new fields.NumberField({integer: true, positive: true, initial: 3000}),
      padding: new fields.NumberField({required: true, nullable: false, min: 0, max: 0.5, step: 0.05, initial: 0.25}),
      initial: new fields.SchemaField({
        x: new fields.NumberField({integer: true, required: true}),
        y: new fields.NumberField({integer: true, required: true}),
        scale: new fields.NumberField({required: true, max: 3, positive: true, initial: 0.5})
      }),
      backgroundColor: new fields.ColorField({nullable: false, initial: "#999999"}),

      // Grid Configuration
      grid: new fields.SchemaField({
        type: new fields.NumberField({required: true, choices: Object.values(CONST.GRID_TYPES),
          initial: () => game.system.grid.type, validationError: "must be a value in CONST.GRID_TYPES"}),
        size: new fields.NumberField({required: true, nullable: false, integer: true, min: CONST.GRID_MIN_SIZE,
          initial: 100, validationError: `must be an integer number of pixels, ${CONST.GRID_MIN_SIZE} or greater`}),
        style: new fields.StringField({required: true, blank: false, initial: "solidLines"}),
        thickness: new fields.NumberField({required: true, nullable: false, positive: true, integer: true, initial: 1}),
        color: new fields.ColorField({required: true, nullable: false, initial: "#000000"}),
        alpha: new fields.AlphaField({initial: 0.2}),
        distance: new fields.NumberField({required: true, nullable: false, positive: true,
          initial: () => game.system.grid.distance}),
        units: new fields.StringField({required: true, initial: () => game.system.grid.units})
      }),

      // Vision Configuration
      tokenVision: new fields.BooleanField({initial: true}),
      fog: new fields.SchemaField({
        exploration: new fields.BooleanField({initial: true}),
        reset: new fields.NumberField({required: false, initial: undefined}),
        overlay: new fields.FilePathField({categories: ["IMAGE", "VIDEO"]}),
        colors: new fields.SchemaField({
          explored: new fields.ColorField({label: "SCENES.FogExploredColor"}),
          unexplored: new fields.ColorField({label: "SCENES.FogUnexploredColor"})
        })
      }),

      // Environment Configuration
      environment: new fields.SchemaField({
        darknessLevel: new fields.AlphaField({initial: 0}),
        darknessLock: new fields.BooleanField({initial: false}),
        globalLight: new fields.SchemaField({
          enabled: new fields.BooleanField({required: true, initial: false}),
          alpha: lightDataSchema.alpha,
          bright: new fields.BooleanField({required: true, initial: false}),
          color: lightDataSchema.color,
          coloration: lightDataSchema.coloration,
          luminosity: new fields.NumberField({required: true, nullable: false, initial: 0, min: 0, max: 1}),
          saturation: lightDataSchema.saturation,
          contrast: lightDataSchema.contrast,
          shadows: lightDataSchema.shadows,
          darkness: lightDataSchema.darkness
        }),
        cycle: new fields.BooleanField({initial: true}),
        base: environmentData({hue: 0, intensity: 0, luminosity: 0, saturation: 0, shadows: 0}),
        dark: environmentData({hue: 257/360, intensity: 0, luminosity: -0.25, saturation: 0, shadows: 0})
      }),

      // Embedded Collections
      drawings: new fields.EmbeddedCollectionField(documents.BaseDrawing),
      tokens: new fields.EmbeddedCollectionField(documents.BaseToken),
      lights: new fields.EmbeddedCollectionField(documents.BaseAmbientLight),
      notes: new fields.EmbeddedCollectionField(documents.BaseNote),
      sounds: new fields.EmbeddedCollectionField(documents.BaseAmbientSound),
      regions: new fields.EmbeddedCollectionField(documents.BaseRegion),
      templates: new fields.EmbeddedCollectionField(documents.BaseMeasuredTemplate),
      tiles: new fields.EmbeddedCollectionField(documents.BaseTile),
      walls: new fields.EmbeddedCollectionField(documents.BaseWall),

      // Linked Documents
      playlist: new fields.ForeignDocumentField(documents.BasePlaylist),
      playlistSound: new fields.ForeignDocumentField(documents.BasePlaylistSound, {idOnly: true}),
      journal: new fields.ForeignDocumentField(documents.BaseJournalEntry),
      journalEntryPage: new fields.ForeignDocumentField(documents.BaseJournalEntryPage, {idOnly: true}),
      weather: new fields.StringField({required: true}),

      // Permissions
      folder: new fields.ForeignDocumentField(documents.BaseFolder),
      sort: new fields.IntegerSortField(),
      ownership: new fields.DocumentOwnershipField(),
      flags: new fields.ObjectField(),
      _stats: new fields.DocumentStatsField()
    }
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * Static Initializer Block for deprecated properties.
   * @see [Static Initialization Blocks](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Static_initialization_blocks)
   */
  static {
    const migrations = {
      fogExploration: "fog.exploration",
      fogReset: "fog.reset",
      fogOverlay: "fog.overlay",
      fogExploredColor: "fog.colors.explored",
      fogUnexploredColor: "fog.colors.unexplored",
      globalLight: "environment.globalLight.enabled",
      globalLightThreshold: "environment.globalLight.darkness.max",
      darkness: "environment.darknessLevel"
    };
    Object.defineProperties(this.prototype, Object.fromEntries(
      Object.entries(migrations).map(([o, n]) => [o, {
        get() {
          this.constructor._logDataFieldMigration(o, n, {since: 12, until: 14});
          return foundry.utils.getProperty(this, n);
        },
        set(v) {
          this.constructor._logDataFieldMigration(o, n, {since: 12, until: 14});
          return foundry.utils.setProperty(this, n, v);
        },
        configurable: true
      }])));
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  static migrateData(data) {
    /**
     * Migration to fog schema fields. Can be safely removed in V14+
     * @deprecated since v12
     */
    for ( const [oldKey, newKey] of Object.entries({
      "fogExploration": "fog.exploration",
      "fogReset": "fog.reset",
      "fogOverlay": "fog.overlay",
      "fogExploredColor": "fog.colors.explored",
      "fogUnexploredColor": "fog.colors.unexplored"
    }) ) this._addDataFieldMigration(data, oldKey, newKey);

    /**
     * Migration to global light embedded fields. Can be safely removed in V14+
     * @deprecated since v12
     */
    this._addDataFieldMigration(data, "globalLight", "environment.globalLight.enabled");
    this._addDataFieldMigration(data, "globalLightThreshold", "environment.globalLight.darkness.max",
      d => d.globalLightThreshold ?? 1);

    /**
     * Migration to environment darkness level. Can be safely removed in V14+
     * @deprecated since v12
     */
    this._addDataFieldMigration(data, "darkness", "environment.darknessLevel");

    /**
     * Migrate sourceId.
     * @deprecated since v12
     */
    this._addDataFieldMigration(data, "flags.core.sourceId", "_stats.compendiumSource");

    return super.migrateData(data);
  }

  /* ---------------------------------------- */

  /** @inheritdoc */
  static shimData(data, options) {
    /** @deprecated since v12 */
    this._addDataFieldShims(data, {
      fogExploration: "fog.exploration",
      fogReset: "fog.reset",
      fogOverlay: "fog.overlay",
      fogExploredColor: "fog.colors.explored",
      fogUnexploredColor: "fog.colors.unexplored",
      globalLight: "environment.globalLight.enabled",
      globalLightThreshold: "environment.globalLight.darkness.max",
      darkness: "environment.darknessLevel"
    }, {since: 12, until: 14});
    return super.shimData(data, options);
  }
}
