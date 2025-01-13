/**
 * The client-side Drawing document which extends the common BaseDrawing model.
 *
 * @extends foundry.documents.BaseDrawing
 * @mixes ClientDocumentMixin
 *
 * @see {@link Scene}               The Scene document type which contains Drawing embedded documents
 * @see {@link DrawingConfig}       The Drawing configuration application
 */
class DrawingDocument extends CanvasDocumentMixin(foundry.documents.BaseDrawing) {

  /* -------------------------------------------- */
  /*  Model Properties                            */
  /* -------------------------------------------- */

  /**
   * Is the current User the author of this drawing?
   * @type {boolean}
   */
  get isAuthor() {
    return game.user === this.author;
  }
}
