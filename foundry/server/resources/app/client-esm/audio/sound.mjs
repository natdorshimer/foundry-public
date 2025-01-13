import AudioTimeout from "./timeout.mjs";
import EventEmitterMixin from "../../common/utils/event-emitter.mjs";

/**
 * @typedef {import("./_types.mjs").SoundPlaybackOptions} SoundPlaybackOptions
 * @typedef {import("./_types.mjs").SoundScheduleCallback} SoundScheduleCallback
 */

/**
 * A container around an AudioNode which manages sound playback in Foundry Virtual Tabletop.
 * Each Sound is either an AudioBufferSourceNode (for short sources) or a MediaElementAudioSourceNode (for long ones).
 * This class provides an interface around both types which allows standardized control over playback.
 * @alias foundry.audio.Sound
 * @see {EventEmitterMixin}
 */
export default class Sound extends EventEmitterMixin(Object) {
  /**
   * Construct a Sound by providing the source URL and other options.
   * @param {string} src                    The audio source path, either a relative path or a remote URL
   * @param {object} [options]              Additional options which configure the Sound
   * @param {AudioContext} [options.context]  A non-default audio context within which the sound should play
   * @param {boolean} [options.forceBuffer]   Force use of an AudioBufferSourceNode even if the audio duration is long
   */
  constructor(src, {context, forceBuffer=false}={}) {
    super();
    Object.defineProperties(this, {
      id: {value: Sound.#nodeId++, writable: false, enumerable: true, configurable: false},
      src: {value: src, writable: false, enumerable: true, configurable: false}
    });
    this.#context = context || game.audio.music;
    this.#forceBuffer = forceBuffer;
  }

  /**
   * The sequence of container loading states.
   * @enum {Readonly<number>}
   */
  static STATES = Object.freeze({
    FAILED: -1,
    NONE: 0,
    LOADING: 1,
    LOADED: 2,
    STARTING: 3,
    PLAYING: 4,
    PAUSED: 5,
    STOPPING: 6,
    STOPPED: 7
  });

  /**
   * The maximum duration, in seconds, for which an AudioBufferSourceNode will be used.
   * Otherwise, a MediaElementAudioSourceNode will be used.
   * @type {number}
   */
  static MAX_BUFFER_DURATION = 10 * 60;  // 10 Minutes

  /**
   * An incrementing counter used to assign each Sound a unique id.
   * @type {number}
   */
  static #nodeId = 0;

  /** @override */
  static emittedEvents = ["load", "play", "pause", "end", "stop"];

  /**
   * A unique integer identifier for this sound.
   * @type {number}
   */
  id;

  /**
   * The audio source path.
   * Either a relative path served by the running Foundry VTT game server or a remote URL.
   * @type {string}
   */
  src;

  /**
   * The audio context within which this Sound is played.
   * @type {AudioContext}
   */
  get context() {
    return this.#context;
  }
  #context;

  /**
   * When this Sound uses an AudioBuffer, this is an AudioBufferSourceNode.
   * @type {AudioBufferSourceNode}
   */
  #bufferNode;

  /**
   * When this Sound uses an HTML Audio stream, this is a MediaElementAudioSourceNode.
   * @type {MediaElementAudioSourceNode}
   */
  #mediaNode;

  /**
   * The AudioSourceNode used to control sound playback.
   * @type {AudioBufferSourceNode|MediaElementAudioSourceNode}
   */
  get sourceNode() {
    return this.#bufferNode || this.#mediaNode;
  }

  /**
   * The GainNode used to control volume for this sound.
   * @type {GainNode}
   */
  gainNode;

  /**
   * An AudioBuffer instance, if this Sound uses an AudioBufferSourceNode for playback.
   * @type {AudioBuffer|null}
   */
  buffer = null;

  /**
   * An HTMLAudioElement, if this Sound uses a MediaElementAudioSourceNode for playback.
   * @type {HTMLAudioElement|null}
   */
  element = null;

  /**
   * Playback configuration options specified at the time that Sound#play is called.
   * @type {SoundPlaybackOptions}
   */
  #playback = {
    delay: 0,
    duration: undefined,
    fade: 0,
    loop: false,
    loopStart: 0,
    loopEnd: undefined,
    offset: 0,
    onended: null,
    volume: 1.0
  };

