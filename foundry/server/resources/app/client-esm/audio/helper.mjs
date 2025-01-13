import AudioBufferCache from "./cache.mjs";
import Sound from "./sound.mjs";

/**
 * @typedef {import("./_types.mjs").SoundCreationOptions} SoundCreationOptions
 */

/**
 * A helper class to provide common functionality for working with the Web Audio API.
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
 * A singleton instance of this class is available as game#audio.
 * @see Game#audio
 * @alias game.audio
 */
export default class AudioHelper {
  constructor() {
    if ( game.audio instanceof this.constructor ) {
      throw new Error("You may not re-initialize the singleton AudioHelper. Use game.audio instead.");
    }
    this.unlock = this.awaitFirstGesture();
  }

  /**
   * The Native interval for the AudioHelper to analyse audio levels from streams
   * Any interval passed to startLevelReports() would need to be a multiple of this value.
   * @type {number}
   */
  static levelAnalyserNativeInterval = 50;

  /**
   * The cache size threshold after which audio buffers will be expired from the cache to make more room.
   * 1 gigabyte, by default.
   */
  static THRESHOLD_CACHE_SIZE_BYTES = Math.pow(1024, 3);

  /**
   * Audio Context singleton used for analysing audio levels of each stream
   * Only created if necessary to listen to audio streams.
   * @type {AudioContext}
   */
  static #analyzerContext;

  /**
   * The set of singleton Sound instances which are shared across multiple uses of the same sound path.
   * @type {Map<string,WeakRef<Sound>>}
   */
  sounds = new Map();

  /**
   * Get a map of the Sound objects which are currently playing.
   * @type {Map<number,Sound>}
   */
  playing = new Map();

  /**
   * A user gesture must be registered before audio can be played.
   * This Array contains the Sound instances which are requested for playback prior to a gesture.
   * Once a gesture is observed, we begin playing all elements of this Array.
   * @type {Function[]}
   * @see Sound
   */
  pending = [];

  /**
   * A Promise which resolves once the game audio API is unlocked and ready to use.
   * @type {Promise<void>}
   */
  unlock;

  /**
   * A flag for whether video playback is currently locked by awaiting a user gesture
   * @type {boolean}
   */
  locked = true;

  /**
   * A singleton audio context used for playback of music.
   * @type {AudioContext}
   */
  music;

  /**
   * A singleton audio context used for playback of environmental audio.
   * @type {AudioContext}
   */
  environment;

  /**
   * A singleton audio context used for playback of interface sounds and effects.
   * @type {AudioContext}
   */
  interface;

  /**
   * For backwards compatibility, AudioHelper#context refers to the context used for music playback.
   * @type {AudioContext}
   */
  get context() {
    return this.music;
  }

  /**
   * Interval ID as returned by setInterval for analysing the volume of streams
   * When set to 0, means no timer is set.
   * @type {number}
   */
  #analyserInterval;

  /**
   * A singleton cache used for audio buffers.
   * @type {AudioBufferCache}
   */
  buffers = new AudioBufferCache(AudioHelper.THRESHOLD_CACHE_SIZE_BYTES);

  /**
   * Map of all streams that we listen to for determining the decibel levels.
   * Used for analyzing audio levels of each stream.
   * @type {Record<string, {stream: MediaStream, analyser: AnalyserNode, interval: number, callback: Function}>}
   */
  #analyserStreams = {};

  /**
   * Fast Fourier Transform Array.
   * Used for analysing the decibel level of streams. The array is allocated only once
   * then filled by the analyser repeatedly. We only generate it when we need to listen to
   * a stream's level, so we initialize it to null.
   * @type {Float32Array}
   */
  #fftArray = null;

  /* -------------------------------------------- */

