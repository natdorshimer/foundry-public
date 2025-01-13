/**
 * Runtime configuration settings for Foundry VTT which exposes a large number of variables which determine how
 * aspects of the software behaves.
 *
 * Unlike the CONST analog which is frozen and immutable, the CONFIG object may be updated during the course of a
 * session or modified by system and module developers to adjust how the application behaves.
 *
 * @type {object}
 */
const CONFIG = globalThis.CONFIG = {

  /**
   * Configure debugging flags to display additional information
   */
  debug: {
    applications: false,
    audio: false,
    combat: false,
    dice: false,
    documents: false,
    fog: {
      extractor: false,
      manager: false
    },
    hooks: false,
    av: false,
    avclient: false,
    mouseInteraction: false,
    time: false,
    keybindings: false,
    polygons: false,
    gamepad: false,
    canvas: {
      primary: {
        bounds: false
      }
    },
    rollParsing: false
  },

  /**
   * Configure the verbosity of compatibility warnings generated throughout the software.
   * The compatibility mode defines the logging level of any displayed warnings.
   * The includePatterns and excludePatterns arrays provide a set of regular expressions which can either only
   * include or specifically exclude certain file paths or warning messages.
   * Exclusion rules take precedence over inclusion rules.
   *
   * @see {@link CONST.COMPATIBILITY_MODES}
   * @type {{mode: number, includePatterns: RegExp[], excludePatterns: RegExp[]}}
   *
   * @example Include Specific Errors
   * ```js
   * const includeRgx = new RegExp("/systems/dnd5e/module/documents/active-effect.mjs");
   * CONFIG.compatibility.includePatterns.push(includeRgx);
   * ```
   *
   * @example Exclude Specific Errors
   * ```js
   * const excludeRgx = new RegExp("/systems/dnd5e/");
   * CONFIG.compatibility.excludePatterns.push(excludeRgx);
   * ```
   *
   * @example Both Include and Exclude
   * ```js
   * const includeRgx = new RegExp("/systems/dnd5e/module/actor/");
   * const excludeRgx = new RegExp("/systems/dnd5e/module/actor/sheets/base.js");
   * CONFIG.compatibility.includePatterns.push(includeRgx);
   * CONFIG.compatibility.excludePatterns.push(excludeRgx);
   * ```
   *
   * @example Targeting more than filenames
   * ```js
   * const includeRgx = new RegExp("applyActiveEffects");
   * CONFIG.compatibility.includePatterns.push(includeRgx);
   * ```
   */
  compatibility: {
    mode: CONST.COMPATIBILITY_MODES.WARNING,
    includePatterns: [],
    excludePatterns: []
  },

  compendium: {
    /**
     * Configure a table of compendium UUID redirects. Must be configured before the game *ready* hook is fired.
     * @type {Record<string, string>}
     *
     * @example Re-map individual UUIDs
     * ```js
     * CONFIG.compendium.uuidRedirects["Compendium.system.heroes.Actor.Tf0JDPzHOrIxz6BH"] = "Compendium.system.villains.Actor.DKYLeIliXXzlAZ2G";
     * ```
     *
     * @example Redirect UUIDs from one compendium to another.
     * ```js
     * CONFIG.compendium.uuidRedirects["Compendium.system.heroes"] = "Compendium.system.villains";
     * ```
     */
    uuidRedirects: {},
  },

  /**
   * Configure the DatabaseBackend used to perform Document operations
   * @type {foundry.data.ClientDatabaseBackend}
   */
  DatabaseBackend: new foundry.data.ClientDatabaseBackend(),

  /**
   * Configuration for the Actor document
   */
  Actor: {
    documentClass: Actor,
    collection: Actors,
    compendiumIndexFields: [],
    compendiumBanner: "ui/banners/actor-banner.webp",
    sidebarIcon: "fas fa-user",
    dataModels: {},
    typeLabels: {},
    typeIcons: {},
    trackableAttributes: {}
  },

  /**
   * Configuration for the Adventure document.
   * Currently for internal use only.
   * @private
   */
  Adventure: {
    documentClass: Adventure,
    exporterClass: AdventureExporter,
    compendiumIndexFields: [],
    compendiumBanner: "ui/banners/adventure-banner.webp",
    sidebarIcon: "fa-solid fa-treasure-chest"
  },

  /**
   * Configuration for the Cards primary Document type
   */
  Cards: {
    collection: CardStacks,
    compendiumIndexFields: [],
    compendiumBanner: "ui/banners/cards-banner.webp",
    documentClass: Cards,
    sidebarIcon: "fa-solid fa-cards",
    dataModels: {},
    presets: {
      pokerDark: {
        type: "deck",
        label: "CARDS.DeckPresetPokerDark",
        src: "cards/poker-deck-dark.json"
      },
      pokerLight: {
        type: "deck",
        label: "CARDS.DeckPresetPokerLight",
        src: "cards/poker-deck-light.json"
      }
    },
    typeLabels: {},
    typeIcons: {
      deck: "fas fa-cards",
      hand: "fa-duotone fa-cards",
      pile: "fa-duotone fa-layer-group"
    }
  },

  /**
   * Configuration for the ChatMessage document
   */
  ChatMessage: {
    documentClass: ChatMessage,
    collection: Messages,
    template: "templates/sidebar/chat-message.html",
    sidebarIcon: "fas fa-comments",
    dataModels: {},
    typeLabels: {},
    typeIcons: {},
    batchSize: 100
  },

  /**
   * Configuration for the Combat document
   */
  Combat: {
    documentClass: Combat,
    collection: CombatEncounters,
    sidebarIcon: "fas fa-swords",
    dataModels: {},
    typeLabels: {},
    typeIcons: {},
    initiative: {
      formula: null,
      decimals: 2
    },
    sounds: {
      epic: {
        label: "COMBAT.Sounds.Epic",
        startEncounter: ["sounds/combat/epic-start-3hit.ogg", "sounds/combat/epic-start-horn.ogg"],
        nextUp: ["sounds/combat/epic-next-horn.ogg"],
        yourTurn: ["sounds/combat/epic-turn-1hit.ogg", "sounds/combat/epic-turn-2hit.ogg"]
      },
      mc: {
        label: "COMBAT.Sounds.MC",
        startEncounter: ["sounds/combat/mc-start-battle.ogg", "sounds/combat/mc-start-begin.ogg", "sounds/combat/mc-start-fight.ogg", "sounds/combat/mc-start-fight2.ogg"],
        nextUp: ["sounds/combat/mc-next-itwillbe.ogg", "sounds/combat/mc-next-makeready.ogg", "sounds/combat/mc-next-youare.ogg"],
        yourTurn: ["sounds/combat/mc-turn-itisyour.ogg", "sounds/combat/mc-turn-itsyour.ogg"]
      }
    }
  },

  /**
   * @typedef {object} DiceFulfillmentConfiguration
   * @property {Record<string, DiceFulfillmentDenomination>} dice  The die denominations available for configuration.
   * @property {Record<string, DiceFulfillmentMethod>} methods     The methods available for fulfillment.
   * @property {string} defaultMethod                              Designate one of the methods to be used by default
   *                                                               for dice fulfillment, if the user hasn't specified
   *                                                               otherwise. Leave this blank to use the configured
   *                                                               randomUniform to generate die rolls.
   */

  /**
   * @typedef {object} DiceFulfillmentDenomination
   * @property {string} label  The human-readable label for the die.
   * @property {string} icon   An icon to display on the configuration sheet.
   */

  /**
   * @typedef {object} DiceFulfillmentMethod
   * @property {string} label                      The human-readable label for the fulfillment method.
   * @property {string} [icon]                     An icon to represent the fulfillment method.
   * @property {boolean} [interactive=false]       Whether this method requires input from the user or if it is
   *                                               fulfilled entirely programmatically.
   * @property {DiceFulfillmentHandler} [handler]  A function to invoke to programmatically fulfil a given term for non-
   *                                               interactive fulfillment methods.
   * @property {typeof RollResolver} [resolver]    A custom RollResolver implementation. If the only interactive methods
   *                                               the user has configured are this method and manual, this resolver
   *                                               will be used to resolve interactive rolls, instead of the default
   *                                               resolver. This resolver must therefore be capable of handling manual
   *                                               rolls.
   */

  /**
   * Only used for non-interactive fulfillment methods. If a die configured to use this fulfillment method is rolled,
   * this handler is called and awaited in order to produce the die roll result.
   * @callback DiceFulfillmentHandler
   * @param {DiceTerm} term           The term being fulfilled.
   * @param {object} [options]        Additional options to configure fulfillment.
   * @returns {Promise<number|void>}  The fulfilled value, or undefined if it could not be fulfilled.
   */

  /**
   * @callback RollFunction
   * @param {...any} args
   * @returns {Promise<number>|number}
   */

  /**
   * Configuration for dice rolling behaviors in the Foundry Virtual Tabletop client.
   * @type {object}
   */
  Dice: {
    /**
     * The Dice types which are supported.
     * @type {Array<typeof DiceTerm>}
     */
    types: [foundry.dice.terms.Die, foundry.dice.terms.FateDie],
    rollModes: Object.entries(CONST.DICE_ROLL_MODES).reduce((obj, e) => {
      let [k, v] = e;
      obj[v] = `CHAT.Roll${k.titleCase()}`;
      return obj;
    }, {}),
    /**
     * Configured Roll class definitions
     * @type {Array<typeof Roll>}
     */
    rolls: [Roll],
    /**
     * Configured DiceTerm class definitions
     * @type {Record<string, typeof RollTerm>}
     */
    termTypes: {
      DiceTerm: foundry.dice.terms.DiceTerm,
      FunctionTerm: foundry.dice.terms.FunctionTerm,
      NumericTerm: foundry.dice.terms.NumericTerm,
      OperatorTerm: foundry.dice.terms.OperatorTerm,
      ParentheticalTerm: foundry.dice.terms.ParentheticalTerm,
      PoolTerm: foundry.dice.terms.PoolTerm,
      StringTerm: foundry.dice.terms.StringTerm
    },
    /**
     * Configured roll terms and the classes they map to.
     * @enum {typeof DiceTerm}
     */
    terms: {
      c: foundry.dice.terms.Coin,
      d: foundry.dice.terms.Die,
      f: foundry.dice.terms.FateDie
    },
    /**
     * A function used to provide random uniform values.
     * @type {function():number}
     */
    randomUniform: foundry.dice.MersenneTwister.random,

    /**
     * A parser implementation for parsing Roll expressions.
     * @type {typeof RollParser}
     */
    parser: foundry.dice.RollParser,

    /**
     * A collection of custom functions that can be included in roll expressions.
     * @type {Record<string, RollFunction>}
     */
    functions: {},

    /**
     * Dice roll fulfillment configuration.
     * @type {DiceFulfillmentConfiguration}
     * @type {{dice: Record<string, DiceFulfillmentDenomination>, methods: Record<string, DiceFulfillmentMethod>}}
     */
    fulfillment: {
      dice: {
        d4: { label: "d4", icon: '<i class="fas fa-dice-d4"></i>' },
        d6: { label: "d6", icon: '<i class="fas fa-dice-d6"></i>' },
        d8: { label: "d8", icon: '<i class="fas fa-dice-d8"></i>' },
        d10: { label: "d10", icon: '<i class="fas fa-dice-d10"></i>' },
        d12: { label: "d12", icon: '<i class="fas fa-dice-d12"></i>' },
        d20: { label: "d20", icon: '<i class="fas fa-dice-d20"></i>' },
        d100: { label: "d100", icon: '<i class="fas fa-percent"></i>' }
      },
      methods: {
        mersenne: {
          label: "DICE.FULFILLMENT.Mersenne",
          interactive: false,
          handler: term => term.mapRandomFace(foundry.dice.MersenneTwister.random())
        },
        manual: {
          label: "DICE.FULFILLMENT.Manual",
          icon: '<i class="fas fa-keyboard"></i>',
          interactive: true
        }
      },
      defaultMethod: ""
    }
  },

  /**
   * Configuration for the FogExploration document
   */
  FogExploration: {
    documentClass: FogExploration,
    collection: FogExplorations
  },

  /**
   * Configuration for the Folder document
   */
  Folder: {
    documentClass: Folder,
    collection: Folders,
    sidebarIcon: "fas fa-folder"
  },

  /**
   * Configuration for Item document
   */
  Item: {
    documentClass: Item,
    collection: Items,
    compendiumIndexFields: [],
    compendiumBanner: "ui/banners/item-banner.webp",
    sidebarIcon: "fas fa-suitcase",
    dataModels: {},
    typeLabels: {},
    typeIcons: {}
  },

  /**
   * Configuration for the JournalEntry document
   */
  JournalEntry: {
    documentClass: JournalEntry,
    collection: Journal,
    compendiumIndexFields: [],
    compendiumBanner: "ui/banners/journalentry-banner.webp",
    noteIcons: {
      Anchor: "icons/svg/anchor.svg",
      Barrel: "icons/svg/barrel.svg",
      Book: "icons/svg/book.svg",
      Bridge: "icons/svg/bridge.svg",
      Cave: "icons/svg/cave.svg",
      Castle: "icons/svg/castle.svg",
      Chest: "icons/svg/chest.svg",
      City: "icons/svg/city.svg",
      Coins: "icons/svg/coins.svg",
      Fire: "icons/svg/fire.svg",
      "Hanging Sign": "icons/svg/hanging-sign.svg",
      House: "icons/svg/house.svg",
      Mountain: "icons/svg/mountain.svg",
      "Oak Tree": "icons/svg/oak.svg",
      Obelisk: "icons/svg/obelisk.svg",
      Pawprint: "icons/svg/pawprint.svg",
      Ruins: "icons/svg/ruins.svg",
      Skull: "icons/svg/skull.svg",
      Statue: "icons/svg/statue.svg",
      Sword: "icons/svg/sword.svg",
      Tankard: "icons/svg/tankard.svg",
      Temple: "icons/svg/temple.svg",
      Tower: "icons/svg/tower.svg",
      Trap: "icons/svg/trap.svg",
      Village: "icons/svg/village.svg",
      Waterfall: "icons/svg/waterfall.svg",
      Windmill: "icons/svg/windmill.svg"
    },
    sidebarIcon: "fas fa-book-open"
  },

  /**
   * Configuration for the Macro document
   */
  Macro: {
    documentClass: Macro,
    collection: Macros,
    compendiumIndexFields: [],
    compendiumBanner: "ui/banners/macro-banner.webp",
    sidebarIcon: "fas fa-code"
  },

  /**
   * Configuration for the Playlist document
   */
  Playlist: {
    documentClass: Playlist,
    collection: Playlists,
    compendiumIndexFields: [],
    compendiumBanner: "ui/banners/playlist-banner.webp",
    sidebarIcon: "fas fa-music",
    autoPreloadSeconds: 20
  },

  /**
   * Configuration for RollTable random draws
   */
  RollTable: {
    documentClass: RollTable,
    collection: RollTables,
    compendiumIndexFields: ["formula"],
    compendiumBanner: "ui/banners/rolltable-banner.webp",
    sidebarIcon: "fas fa-th-list",
    resultIcon: "icons/svg/d20-black.svg",
    resultTemplate: "templates/dice/table-result.html"
  },

  /**
   * Configuration for the Scene document
   */
  Scene: {
    documentClass: Scene,
    collection: Scenes,
    compendiumIndexFields: [],
    compendiumBanner: "ui/banners/scene-banner.webp",
    sidebarIcon: "fas fa-map"
  },

  Setting: {
    documentClass: Setting,
    collection: WorldSettings
  },

  /**
   * Configuration for the User document
   */
  User: {
    documentClass: User,
    collection: Users
  },

  /* -------------------------------------------- */
  /*  Canvas                                      */
  /* -------------------------------------------- */

  /**
   * Configuration settings for the Canvas and its contained layers and objects
   * @type {object}
   */
  Canvas: {
    blurStrength: 8,
    blurQuality: 4,
    darknessColor: 0x303030,
    daylightColor: 0xEEEEEE,
    brightestColor: 0xFFFFFF,
    chatBubblesClass: ChatBubbles,
    darknessLightPenalty: 0.25,
    dispositionColors: {
      HOSTILE: 0xE72124,
      NEUTRAL: 0xF1D836,
      FRIENDLY: 0x43DFDF,
      INACTIVE: 0x555555,
      PARTY: 0x33BC4E,
      CONTROLLED: 0xFF9829,
      SECRET: 0xA612D4
    },
    /**
     * The class used to render door control icons.
     * @type {typeof DoorControl}
     */
    doorControlClass: DoorControl,
    exploredColor: 0x000000,
    unexploredColor: 0x000000,
    darknessToDaylightAnimationMS: 10000,
    daylightToDarknessAnimationMS: 10000,
    darknessSourceClass: foundry.canvas.sources.PointDarknessSource,
    lightSourceClass: foundry.canvas.sources.PointLightSource,
    globalLightSourceClass: foundry.canvas.sources.GlobalLightSource,
    visionSourceClass: foundry.canvas.sources.PointVisionSource,
    soundSourceClass: foundry.canvas.sources.PointSoundSource,
    groups: {
      hidden: {
        groupClass: HiddenCanvasGroup,
        parent: "stage"
      },
      rendered: {
        groupClass: RenderedCanvasGroup,
        parent: "stage"
      },
      environment: {
        groupClass: EnvironmentCanvasGroup,
        parent: "rendered"
      },
      primary: {
        groupClass: PrimaryCanvasGroup,
        parent: "environment"
      },
      effects: {
        groupClass: EffectsCanvasGroup,
        parent: "environment"
      },
      visibility: {
        groupClass: CanvasVisibility,
        parent: "rendered"
      },
      interface: {
        groupClass: InterfaceCanvasGroup,
        parent: "rendered",
        zIndexDrawings: 500,
        zIndexScrollingText: 1100
      },
      overlay: {
        groupClass: OverlayCanvasGroup,
        parent: "stage"
      }
    },
    layers: {
      weather: {
        layerClass: WeatherEffects,
        group: "primary"
      },
      grid: {
        layerClass: GridLayer,
        group: "interface"
      },
      regions: {
        layerClass: RegionLayer,
        group: "interface"
      },
      drawings: {
        layerClass: DrawingsLayer,
        group: "interface"
      },
      templates: {
        layerClass: TemplateLayer,
        group: "interface"
      },
      tiles: {
        layerClass: TilesLayer,
        group: "interface"
      },
      walls: {
        layerClass: WallsLayer,
        group: "interface"
      },
      tokens: {
        layerClass: TokenLayer,
        group: "interface"
      },
      sounds: {
        layerClass: SoundsLayer,
        group: "interface"
      },
      lighting: {
        layerClass: LightingLayer,
        group: "interface"
      },
      notes: {
        layerClass: NotesLayer,
        group: "interface"
      },
      controls: {
        layerClass: ControlsLayer,
        group: "interface"
      }
    },
    lightLevels: {
      dark: 0,
      halfdark: 0.5,
      dim: 0.25,
      bright: 1.0
    },
    fogManager: FogManager,
    /**
     * @enum {typeof PointSourcePolygon}
     */
    polygonBackends: {
      sight: ClockwiseSweepPolygon,
      light: ClockwiseSweepPolygon,
      sound: ClockwiseSweepPolygon,
      move: ClockwiseSweepPolygon
    },
    darknessSourcePaddingMultiplier: 0.5,
    visibilityFilter: VisibilityFilter,
    visualEffectsMaskingFilter: VisualEffectsMaskingFilter,
    rulerClass: Ruler,
    dragSpeedModifier: 0.8,
    maxZoom: 3.0,
    objectBorderThickness: 4,
    gridStyles: {
      solidLines: {
        label: "GRID.STYLES.SolidLines",
        shaderClass: GridShader,
        shaderOptions: {
          style: 0
        }
      },
      dashedLines: {
        label: "GRID.STYLES.DashedLines",
        shaderClass: GridShader,
        shaderOptions: {
          style: 1
        }
      },
      dottedLines: {
        label: "GRID.STYLES.DottedLines",
        shaderClass: GridShader,
        shaderOptions: {
          style: 2
        }
      },
      squarePoints: {
        label: "GRID.STYLES.SquarePoints",
        shaderClass: GridShader,
        shaderOptions: {
          style: 3
        }
      },
      diamondPoints: {
        label: "GRID.STYLES.DiamondPoints",
        shaderClass: GridShader,
        shaderOptions: {
          style: 4
        }
      },
      roundPoints: {
        label: "GRID.STYLES.RoundPoints",
        shaderClass: GridShader,
        shaderOptions: {
          style: 5
        }
      }
    },

    /**
     * A light source animation configuration object.
     * @typedef {Record<string, {label: string, animation: Function, backgroundShader: AdaptiveBackgroundShader,
     * illuminationShader: AdaptiveIlluminationShader,
     * colorationShader: AdaptiveColorationShader}>} LightSourceAnimationConfig
     */

    /** @type {LightSourceAnimationConfig} */
    lightAnimations: {
      flame: {
        label: "LIGHT.AnimationFlame",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateFlickering,
        illuminationShader: FlameIlluminationShader,
        colorationShader: FlameColorationShader
      },
      torch: {
        label: "LIGHT.AnimationTorch",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTorch,
        illuminationShader: TorchIlluminationShader,
        colorationShader: TorchColorationShader
      },
      revolving: {
        label: "LIGHT.AnimationRevolving",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        colorationShader: RevolvingColorationShader
      },
      siren: {
        label: "LIGHT.AnimationSiren",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTorch,
        illuminationShader: SirenIlluminationShader,
        colorationShader: SirenColorationShader
      },
      pulse: {
        label: "LIGHT.AnimationPulse",
        animation: foundry.canvas.sources.PointLightSource.prototype.animatePulse,
        illuminationShader: PulseIlluminationShader,
        colorationShader: PulseColorationShader
      },
      chroma: {
        label: "LIGHT.AnimationChroma",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        colorationShader: ChromaColorationShader
      },
      wave: {
        label: "LIGHT.AnimationWave",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        illuminationShader: WaveIlluminationShader,
        colorationShader: WaveColorationShader
      },
      fog: {
        label: "LIGHT.AnimationFog",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        colorationShader: FogColorationShader
      },
      sunburst: {
        label: "LIGHT.AnimationSunburst",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        illuminationShader: SunburstIlluminationShader,
        colorationShader: SunburstColorationShader
      },
      dome: {
        label: "LIGHT.AnimationLightDome",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        colorationShader: LightDomeColorationShader
      },
      emanation: {
        label: "LIGHT.AnimationEmanation",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        colorationShader: EmanationColorationShader
      },
      hexa: {
        label: "LIGHT.AnimationHexaDome",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        colorationShader: HexaDomeColorationShader
      },
      ghost: {
        label: "LIGHT.AnimationGhostLight",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        illuminationShader: GhostLightIlluminationShader,
        colorationShader: GhostLightColorationShader
      },
      energy: {
        label: "LIGHT.AnimationEnergyField",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        colorationShader: EnergyFieldColorationShader
      },
      vortex: {
        label: "LIGHT.AnimationVortex",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        illuminationShader: VortexIlluminationShader,
        colorationShader: VortexColorationShader
      },
      witchwave: {
        label: "LIGHT.AnimationBewitchingWave",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        illuminationShader: BewitchingWaveIlluminationShader,
        colorationShader: BewitchingWaveColorationShader
      },
      rainbowswirl: {
        label: "LIGHT.AnimationSwirlingRainbow",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        colorationShader: SwirlingRainbowColorationShader
      },
      radialrainbow: {
        label: "LIGHT.AnimationRadialRainbow",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        colorationShader: RadialRainbowColorationShader
      },
      fairy: {
        label: "LIGHT.AnimationFairyLight",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        illuminationShader: FairyLightIlluminationShader,
        colorationShader: FairyLightColorationShader
      },
      grid: {
        label: "LIGHT.AnimationForceGrid",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        colorationShader: ForceGridColorationShader
      },
      starlight: {
        label: "LIGHT.AnimationStarLight",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        colorationShader: StarLightColorationShader
      },
      smokepatch: {
        label: "LIGHT.AnimationSmokePatch",
        animation: foundry.canvas.sources.PointLightSource.prototype.animateTime,
        illuminationShader: SmokePatchIlluminationShader,
        colorationShader: SmokePatchColorationShader
      }
    },

    /**
     * A darkness source animation configuration object.
     * @typedef {Record<string, {label: string, animation: Function,
     * darknessShader: AdaptiveDarknessShader}>} DarknessSourceAnimationConfig
     */

    /** @type {DarknessSourceAnimationConfig} */
    darknessAnimations: {
      magicalGloom: {
        label: "LIGHT.AnimationMagicalGloom",
        animation: foundry.canvas.sources.PointDarknessSource.prototype.animateTime,
        darknessShader: MagicalGloomDarknessShader
      },
      roiling: {
        label: "LIGHT.AnimationRoilingMass",
        animation: foundry.canvas.sources.PointDarknessSource.prototype.animateTime,
        darknessShader: RoilingDarknessShader
      },
      hole: {
        label: "LIGHT.AnimationBlackHole",
        animation: foundry.canvas.sources.PointDarknessSource.prototype.animateTime,
        darknessShader: BlackHoleDarknessShader
      }
    },

    /**
     * A registry of Scenes which are managed by a specific SceneManager class.
     * @type {Record<string, typeof foundry.canvas.SceneManager>}
     */
    managedScenes: {},

    pings: {
      types: {
        PULSE: "pulse",
        ALERT: "alert",
        PULL: "chevron",
        ARROW: "arrow"
      },
      styles: {
        alert: {
          class: AlertPing,
          color: "#ff0000",
          size: 1.5,
          duration: 900
        },
        arrow: {
          class: ArrowPing,
          size: 1,
          duration: 900
        },
        chevron: {
          class: ChevronPing,
          size: 1,
          duration: 2000
        },
        pulse: {
          class: PulsePing,
          size: 1.5,
          duration: 900
        }
      },
      pullSpeed: 700
    },
    targeting: {
      size: .15
    },

    /**
     * The hover-fading configuration.
     * @type {object}
     */
    hoverFade: {
      /**
       * The delay in milliseconds before the (un)faded animation starts on (un)hover.
       * @type {number}
       */
      delay: 250,

      /**
       * The duration in milliseconds of the (un)fade animation on (un)hover.
       * @type {number}
       */
      duration: 750
    },

    /* -------------------------------------------- */
    /*  Transcoders                                 */
    /* -------------------------------------------- */

    /**
     * Allow specific transcoders for assets
     * @type {Record<string, boolean>}
     */
    transcoders: {
      basis: false    // set to true to activate basis support
    },

    /* -------------------------------------------- */

    /**
     * The set of VisionMode definitions which are available to be used for Token vision.
     * @type {Record<string, VisionMode>}
     */
    visionModes: {

      // Default (Basic) Vision
      basic: new VisionMode({
        id: "basic",
        label: "VISION.ModeBasicVision",
        vision: {
          defaults: { attenuation: 0, contrast: 0, saturation: 0, brightness: 0 },
          preferred: true // Takes priority over other vision modes
        }
      }),

      // Darkvision
      darkvision: new VisionMode({
        id: "darkvision",
        label: "VISION.ModeDarkvision",
        canvas: {
          shader: ColorAdjustmentsSamplerShader,
          uniforms: { contrast: 0, saturation: -1.0, brightness: 0 }
        },
        lighting: {
          levels: {
            [VisionMode.LIGHTING_LEVELS.DIM]: VisionMode.LIGHTING_LEVELS.BRIGHT
          },
          background: { visibility: VisionMode.LIGHTING_VISIBILITY.REQUIRED }
        },
        vision: {
          darkness: { adaptive: false },
          defaults: { attenuation: 0, contrast: 0, saturation: -1.0, brightness: 0 }
        }
      }),

      // Darkvision
      monochromatic: new VisionMode({
        id: "monochromatic",
        label: "VISION.ModeMonochromatic",
        canvas: {
          shader: ColorAdjustmentsSamplerShader,
          uniforms: { contrast: 0, saturation: -1.0, brightness: 0 }
        },
        lighting: {
          background: {
            postProcessingModes: ["SATURATION"],
            uniforms: { saturation: -1.0, tint: [1, 1, 1] }
          },
          illumination: {
            postProcessingModes: ["SATURATION"],
            uniforms: { saturation: -1.0, tint: [1, 1, 1] }
          },
          coloration: {
            postProcessingModes: ["SATURATION"],
            uniforms: { saturation: -1.0, tint: [1, 1, 1] }
          }
        },
        vision: {
          darkness: { adaptive: false },
          defaults: { attenuation: 0, contrast: 0, saturation: -1, brightness: 0 }
        }
      }),

      // Blindness
      blindness: new VisionMode({
        id: "blindness",
        label: "VISION.ModeBlindness",
        tokenConfig: false,
        canvas: {
          shader: ColorAdjustmentsSamplerShader,
          uniforms: { contrast: -0.75, saturation: -1, exposure: -0.3 }
        },
        lighting: {
          background: { visibility: VisionMode.LIGHTING_VISIBILITY.DISABLED },
          illumination: { visibility: VisionMode.LIGHTING_VISIBILITY.DISABLED },
          coloration: { visibility: VisionMode.LIGHTING_VISIBILITY.DISABLED }
        },
        vision: {
          darkness: { adaptive: false },
          defaults: { color: null, attenuation: 0, contrast: -0.5, saturation: -1, brightness: -1 }
        }
      }),

      // Tremorsense
      tremorsense: new VisionMode({
        id: "tremorsense",
        label: "VISION.ModeTremorsense",
        canvas: {
          shader: ColorAdjustmentsSamplerShader,
          uniforms: { contrast: 0, saturation: -0.8, exposure: -0.65 }
        },
        lighting: {
          background: { visibility: VisionMode.LIGHTING_VISIBILITY.DISABLED },
          illumination: { visibility: VisionMode.LIGHTING_VISIBILITY.DISABLED },
          coloration: { visibility: VisionMode.LIGHTING_VISIBILITY.DISABLED },
          darkness: { visibility: VisionMode.LIGHTING_VISIBILITY.DISABLED }
        },
        vision: {
          darkness: { adaptive: false },
          defaults: { attenuation: 0, contrast: 0.2, saturation: -0.3, brightness: 1 },
          background: { shader: WaveBackgroundVisionShader },
          coloration: { shader: WaveColorationVisionShader }
        }
      }, {animated: true}),

      // Light Amplification
      lightAmplification: new VisionMode({
        id: "lightAmplification",
        label: "VISION.ModeLightAmplification",
        canvas: {
          shader: AmplificationSamplerShader,
          uniforms: { saturation: -0.5, tint: [0.38, 0.8, 0.38] }
        },
        lighting: {
          background: {
            visibility: VisionMode.LIGHTING_VISIBILITY.REQUIRED,
            postProcessingModes: ["SATURATION", "EXPOSURE"],
            uniforms: { saturation: -0.5, exposure: 1.5, tint: [0.38, 0.8, 0.38] }
          },
          illumination: {
            postProcessingModes: ["SATURATION"],
            uniforms: { saturation: -0.5 }
          },
          coloration: {
            postProcessingModes: ["SATURATION", "EXPOSURE"],
            uniforms: { saturation: -0.5, exposure: 1.5, tint: [0.38, 0.8, 0.38] }
          },
          levels: {
            [VisionMode.LIGHTING_LEVELS.DIM]: VisionMode.LIGHTING_LEVELS.BRIGHT,
            [VisionMode.LIGHTING_LEVELS.BRIGHT]: VisionMode.LIGHTING_LEVELS.BRIGHTEST
          }
        },
        vision: {
          darkness: { adaptive: false },
          defaults: { attenuation: 0, contrast: 0, saturation: -0.5, brightness: 1 },
          background: { shader: AmplificationBackgroundVisionShader }
        }
      })
    },

    /* -------------------------------------------- */

    /**
     * The set of DetectionMode definitions which are available to be used for visibility detection.
     * @type {Record<string, DetectionMode>}
     */
    detectionModes: {
      lightPerception: new DetectionModeLightPerception({
        id: "lightPerception",
        label: "DETECTION.LightPerception",
        type: DetectionMode.DETECTION_TYPES.SIGHT
      }),
      basicSight: new DetectionModeBasicSight({
        id: "basicSight",
        label: "DETECTION.BasicSight",
        type: DetectionMode.DETECTION_TYPES.SIGHT
      }),
      seeInvisibility: new DetectionModeInvisibility({
        id: "seeInvisibility",
        label: "DETECTION.SeeInvisibility",
        type: DetectionMode.DETECTION_TYPES.SIGHT
      }),
      senseInvisibility: new DetectionModeInvisibility({
        id: "senseInvisibility",
        label: "DETECTION.SenseInvisibility",
        walls: false,
        angle: false,
        type: DetectionMode.DETECTION_TYPES.OTHER
      }),
      feelTremor: new DetectionModeTremor({
        id: "feelTremor",
        label: "DETECTION.FeelTremor",
        walls: false,
        angle: false,
        type: DetectionMode.DETECTION_TYPES.MOVE
      }),
      seeAll: new DetectionModeAll({
        id: "seeAll",
        label: "DETECTION.SeeAll",
        type: DetectionMode.DETECTION_TYPES.SIGHT
      }),
      senseAll: new DetectionModeAll({
        id: "senseAll",
        label: "DETECTION.SenseAll",
        walls: false,
        angle: false,
        type: DetectionMode.DETECTION_TYPES.OTHER
      })
    }
  },

  /* -------------------------------------------- */

  /**
   * Configure the default Token text style so that it may be reused and overridden by modules
   * @type {PIXI.TextStyle}
   */
  canvasTextStyle: new PIXI.TextStyle({
    fontFamily: "Signika",
    fontSize: 36,
    fill: "#FFFFFF",
    stroke: "#111111",
    strokeThickness: 1,
    dropShadow: true,
    dropShadowColor: "#000000",
    dropShadowBlur: 2,
    dropShadowAngle: 0,
    dropShadowDistance: 0,
    align: "center",
    wordWrap: false,
    padding: 1
  }),

  /**
   * Available Weather Effects implementations
   * @typedef {Object} WeatherAmbienceConfiguration
   * @param {string} id
   * @param {string} label
   * @param {{enabled: boolean, blendMode: PIXI.BLEND_MODES}} filter
   * @param {WeatherEffectConfiguration[]} effects
   *
   * @typedef {Object} WeatherEffectConfiguration
   * @param {string} id
   * @param {typeof ParticleEffect|WeatherShaderEffect} effectClass
   * @param {PIXI.BLEND_MODES} blendMode
   * @param {object} config
   */
  weatherEffects: {
    leaves: {
      id: "leaves",
      label: "WEATHER.AutumnLeaves",
      effects: [{
        id: "leavesParticles",
        effectClass: AutumnLeavesWeatherEffect
      }]
    },
    rain: {
      id: "rain",
      label: "WEATHER.Rain",
      filter: {
        enabled: false
      },
      effects: [{
        id: "rainShader",
        effectClass: WeatherShaderEffect,
        shaderClass: RainShader,
        blendMode: PIXI.BLEND_MODES.SCREEN,
        config: {
          opacity: 0.25,
          tint: [0.7, 0.9, 1.0],
          intensity: 1,
          strength: 1,
          rotation: 0.2618,
          speed: 0.2,
        }
      }]
    },
    rainStorm: {
      id: "rainStorm",
      label: "WEATHER.RainStorm",
      filter: {
        enabled: false
      },
      effects: [{
        id: "fogShader",
        effectClass: WeatherShaderEffect,
        shaderClass: FogShader,
        blendMode: PIXI.BLEND_MODES.SCREEN,
        performanceLevel: 2,
        config: {
          slope: 1.5,
          intensity: 0.050,
          speed: -55.0,
          scale: 25,
        }
      },
      {
        id: "rainShader",
        effectClass: WeatherShaderEffect,
        shaderClass: RainShader,
        blendMode: PIXI.BLEND_MODES.SCREEN,
        config: {
          opacity: 0.45,
          tint: [0.7, 0.9, 1.0],
          intensity: 1.5,
          strength: 1.5,
          rotation: 0.5236,
          speed: 0.30,
        }
      }]
    },
    fog: {
      id: "fog",
      label: "WEATHER.Fog",
      filter: {
        enabled: false
      },
      effects: [{
        id: "fogShader",
        effectClass: WeatherShaderEffect,
        shaderClass: FogShader,
        blendMode: PIXI.BLEND_MODES.SCREEN,
        config: {
          slope: 0.45,
          intensity: 0.4,
          speed: 0.4,
        }
      }]
    },
    snow: {
      id: "snow",
      label: "WEATHER.Snow",
      filter: {
        enabled: false
      },
      effects: [{
        id: "snowShader",
        effectClass: WeatherShaderEffect,
        shaderClass: SnowShader,
        blendMode: PIXI.BLEND_MODES.SCREEN,
        config: {
          tint: [0.85, 0.95, 1],
          direction: 0.5,
          speed: 2,
          scale: 2.5,
        }
      }]
    },
    blizzard: {
      id: "blizzard",
      label: "WEATHER.Blizzard",
      filter: {
        enabled: false
      },
      effects: [{
        id: "snowShader",
        effectClass: WeatherShaderEffect,
        shaderClass: SnowShader,
        blendMode: PIXI.BLEND_MODES.SCREEN,
        config: {
          tint: [0.95, 1, 1],
          direction: 0.80,
          speed: 8,
          scale: 2.5,
        }
      },
      {
        id: "fogShader",
        effectClass: WeatherShaderEffect,
        shaderClass: FogShader,
        blendMode: PIXI.BLEND_MODES.SCREEN,
        performanceLevel: 2,
        config: {
          slope: 1.0,
          intensity: 0.15,
          speed: -4.0,
        }
      }]
    }
  },

  /**
   * The control icons used for rendering common HUD operations
   * @type {object}
   */
  controlIcons: {
    combat: "icons/svg/combat.svg",
    visibility: "icons/svg/cowled.svg",
    effects: "icons/svg/aura.svg",
    lock: "icons/svg/padlock.svg",
    up: "icons/svg/up.svg",
    down: "icons/svg/down.svg",
    defeated: "icons/svg/skull.svg",
    light: "icons/svg/light.svg",
    lightOff: "icons/svg/light-off.svg",
    template: "icons/svg/explosion.svg",
    sound: "icons/svg/sound.svg",
    soundOff: "icons/svg/sound-off.svg",
    doorClosed: "icons/svg/door-closed-outline.svg",
    doorOpen: "icons/svg/door-open-outline.svg",
    doorSecret: "icons/svg/door-secret-outline.svg",
    doorLocked: "icons/svg/door-locked-outline.svg",
    wallDirection: "icons/svg/wall-direction.svg"
  },

  /**
   * @typedef {FontFaceDescriptors} FontDefinition
   * @property {string} urls  An array of remote URLs the font files exist at.
   */

  /**
   * @typedef {object} FontFamilyDefinition
   * @property {boolean} editor          Whether the font is available in the rich text editor. This will also enable it
   *                                     for notes and drawings.
   * @property {FontDefinition[]} fonts  Individual font face definitions for this font family. If this is empty, the
   *                                     font family may only be loaded from the client's OS-installed fonts.
   */

  /**
   * A collection of fonts to load either from the user's local system, or remotely.
   * @type {Record<string, FontFamilyDefinition>}
   */
  fontDefinitions: {
    Arial: {editor: true, fonts: []},
    Amiri: {
      editor: true,
      fonts: [
        {urls: ["fonts/amiri/amiri-regular.woff2"]},
        {urls: ["fonts/amiri/amiri-bold.woff2"], weight: 700}
      ]
    },
    "Bruno Ace": {editor: true, fonts: [
      {urls: ["fonts/bruno-ace/bruno-ace.woff2"]}
    ]},
    Courier: {editor: true, fonts: []},
    "Courier New": {editor: true, fonts: []},
    "Modesto Condensed": {
      editor: true,
      fonts: [
        {urls: ["fonts/modesto-condensed/modesto-condensed.woff2"]},
        {urls: ["fonts/modesto-condensed/modesto-condensed-bold.woff2"], weight: 700}
      ]
    },
    Signika: {
      editor: true,
      fonts: [
        {urls: ["fonts/signika/signika-regular.woff2"]},
        {urls: ["fonts/signika/signika-bold.woff2"], weight: 700}
      ]
    },
    Times: {editor: true, fonts: []},
    "Times New Roman": {editor: true, fonts: []}
  },

  /**
   * The default font family used for text labels on the PIXI Canvas
   * @type {string}
   */
  defaultFontFamily: "Signika",

  /**
   * @typedef {object} _StatusEffectConfig    Configured status effects which are recognized by the game system
   * @property {string} id                    A string identifier for the effect
   * @property {string} label                 Alias for ActiveEffectData#name (deprecated)
   * @property {string} icon                  Alias for ActiveEffectData#img (deprecated)
   * @property {boolean|{actorTypes?: string[]}} [hud=true]  Should this effect be selectable in the Token HUD?
   *                                          This effect is only selectable in the Token HUD if the Token's
   *                                          Actor sub-type is one of the configured ones.
   */

  /**
   * Configured status effects which are recognized by the game system.
   * @typedef {_StatusEffectConfig & Partial<ActiveEffectData>} StatusEffectConfig
   */

  /**
   * The array of status effects which can be applied to an Actor.
   * @type {Array<StatusEffectConfig>}
   */
  statusEffects: [
    {
      id: "dead",
      name: "EFFECT.StatusDead",
      img: "icons/svg/skull.svg"
    },
    {
      id: "unconscious",
      name: "EFFECT.StatusUnconscious",
      img: "icons/svg/unconscious.svg"
    },
    {
      id: "sleep",
      name: "EFFECT.StatusAsleep",
      img: "icons/svg/sleep.svg"
    },
    {
      id: "stun",
      name: "EFFECT.StatusStunned",
      img: "icons/svg/daze.svg"
    },
    {
      id: "prone",
      name: "EFFECT.StatusProne",
      img: "icons/svg/falling.svg"
    },
    {
      id: "restrain",
      name: "EFFECT.StatusRestrained",
      img: "icons/svg/net.svg"
    },
    {
      id: "paralysis",
      name: "EFFECT.StatusParalysis",
      img: "icons/svg/paralysis.svg"
    },
    {
      id: "fly",
      name: "EFFECT.StatusFlying",
      img: "icons/svg/wing.svg"
    },
    {
      id: "blind",
      name: "EFFECT.StatusBlind",
      img: "icons/svg/blind.svg"
    },
    {
      id: "deaf",
      name: "EFFECT.StatusDeaf",
      img: "icons/svg/deaf.svg"
    },
    {
      id: "silence",
      name: "EFFECT.StatusSilenced",
      img: "icons/svg/silenced.svg"
    },
    {
      id: "fear",
      name: "EFFECT.StatusFear",
      img: "icons/svg/terror.svg"
    },
    {
      id: "burning",
      name: "EFFECT.StatusBurning",
      img: "icons/svg/fire.svg"
    },
    {
      id: "frozen",
      name: "EFFECT.StatusFrozen",
      img: "icons/svg/frozen.svg"
    },
    {
      id: "shock",
      name: "EFFECT.StatusShocked",
      img: "icons/svg/lightning.svg"
    },
    {
      id: "corrode",
      name: "EFFECT.StatusCorrode",
      img: "icons/svg/acid.svg"
    },
    {
      id: "bleeding",
      name: "EFFECT.StatusBleeding",
      img: "icons/svg/blood.svg"
    },
    {
      id: "disease",
      name: "EFFECT.StatusDisease",
      img: "icons/svg/biohazard.svg"
    },
    {
      id: "poison",
      name: "EFFECT.StatusPoison",
      img: "icons/svg/poison.svg"
    },
    {
      id: "curse",
      name: "EFFECT.StatusCursed",
      img: "icons/svg/sun.svg"
    },
    {
      id: "regen",
      name: "EFFECT.StatusRegen",
      img: "icons/svg/regen.svg"
    },
    {
      id: "degen",
      name: "EFFECT.StatusDegen",
      img: "icons/svg/degen.svg"
    },
    {
      id: "hover",
      name: "EFFECT.StatusHover",
      img: "icons/svg/wingfoot.svg"
    },
    {
      id: "burrow",
      name: "EFFECT.StatusBurrow",
      img: "icons/svg/mole.svg"
    },
    {
      id: "upgrade",
      name: "EFFECT.StatusUpgrade",
      img: "icons/svg/upgrade.svg"
    },
    {
      id: "downgrade",
      name: "EFFECT.StatusDowngrade",
      img: "icons/svg/downgrade.svg"
    },
    {
      id: "invisible",
      name: "EFFECT.StatusInvisible",
      img: "icons/svg/invisible.svg"
    },
    {
      id: "target",
      name: "EFFECT.StatusTarget",
      img: "icons/svg/target.svg"
    },
    {
      id: "eye",
      name: "EFFECT.StatusMarked",
      img: "icons/svg/eye.svg"
    },
    {
      id: "bless",
      name: "EFFECT.StatusBlessed",
      img: "icons/svg/angel.svg"
    },
    {
      id: "fireShield",
      name: "EFFECT.StatusFireShield",
      img: "icons/svg/fire-shield.svg"
    },
    {
      id: "coldShield",
      name: "EFFECT.StatusIceShield",
      img: "icons/svg/ice-shield.svg"
    },
    {
      id: "magicShield",
      name: "EFFECT.StatusMagicShield",
      img: "icons/svg/mage-shield.svg"
    },
    {
      id: "holyShield",
      name: "EFFECT.StatusHolyShield",
      img: "icons/svg/holy-shield.svg"
    }
  ].map(status => {
    /** @deprecated since v12 */
    for ( const [oldKey, newKey] of Object.entries({label: "name", icon: "img"}) ) {
      const msg = `StatusEffectConfig#${oldKey} has been deprecated in favor of StatusEffectConfig#${newKey}`;
      Object.defineProperty(status, oldKey, {
        get() {
          foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
          return this[newKey];
        },
        set(value) {
          foundry.utils.logCompatibilityWarning(msg, {since: 12, until: 14, once: true});
          this[newKey] = value;
        },
        enumerable: false,
        configurable: true
      });
    }
    return status;
  }),

  /**
   * A mapping of status effect IDs which provide some additional mechanical integration.
   * @enum {string}
   */
  specialStatusEffects: {
    DEFEATED: "dead",
    INVISIBLE: "invisible",
    BLIND: "blind",
    BURROW: "burrow",
    HOVER: "hover",
    FLY: "fly"
  },

  /**
   * A mapping of core audio effects used which can be replaced by systems or mods
   * @type {object}
   */
  sounds: {
    dice: "sounds/dice.wav",
    lock: "sounds/lock.wav",
    notification: "sounds/notify.wav",
    combat: "sounds/drums.wav"
  },

  /**
   * Define the set of supported languages for localization
   * @type {{string, string}}
   */
  supportedLanguages: {
    en: "English"
  },

  /**
   * Localization constants.
   * @type {object}
   */
  i18n: {
    /**
     * In operations involving the document index, search prefixes must have at least this many characters to avoid too
     * large a search space. Languages that have hundreds or thousands of characters will typically have very shallow
     * search trees, so it should be safe to lower this number in those cases.
     */
    searchMinimumCharacterLength: 4
  },

  /**
   * Configuration for time tracking
   * @type {{turnTime: number}}
   */
  time: {
    turnTime: 0,
    roundTime: 0
  },

  /* -------------------------------------------- */
  /*  Embedded Documents                          */
  /* -------------------------------------------- */

  /**
   * Configuration for the ActiveEffect embedded document type
   */
  ActiveEffect: {
    documentClass: ActiveEffect,
    dataModels: {},
    typeLabels: {},
    typeIcons: {},

    /**
     * If true, Active Effects on Items will be copied to the Actor when the Item is created on the Actor if the
     * Active Effect's transfer property is true, and will be deleted when that Item is deleted from the Actor.
     * If false, Active Effects are never copied to the Actor, but will still apply to the Actor from within the Item
     * if the transfer property on the Active Effect is true.
     * @deprecated since v11
     */
    legacyTransferral: true
  },

  /**
   * Configuration for the ActorDelta embedded document type.
   */
  ActorDelta: {
    documentClass: ActorDelta
  },

  /**
   * Configuration for the Card embedded Document type
   */
  Card: {
    documentClass: Card,
    dataModels: {},
    typeLabels: {},
    typeIcons: {}
  },

  /**
   * Configuration for the TableResult embedded document type
   */
  TableResult: {
    documentClass: TableResult
  },

  /**
   * Configuration for the JournalEntryPage embedded document type.
   */
  JournalEntryPage: {
    documentClass: JournalEntryPage,
    dataModels: {},
    typeLabels: {},
    typeIcons: {
      image: "fas fa-file-image",
      pdf: "fas fa-file-pdf",
      text: "fas fa-file-lines",
      video: "fas fa-file-video"
    },
    defaultType: "text",
    sidebarIcon: "fas fa-book-open"
  },

  /**
   * Configuration for the PlaylistSound embedded document type
   */
  PlaylistSound: {
    documentClass: PlaylistSound,
    sidebarIcon: "fas fa-music"
  },

  /**
   * Configuration for the AmbientLight embedded document type and its representation on the game Canvas
   * @enum {Function}
   */
  AmbientLight: {
    documentClass: AmbientLightDocument,
    objectClass: AmbientLight,
    layerClass: LightingLayer
  },

  /**
   * Configuration for the AmbientSound embedded document type and its representation on the game Canvas
   * @enum {Function}
   */
  AmbientSound: {
    documentClass: AmbientSoundDocument,
    objectClass: AmbientSound,
    layerClass: SoundsLayer
  },

  /**
   * Configuration for the Combatant embedded document type within a Combat document
   * @enum {Function}
   */
  Combatant: {
    documentClass: Combatant,
    dataModels: {},
    typeLabels: {},
    typeIcons: {}
  },

  /**
   * Configuration for the Drawing embedded document type and its representation on the game Canvas
   * @type {{
   *   documentClass: typeof DrawingDocument,
   *   objectClass: typeof Drawing,
   *   layerClass: typeof DrawingsLayer,
   *   hudClass: typeof DrawingHUD
   * }}
   */
  Drawing: {
    documentClass: DrawingDocument,
    objectClass: Drawing,
    layerClass: DrawingsLayer,
    hudClass: DrawingHUD
  },

  /**
   * Configuration for the MeasuredTemplate embedded document type and its representation on the game Canvas
   * @enum {Function}
   */
  MeasuredTemplate: {
    defaults: {
      angle: 53.13,
      width: 1
    },
    types: {
      circle: "Circle",
      cone: "Cone",
      rect: "Rectangle",
      ray: "Ray"
    },
    documentClass: MeasuredTemplateDocument,
    objectClass: MeasuredTemplate,
    layerClass: TemplateLayer
  },

  /**
   * Configuration for the Note embedded document type and its representation on the game Canvas
   * @enum {Function}
   */
  Note: {
    documentClass: NoteDocument,
    objectClass: Note,
    layerClass: NotesLayer
  },

  /**
   * Configuration for the Region embedded document type and its representation on the game Canvas
   */
  Region: {
    documentClass: RegionDocument,
    objectClass: Region,
    layerClass: RegionLayer
  },

  /**
   * Configuration for the RegionBehavior embedded document type
   */
  RegionBehavior: {
    documentClass: RegionBehavior,
    dataModels: {
      adjustDarknessLevel: foundry.data.regionBehaviors.AdjustDarknessLevelRegionBehaviorType,
      displayScrollingText: foundry.data.regionBehaviors.DisplayScrollingTextRegionBehaviorType,
      executeMacro: foundry.data.regionBehaviors.ExecuteMacroRegionBehaviorType,
      executeScript: foundry.data.regionBehaviors.ExecuteScriptRegionBehaviorType,
      pauseGame: foundry.data.regionBehaviors.PauseGameRegionBehaviorType,
      suppressWeather: foundry.data.regionBehaviors.SuppressWeatherRegionBehaviorType,
      teleportToken: foundry.data.regionBehaviors.TeleportTokenRegionBehaviorType,
      toggleBehavior: foundry.data.regionBehaviors.ToggleBehaviorRegionBehaviorType
    },
    typeLabels: {},
    typeIcons: {
      adjustDarknessLevel: "fa-solid fa-circle-half-stroke",
      displayScrollingText: "fa-solid fa-message-arrow-up",
      executeMacro: "fa-solid fa-code",
      executeScript: "fa-brands fa-js",
      pauseGame: "fa-solid fa-pause",
      suppressWeather: "fa-solid fa-cloud-slash",
      teleportToken: "fa-solid fa-transporter-1",
      toggleBehavior: "fa-solid fa-sliders"
    }
  },

  /**
   * Configuration for the Tile embedded document type and its representation on the game Canvas
   * @type {{
   *   documentClass: typeof TileDocument,
   *   objectClass: typeof Tile,
   *   layerClass: typeof TilesLayer,
   *   hudClass: typeof TileHUD
   * }}
   */
  Tile: {
    documentClass: TileDocument,
    objectClass: Tile,
    layerClass: TilesLayer,
    hudClass: TileHUD
  },

  /**
   * Configuration for the Token embedded document type and its representation on the game Canvas
   * @type {{
   *   documentClass: typeof TokenDocument,
   *   objectClass: typeof Token,
   *   layerClass: typeof TokenLayer,
   *   prototypeSheetClass: typeof TokenConfig,
   *   hudClass: typeof TokenHUD,
   *   adjectivesPrefix: string,
   *   ring: foundry.canvas.tokens.TokenRingConfig
   * }}
   */
  Token: {
    documentClass: TokenDocument,
    objectClass: Token,
    layerClass: TokenLayer,
    prototypeSheetClass: TokenConfig,
    hudClass: TokenHUD,
    adjectivesPrefix: "TOKEN.Adjectives"
    // ring property is initialized in foundry.canvas.tokens.TokenRingConfig.initialize
  },

  /**
   * @typedef {Object} WallDoorSound
   * @property {string} label     A localization string label
   * @property {string} close     A sound path when the door is closed
   * @property {string} lock      A sound path when the door becomes locked
   * @property {string} open      A sound path when opening the door
   * @property {string} test      A sound path when attempting to open a locked door
   * @property {string} unlock    A sound path when the door becomes unlocked
   */

  /**
   * Configuration for the Wall embedded document type and its representation on the game Canvas
   * @property {typeof ClientDocument} documentClass
   * @property {typeof PlaceableObject} objectClass
   * @property {typeof CanvasLayer} layerClass
   * @property {number} thresholdAttenuationMultiplier
   * @property {WallDoorSound[]} doorSounds
   */
  Wall: {
    documentClass: WallDocument,
    objectClass: Wall,
    layerClass: WallsLayer,
    thresholdAttenuationMultiplier: 1,
    doorSounds: {
      futuristicFast: {
        label: "WALLS.DoorSound.FuturisticFast",
        close: "sounds/doors/futuristic/close-fast.ogg",
        lock: "sounds/doors/futuristic/lock.ogg",
        open: "sounds/doors/futuristic/open-fast.ogg",
        test: "sounds/doors/futuristic/test.ogg",
        unlock: "sounds/doors/futuristic/unlock.ogg"
      },
      futuristicHydraulic: {
        label: "WALLS.DoorSound.FuturisticHydraulic",
        close: "sounds/doors/futuristic/close-hydraulic.ogg",
        lock: "sounds/doors/futuristic/lock.ogg",
        open: "sounds/doors/futuristic/open-hydraulic.ogg",
        test: "sounds/doors/futuristic/test.ogg",
        unlock: "sounds/doors/futuristic/unlock.ogg"
      },
      futuristicForcefield: {
        label: "WALLS.DoorSound.FuturisticForcefield",
        close: "sounds/doors/futuristic/close-forcefield.ogg",
        lock: "sounds/doors/futuristic/lock.ogg",
        open: "sounds/doors/futuristic/open-forcefield.ogg",
        test: "sounds/doors/futuristic/test-forcefield.ogg",
        unlock: "sounds/doors/futuristic/unlock.ogg"
      },
      industrial: {
        label: "WALLS.DoorSound.Industrial",
        close: "sounds/doors/industrial/close.ogg",
        lock: "sounds/doors/industrial/lock.ogg",
        open: "sounds/doors/industrial/open.ogg",
        test: "sounds/doors/industrial/test.ogg",
        unlock: "sounds/doors/industrial/unlock.ogg"
      },
      industrialCreaky: {
        label: "WALLS.DoorSound.IndustrialCreaky",
        close: "sounds/doors/industrial/close-creaky.ogg",
        lock: "sounds/doors/industrial/lock.ogg",
        open: "sounds/doors/industrial/open-creaky.ogg",
        test: "sounds/doors/industrial/test.ogg",
        unlock: "sounds/doors/industrial/unlock.ogg"
      },
      jail: {
        label: "WALLS.DoorSound.Jail",
        close: "sounds/doors/jail/close.ogg",
        lock: "sounds/doors/jail/lock.ogg",
        open: "sounds/doors/jail/open.ogg",
        test: "sounds/doors/jail/test.ogg",
        unlock: "sounds/doors/jail/unlock.ogg"
      },
      magicDoor: {
        label: "WALLS.DoorSound.MagicDoor",
        close: "sounds/doors/magic/door-close.ogg",
        lock: "sounds/doors/magic/lock.ogg",
        open: "sounds/doors/magic/door-open.ogg",
        test: "sounds/doors/magic/test.ogg",
        unlock: "sounds/doors/magic/unlock.ogg"
      },
      magicWall: {
        label: "WALLS.DoorSound.MagicWall",
        close: "sounds/doors/magic/wall-close.ogg",
        lock: "sounds/doors/magic/lock.ogg",
        open: "sounds/doors/magic/wall-open.ogg",
        test: "sounds/doors/magic/test.ogg",
        unlock: "sounds/doors/magic/unlock.ogg"
      },
      metal: {
        label: "WALLS.DoorSound.Metal",
        close: "sounds/doors/metal/close.ogg",
        lock: "sounds/doors/metal/lock.ogg",
        open: "sounds/doors/metal/open.ogg",
        test: "sounds/doors/metal/test.ogg",
        unlock: "sounds/doors/metal/unlock.ogg"
      },
      slidingMetal: {
        label: "WALLS.DoorSound.SlidingMetal",
        close: "sounds/doors/shutter/close.ogg",
        lock: "sounds/doors/shutter/lock.ogg",
        open: "sounds/doors/shutter/open.ogg",
        test: "sounds/doors/shutter/test.ogg",
        unlock: "sounds/doors/shutter/unlock.ogg"
      },
      slidingModern: {
        label: "WALLS.DoorSound.SlidingModern",
        close: "sounds/doors/sliding/close.ogg",
        lock: "sounds/doors/sliding/lock.ogg",
        open: "sounds/doors/sliding/open.ogg",
        test: "sounds/doors/sliding/test.ogg",
        unlock: "sounds/doors/sliding/unlock.ogg"
      },
      slidingWood: {
        label: "WALLS.DoorSound.SlidingWood",
        close: "sounds/doors/sliding/close-wood.ogg",
        lock: "sounds/doors/sliding/lock.ogg",
        open: "sounds/doors/sliding/open-wood.ogg",
        test: "sounds/doors/sliding/test.ogg",
        unlock: "sounds/doors/sliding/unlock.ogg"
      },
      stoneBasic: {
        label: "WALLS.DoorSound.StoneBasic",
        close: "sounds/doors/stone/close.ogg",
        lock: "sounds/doors/stone/lock.ogg",
        open: "sounds/doors/stone/open.ogg",
        test: "sounds/doors/stone/test.ogg",
        unlock: "sounds/doors/stone/unlock.ogg"
      },
      stoneRocky: {
        label: "WALLS.DoorSound.StoneRocky",
        close: "sounds/doors/stone/close-rocky.ogg",
        lock: "sounds/doors/stone/lock.ogg",
        open: "sounds/doors/stone/open-rocky.ogg",
        test: "sounds/doors/stone/test.ogg",
        unlock: "sounds/doors/stone/unlock.ogg"
      },
      stoneSandy: {
        label: "WALLS.DoorSound.StoneSandy",
        close: "sounds/doors/stone/close-sandy.ogg",
        lock: "sounds/doors/stone/lock.ogg",
        open: "sounds/doors/stone/open-sandy.ogg",
        test: "sounds/doors/stone/test.ogg",
        unlock: "sounds/doors/stone/unlock.ogg"
      },
      woodBasic: {
        label: "WALLS.DoorSound.WoodBasic",
        close: "sounds/doors/wood/close.ogg",
        lock: "sounds/doors/wood/lock.ogg",
        open: "sounds/doors/wood/open.ogg",
        test: "sounds/doors/wood/test.ogg",
        unlock: "sounds/doors/wood/unlock.ogg"
      },
      woodCreaky: {
        label: "WALLS.DoorSound.WoodCreaky",
        close: "sounds/doors/wood/close-creaky.ogg",
        lock: "sounds/doors/wood/lock.ogg",
        open: "sounds/doors/wood/open-creaky.ogg",
        test: "sounds/doors/wood/test.ogg",
        unlock: "sounds/doors/wood/unlock.ogg"
      },
      woodHeavy: {
        label: "WALLS.DoorSound.WoodHeavy",
        close: "sounds/doors/wood/close-heavy.ogg",
        lock: "sounds/doors/wood/lock.ogg",
        open: "sounds/doors/wood/open-heavy.ogg",
        test: "sounds/doors/wood/test.ogg",
        unlock: "sounds/doors/wood/unlock.ogg"
      }
    }
  },

  /**
   * An enumeration of sound effects which can be applied to Sound instances.
   * @enum {{label: string, effectClass: AudioNode}}
   */
  soundEffects: {
    lowpass: {
      label: "SOUND.EFFECTS.LOWPASS",
      effectClass: foundry.audio.BiquadFilterEffect
    },
    highpass: {
      label: "SOUND.EFFECTS.HIGHPASS",
      effectClass: foundry.audio.BiquadFilterEffect
    },
    reverb: {
      label: "SOUND.EFFECTS.REVERB",
      effectClass: foundry.audio.ConvolverEffect
    }
  },

  /* -------------------------------------------- */
  /*  Integrations                                */
  /* -------------------------------------------- */

  /**
   * Default configuration options for TinyMCE editors
   * @type {object}
   */
  TinyMCE: {
    branding: false,
    menubar: false,
    statusbar: false,
    content_css: ["/css/mce.css"],
    plugins: "lists image table code save link",
    toolbar: "styles bullist numlist image table hr link removeformat code save",
    save_enablewhendirty: true,
    table_default_styles: {},
    style_formats: [
      {
        title: "Custom",
        items: [
          {
            title: "Secret",
            block: "section",
            classes: "secret",
            wrapper: true
          }
        ]
      }
    ],
    style_formats_merge: true
  },

  /**
   * @callback TextEditorEnricher
   * @param {RegExpMatchArray} match          The regular expression match result
   * @param {EnrichmentOptions} [options]     Options provided to customize text enrichment
   * @returns {Promise<HTMLElement|null>}     An HTML element to insert in place of the matched text or null to
   *                                          indicate that no replacement should be made.
   */

  /**
   * @typedef {object} TextEditorEnricherConfig
   * @property {RegExp} pattern               The string pattern to match. Must be flagged as global.
   * @property {boolean} [replaceParent]      Hoist the replacement element out of its containing element if it replaces
   *                                          the entire contents of the element.
   * @property {TextEditorEnricher} enricher  The function that will be called on each match. It is expected that this
   *                                          returns an HTML element to be inserted into the final enriched content.
   */

  /**
   * Rich text editing configuration.
   * @type {object}
   */
  TextEditor: {
    /**
     * A collection of custom enrichers that can be applied to text content, allowing for the matching and handling of
     * custom patterns.
     * @type {TextEditorEnricherConfig[]}
     */
    enrichers: []
  },

  /**
   * Configuration for the WebRTC implementation class
   * @type {object}
   */
  WebRTC: {
    clientClass: SimplePeerAVClient,
    detectPeerVolumeInterval: 50,
    detectSelfVolumeInterval: 20,
    emitVolumeInterval: 25,
    speakingThresholdEvents: 2,
    speakingHistoryLength: 10,
    connectedUserPollIntervalS: 8
  },

  /* -------------------------------------------- */
  /*  Interface                                   */
  /* -------------------------------------------- */

  /**
   * Configure the Application classes used to render various core UI elements in the application.
   * The order of this object is relevant, as certain classes need to be constructed and referenced before others.
   * @type {Record<string, Application>}
   */
  ui: {
    menu: MainMenu,
    sidebar: Sidebar,
    pause: Pause,
    nav: SceneNavigation,
    notifications: Notifications,
    actors: ActorDirectory,
    cards: CardsDirectory,
    chat: ChatLog,
    combat: CombatTracker,
    compendium: CompendiumDirectory,
    controls: SceneControls,
    hotbar: Hotbar,
    items: ItemDirectory,
    journal: JournalDirectory,
    macros: MacroDirectory,
    players: PlayerList,
    playlists: PlaylistDirectory,
    scenes: SceneDirectory,
    settings: Settings,
    tables: RollTableDirectory,
    webrtc: CameraViews
  }
};