  /**
   * Force usage of an AudioBufferSourceNode regardless of audio duration?
   * @type {boolean}
   */
  #forceBuffer = false;

  /**
   * The life-cycle state of the sound.
   * @see {Sound.STATES}
   * @type {number}
   * @protected
   */
  _state = Sound.STATES.NONE;

  /**
   * Has the audio file been loaded either fully or for streaming.
   * @type {boolean}
   */
  get loaded() {
    if ( this._state < Sound.STATES.LOADED ) return false;
    return !!(this.buffer || this.element);
  }

  /**
   * Did the audio file fail to load.
   * @type {boolean}
   */
  get failed() {
    return this._state === Sound.STATES.FAILED;
  }

  /**
   * Is this sound currently playing?
   * @type {boolean}
   */
  get playing() {
    return (this._state === Sound.STATES.STARTING) || (this._state === Sound.STATES.PLAYING);
  }

  /**
   * Does this Sound use an AudioBufferSourceNode?
   * Otherwise, the Sound uses a streamed MediaElementAudioSourceNode.
   * @type {boolean}
   */
  get isBuffer() {
    return !!this.buffer && (this.sourceNode instanceof AudioBufferSourceNode);
  }

  /**
   * A convenience reference to the GainNode gain audio parameter.
   * @type {AudioParam}
   */
  get gain() {
    return this.gainNode?.gain;
  }

  /**
   * The AudioNode destination which is the output target for the Sound.
   * @type {AudioNode}
   */
  destination;

  /**
   * Record the pipeline of nodes currently used by this Sound.
   * @type {AudioNode[]}
   */
  #pipeline = [];

  /**
   * A pipeline of AudioNode instances to be applied to Sound playback.
   * @type {AudioNode[]}
   */
  effects = [];

  /**
   * The currently playing volume of the sound.
   * Undefined until playback has started for the first time.
   * @type {number}
   */
  get volume() {
    return this.gain?.value;
  }

  set volume(value) {
    if ( !this.gainNode || !Number.isFinite(value) ) return;
    const ct = this.#context.currentTime;
    this.gain.cancelScheduledValues(ct);
    this.gain.value = value;
    this.gain.setValueAtTime(value, ct); // Immediately schedule the new value
  }

  /**
   * The time in seconds at which playback was started.
   * @type {number}
   */
  startTime;

  /**
   * The time in seconds at which playback was paused.
   * @type {number}
   */
  pausedTime;

  /**
   * The total duration of the audio source in seconds.
   * @type {number}
   */
  get duration() {
    if ( this._state < Sound.STATES.LOADED ) return undefined;
    if ( this.buffer ) {
      const {loop, loopStart, loopEnd} = this.#playback;
      if ( loop && Number.isFinite(loopStart) && Number.isFinite(loopEnd) ) return loopEnd - loopStart;
      return this.buffer.duration;
    }
    return this.element?.duration;
  }

  /**
   * The current playback time of the sound.
   * @type {number}
   */
  get currentTime() {
    if ( !this.playing ) return undefined;
    if ( this.pausedTime ) return this.pausedTime;
    let time = this.#context.currentTime - this.startTime;
    if ( Number.isFinite(this.duration) ) time %= this.duration;
    return time;
  }

  /**
   * Is the sound looping?
   * @type {boolean}
   */
  get loop() {
    return this.#playback.loop;
  }

