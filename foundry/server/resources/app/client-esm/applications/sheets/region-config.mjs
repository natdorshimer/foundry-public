import DocumentSheetV2 from "../api/document-sheet.mjs";
import HandlebarsApplicationMixin from "../api/handlebars-application.mjs";
import {DOCUMENT_OWNERSHIP_LEVELS} from "../../../common/constants.mjs";

/**
 * @typedef {import("../_types.mjs").ApplicationTab} ApplicationTab
 * @typedef {import("../_types.mjs").FormFooterButton} FormFooterButton
 */

/**
 * The Scene Region configuration application.
 * @extends DocumentSheetV2
 * @mixes HandlebarsApplication
 * @alias RegionConfig
 */
export default class RegionConfig extends HandlebarsApplicationMixin(DocumentSheetV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["region-config"],
    window: {
      contentClasses: ["standard-form"],
      icon: "fa-regular fa-game-board"
    },
    position: {
      width: 480,
      height: "auto"
    },
    form: {
      closeOnSubmit: true
    },
    viewPermission: DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    actions: {
      shapeCreateFromWalls: RegionConfig.#onShapeCreateFromWalls,
      shapeToggleHole: RegionConfig.#onShapeToggleHole,
      shapeMoveUp: RegionConfig.#onShapeMoveUp,
      shapeMoveDown: RegionConfig.#onShapeMoveDown,
      shapeRemove: RegionConfig.#onShapeRemove,
      behaviorCreate: RegionConfig.#onBehaviorCreate,
      behaviorDelete: RegionConfig.#onBehaviorDelete,
      behaviorEdit: RegionConfig.#onBehaviorEdit,
      behaviorToggle: RegionConfig.#onBehaviorToggle
    }
  };

  /** @override */
  static PARTS = {
    tabs: {
      template: "templates/generic/tab-navigation.hbs"
    },
    identity: {
      template: "templates/scene/parts/region-identity.hbs"
    },
    shapes: {
      template: "templates/scene/parts/region-shapes.hbs",
      scrollable: [".scrollable"]
    },
    behaviors: {
      template: "templates/scene/parts/region-behaviors.hbs",
      scrollable: [".scrollable"]
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  }

  /** @override */
  tabGroups = {
    sheet: "identity"
  }

  /* -------------------------------------------- */
  /*  Context Preparation                         */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(_options) {
    const doc = this.document;
    return {
      region: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      tabs: this.#getTabs(),
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _preparePartContext(partId, context) {
    const doc = this.document;
    switch ( partId ) {
      case "footer":
        context.buttons = this.#getFooterButtons();
        break;
      case "behaviors":
        context.tab = context.tabs.behaviors;
        context.behaviors = doc.behaviors.map(b => ({
          id: b.id,
          name: b.name,
          typeLabel: game.i18n.localize(CONFIG.RegionBehavior.typeLabels[b.type]),
          typeIcon: CONFIG.RegionBehavior.typeIcons[b.type] || "fa-regular fa-notdef",
          disabled: b.disabled
        })).sort((a, b) => (a.disabled - b.disabled) || a.name.localeCompare(b.name, game.i18n.lang));
        break;
      case "identity":
        context.tab = context.tabs.identity;
        break;
      case "shapes":
        context.tab = context.tabs.shapes;
        break;
    }
    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll(".region-shape").forEach(e => {
      e.addEventListener("mouseover", this.#onShapeHoverIn.bind(this));
      e.addEventListener("mouseout", this.#onShapeHoverOut.bind(this));
    });
    this.document.object?.renderFlags.set({refreshState: true});
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClose(options) {
    super._onClose(options);
    this.document.object?.renderFlags.set({refreshState: true});
  }

  /* -------------------------------------------- */

  /**
   * Prepare an array of form header tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  #getTabs() {
    const tabs = {
      identity: {id: "identity", group: "sheet", icon: "fa-solid fa-tag", label: "REGION.SECTIONS.identity"},
      shapes: {id: "shapes", group: "sheet", icon: "fa-solid fa-shapes", label: "REGION.SECTIONS.shapes"},
      behaviors: {id: "behaviors", group: "sheet", icon: "fa-solid fa-child-reaching", label: "REGION.SECTIONS.behaviors"}
    }
    for ( const v of Object.values(tabs) ) {
      v.active = this.tabGroups[v.group] === v.id;
      v.cssClass = v.active ? "active" : "";
    }
    return tabs;
  }

  /* -------------------------------------------- */

  /**
   * Prepare an array of form footer buttons.
   * @returns {Partial<FormFooterButton>[]}
   */
  #getFooterButtons() {
    return [
      {type: "submit", icon: "fa-solid fa-save", label: "REGION.ACTIONS.update"}
    ]
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle mouse-hover events on a shape.
   */
  #onShapeHoverIn(event) {
    event.preventDefault();
    if ( !this.document.parent.isView ) return;
    const index = this.#getControlShapeIndex(event);
    canvas.regions._highlightShape(this.document.shapes[index]);
  }

  /* -------------------------------------------- */

  /**
   * Handle mouse-unhover events for shape.
   */
  #onShapeHoverOut(event) {
    event.preventDefault();
    if ( !this.document.parent.isView ) return;
    canvas.regions._highlightShape(null);
  }

  /* -------------------------------------------- */

  /**
   * Handle button clicks to move the shape up.
   * @param {PointerEvent} event
   * @this {RegionConfig}
   */
  static async #onShapeMoveUp(event) {
    if ( this.document.shapes.length <= 1 ) return;
    const index = this.#getControlShapeIndex(event);
    if ( index === 0 ) return;
    const shapes = [...this.document.shapes];
    [shapes[index - 1], shapes[index]] = [shapes[index], shapes[index - 1]];
    await this.document.update({shapes});
  }

  /* -------------------------------------------- */

  /**
   * Handle button clicks to move the shape down.
   * @param {PointerEvent} event
   * @this {RegionConfig}
   */
  static async #onShapeMoveDown(event) {
    if ( this.document.shapes.length <= 1 ) return;
    const index = this.#getControlShapeIndex(event);
    if ( index === this.document.shapes.length - 1 ) return;
    const shapes = [...this.document.shapes];
    [shapes[index], shapes[index + 1]] = [shapes[index + 1], shapes[index]];
    await this.document.update({shapes});
  }

  /* -------------------------------------------- */

  /**
   * Handle button clicks to create shapes from the controlled walls.
   * @param {PointerEvent} event
   * @this {RegionConfig}
   */
  static async #onShapeCreateFromWalls(event) {
    event.preventDefault(); // Don't open context menu
    event.stopPropagation(); // Don't trigger other events
    if ( !canvas.ready || (event.detail > 1) ) return; // Ignore repeated clicks

    // If no walls are controlled, inform the user they need to control walls
    if ( !canvas.walls.controlled.length ) {
      if ( canvas.walls.active ) {
        ui.notifications.error("REGION.NOTIFICATIONS.NoControlledWalls", {localize: true});
      }
      else {
        canvas.walls.activate({tool: "select"});
        ui.notifications.info("REGION.NOTIFICATIONS.ControlWalls", {localize: true});
      }
      return;
    }

    // Create the shape
    const polygons = canvas.walls.identifyInteriorArea(canvas.walls.controlled);
    if ( polygons.length === 0 ) {
      ui.notifications.error("REGION.NOTIFICATIONS.EmptyEnclosedArea", {localize: true});
      return;
    }
    const shapes = polygons.map(p => new foundry.data.PolygonShapeData({points: p.points}));

    // Merge the new shape with form submission data
    const form = this.element;
    const formData = new FormDataExtended(form);
    const submitData = this._prepareSubmitData(event, form, formData);
    submitData.shapes = [...this.document._source.shapes, ...shapes];

    // Update the region
    await this.document.update(submitData);
  }

  /* -------------------------------------------- */

  /**
   * Handle button clicks to toggle the hold field of a shape.
   * @param {PointerEvent} event
   * @this {RegionConfig}
   */
  static async #onShapeToggleHole(event) {
    const index = this.#getControlShapeIndex(event);
    const shapes = this.document.shapes.map(s => s.toObject());
    shapes[index].hole = !shapes[index].hole;
    await this.document.update({shapes});
  }

  /* -------------------------------------------- */

  /**
   * Handle button clicks to remove a shape.
   * @param {PointerEvent} event
   * @this {RegionConfig}
   */
  static async #onShapeRemove(event) {
    const index = this.#getControlShapeIndex(event);
    let shapes = this.document.shapes;
    return foundry.applications.api.DialogV2.confirm({
      window: {
        title: game.i18n.localize("REGION.ACTIONS.shapeRemove")
      },
      content: `<p>${game.i18n.localize("AreYouSure")}</p>`,
      rejectClose: false,
      yes: {
        callback: () => {
          // Test that there haven't been any changes to the shapes since the dialog the button was clicked
          if ( this.document.shapes !== shapes ) return false;
          shapes = [...shapes];
          shapes.splice(index, 1);
          this.document.update({shapes});
          return true;
        }
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * Get the shape index from a control button click.
   * @param {PointerEvent} event    The button-click event
   * @returns {number}              The shape index
   */
  #getControlShapeIndex(event) {
    const button = event.target;
    const li = button.closest(".region-shape");
    return Number(li.dataset.shapeIndex);
  }

  /* -------------------------------------------- */


  /**
   * Handle button clicks to create a new behavior.
   * @this {RegionConfig}
   */
  static async #onBehaviorCreate(_event) {
    await RegionBehavior.implementation.createDialog({}, {parent: this.document});
  }

  /* -------------------------------------------- */

  /**
   * Handle button clicks to delete a behavior.
   * @param {PointerEvent} event
   * @this {RegionConfig}
   */
  static async #onBehaviorDelete(event) {
    const behavior = this.#getControlBehavior(event);
    await behavior.deleteDialog();
  }

  /* -------------------------------------------- */

  /**
   * Handle button clicks to edit a behavior.
   * @param {PointerEvent} event
   * @this {RegionConfig}
   */
  static async #onBehaviorEdit(event) {
    const target = event.target;
    if ( target.closest(".region-element-name") && (event.detail !== 2) ) return; // Double-click on name
    const behavior = this.#getControlBehavior(event);
    await behavior.sheet.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle button clicks to toggle a behavior.
   * @param {PointerEvent} event
   * @this {RegionConfig}
   */
  static async #onBehaviorToggle(event) {
    const behavior = this.#getControlBehavior(event);
    await behavior.update({disabled: !behavior.disabled});
  }

  /* -------------------------------------------- */

  /**
   * Get the RegionBehavior document from a control button click.
   * @param {PointerEvent} event    The button-click event
   * @returns {RegionBehavior}      The region behavior document
   */
  #getControlBehavior(event) {
    const button = event.target;
    const li = button.closest(".region-behavior");
    return this.document.behaviors.get(li.dataset.behaviorId);
  }
}