// Define the ring property with a TokenRingConfig instance
Object.defineProperty(CONFIG.Token, 'ring', {
  value: new foundry.canvas.tokens.TokenRingConfig(),
  enumerable: true
});

/**
 * @deprecated since v11
 */
["Actor", "Item", "JournalEntryPage", "Cards", "Card"].forEach(doc => {
  const warning = `You are accessing CONFIG.${doc}.systemDataModels which is deprecated. `
    + `Please use CONFIG.${doc}.dataModels instead.`;
  Object.defineProperty(CONFIG[doc], "systemDataModels", {
    enumerable: false,
    get() {
      foundry.utils.logCompatibilityWarning(warning, {since: 11, until: 13});
      return CONFIG[doc].dataModels;
    },
    set(models) {
      foundry.utils.logCompatibilityWarning(warning, {since: 11, until: 13});
      CONFIG[doc].dataModels = models;
    }
  });
});

/**
 * @deprecated since v11
 */
Object.defineProperty(CONFIG.Canvas, "losBackend", {
  get() {
    const warning = "You are accessing CONFIG.Canvas.losbackend, which is deprecated."
    + " Use CONFIG.Canvas.polygonBackends.sight instead.";
    foundry.utils.logCompatibilityWarning(warning, {since: 11, until: 13});
    return CONFIG.Canvas.polygonBackends.sight;
  },
  set(cls) {
    const warning = "You are setting CONFIG.Canvas.losbackend, which is deprecated."
      + " Use CONFIG.Canvas.polygonBackends[type] instead.";
    foundry.utils.logCompatibilityWarning(warning, {since: 11, until: 13});
    for ( const k of Object.keys(CONFIG.Canvas.polygonBackends) ) CONFIG.Canvas.polygonBackends[k] = cls;
  }
});