  set loop(value) {
    const loop = this.#playback.loop = Boolean(value);
    if ( this.#bufferNode ) this.#bufferNode.loop = loop;
    else if ( this.element ) this.element.loop = loop;
  }

  /**
   * A set of scheduled events orchestrated using the Sound#schedule function.
   * @type {Set<AudioTimeout>}
   */
  #scheduledEvents = new Set();

  /**
   * An operation in progress on the sound which must be queued.
   * @type {Promise}
   */
  #operation;

  /**
   * A delay timeout before the sound starts or stops.
   * @type {AudioTimeout}
   */
  #delay;

  /**
   * An internal reference to some object which is managing this Sound instance.
   * @type {Object|null}
   * @internal
   */
  _manager = null;

  /* -------------------------------------------- */
  /*  Life-Cycle Methods                          */
  /* -------------------------------------------- */

  /**
   * Load the audio source and prepare it for playback, either using an AudioBuffer or a streamed HTMLAudioElement.
   * @param {object} [options={}]   Additional options which affect resource loading
   * @param {boolean} [options.autoplay=false]  Automatically begin playback of the sound once loaded
   * @param {SoundPlaybackOptions} [options.autoplayOptions]  Playback options passed to Sound#play, if autoplay
   * @returns {Promise<Sound>}      A Promise which resolves to the Sound once it is loaded
   */
  async load({autoplay=false, autoplayOptions={}}={}) {
    const {STATES} = Sound;

    // Await audio unlock
    if ( game.audio.locked ) {
      game.audio.debug(`Delaying load of sound "${this.src}" until after first user gesture`);
      await game.audio.unlock;
    }

    // Wait for another ongoing operation
    if ( this.#operation ) {
      await this.#operation;
      return this.load({autoplay, autoplayOptions});
    }

    // Queue loading
    if ( !this.loaded ) {
      this._state = STATES.LOADING;
      this.#context ||= game.audio.music;
      try {
        this.#operation = this._load();
        await this.#operation;
        this._state = STATES.LOADED;
        this.dispatchEvent(new Event("load"));
      } catch(err) {
        console.error(err);
        this._state = STATES.FAILED;
      }
      finally {
        this.#operation = undefined;
      }
    }

    // Autoplay after load
    if ( autoplay && !this.failed && !this.playing ) {
      // noinspection ES6MissingAwait
      this.play(autoplayOptions);
    }
    return this;
  }

  /* -------------------------------------------- */

  /**
   * An inner method which handles loading so that it can be de-duplicated under a single shared Promise resolution.
   * This method is factored out to allow for subclasses to override loading behavior.
   * @returns {Promise<void>}                       A Promise which resolves once the sound is loaded
   * @throws {Error}                                An error if loading failed for any reason
   * @protected
   */
  async _load() {

    // Attempt to load a cached AudioBuffer
    this.buffer = game.audio.buffers.getBuffer(this.src) || null;
    this.element = null;

    // Otherwise, load the audio as an HTML5 audio element to learn its playback duration
    if ( !this.buffer ) {
      const element = await this.#createAudioElement();
      const isShort = (element?.duration || Infinity) <= Sound.MAX_BUFFER_DURATION;

      // For short sounds create and cache the audio buffer and use an AudioBufferSourceNode
      if ( isShort || this.#forceBuffer ) {
        this.buffer = await this.#createAudioBuffer();
        game.audio.buffers.setBuffer(this.src, this.buffer);
        Sound.#unloadAudioElement(element);
      }
      else this.element = element;
    }
  }

  /* -------------------------------------------- */

  /**
   * Begin playback for the Sound.
   * This method is asynchronous because playback may not start until after an initially provided delay.
   * The Promise resolves *before* the fade-in of any configured volume transition.
   * @param {SoundPlaybackOptions} [options]  Options which configure the beginning of sound playback
   * @returns {Promise<Sound>}                A Promise which resolves once playback has started (excluding fade)
   */
  async play(options={}) {

    // Signal our intention to start immediately
    const {STATES} = Sound;
    if ( ![STATES.LOADED, STATES.PAUSED, STATES.STOPPED].includes(this._state) ) return this;
    this._state = STATES.STARTING;

    // Wait for another ongoing operation
    if ( this.#operation ) {
      await this.#operation;
      return this.play(options);
    }

    // Configure options
    if ( typeof options === "number" ) {
      options = {offset: options};
      if ( arguments[1] instanceof Function ) options.onended = arguments[1];
      foundry.utils.logCompatibilityWarning("Sound#play now takes an object of playback options instead of "
        + "positional arguments.", {since: 12, until: 14});
    }

    // Queue playback
    try {
      this.#operation = this.#queuePlay(options);
      await this.#operation;
      this._state = STATES.PLAYING;
    } finally {
      this.#operation = undefined;
    }
    return this;
  }

  /* -------------------------------------------- */

  /**
   * An inner method that is wrapped in an enqueued promise. See {@link Sound#play}.
   */
  async #queuePlay(options={}) {

    // Configure playback
    this.#configurePlayback(options);
    const {delay, fade, offset, volume} = this.#playback;

    // Create the audio pipeline including gainNode and sourceNode used for playback
    this._createNodes();
    this._connectPipeline();

    // Delay playback start
    if ( delay ) {
      await this.wait(delay * 1000);
      if ( this._state !== Sound.STATES.STARTING ) return; // We may no longer be starting if the delay was cancelled
    }

    // Begin playback
    this._play();

    // Record state change
    this.startTime = this.#context.currentTime - offset;
    this.pausedTime = undefined;

    // Set initial volume
    this.volume = fade ? 0 : volume;
    if ( fade ) this.fade(volume, {duration: fade});
    this.#onStart();
  }

