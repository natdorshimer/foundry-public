/**
 * An implementation of the PlaceableHUD base class which renders a heads-up-display interface for Drawing objects.
 * The DrawingHUD implementation can be configured and replaced via {@link CONFIG.Drawing.hudClass}.
 * @extends {BasePlaceableHUD<Drawing, DrawingDocument, DrawingsLayer>}
 */
class DrawingHUD extends BasePlaceableHUD {

  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "drawing-hud",
      template: "templates/hud/drawing-hud.html"
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getData(options={}) {
    const {locked, hidden} = this.object.document;
    return foundry.utils.mergeObject(super.getData(options), {
      lockedClass: locked ? "active" : "",
      visibilityClass: hidden ? "active" : ""
    });
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options) {
    let {x, y, width, height} = this.object.frame.bounds;
    const c = 70;
    const p = 10;
    const position = {
      width: width + (c * 2) + (p * 2),
      height: height + (p * 2),
      left: x + this.object.x - c - p,
      top: y + this.object.y - p
    };
    this.element.css(position);
  }
}
