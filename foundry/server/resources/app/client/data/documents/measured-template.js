/**
 * The client-side MeasuredTemplate document which extends the common BaseMeasuredTemplate document model.
 * @extends foundry.documents.BaseMeasuredTemplate
 * @mixes ClientDocumentMixin
 *
 * @see {@link Scene}                     The Scene document type which contains MeasuredTemplate documents
 * @see {@link MeasuredTemplateConfig}    The MeasuredTemplate configuration application
 */
class MeasuredTemplateDocument extends CanvasDocumentMixin(foundry.documents.BaseMeasuredTemplate) {

  /* -------------------------------------------- */
  /*  Model Properties                            */
  /* -------------------------------------------- */

  /**
   * Rotation is an alias for direction
   * @returns {number}
   */
  get rotation() {
    return this.direction;
  }

  /* -------------------------------------------- */

  /**
   * Is the current User the author of this template?
   * @type {boolean}
   */
  get isAuthor() {
    return game.user === this.author;
  }
}