  /* -------------------------------------------- */

  /**
   * Begin playback for the configured pipeline and playback options.
   * This method is factored out so that subclass implementations of Sound can implement alternative behavior.
   * @protected
   */
  _play() {
    const {loop, loopStart, loopEnd, offset, duration} = this.#playback;
    if ( this.buffer ) {
      this.#bufferNode.loop = loop;
      if ( loop && Number.isFinite(loopStart) && Number.isFinite(loopEnd) ) {
        this.#bufferNode.loopStart = loopStart;
        this.#bufferNode.loopEnd = loopEnd;
      }
      this.#bufferNode.onended = this.#onEnd.bind(this);
      this.#bufferNode.start(0, offset, duration);
    }
    else if ( this.element ) {
      this.element.loop = loop;
      this.element.currentTime = offset;
      this.element.onended = this.#onEnd.bind(this);
      this.element.play();
    }
    game.audio.debug(`Beginning playback of Sound "${this.src}"`);
  }

  /* -------------------------------------------- */

  /**
   * Pause playback of the Sound.
   * For AudioBufferSourceNode this stops playback after recording the current time.
   * Calling Sound#play will resume playback from the pausedTime unless some other offset is passed.
   * For a MediaElementAudioSourceNode this simply calls the HTMLAudioElement#pause method directly.
   */
  pause() {
    const {STATES} = Sound;
    if ( this._state !== STATES.PLAYING ) {
      throw new Error("You may only call Sound#pause for a Sound which is PLAYING");
    }
    this._pause();
    this.pausedTime = this.currentTime;
    this._state = STATES.PAUSED;
    this.#onPause();
  }

  /* -------------------------------------------- */

  /**
   * Pause playback of the Sound.
   * This method is factored out so that subclass implementations of Sound can implement alternative behavior.
   * @protected
   */
  _pause() {
    if ( this.isBuffer ) {
      this.#bufferNode.onended = undefined;
      this.#bufferNode.stop(0);
    }
    else this.element.pause();
    game.audio.debug(`Pausing playback of Sound "${this.src}"`);
  }

  /* -------------------------------------------- */

  /**
   * Stop playback for the Sound.
   * This method is asynchronous because playback may not stop until after an initially provided delay.
   * The Promise resolves *after* the fade-out of any configured volume transition.
   * @param {SoundPlaybackOptions} [options]  Options which configure the stopping of sound playback
   * @returns {Promise<Sound>}                A Promise which resolves once playback is fully stopped (including fade)
   */
  async stop(options={}) {

    // Signal our intention to stop immediately
    if ( !this.playing ) return this;
    this._state = Sound.STATES.STOPPING;
    this.#delay?.cancel();

    // Wait for another operation to conclude
    if ( this.#operation ) {
      await this.#operation;
      return this.stop(options);
    }

    // Queue stop
    try {
      this.#operation = this.#queueStop(options);
      await this.#operation;
      this._state = Sound.STATES.STOPPED;
    } finally {
      this.#operation = undefined;
    }
    return this;
  }

  /* -------------------------------------------- */

  /**
   * An inner method that is wrapped in an enqueued promise. See {@link Sound#stop}.
   */
  async #queueStop(options) {