  /**
   * Create a Sound instance for a given audio source URL
   * @param {SoundCreationOptions} options        Sound creation options
   * @returns {Sound}
   */
  create({src, context, singleton=true, preload=false, autoplay=false, autoplayOptions={}}) {
    let sound;

    // Share singleton sounds across multiple use cases
    if ( singleton ) {
      const ref = this.sounds.get(src);
      sound = ref?.deref();
      if ( !sound ) {
        sound = new Sound(src, {context});
        this.sounds.set(src, new WeakRef(sound));
      }
    }

    // Create an independent sound instance
    else sound = new Sound(src, {context});

    // Preload or autoplay
    if ( preload && !sound.loaded ) sound.load({autoplay, autoplayOptions});
    else if ( autoplay ) sound.play(autoplayOptions);
    return sound;
  }

  /* -------------------------------------------- */

  /**
   * Test whether a source file has a supported audio extension type
   * @param {string} src      A requested audio source path
   * @returns {boolean}       Does the filename end with a valid audio extension?
   */
  static hasAudioExtension(src) {
    let rgx = new RegExp(`(\\.${Object.keys(CONST.AUDIO_FILE_EXTENSIONS).join("|\\.")})(\\?.*)?`, "i");
    return rgx.test(src);
  }

  /* -------------------------------------------- */

  /**
   * Given an input file path, determine a default name for the sound based on the filename
   * @param {string} src      An input file path
   * @returns {string}        A default sound name for the path
   */
  static getDefaultSoundName(src) {
    const parts = src.split("/").pop().split(".");
    parts.pop();
    let name = decodeURIComponent(parts.join("."));
    return name.replace(/[-_.]/g, " ").titleCase();
  }

  /* -------------------------------------------- */

  /**
   * Play a single Sound by providing its source.
   * @param {string} src            The file path to the audio source being played
   * @param {object} [options]      Additional options which configure playback
   * @param {AudioContext} [options.context]  A specific AudioContext within which to play
   * @returns {Promise<Sound>}      The created Sound which is now playing
   */
  async play(src, {context, ...options}={}) {
    const sound = new Sound(src, {context});
    await sound.load();
    sound.play(options);
    return sound;
  }

  /* -------------------------------------------- */

