/**
 * The singleton collection of Folder documents which exist within the active World.
 * This Collection is accessible within the Game object as game.folders.
 * @extends {WorldCollection}
 *
 * @see {@link Folder} The Folder document
 */
class Folders extends WorldCollection {

  /** @override */
  static documentName = "Folder";

  /**
   * Track which Folders are currently expanded in the UI
   */
  _expanded = {};

  /* -------------------------------------------- */

  /** @override */
  _onModifyContents(action, documents, result, operation, user) {
    if ( operation.render ) {
      const folderTypes = new Set(documents.map(f => f.type));
      for ( const type of folderTypes ) {
        if ( type === "Compendium" ) ui.sidebar.tabs.compendium.render(false);
        else {
          const collection = game.collections.get(type);
          collection.render(false, {renderContext: `${action}${this.documentName}`, renderData: result});
        }
      }
      if ( folderTypes.has("JournalEntry") ) this._refreshJournalEntrySheets();
    }
  }

  /* -------------------------------------------- */

  /**
   * Refresh the display of any active JournalSheet instances where the folder list will change.
   * @private
   */
  _refreshJournalEntrySheets() {
    for ( let app of Object.values(ui.windows) ) {
      if ( !(app instanceof JournalSheet) ) continue;
      app.submit();
    }
  }

  /* -------------------------------------------- */

  /** @override */
  render(force, options={}) {
    console.warn("The Folders collection is not directly rendered");
  }
}