    // Immediately disconnect the onended callback
    if ( this.#bufferNode ) this.#bufferNode.onended = undefined;
    if ( this.#mediaNode ) this.element.onended = undefined;

    // Configure playback settings
    this.#configurePlayback(options);
    const {delay, fade, volume} = this.#playback;

    // Fade out
    if ( fade ) await this.fade(volume, {duration: fade});
    else this.volume = volume;

    // Stop playback
    if ( delay ) {
      await this.wait(delay * 1000);
      if ( this._state !== Sound.STATES.STOPPING ) return; // We may no longer be stopping if the delay was cancelled
    }
    this._stop();

    // Disconnect the audio pipeline
    this._disconnectPipeline();

    // Record state changes
    this.#bufferNode = this.#mediaNode = undefined;
    this.startTime = this.pausedTime = undefined;
    this.#onStop();
  }

  /* -------------------------------------------- */

  /**
   * Stop playback of the Sound.
   * This method is factored out so that subclass implementations of Sound can implement alternative behavior.
   * @protected
   */
  _stop() {
    this.gain.cancelScheduledValues(this.context.currentTime);
    if ( this.buffer && this.sourceNode && (this._state === Sound.STATES.PLAYING) ) this.#bufferNode.stop(0);
    else if ( this.element ) {
      Sound.#unloadAudioElement(this.element);
      this.element = null;
    }
    game.audio.debug(`Stopping playback of Sound "${this.src}"`);
  }

  /* -------------------------------------------- */

  /**
   * Fade the volume for this sound between its current level and a desired target volume.
   * @param {number} volume                     The desired target volume level between 0 and 1
   * @param {object} [options={}]               Additional options that configure the fade operation
   * @param {number} [options.duration=1000]      The duration of the fade effect in milliseconds
   * @param {number} [options.from]               A volume level to start from, the current volume by default
   * @param {string} [options.type=linear]        The type of fade easing, "linear" or "exponential"
   * @returns {Promise<void>}                   A Promise that resolves after the requested fade duration
   */
  async fade(volume, {duration=1000, from, type="linear"}={}) {
    if ( !this.gain ) return;
    const ramp = this.gain[`${type}RampToValueAtTime`];
    if ( !ramp ) throw new Error(`Invalid fade type ${type} requested`);

    // Cancel any other ongoing transitions
    const startTime = this.#context.currentTime;
    this.gain.cancelScheduledValues(startTime);

    // Immediately schedule the starting volume
    from ??= this.gain.value;
    this.gain.setValueAtTime(from, startTime);

    // Ramp to target volume
    ramp.call(this.gain, volume, startTime + (duration / 1000));

    // Wait for the transition
    if ( volume !== from ) await this.wait(duration);
  }

  /* -------------------------------------------- */

  /**
   * Wait a certain scheduled duration within this sound's own AudioContext.
   * @param {number} duration                   The duration to wait in milliseconds
   * @returns {Promise<void>}                   A promise which resolves after the waited duration
   */
  async wait(duration) {
    this.#delay = new AudioTimeout(duration, {context: this.#context});
    await this.#delay.complete;
    this.#delay = undefined;
  }

  /* -------------------------------------------- */

  /**
   * Schedule a function to occur at the next occurrence of a specific playbackTime for this Sound.
   * @param {SoundScheduleCallback} fn  A function that will be called with this Sound as its single argument
   * @param {number} playbackTime       The desired playback time at which the function should be called
   * @returns {Promise<any>}            A Promise which resolves to the returned value of the provided function once
   *                                    it has been evaluated.
   *
   * @example Schedule audio playback changes
   * ```js
   * sound.schedule(() => console.log("Do something exactly 30 seconds into the track"), 30);
   * sound.schedule(() => console.log("Do something next time the track loops back to the beginning"), 0);
   * sound.schedule(() => console.log("Do something 5 seconds before the end of the track"), sound.duration - 5);
   * ```
   */
  async schedule(fn, playbackTime) {

    // Determine the amount of time until the next occurrence of playbackTime
    const {currentTime, duration} = this;
    playbackTime = Math.clamp(playbackTime, 0, duration);
    if ( this.#playback.loop && Number.isFinite(duration) ) {
      while ( playbackTime < currentTime ) playbackTime += duration;
    }
    const deltaMS = Math.max(0, (playbackTime - currentTime) * 1000);

    // Wait for an AudioTimeout completion then invoke the scheduled function
    const timeout = new AudioTimeout(deltaMS, {context: this.#context});
    this.#scheduledEvents.add(timeout);
    try {
      await timeout.complete;
      return fn(this);
    }
    catch {}
    finally {
      this.#scheduledEvents.delete(timeout);
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the array of effects applied to a Sound instance.
   * Optionally a new array of effects can be assigned. If no effects are passed, the current effects are re-applied.
   * @param {AudioNode[]} [effects]     An array of AudioNode effects to apply
   */
  applyEffects(effects) {
    if ( Array.isArray(effects) ) this.effects = effects;
    this._disconnectPipeline();
    this._connectPipeline();
    game.audio.debug(`Applied effects to Sound "${this.src}": ${this.effects.map(e => e.constructor.name)}`);
  }

  /* -------------------------------------------- */
  /*  Playback Events                             */
  /* -------------------------------------------- */

  /**
   * Additional workflows when playback of the Sound begins.
   */
  #onStart() {
    game.audio.playing.set(this.id, this); // Track playing sounds
    this.dispatchEvent(new Event("play"));
  }

  /* -------------------------------------------- */

  /**
   * Additional workflows when playback of the Sound is paused.
   */
  #onPause() {
    this.#cancelScheduledEvents();
    this.dispatchEvent(new Event("pause"));
  }

  /* -------------------------------------------- */

  /**
   * Additional workflows when playback of the Sound concludes.
   * This is called by the AudioNode#onended callback.
   */
  async #onEnd() {
    await this.stop();
    this.#playback.onended?.(this);
    this.dispatchEvent(new Event("end"));
  }

  /* -------------------------------------------- */

  /**
   * Additional workflows when playback of the Sound is stopped, either manually or by concluding its playback.
   */
  #onStop() {
    game.audio.playing.delete(this.id);
    this.#cancelScheduledEvents();
    this.dispatchEvent(new Event("stop"));
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Create an HTML5 Audio element which has loaded the metadata for the provided source.
   * @returns {Promise<HTMLAudioElement>}     A created HTML Audio element
   * @throws {Error}                          An error if audio element creation failed
   */
  async #createAudioElement() {
    game.audio.debug(`Loading audio element "${this.src}"`);
    return new Promise((resolve, reject) => {
      const element = new Audio();
      element.autoplay = false;
      element.crossOrigin = "anonymous";
      element.preload = "metadata";
      element.onloadedmetadata = () => resolve(element);
      element.onerror = () => reject(`Failed to load audio element "${this.src}"`);
      element.src = this.src;
    });
  }

  /* -------------------------------------------- */

  /**
   * Ensure to safely unload a media stream
   * @param {HTMLAudioElement} element      The audio element to unload
   */
  static #unloadAudioElement(element) {
    element.onended = undefined;
    element.pause();
    element.src = "";
    element.remove();
  }

