/**
 * The client-side TableResult document which extends the common BaseTableResult document model.
 * @extends foundry.documents.BaseTableResult
 * @mixes ClientDocumentMixin
 *
 * @see {@link RollTable}                The RollTable document type which contains TableResult documents
 */
class TableResult extends ClientDocumentMixin(foundry.documents.BaseTableResult) {

  /**
   * A path reference to the icon image used to represent this result
   */
  get icon() {
    return this.img || CONFIG.RollTable.resultIcon;
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
    if ( game._documentsReady ) {
      if ( this.type === "document" ) {
        this.img = game.collections.get(this.documentCollection)?.get(this.documentId)?.img ?? this.img;
      } else if ( this.type === "pack" ) {
        this.img = game.packs.get(this.documentCollection)?.index.get(this.documentId)?.img ?? this.img;
      }
    }
  }

  /**
   * Prepare a string representation for the result which (if possible) will be a dynamic link or otherwise plain text
   * @returns {string}  The text to display
   */
  getChatText() {
    switch (this.type) {
      case CONST.TABLE_RESULT_TYPES.DOCUMENT:
        return `@${this.documentCollection}[${this.documentId}]{${this.text}}`;
      case CONST.TABLE_RESULT_TYPES.COMPENDIUM:
        return `@Compendium[${this.documentCollection}.${this.documentId}]{${this.text}}`;
      default:
        return this.text;
    }
  }
}
