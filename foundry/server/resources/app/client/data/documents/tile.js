/**
 * The client-side Tile document which extends the common BaseTile document model.
 * @extends foundry.documents.BaseTile
 * @mixes ClientDocumentMixin
 *
 * @see {@link Scene}                     The Scene document type which contains Tile documents
 * @see {@link TileConfig}                The Tile configuration application
 */
class TileDocument extends CanvasDocumentMixin(foundry.documents.BaseTile) {

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();
    const d = this.parent?.dimensions;
    if ( !d ) return;
    const securityBuffer = Math.max(d.size / 5, 20).toNearest(0.1);
    const maxX = d.width - securityBuffer;
    const maxY = d.height - securityBuffer;
    const minX = (this.width - securityBuffer) * -1;
    const minY = (this.height - securityBuffer) * -1;
    this.x = Math.clamp(this.x.toNearest(0.1), minX, maxX);
    this.y = Math.clamp(this.y.toNearest(0.1), minY, maxY);
  }
}