  /* -------------------------------------------- */

  /**
   * Load an audio file and decode it to create an AudioBuffer.
   * @returns {Promise<AudioBuffer>}        A created AudioBuffer
   * @throws {Error}                        An error if buffer creation failed
   */
  async #createAudioBuffer() {
    game.audio.debug(`Loading audio buffer "${this.src}"`);
    try {
      const response = await foundry.utils.fetchWithTimeout(this.src);
      const arrayBuffer = await response.arrayBuffer();
      return this.#context.decodeAudioData(arrayBuffer);
    } catch(err) {
      err.message = `Failed to load audio buffer "${this.src}"`;
      throw err;
    }
  }

  /* -------------------------------------------- */

  /**
   * Create any AudioNode instances required for playback of this Sound.
   * @protected
   */
  _createNodes() {
    this.gainNode ||= this.#context.createGain();
    this.destination ||= (this.#context.gainNode ?? this.#context.destination); // Prefer a context gain if present
    const {buffer, element: mediaElement} = this;
    if ( buffer ) this.#bufferNode = new AudioBufferSourceNode(this.#context, {buffer});
    else if ( mediaElement ) this.#mediaNode = new MediaElementAudioSourceNode(this.#context, {mediaElement});
  }

  /* -------------------------------------------- */

  /**
   * Create the audio pipeline used to play this Sound.
   * The GainNode is reused each time to link volume changes across multiple playbacks.
   * The AudioSourceNode is re-created every time that Sound#play is called.
   * @protected
   */
  _connectPipeline() {
    if ( !this.sourceNode ) return;
    this.#pipeline.length = 0;

    // Start with the sourceNode
    let node = this.sourceNode;
    this.#pipeline.push(node);

    // Connect effect nodes
    for ( const effect of this.effects ) {
      node.connect(effect);
      effect.onConnectFrom?.(node);  // Special behavior to inform the effect node it has been connected
      node = effect;
      this.#pipeline.push(effect);
    }

    // End with the gainNode
    node.connect(this.gainNode);
    this.#pipeline.push(this.gainNode);
    this.gainNode.connect(this.destination);
  }

  /* -------------------------------------------- */

  /**
   * Disconnect the audio pipeline once playback is stopped.
   * Walk backwards along the Sound##pipeline from the Sound#destination, disconnecting each node.
   * @protected
   */
  _disconnectPipeline() {
    for ( let i=this.#pipeline.length-1; i>=0; i-- ) {
      const node = this.#pipeline[i];
      node.disconnect();
    }
  }

  /* -------------------------------------------- */

  /**
   * Configure playback parameters for the Sound.
   * @param {SoundPlaybackOptions}    Provided playback options
   */
  #configurePlayback({delay, duration, fade, loop, loopStart, loopEnd, offset, onended, volume}={}) {

    // Some playback options only update if they are explicitly passed
    this.#playback.loop = loop ?? this.#playback.loop;
    this.#playback.loopStart = loopStart ?? this.#playback.loopStart;
    this.#playback.loopEnd = loopEnd ?? this.#playback.loopEnd;
    this.#playback.volume = volume ?? this.#playback.volume;
    this.#playback.onended = onended !== undefined ? onended : this.#playback.onended;

    // Determine playback offset and duration timing
    const loopTime = (this.#playback.loopEnd ?? Infinity) - this.#playback.loopStart;

    // Starting offset
    offset ??= this.#playback.loopStart;
    if ( Number.isFinite(this.pausedTime) ) offset += this.pausedTime;

    // Loop forever
    if ( this.#playback.loop ) duration ??= undefined;

    // Play once
    else if ( Number.isFinite(loopTime) ) {
      offset = Math.clamp(offset, this.#playback.loopStart, this.#playback.loopEnd);
      duration ??= loopTime;
      duration = Math.min(duration, loopTime);
    }

    // Some playback options reset unless they are explicitly passed
    this.#playback.delay = delay ?? 0;
    this.#playback.offset = offset;
    this.#playback.duration = duration;
    this.#playback.fade = fade ?? 0;
  }

  /* -------------------------------------------- */

  /**
   * Cancel any scheduled events which have not yet occurred.
   */
  #cancelScheduledEvents() {
    for ( const timeout of this.#scheduledEvents ) timeout.cancel();
    this.#scheduledEvents.clear();
  }

  /* -------------------------------------------- */
  /*  Deprecations and Compatibility              */
  /* -------------------------------------------- */

  /**
   * @deprecated since v12
   * @ignore
   */
  static get LOAD_STATES() {
    foundry.utils.logCompatibilityWarning("AudioContainer.LOAD_STATES is deprecated in favor of Sound.STATES",
      {since: 12, until: 14});
    return this.STATES;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  get loadState() {
    foundry.utils.logCompatibilityWarning("AudioContainer#loadState is deprecated in favor of Sound#_state",
      {since: 12, until: 14});
    return this._state;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  get container() {
    foundry.utils.logCompatibilityWarning("Sound#container is deprecated without replacement because the Sound and "
      + "AudioContainer classes are now merged", {since: 12, until: 14});
    return this;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  get node() {
    foundry.utils.logCompatibilityWarning("Sound#node is renamed Sound#sourceNode", {since: 12, until: 14});
    return this.sourceNode;
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  on(eventName, fn, {once=false}={}) {
    foundry.utils.logCompatibilityWarning("Sound#on is deprecated in favor of Sound#addEventListener",
      {since: 12, until: 14});
    return this.addEventListener(eventName, fn, {once});
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  off(eventName, fn) {
    foundry.utils.logCompatibilityWarning("Sound#off is deprecated in favor of Sound#removeEventListener",
      {since: 12, until: 14});
    return this.removeEventListener(eventName, fn);
  }

  /**
   * @deprecated since v12
   * @ignore
   */
  emit(eventName) {
    foundry.utils.logCompatibilityWarning("Sound#emit is deprecated in favor of Sound#dispatchEvent",
      {since: 12, until: 14});
    const event = new Event(eventName, {cancelable: true});
    return this.dispatchEvent(event);
  }
}
