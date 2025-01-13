/**
 * The client-side PlaylistSound document which extends the common BasePlaylistSound model.
 * Each PlaylistSound belongs to the sounds collection of a Playlist document.
 * @extends foundry.documents.BasePlaylistSound
 * @mixes ClientDocumentMixin
 *
 * @see {@link Playlist}              The Playlist document which contains PlaylistSound embedded documents
 * @see {@link PlaylistSoundConfig}   The PlaylistSound configuration application
 * @see {@link foundry.audio.Sound}   The Sound API which manages web audio playback
 */
class PlaylistSound extends ClientDocumentMixin(foundry.documents.BasePlaylistSound) {

  /**
   * The debounce tolerance for processing rapid volume changes into database updates in milliseconds
   * @type {number}
   */
  static VOLUME_DEBOUNCE_MS = 100;

  /**
   * The Sound which manages playback for this playlist sound.
   * The Sound is created lazily when playback is required.
   * @type {Sound|null}
   */
  sound;

  /**
   * A debounced function, accepting a single volume parameter to adjust the volume of this sound
   * @type {function(number): void}
   * @param {number} volume     The desired volume level
   */
  debounceVolume = foundry.utils.debounce(volume => {
    this.update({volume}, {diff: false, render: false});
  }, PlaylistSound.VOLUME_DEBOUNCE_MS);

  /* -------------------------------------------- */

  /**
   * Create a Sound used to play this PlaylistSound document
   * @returns {Sound|null}
   * @protected
   */
  _createSound() {
    if ( game.audio.locked ) {
      throw new Error("You may not call PlaylistSound#_createSound until after game audio is unlocked.");
    }
    if ( !(this.id && this.path) ) return null;
    const sound = game.audio.create({src: this.path, context: this.context, singleton: false});
    sound.addEventListener("play", this._onStart.bind(this));
    sound.addEventListener("end", this._onEnd.bind(this));
    sound.addEventListener("stop", this._onStop.bind(this));
    return sound;
  }

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Determine the fade duration for this PlaylistSound based on its own configuration and that of its parent.
   * @type {number}
   */
  get fadeDuration() {
    if ( !this.sound.duration ) return 0;
    const halfDuration = Math.ceil(this.sound.duration / 2) * 1000;
    return Math.clamp(this.fade ?? this.parent.fade ?? 0, 0, halfDuration);
  }

  /**
   * The audio context within which this sound is played.
   * This will be undefined if the audio context is not yet active.
   * @type {AudioContext|undefined}
   */
  get context() {
    const channel = (this.channel || this.parent.channel) ?? "music";
    return game.audio[channel];
  }

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /**
   * Synchronize playback for this particular PlaylistSound instance.
   */
  sync() {

    // Conclude playback
    if ( !this.playing ) {
      if ( this.sound?.playing ) {
        this.sound.stop({fade: this.pausedTime ? 0 : this.fadeDuration, volume: 0});
      }
      return;
    }

    // Create a Sound if necessary
    this.sound ||= this._createSound();
    const sound = this.sound;
    if ( !sound || sound.failed ) return;

    // Update an already playing sound
    if ( sound.playing ) {
      sound.loop = this.repeat;
      sound.fade(this.volume, {duration: 500});
      return;
    }

    // Begin playback
    sound.load({autoplay: true, autoplayOptions: {
      loop: this.repeat,
      volume: this.volume,
      fade: this.fade,
      offset: this.pausedTime && !sound.playing ? this.pausedTime : undefined
    }});
  }

  /* -------------------------------------------- */

  /**
   * Load the audio for this sound for the current client.
   * @returns {Promise<void>}
   */
  async load() {
    this.sound ||= this._createSound();
    await this.sound.load();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  toAnchor({classes=[], ...options}={}) {
    if ( this.playing ) classes.push("playing");
    if ( !this.isOwner ) classes.push("disabled");
    return super.toAnchor({classes, ...options});
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onClickDocumentLink(event) {
    if ( this.playing ) return this.parent.stopSound(this);
    return this.parent.playSound(this);
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if ( this.parent ) this.parent._playbackOrder = undefined;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if ( "path" in changed ) {
      if ( this.sound ) this.sound.stop();
      this.sound = this._createSound();
    }
    if ( ("sort" in changed) && this.parent ) {
      this.parent._playbackOrder = undefined;
    }
    this.sync();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    if ( this.parent ) this.parent._playbackOrder = undefined;
    this.playing = false;
    this.sync();
  }

  /* -------------------------------------------- */

  /**
   * Special handling that occurs when playback of a PlaylistSound is started.
   * @protected
   */
  async _onStart() {
    if ( !this.playing ) return this.sound.stop();
    const {volume, fadeDuration} = this;

    // Immediate fade-in
    if ( fadeDuration ) {
      // noinspection ES6MissingAwait
      this.sound.fade(volume, {duration: fadeDuration});
    }

    // Schedule fade-out
    if ( !this.repeat && Number.isFinite(this.sound.duration) ) {
      const fadeOutTime = this.sound.duration - (fadeDuration / 1000);
      const fadeOut = () => this.sound.fade(0, {duration: fadeDuration});
      // noinspection ES6MissingAwait
      this.sound.schedule(fadeOut, fadeOutTime);
    }

    // Playlist-level orchestration actions
    return this.parent._onSoundStart(this);
  }

  /* -------------------------------------------- */

  /**
   * Special handling that occurs when a PlaylistSound reaches the natural conclusion of its playback.
   * @protected
   */
  async _onEnd() {
    if ( !this.parent.isOwner ) return;
    return this.parent._onSoundEnd(this);
  }

  /* -------------------------------------------- */

  /**
   * Special handling that occurs when a PlaylistSound is manually stopped before its natural conclusion.
   * @protected
   */
  async _onStop() {}

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * The effective volume at which this playlist sound is played, incorporating the global playlist volume setting.
   * @type {number}
   */
  get effectiveVolume() {
    foundry.utils.logCompatibilityWarning("PlaylistSound#effectiveVolume is deprecated in favor of using"
      + " PlaylistSound#volume directly", {since: 12, until: 14});
    return this.volume;
  }
}
