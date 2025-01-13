/**
 * The Application responsible for configuring a single Playlist document.
 * @extends {DocumentSheet}
 * @param {Playlist} object                 The {@link Playlist} to configure.
 * @param {DocumentSheetOptions} [options]  Application configuration options.
 */
class PlaylistConfig extends DocumentSheet {

  /** @inheritdoc */
  static get defaultOptions() {
    const options = super.defaultOptions;
    options.id = "playlist-config";
    options.template = "templates/playlist/playlist-config.html";
    options.width = 360;
    return options;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  get title() {
    return `${game.i18n.localize("PLAYLIST.Edit")}: ${this.object.name}`;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  getData(options={}) {
    const data = super.getData(options);
    data.modes = Object.entries(CONST.PLAYLIST_MODES).reduce((obj, e) => {
      const [name, value] = e;
      obj[value] = game.i18n.localize(`PLAYLIST.Mode${name.titleCase()}`);
      return obj;
    }, {});
    data.sorting = Object.entries(CONST.PLAYLIST_SORT_MODES).reduce((obj, [name, value]) => {
      obj[value] = game.i18n.localize(`PLAYLIST.Sort${name.titleCase()}`);
      return obj;
    }, {});
    data.channels = CONST.AUDIO_CHANNELS;
    return data;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("file-picker").on("change", this._onBulkImport.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Special actions to take when a bulk-import path is selected in the FilePicker.
   * @param {Event} event     The <file-picker> change event
   */
  async _onBulkImport(event) {

    // Get audio files
    const fp = event.target;
    fp.picker.type = "audio";
    const contents = await fp.picker.browse(fp.value);
    fp.picker.type = "folder";
    if ( !contents?.files?.length ) return;

    // Prepare PlaylistSound data
    const playlist = this.object;
    const currentSources = new Set(playlist.sounds.map(s => s.path));
    const toCreate = contents.files.reduce((arr, src) => {
      if ( !AudioHelper.hasAudioExtension(src) || currentSources.has(src) ) return arr;
      const soundData = { name: foundry.audio.AudioHelper.getDefaultSoundName(src), path: src };
      arr.push(soundData);
      return arr;
    }, []);

    // Create all PlaylistSound documents
    if ( toCreate.length ) {
      ui.playlists._expanded.add(playlist.id);
      return playlist.createEmbeddedDocuments("PlaylistSound", toCreate);
    } else {
      const warning = game.i18n.format("PLAYLIST.BulkImportWarning", {path: filePicker.target});
      return ui.notifications.warn(warning);
    }
  }
}
