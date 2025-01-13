import DocumentSheetV2 from "../api/document-sheet.mjs";

/**
 * A base class for providing Item Sheet behavior using ApplicationV2.
 */
export default class ItemSheetV2 extends DocumentSheetV2 {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    position: {
      width: 480
    }
  };

  /**
   * The Item document managed by this sheet.
   * @type {ClientDocument}
   */
  get item() {
    return this.document;
  }

  /**
   * The Actor instance which owns this Item, if any.
   * @type {Actor|null}
   */
  get actor() {
    return this.document.actor;
  }
}
