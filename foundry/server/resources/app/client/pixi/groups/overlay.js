/**
 * A container group which is not bound to the stage world transform.
 *
 * @category - Canvas
 */
class OverlayCanvasGroup extends CanvasGroupMixin(UnboundContainer) {
  /** @override */
  static groupName = "overlay";

  /** @override */
  static tearDownChildren = false;
}

