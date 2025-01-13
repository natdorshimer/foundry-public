/**
 * A module which provides documentation for the various hook events which are dispatched throughout the Foundry
 * Virtual Tabletop client-side software.
 * @module hookEvents
 */

/* -------------------------------------------- */
/*  Core lifecycle                              */
/* -------------------------------------------- */

/**
 * A hook event that fires as Foundry is initializing, right before any
 * initialization tasks have begun.
 * @event init
 * @category CoreLifecycle
 */
export function init() {}

/* -------------------------------------------- */

/**
 * A hook event that fires once Localization translations have been loaded and are ready for use.
 * @event i18nInit
 * @category CoreLifecycle
 */
export function i18nInit() {}

/* -------------------------------------------- */

/**
 * A hook event that fires when Foundry has finished initializing but
 * before the game state has been set up. Fires before any Documents, UI
 * applications, or the Canvas have been initialized.
 * @event setup
 * @category CoreLifecycle
 */
export function setup() {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the game is fully ready.
 * @event ready
 * @category CoreLifecycle
 */
export function ready() {}

/* -------------------------------------------- */

/**
 * A hook event that fires whenever foundry experiences an error.
 * @event error
 * @category CoreLifecycle
 * @param {string} location      The method where the error was caught.
 * @param {Error} err            The error.
 * @param {object} [data={}]     Additional data that might be provided, based on the nature of the error.
 */
export function error(location, error, data) {}

/* -------------------------------------------- */
/*  Game                                        */
/* -------------------------------------------- */

/**
 * A hook event that fires when the game is paused or un-paused.
 * @event pauseGame
 * @category Game
 * @param {boolean} paused    Is the game now paused (true) or un-paused (false)
 */
export function pauseGame(paused) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the official World time is changed.
 * @event updateWorldTime
 * @category Game
 * @param {number} worldTime      The new canonical World time.
 * @param {number} dt             The delta.
 * @param {object} options        Options passed from the requesting client where the change was made
 * @param {string} userId         The ID of the User who advanced the time
 */
export function updateWorldTime(worldTime, dt, options, userId) {}

/* -------------------------------------------- */
/*  CanvasLifecycle                             */
/* -------------------------------------------- */

/**
 * A hook event that fires immediately prior to PIXI Application construction with the configuration parameters.
 * @event canvasConfig
 * @category Canvas
 * @param {object} config  Canvas configuration parameters that will be used to initialize the PIXI.Application
 */
export function canvasConfig(config) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the Canvas is initialized.
 * @event canvasInit
 * @category Canvas
 * @param {Canvas} canvas   The Canvas instance being initialized
 */
export function canvasInit(canvas) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the Canvas is panned.
 * @event canvasPan
 * @category Canvas
 * @param {Canvas} canvas         The Canvas instance
 * @param {object} position       The applied camera position
 * @param {number} position.x         The constrained x-coordinate of the pan
 * @param {number} position.y         The constrained y-coordinate of the pan
 * @param {number} position.scale     The constrained zoom level of the pan
 */
export function canvasPan(canvas, position) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the Canvas is ready.
 * @event canvasReady
 * @category Canvas
 * @param {Canvas} canvas The Canvas which is now ready for use
 */
export function canvasReady(canvas) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the Canvas is deactivated.
 * @event canvasTearDown
 * @category Canvas
 * @param {Canvas} canvas   The Canvas instance being deactivated
 */
export function canvasTearDown(canvas) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the Canvas is beginning to draw the canvas groups.
 * @event canvasDraw
 * @category Canvas
 * @param {Canvas} canvas   The Canvas instance being drawn
 */
export function canvasDraw(canvas) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when some useful data is dropped onto the Canvas.
 * @event dropCanvasData
 * @category Canvas
 * @param {Canvas} canvas The Canvas
 * @param {object} data   The data that has been dropped onto the Canvas
 */
export function dropCanvasData(canvas, data) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when objects are highlighted on the canvas.
 * Callers may use this hook to apply their own modifications or enhancements to highlighted objects.
 * @event highlightObjects
 * @category Canvas
 * @param {boolean} active    Is the highlight state now active
 */
export function highlightObjects(active) {}

/* -------------------------------------------- */
/*  Application                                 */
/* -------------------------------------------- */

/**
 * A hook event that fires whenever an Application is rendered. Substitute the
 * Application name in the hook event to target a specific Application type, for example "renderMyApplication".
 * Each Application class in the inheritance chain will also fire this hook, i.e. "renderApplication" will also fire.
 * The hook provides the pending application HTML which will be added to the DOM.
 * Hooked functions may modify that HTML or attach interactive listeners to it.
 *
 * @event renderApplication
 * @category Application
 * @param {Application} application     The Application instance being rendered
 * @param {jQuery} html                 The inner HTML of the document that will be displayed and may be modified
 * @param {object} data                 The object of data used when rendering the application
 */
export function renderApplication(application, html, data) {}

/* -------------------------------------------- */

/**
 * A hook event that fires whenever this Application is first rendered to add buttons to its header.
 *
 * @event getApplicationHeaderButtons
 * @category Application
 * @typedef {{label: string, class: string, icon: string, [tooltip]: string, onclick: Function|null}} ApplicationHeaderButton
 * @param {Application} app                     The Application instance being rendered
 * @param {ApplicationHeaderButton[]} buttons   The array of header buttons which will be displayed
 */
export function getApplicationHeaderButtons(application, buttons) {}

/* -------------------------------------------- */

/**
 * A hook event that fires whenever this Application is closed.
 *
 * @event closeApplication
 * @category Application
 * @param {Application} app                     The Application instance being closed
 * @param {jQuery[]} html                       The application HTML when it is closed
 */
export function closeApplication(application, html) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the Scene controls are initialized.
 * @event getSceneControlButtons
 * @category Application
 * @param {SceneControl[]} controls The SceneControl configurations
 */
export function getSceneControlButtons(controls) {}

/* -------------------------------------------- */

/**
 * A hook event that fires whenever data is dropped into a Hotbar slot.
 * The hook provides a reference to the Hotbar application, the dropped data, and the target slot.
 * Default handling of the drop event can be prevented by returning false within the hooked function.
 * @event hotbarDrop
 * @category Application
 * @param {Hotbar} hotbar       The Hotbar application instance
 * @param {object} data         The dropped data object
 * @param {number} slot         The target hotbar slot
 */
export function hotbarDrop(hotbar, data, slot) {}

/* -------------------------------------------- */

/**
 * A hook event that fires whenever scene navigation is collapsed.
 * @event collapseSceneNavigation
 * @category Application
 * @param {SceneNavigation} sceneNavigation
 * @param {boolean} collapsed
 */
export function collapseSceneNavigation(sceneNavigation, collapsed) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the context menu for entries in an Application is constructed. Substitute the
 * Application name in the hook event to target a specific Application, for example
 * "getActorDirectoryEntryContext".
 * @event getApplicationEntryContext
 * @category Application
 * @param {Application} application           The Application instance that the context menu is constructed in
 * @param {ContextMenuEntry[]} entryOptions   The context menu entries
 */
export function getApplicationEntryContext(application, entryOptions) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the Sidebar is collapsed or expanded.
 * @event collapseSidebar
 * @category Application
 * @param {Sidebar} sidebar   The Sidebar application
 * @param {boolean} collapsed Whether the Sidebar is now collapsed or not
 */
export function collapseSidebar(sidebar, collapsed) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the Sidebar tab is changed.
 * @event changeSidebarTab
 * @category Application
 * @param {SidebarTab} app    The SidebarTab application which is now active
 */
export function changeSidebarTab(app) {}

/* -------------------------------------------- */
/*  EffectsCanvasGroup                          */
/* -------------------------------------------- */

/**
 * A hook event that fires when a {@link CanvasGroup} is drawn.
 * The dispatched event name replaces "Group" with the named CanvasGroup subclass, i.e. "drawPrimaryCanvasGroup".
 * @event drawGroup
 * @category CanvasGroup
 * @param {CanvasGroup} group         The group being drawn
 */
export function drawGroup(group) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when a {@link CanvasGroup} is deconstructed.
 * The dispatched event name replaces "Group" with the named CanvasGroup subclass, i.e. "tearDownPrimaryCanvasGroup".
 * @event tearDownGroup
 * @category CanvasGroup
 * @param {CanvasGroup} group         The group being deconstructed
 */
export function tearDownGroup(group) {}

/* -------------------------------------------- */
/*  CanvasLayer                                 */
/* -------------------------------------------- */

/**
 * A hook event that fires when a {@link CanvasLayer} is drawn.
 * The dispatched event name replaces "Layer" with the named CanvasLayer subclass, i.e. "drawTokensLayer".
 * @event drawLayer
 * @category CanvasLayer
 * @param {CanvasLayer} layer         The layer being drawn
 */
export function drawLayer(layer) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when a {@link CanvasLayer} is deconstructed.
 * The dispatched event name replaces "Layer" with the named CanvasLayer subclass, i.e. "tearDownTokensLayer".
 * @event tearDownLayer
 * @category CanvasLayer
 * @param {CanvasLayer} layer         The layer being deconstructed
 */
export function tearDownLayer(layer) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when any PlaceableObject is pasted onto the Scene.
 * Substitute the PlaceableObject name in the hook event to target a
 * specific PlaceableObject type, for example "pasteToken".
 * @event pastePlaceableObject
 * @category CanvasLayer
 * @param {PlaceableObject[]} copied The PlaceableObjects that were copied
 * @param {object[]} createData      The new objects that will be added to the Scene
 */
export function pastePlaceableObject(copied, createData) {}

/* -------------------------------------------- */
/*  Active Effects                              */
/* -------------------------------------------- */

/**
 * A hook event that fires when a custom active effect is applied.
 * @event applyActiveEffect
 * @category Active Effects
 * @param {Actor} actor                   The actor the active effect is being applied to
 * @param {EffectChangeData} change       The change data being applied
 * @param {*} current                     The current value being modified
 * @param {*} delta                       The parsed value of the change object
 * @param {object} changes                An object which accumulates changes to be applied
 */
export function applyActiveEffect(actor, change, current, delta, changes) {}

/* -------------------------------------------- */
/*  Compendium                                  */
/* -------------------------------------------- */

/**
 * A hook event that fires whenever the contents of a Compendium pack were modified.
 * This hook fires for all connected clients after the update has been processed.
 *
 * @event updateCompendium
 * @category Compendium
 * @param {CompendiumCollection} pack   The Compendium pack being modified
 * @param {Document[]} documents        The locally-cached Documents which were modified in the operation
 * @param {object} options              Additional options which modified the modification request
 * @param {string} userId               The ID of the User who triggered the modification workflow
 */
export function updateCompendium(pack, documents, options, userId) {}

/* -------------------------------------------- */
/*  Document                                    */
/* -------------------------------------------- */

/**
 * A hook event that fires for every Document type before execution of a creation workflow. Substitute the
 * Document name in the hook event to target a specific Document type, for example "preCreateActor". This hook
 * only fires for the client who is initiating the creation request.
 *
 * The hook provides the pending document instance which will be used for the Document creation. Hooked functions
 * may modify the pending document with updateSource, or prevent the workflow entirely by returning false.
 *
 * @event preCreateDocument
 * @category Document
 * @param {Document} document                     The pending document which is requested for creation
 * @param {object} data                           The initial data object provided to the document creation request
 * @param {Partial<DatabaseCreateOperation>} options Additional options which modify the creation request
 * @param {string} userId                         The ID of the requesting user, always game.user.id
 * @returns {boolean|void}                        Explicitly return false to prevent creation of this Document
 */
export function preCreateDocument(document, data, options, userId) {}

/* -------------------------------------------- */

/**
 * A hook event that fires for every Document type before execution of an update workflow. Substitute the Document
 * name in the hook event to target a specific Document type, for example "preUpdateActor". This hook only fires
 * for the client who is initiating the update request.
 *
 * The hook provides the differential data which will be used to update the Document. Hooked functions may modify
 * that data or prevent the workflow entirely by explicitly returning false.
 *
 * @event preUpdateDocument
 * @category Document
 * @param {Document} document                       The Document instance being updated
 * @param {object} changed                          Differential data that will be used to update the document
 * @param {Partial<DatabaseUpdateOperation>} options Additional options which modify the update request
 * @param {string} userId                           The ID of the requesting user, always game.user.id
 * @returns {boolean|void}                          Explicitly return false to prevent update of this Document
 */
export function preUpdateDocument(document, changed, options, userId) {}

/* -------------------------------------------- */

/**
 * A hook event that fires for every Document type before execution of a deletion workflow. Substitute the
 * Document name in the hook event to target a specific Document type, for example "preDeleteActor". This hook
 * only fires for the client who is initiating the update request.
 *
 * The hook provides the Document instance which is requested for deletion. Hooked functions may prevent the
 * workflow entirely by explicitly returning false.
 *
 * @event preDeleteDocument
 * @category Document
 * @param {Document} document                       The Document instance being deleted
 * @param {Partial<DatabaseDeleteOperation>} options Additional options which modify the deletion request
 * @param {string} userId                           The ID of the requesting user, always game.user.id
 * @returns {boolean|void}                          Explicitly return false to prevent deletion of this Document
 */
export function preDeleteDocument(document, options, userId) {}

/* -------------------------------------------- */

/**
 * A hook event that fires for every embedded Document type after conclusion of a creation workflow.
 * Substitute the Document name in the hook event to target a specific type, for example "createToken".
 * This hook fires for all connected clients after the creation has been processed.
 *
 * @event createDocument
 * @category Document
 * @param {Document} document                       The new Document instance which has been created
 * @param {Partial<DatabaseCreateOperation>} options Additional options which modified the creation request
 * @param {string} userId                           The ID of the User who triggered the creation workflow
 */
export function createDocument(document, options, userId) {}

/* -------------------------------------------- */

/**
 * A hook event that fires for every Document type after conclusion of an update workflow.
 * Substitute the Document name in the hook event to target a specific Document type, for example "updateActor".
 * This hook fires for all connected clients after the update has been processed.
 *
 * @event updateDocument
 * @category Document
 * @param {Document} document                       The existing Document which was updated
 * @param {object} changed                          Differential data that was used to update the document
 * @param {Partial<DatabaseUpdateOperation>} options Additional options which modified the update request
 * @param {string} userId                           The ID of the User who triggered the update workflow
 */
export function updateDocument(document, changed, options, userId) {}

/* -------------------------------------------- */

/**
 * A hook event that fires for every Document type after conclusion of an deletion workflow.
 * Substitute the Document name in the hook event to target a specific Document type, for example "deleteActor".
 * This hook fires for all connected clients after the deletion has been processed.
 *
 * @event deleteDocument
 * @category Document
 * @param {Document} document                       The existing Document which was deleted
 * @param {Partial<DatabaseDeleteOperation>} options Additional options which modified the deletion request
 * @param {string} userId                           The ID of the User who triggered the deletion workflow
 */
export function deleteDocument(document, options, userId) {}

/* -------------------------------------------- */
/*  PlaceableObject                             */
/* -------------------------------------------- */

/**
 * A hook event that fires when a {@link PlaceableObject} is initially drawn.
 * The dispatched event name replaces "Object" with the named PlaceableObject subclass, i.e. "drawToken".
 * @event drawObject
 * @category PlaceableObject
 * @param {PlaceableObject} object    The object instance being drawn
 */
export function drawObject(object) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when a {@link PlaceableObject} is incrementally refreshed.
 * The dispatched event name replaces "Object" with the named PlaceableObject subclass, i.e. "refreshToken".
 * @event refreshObject
 * @category PlaceableObject
 * @param {PlaceableObject} object    The object instance being refreshed
 */
export function refreshObject(object) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when a {@link PlaceableObject} is destroyed.
 * The dispatched event name replaces "Object" with the named PlaceableObject subclass, i.e. "destroyToken".
 * @event destroyObject
 * @category PlaceableObject
 * @param {PlaceableObject} object    The object instance being destroyed
 */
export function destroyObject(object) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when a {@link PlaceableObject} is selected or
 * deselected. Substitute the PlaceableObject name in the hook event to
 * target a specific PlaceableObject type, for example "controlToken".
 * @event controlObject
 * @category PlaceableObject
 * @param {PlaceableObject} object The object instance which is selected/deselected.
 * @param {boolean} controlled     Whether the PlaceableObject is selected or not.
 */
export function controlObject(object, controlled) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when a {@link PlaceableObject} is hovered over or out.
 * Substitute the PlaceableObject name in the hook event to target a specific
 * PlaceableObject type, for example "hoverToken".
 * @event hoverObject
 * @category PlaceableObject
 * @param {PlaceableObject} object The object instance.
 * @param {boolean} hovered        Whether the PlaceableObject is hovered over or not.
 */
export function hoverObject(object, hovered) {}

/* -------------------------------------------- */
/*  Token                                       */
/* -------------------------------------------- */

/**
 * A hook event that fires when a token {@link Token} should apply a specific status effect.
 * @event applyTokenStatusEffect
 * @category Token
 * @param {Token} token       The token affected.
 * @param {string} statusId   The status effect ID being applied, from CONFIG.specialStatusEffects.
 * @param {boolean} active    Is the special status effect now active?
 */
export function applyTokenStatusEffect(token, statusId, active) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when a chat bubble is initially configured.
 * @event chatBubble
 * @category Token
 * @param {Token} token                 The speaking token
 * @param {jQuery} html                 The HTML of the chat bubble
 * @param {string} message              The spoken message text
 * @param {ChatBubbleOptions} options   Provided options which affect bubble appearance
 * @returns {void|false}                May return false to prevent the calling workflow
 */
export function chatBubble(token, html, message, {cssClasses, pan}) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when a token's resource bar attribute has been modified.
 * @event modifyTokenAttribute
 * @category Token
 * @param {object} data           An object describing the modification
 * @param {string} data.attribute The attribute path
 * @param {number} data.value     The target attribute value
 * @param {boolean} data.isDelta  Does number represents a relative change (true) or an absolute change (false)
 * @param {boolean} data.isBar    Whether the new value is part of an attribute bar, or just a direct value
 * @param {objects} updates       The update delta that will be applied to the Token's actor
 */
export function modifyTokenAttribute({attribute, value, isDelta, isBar}, updates) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when a token is targeted or un-targeted.
 * @event targetToken
 * @category Token
 * @param {User} user        The User doing the targeting
 * @param {Token} token      The targeted Token
 * @param {boolean} targeted Whether the Token has been targeted or untargeted
 */
export function targetToken(user, token, targeted) {}

/* -------------------------------------------- */
/*  Note                                        */
/* -------------------------------------------- */

/**
 * A hook event that fires whenever a map note is double-clicked.
 * The hook provides the note placeable and the arguments passed to the associated {@link JournalSheet} render call.
 * Hooked functions may modify the render arguments or cancel the render by returning false.
 * @event activateNote
 * @category Note
 * @param {Note} note  The note that was activated.
 * @param {object} options  Options for rendering the associated {@link JournalSheet}.
 */
export function activateNote(note, options) {}

/* -------------------------------------------- */
/*  PointSource                                 */
/* -------------------------------------------- */

/**
 * A hook event that fires after RenderedPointSource shaders have initialized.
 * @event initializeRenderedEffectSourceShaders
 * @category PointSource
 * @param {RenderedEffectSource} source   The RenderedEffectSource instance being initialized
 */
export function initializeRenderedEffectSourceShaders(source) {}

/* -------------------------------------------- */
/*  Cards                                       */
/* -------------------------------------------- */

/**
 * A hook event that fires when Cards are dealt from a deck to other hands.
 * @event dealCards
 * @category Cards
 * @param {Cards} origin                       The origin Cards document
 * @param {Cards[]} destinations               An array of destination Cards documents
 * @param {object} context                     Additional context which describes the operation
 * @param {string} context.action              The action name being performed, i.e. "deal", "pass"
 * @param {Array<object[]>} context.toCreate   An array of Card creation operations to be performed in each
 *                                             destination Cards document
 * @param {object[]} context.fromUpdate        Card update operations to be performed in the origin Cards document
 * @param {object[]} context.fromDelete        Card deletion operations to be performed in the origin Cards document
 */
export function dealCards(origin, destinations, {action, toCreate, fromUpdate, fromDelete}) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when Cards are passed from one stack to another.
 * @event passCards
 * @category Cards
 * @param {Cards} origin                The origin Cards document
 * @param {Cards} destination           The destination Cards document
 * @param {object} context              Additional context which describes the operation
 * @param {string} context.action       The action name being performed, i.e. "pass", "play", "discard", "draw"
 * @param {object[]} context.toCreate     Card creation operations to be performed in the destination Cards document
 * @param {object[]} context.toUpdate     Card update operations to be performed in the destination Cards document
 * @param {object[]} context.fromUpdate   Card update operations to be performed in the origin Cards document
 * @param {object[]} context.fromDelete   Card deletion operations to be performed in the origin Cards document
 */
export function passCards(origin, destination, {action, toCreate, toUpdate, fromUpdate, fromDelete}) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when Cards are dealt from a deck to other hands.
 * @event returnCards
 * @category Cards
 * @param {Cards} origin                               The origin Cards document.
 * @param {Card[]} returned                            The cards being returned.
 * @param {object} context                             Additional context which describes the operation.
 * @param {Record<string, object[]>} context.toUpdate  A mapping of Card deck IDs to the update operations that
 *                                                     will be performed on them.
 * @param {object[]} context.fromDelete                Card deletion operations to be performed on the origin Cards
 *                                                     document.
 */
export function returnCards(origin, returned, {toUpdate, fromDelete}) {}

/* -------------------------------------------- */
/*  Actor                                       */
/* -------------------------------------------- */

/**
 * A hook even that fires when package-provided art is applied to a compendium Document.
 * @param {typeof Document} documentClass  The Document class.
 * @param {object} source                  The Document's source data.
 * @param {CompendiumCollection} pack      The Document's compendium.
 * @param {CompendiumArtInfo} art          The art being applied.
 */
function applyCompendiumArt(documentClass, source, pack, art) {}

/* -------------------------------------------- */
/*  ActorSheet                                  */
/* -------------------------------------------- */

/**
 * A hook event that fires when some useful data is dropped onto an ActorSheet.
 * @event dropActorSheetData
 * @category ActorSheet
 * @param {Actor} actor      The Actor
 * @param {ActorSheet} sheet The ActorSheet application
 * @param {object} data      The data that has been dropped onto the sheet
 */
export function dropActorSheetData(actor, sheet, data) {}

/* -------------------------------------------- */
/*  InteractionLayer                            */
/* -------------------------------------------- */

/**
 * A hook event that fires with a {@link InteractionLayer} becomes active.
 * The dispatched event name replaces "Layer" with the named InteractionLayer subclass, i.e. "activateTokensLayer".
 * @event activateLayer
 * @category InteractionLayer
 * @param {InteractionLayer} layer    The layer becoming active
 */
export function activateLayer(layer) {}

/* -------------------------------------------- */

/**
 * A hook event that fires with a {@link InteractionLayer} becomes inactive.
 * The dispatched event name replaces "Layer" with the named InteractionLayer subclass, i.e. "deactivateTokensLayer".
 * @event deactivateLayer
 * @category InteractionLayer
 * @param {InteractionLayer} layer    The layer becoming inactive
 */
export function deactivateLayer(layer) {}

/* -------------------------------------------- */
/*  CanvasVisibility                            */
/* -------------------------------------------- */

/**
 * A hook event that fires when the set of vision sources are initialized.
 * @event initializeVisionSources
 * @category CanvasVisibility
 * @param {Collection<string, VisionSource>} sources  The collection of current vision sources
 */
export function initializeVisionSources(sources) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the LightingLayer is refreshed.
 * @event lightingRefresh
 * @category EffectsCanvasGroup
 * @param {EffectsCanvasGroup} group The EffectsCanvasGroup instance
 */
export function lightingRefresh(group) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when visibility is refreshed.
 * @event visibilityRefresh
 * @category CanvasVisibility
 * @param {CanvasVisibility} visibility The CanvasVisibility instance
 */
export function visibilityRefresh(visibility) {}

/* -------------------------------------------- */

/**
 * A hook event that fires during light source initialization.
 * This hook can be used to add programmatic light sources to the Scene.
 * @event initializeLightSources
 * @category CanvasVisibility
 * @param {EffectsCanvasGroup} group   The EffectsCanvasGroup where light sources are initialized
 */
export function initializeLightSources(group) {}

/* -------------------------------------------- */

/**
 * A hook event that fires during darkness source initialization.
 * This hook can be used to add programmatic darkness sources to the Scene.
 * @event initializeDarknessSources
 * @category CanvasVisibility
 * @param {EffectsCanvasGroup} group   The EffectsCanvasGroup where darkness sources are initialized
 */
export function initializeDarknessSources(group) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the CanvasVisibility layer has been refreshed.
 * @event sightRefresh
 * @category CanvasVisibility
 * @param {CanvasVisibility} visibility     The CanvasVisibility layer
 */
export function sightRefresh(visibility) {}

/* -------------------------------------------- */
/*  Weather                                     */
/* -------------------------------------------- */

/**
 * A hook event that fires when initializing a weather effect
 * @event initializeWeatherEffects
 * @category Weather
 * @param {WeatherEffects} weatherEffect  The weather effects canvas layer.
 * @param {object} weatherEffectsConfig   The weather effects config object.
 */
export function initializeWeatherEffects(weatherEffect, weatherEffectsConfig) {}

/* -------------------------------------------- */
/*  Adventure                                   */
/* -------------------------------------------- */

/**
 * A hook event that fires when Adventure data is being prepared for import.
 * Modules may return false from this hook to take over handling of the import workflow.
 * @event preImportAdventure
 * @category Adventure
 * @param {Adventure} adventure                 The Adventure document from which content is being imported
 * @param {object} formData                     Processed data from the importer form
 * @param {Record<string, object[]>} toCreate   Adventure data which needs to be created in the World
 * @param {Record<string, object[]>} toUpdate   Adventure data which needs to be updated in the World
 * @returns {boolean|void}                      False to prevent the core software from handling the import
 */
export function preImportAdventure(adventure, formData, toCreate, toUpdate) {}

/**
 * A hook event that fires after an Adventure has been imported into the World.
 * @event importAdventure
 * @category Adventure
 * @param {Adventure} adventure         The Adventure document from which content is being imported
 * @param {object} formData             Processed data from the importer form
 * @param {Record<string, Document[]>} created  Documents which were created in the World
 * @param {Record<string, Document[]>} updated  Documents which were updated in the World
 */
export function importAdventure(adventure, formData, created, updated) {}

/* -------------------------------------------- */
/*  Socket                                      */
/* -------------------------------------------- */

/**
 * A hook event that fires whenever some other User joins or leaves the game session.
 * @event userConnected
 * @category User
 * @param {User} user                     The User who has connected or disconnected
 * @param {boolean} connected             Is the user now connected (true) or disconnected (false)
 */
export function userConnected(user, connected) {}

/* -------------------------------------------- */
/*  Combat                                      */
/* -------------------------------------------- */

/**
 * A hook event which fires when the turn order of a Combat encounter is progressed.
 * This event fires on all clients after the database update has occurred for the Combat.
 * @param {Combat} combat                 The Combat encounter for which the turn order has changed
 * @param {CombatHistoryData} prior       The prior turn state
 * @param {CombatHistoryData} current     The new turn state
 */
export function combatTurnChange(combat, prior, current) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when a Combat encounter is started.
 * This event fires on the initiating client before any database update occurs.
 * @event combatStart
 * @category Combat
 * @param {Combat} combat           The Combat encounter which is starting
 * @param {object} updateData       An object which contains Combat properties that will be updated. Can be mutated.
 * @param {number} updateData.round      The initial round
 * @param {number} updateData.turn       The initial turn
 */
export function combatStart(combat, updateData) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the turn of the Combat encounter changes.
 * This event fires on the initiating client before any database update occurs.
 * @event combatTurn
 * @category Combat
 * @param {Combat} combat           The Combat encounter which is advancing or rewinding its turn
 * @param {object} updateData       An object which contains Combat properties that will be updated. Can be mutated.
 * @param {number} updateData.round      The current round of Combat
 * @param {number} updateData.turn       The new turn number
 * @param {object} updateOptions    An object which contains options provided to the update method. Can be mutated.
 * @param {number} updateOptions.advanceTime    The amount of time in seconds that time is being advanced
 * @param {number} updateOptions.direction      A signed integer for whether the turn order is advancing or rewinding
 */
export function combatTurn(combat, updateData, updateOptions) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the round of the Combat encounter changes.
 * This event fires on the initiating client before any database update occurs.
 * @event combatRound
 * @category Combat
 * @param {Combat} combat           The Combat encounter which is advancing or rewinding its round
 * @param {object} updateData       An object which contains Combat properties that will be updated. Can be mutated.
 * @param {number} updateData.round      The new round of Combat
 * @param {number} updateData.turn       The new turn number
 * @param {object} updateOptions    An object which contains options provided to the update method. Can be mutated.
 * @param {number} updateOptions.advanceTime    The amount of time in seconds that time is being advanced
 * @param {number} updateOptions.direction      A signed integer for whether the turn order is advancing or rewinding
 */
export function combatRound(combat, updateData, updateOptions) {}

/* -------------------------------------------- */
/*  ProseMirror                                 */
/* -------------------------------------------- */

/**
 * A hook even that fires when a ProseMirrorMenu's drop-downs are initialized.
 * The hook provides the ProseMirrorMenu instance and an object of drop-down configuration data.
 * Hooked functions may append their own drop-downs or append entries to existing drop-downs.
 *
 * @event getProseMirrorMenuDropDowns
 * @category ProseMirrorMenu
 * @param {ProseMirrorMenu} menu  The ProseMirrorMenu instance.
 * @param {{format: ProseMirrorDropDownConfig, fonts: ProseMirrorDropDownConfig}} config  The drop-down config.
 */
export function getProseMirrorMenuDropDowns(menu, config) {}

/* -------------------------------------------- */

/**
 * A hook even that fires when a ProseMirrorMenu's buttons are initialized.
 * The hook provides the ProseMirrorMenu instance and an array of button configuration data.
 * Hooked functions may append their own buttons to the list.
 *
 * @event getProseMirrorMenuItems
 * @category ProseMirrorMenu
 * @param {ProseMirrorMenu} menu          The ProseMirrorMenu instance.
 * @param {ProseMirrorMenuItem[]} config  The button configuration objects.
 */
export function getProseMirrorMenuItems(menu, config) {}

/* -------------------------------------------- */

/**
 * A hook event that fires whenever a ProseMirror editor is created.
 * The hook provides the ProseMirror instance UUID, a list of plugins, and an object containing the provisional
 * editor state, and a reference to the menu plugin.
 * Hooked functions may append their own plugins or replace the state or menu plugin by replacing their references
 * in the final argument.
 *
 * @event createProseMirrorEditor
 * @category ProseMirrorEditor
 * @param {string} uuid                   A UUID that uniquely identifies this ProseMirror instance.
 * @param {Record<string, Plugin>} plugins        A list of plugins that will be loaded.
 * @param {{state: EditorState}} options  The provisional EditorState and ProseMirrorMenuPlugin.
 */
export function createProseMirrorEditor(uuid, plugins, options) {}

/* -------------------------------------------- */
/*  HotReload                                   */
/* -------------------------------------------- */

/**
 * A hook event that fires when a package that is being watched by the hot reload system has a file changed.
 * The hook provides the hot reload data related to the file change.
 * Hooked functions may intercept the hot reload and prevent the core software from handling it by returning false.
 *
 * @event hotReload
 * @category HotReload
 * @param {HotReloadData} data          The hot reload data
 */
export function hotReload(data) {}

/* -------------------------------------------- */
/*  Chat                                        */
/* -------------------------------------------- */

/**
 * A hook event that fires when a user sends a message through the ChatLog.
 * @event chatMessage
 * @category Chat
 * @param {ChatLog} chatLog         The ChatLog instance
 * @param {string} message          The trimmed message content
 * @param {object} chatData         Some basic chat data
 * @param {string} chatData.user    The id of the User sending the message
 * @param {object} chatData.speaker The identified speaker data, see {@link ChatMessage.getSpeaker}
 */
export function chatMessage(chatLog, message, {user, speaker}) {}

/* -------------------------------------------- */

/**
 * A hook event that fires for each ChatMessage which is rendered for addition to the ChatLog.
 * This hook allows for final customization of the message HTML before it is added to the log.
 * @event renderChatMessage
 * @category Chat
 * @param {ChatMessage} message   The ChatMessage document being rendered
 * @param {jQuery} html           The pending HTML as a jQuery object
 * @param {object} data           The input data provided for template rendering
 */
export function renderChatMessage(message, html, messageData) {}

/* -------------------------------------------- */
/*  Audio-Video                                 */
/* -------------------------------------------- */

/**
 * A hook event that fires when the user modifies a global volume slider.
 * The hook name needs to be customized to include the type of global volume being changed, one of:
 * `globalPlaylistVolumeChanged`, `globalAmbientVolumeChanged`, or `globalInterfaceVolumeChanged`.
 * @event globalVolumeChanged
 * @category Audio-Video
 * @param {number} volume     The new volume level
 */
export function globalVolumeChanged(volume) {}

/* -------------------------------------------- */

/**
 * A hook event that fires when the AV settings are changed.
 * @event rtcSettingsChanged
 * @category Audio-Video
 * @param {AVSettings} settings The AVSettings manager
 * @param {object} changed      The delta of the settings that have been changed
 */
export function rtcSettingsChanged(settings, changed) {}

/* -------------------------------------------- */
/*  RollTableConfig                             */
/* -------------------------------------------- */

/**
 * A hook event that fires when some useful data is dropped onto a RollTableConfig.
 * @event dropRollTableSheetData
 * @category RollTableConfig
 * @param {RollTable} table       The RollTable
 * @param {RollTableConfig} sheet The RollTableConfig application
 * @param {object} data           The data dropped onto the RollTableConfig
 */
export function dropRollTableSheetData(table, sheet, data) {}

/* -------------------------------------------- */
/*  Dynamic Token Ring                          */
/* -------------------------------------------- */

/**
 * A hook event that allows to pass custom dynamic ring configurations.
 * @event initializeDynamicTokenRingConfig
 * @category DynamicTokenRing
 * @param {TokenRingConfig} ringConfig The ring configuration instance
 */
export function initializeDynamicTokenRingConfig(ringConfig) {}