  /**
   * Register an event listener to await the first mousemove gesture and begin playback once observed.
   * @returns {Promise<void>}       The unlocked audio context
   */
  async awaitFirstGesture() {
    if ( !this.locked ) return;
    await new Promise(resolve => {
      for ( let eventName of ["contextmenu", "auxclick", "pointerdown", "pointerup", "keydown"] ) {
        document.addEventListener(eventName, event => this._onFirstGesture(event, resolve), {once: true});
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * Request that other connected clients begin preloading a certain sound path.
   * @param {string} src          The source file path requested for preload
   * @returns {Promise<Sound>}    A Promise which resolves once the preload is complete
   */
  preload(src) {
    if ( !src || !AudioHelper.hasAudioExtension(src) ) {
      throw new Error(`Invalid audio source path ${src} provided for preload request`);
    }
    game.socket.emit("preloadAudio", src);
    return this.constructor.preloadSound(src);
  }

  /* -------------------------------------------- */
  /*  Settings and Volume Controls                */
  /* -------------------------------------------- */

  /**
   * Register client-level settings for global volume controls.
   */
  static registerSettings() {

    // Playlist Volume
    game.settings.register("core", "globalPlaylistVolume", {
      name: "Global Playlist Volume",
      hint: "Define a global playlist volume modifier",
      scope: "client",
      config: false,
      type: new foundry.data.fields.AlphaField({required: true, initial: 0.5}),
      onChange: AudioHelper.#onChangeMusicVolume
    });

    // Ambient Volume
    game.settings.register("core", "globalAmbientVolume", {
      name: "Global Ambient Volume",
      hint: "Define a global ambient volume modifier",
      scope: "client",
      config: false,
      type: new foundry.data.fields.AlphaField({required: true, initial: 0.5}),
      onChange: AudioHelper.#onChangeEnvironmentVolume
    });

    // Interface Volume
    game.settings.register("core", "globalInterfaceVolume", {
      name: "Global Interface Volume",
      hint: "Define a global interface volume modifier",
      scope: "client",
      config: false,
      type: new foundry.data.fields.AlphaField({required: true, initial: 0.5}),
      onChange: AudioHelper.#onChangeInterfaceVolume
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle changes to the global music volume slider.
   * @param {number} volume
   */
  static #onChangeMusicVolume(volume) {
    volume = Math.clamp(volume, 0, 1);
    const ctx = game.audio.music;
    if ( !ctx ) return;
    ctx.gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    ui.playlists?.render();
    Hooks.callAll("globalPlaylistVolumeChanged", volume);
  }

  /* -------------------------------------------- */

  /**
   * Handle changes to the global environment volume slider.
   * @param {number} volume
   */
  static #onChangeEnvironmentVolume(volume) {
    volume = Math.clamp(volume, 0, 1);
    const ctx = game.audio.environment;
    if ( !ctx ) return;
    ctx.gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    if ( canvas.ready ) {
      for ( const mesh of canvas.primary.videoMeshes ) {
        mesh.sourceElement.volume = mesh.object instanceof Tile ? mesh.object.volume : volume;
      }
    }
    ui.playlists?.render();
    Hooks.callAll("globalAmbientVolumeChanged", volume);
  }

  /* -------------------------------------------- */

  /**
   * Handle changes to the global interface volume slider.
   * @param {number} volume
   */
  static #onChangeInterfaceVolume(volume) {
    volume = Math.clamp(volume, 0, 1);
    const ctx = game.audio.interface;
    if ( !ctx ) return;
    ctx.gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    ui.playlists?.render();
    Hooks.callAll("globalInterfaceVolumeChanged", volume);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers               */
  /* -------------------------------------------- */

  /**
   * Open socket listeners which transact ChatMessage data
   * @param socket
   */
  static _activateSocketListeners(socket) {
    socket.on("playAudio", audioData => this.play(audioData, false));
    socket.on("playAudioPosition", args => canvas.sounds.playAtPosition(...args));
    socket.on("preloadAudio", src => this.preloadSound(src));
  }

  /* -------------------------------------------- */

  /**
   * Play a one-off sound effect which is not part of a Playlist
   *
   * @param {Object} data           An object configuring the audio data to play
   * @param {string} data.src       The audio source file path, either a public URL or a local path relative to the public directory
   * @param {string} [data.channel] An audio channel in CONST.AUDIO_CHANNELS where the sound should play
   * @param {number} data.volume    The volume level at which to play the audio, between 0 and 1.
   * @param {boolean} data.autoplay Begin playback of the audio effect immediately once it is loaded.
   * @param {boolean} data.loop     Loop the audio effect and continue playing it until it is manually stopped.
   * @param {object|boolean} socketOptions  Options which only apply when emitting playback over websocket.
   *                                As a boolean, emits (true) or does not emit (false) playback to all other clients
   *                                As an object, can configure which recipients should receive the event.
   * @param {string[]} [socketOptions.recipients] An array of user IDs to push audio playback to. All users by default.
   *
   * @returns {Sound}               A Sound instance which controls audio playback.
   *
   * @example Play the sound of a locked door for all players
   * ```js
   * AudioHelper.play({src: "sounds/lock.wav", volume: 0.8, loop: false}, true);
   * ```
   */
  static play(data, socketOptions) {
    const audioData = foundry.utils.mergeObject({
      src: null,
      volume: 1.0,
      loop: false,
      channel: "interface"
    }, data, {insertKeys: true});

    // Push the sound to other clients
    const push = socketOptions && (socketOptions !== false);
    if ( push ) {
      socketOptions = foundry.utils.getType(socketOptions) === "Object" ? socketOptions : {};
      if ( "recipients" in socketOptions && !Array.isArray(socketOptions.recipients)) {
        throw new Error("Socket recipients must be an array of User IDs");
      }
      game.socket.emit("playAudio", audioData, socketOptions);
    }

    // Backwards compatibility, if autoplay was passed as false take no further action
    if ( audioData.autoplay === false ) return;

    // Play the sound locally
    return game.audio.play(audioData.src, {
      volume: audioData.volume ?? 1.0,
      loop: audioData.loop,
      context: game.audio[audioData.channel]
    });
  }

  /* -------------------------------------------- */

  /**
   * Begin loading the sound for a provided source URL adding its
   * @param {string} src            The audio source path to preload
   * @returns {Promise<Sound>}      The created and loaded Sound ready for playback
   */
  static async preloadSound(src) {
    const sound = game.audio.create({src: src, preload: false, singleton: true});
    await sound.load();
    return sound;
  }

  /* -------------------------------------------- */

  /**
   * Returns the volume value based on a range input volume control's position.
   * This is using an exponential approximation of the logarithmic nature of audio level perception
   * @param {number|string} value   Value between [0, 1] of the range input
   * @param {number} [order=1.5]    The exponent of the curve
   * @returns {number}
   */
  static inputToVolume(value, order=1.5) {
    if ( typeof value === "string" ) value = parseFloat(value);
    return Math.pow(value, order);
  }

  /* -------------------------------------------- */

  /**
   * Counterpart to inputToVolume()
   * Returns the input range value based on a volume
   * @param {number} volume         Value between [0, 1] of the volume level
   * @param {number} [order=1.5]    The exponent of the curve
   * @returns {number}
   */
  static volumeToInput(volume, order=1.5) {
    return Math.pow(volume, 1 / order);
  }

  /* -------------------------------------------- */
  /*  Audio Stream Analysis                       */
  /* -------------------------------------------- */

  /**
   * Returns a singleton AudioContext if one can be created.
   * An audio context may not be available due to limited resources or browser compatibility
   * in which case null will be returned
   *
   * @returns {AudioContext}  A singleton AudioContext or null if one is not available
   */
  getAnalyzerContext() {
    if ( !AudioHelper.#analyzerContext ) AudioHelper.#analyzerContext = new AudioContext();
    return AudioHelper.#analyzerContext;
  }

  /* -------------------------------------------- */

  /**
   * Registers a stream for periodic reports of audio levels.
   * Once added, the callback will be called with the maximum decibel level of
   * the audio tracks in that stream since the last time the event was fired.
   * The interval needs to be a multiple of AudioHelper.levelAnalyserNativeInterval which defaults at 50ms
   *
   * @param {string} id             An id to assign to this report. Can be used to stop reports
   * @param {MediaStream} stream    The MediaStream instance to report activity on.
   * @param {Function} callback     The callback function to call with the decibel level. `callback(dbLevel)`
   * @param {number} [interval]     The interval at which to produce reports.
   * @param {number} [smoothing]    The smoothingTimeConstant to set on the audio analyser.
   * @returns {boolean}             Returns whether listening to the stream was successful
   */
  startLevelReports(id, stream, callback, interval=50, smoothing=0.1) {
    if ( !stream || !id ) return false;
    let audioContext = this.getAnalyzerContext();
    if (audioContext === null) return false;

    // Clean up any existing report with the same ID
    this.stopLevelReports(id);

    // Make sure this stream has audio tracks, otherwise we can't connect the analyser to it
    if (stream.getAudioTracks().length === 0) return false;

    // Create the analyser
    let analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = smoothing;

    // Connect the analyser to the MediaStreamSource
    audioContext.createMediaStreamSource(stream).connect(analyser);
    this.#analyserStreams[id] = {stream, analyser, interval, callback, _lastEmit: 0};

    // Ensure the analyser timer is started as we have at least one valid stream to listen to
    this.#ensureAnalyserTimer();
    return true;
  }

  /* -------------------------------------------- */

  /**
   * Stop sending audio level reports
   * This stops listening to a stream and stops sending reports.
   * If we aren't listening to any more streams, cancel the global analyser timer.
   * @param {string} id      The id of the reports that passed to startLevelReports.
   */
  stopLevelReports(id) {
    delete this.#analyserStreams[id];
    if ( foundry.utils.isEmpty(this.#analyserStreams) ) this.#cancelAnalyserTimer();
  }

  /* -------------------------------------------- */

  /**
   * Ensures the global analyser timer is started
   *
   * We create only one timer that runs every 50ms and only create it if needed, this is meant to optimize things
   * and avoid having multiple timers running if we want to analyse multiple streams at the same time.
   * I don't know if it actually helps much with performance but it's expected that limiting the number of timers
   * running at the same time is good practice and with JS itself, there's a potential for a timer congestion
   * phenomenon if too many are created.
   */
  #ensureAnalyserTimer() {
    if ( !this.#analyserInterval ) {
      this.#analyserInterval = setInterval(this.#emitVolumes.bind(this), AudioHelper.levelAnalyserNativeInterval);
    }
  }

  /* -------------------------------------------- */

  /**
   * Cancel the global analyser timer
   * If the timer is running and has become unnecessary, stops it.
   */
  #cancelAnalyserTimer() {
    if ( this.#analyserInterval ) {
      clearInterval(this.#analyserInterval);
      this.#analyserInterval = undefined;
    }
  }

  /* -------------------------------------------- */

  /**
   * Capture audio level for all speakers and emit a webrtcVolumes custom event with all the volume levels
   * detected since the last emit.
   * The event's detail is in the form of {userId: decibelLevel}
   */
  #emitVolumes() {
    for ( const stream of Object.values(this.#analyserStreams) ) {
      if ( ++stream._lastEmit < (stream.interval / AudioHelper.levelAnalyserNativeInterval) ) continue;

      // Create the Fast Fourier Transform Array only once. Assume all analysers use the same fftSize
      if ( this.#fftArray === null ) this.#fftArray = new Float32Array(stream.analyser.frequencyBinCount);

      // Fill the array
      stream.analyser.getFloatFrequencyData(this.#fftArray);
      const maxDecibel = Math.max(...this.#fftArray);
      stream.callback(maxDecibel, this.#fftArray);
      stream._lastEmit = 0;
    }
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle the first observed user gesture
   * @param {Event} event         The mouse-move event which enables playback
   * @param {Function} resolve    The Promise resolution function
   * @private
   */
  _onFirstGesture(event, resolve) {
    if ( !this.locked ) return resolve();

    // Create audio contexts
    this.music = AudioHelper.#createContext("globalPlaylistVolume");
    this.environment = AudioHelper.#createContext("globalAmbientVolume");
    this.interface = AudioHelper.#createContext("globalInterfaceVolume");

    // Unlock and evaluate pending playbacks
    this.locked = false;
    if ( this.pending.length ) {
      console.log(`${vtt} | Activating pending audio playback with user gesture.`);
      this.pending.forEach(fn => fn());
      this.pending = [];
    }
    return resolve();
  }

  /* -------------------------------------------- */

  /**
   * Create an AudioContext with an attached GainNode for master volume control.
   * @returns {AudioContext}
   */
  static #createContext(volumeSetting) {
    const ctx = new AudioContext();
    ctx.gainNode = ctx.createGain();
    ctx.gainNode.connect(ctx.destination);
    const volume = game.settings.get("core", volumeSetting);
    ctx.gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    return ctx;
  }

  /* -------------------------------------------- */

  /**
   * Log a debugging message if the audio debugging flag is enabled.
   * @param {string} message      The message to log
   */
  debug(message) {
    if ( CONFIG.debug.audio ) console.debug(`${vtt} | ${message}`);
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  getCache(src) {
    foundry.utils.logCompatibilityWarning("AudioHelper#getCache is deprecated in favor of AudioHelper#buffers#get");
    return this.buffers.getBuffer(src, {since: 12, until: 14});
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  updateCache(src, playing=false) {
    foundry.utils.logCompatibilityWarning("AudioHelper#updateCache is deprecated without replacement");
  }

  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  setCache(src, buffer) {
    foundry.utils.logCompatibilityWarning("AudioHelper#setCache is deprecated in favor of AudioHelper#buffers#set");
    this.buffers.setBuffer(src, buffer);
  }
}
