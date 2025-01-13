/**
 * @typedef {Object} AudioBufferCacheEntry
 * @property {string} src
 * @property {AudioBuffer} buffer
 * @property {number} size
 * @property {boolean} [locked]
 * @property {AudioBufferCacheEntry} [next]
 * @property {AudioBufferCacheEntry} [previous]
 */

/**
 * @typedef {Object} SoundCreationOptions
 * @property {string} src                    The source URL for the audio file
 * @property {AudioContext} [context]        A specific AudioContext to attach the sound to
 * @property {boolean} [singleton=true]      Reuse an existing Sound for this source?
 * @property {boolean} [preload=false]       Begin loading the audio immediately?
 * @property {boolean} [autoplay=false]      Begin playing the audio as soon as it is ready?
 * @property {SoundPlaybackOptions} [autoplayOptions={}]  Options passed to the play method if autoplay is true
 */

/**
 * @typedef {Object} SoundPlaybackOptions
 * @property {number} [delay=0]               A delay in seconds by which to delay playback
 * @property {number} [duration]              A limited duration in seconds for which to play
 * @property {number} [fade=0]                A duration in milliseconds over which to fade in playback
 * @property {boolean} [loop=false]           Should sound playback loop?
 * @property {number} [loopStart=0]           Seconds of the AudioBuffer when looped playback should start.
 *                                            Only works for AudioBufferSourceNode.
 * @property {number} [loopEnd]               Seconds of the Audio buffer when looped playback should restart.
 *                                            Only works for AudioBufferSourceNode.
 * @property {number} [offset=0]              An offset in seconds at which to start playback
 * @property {Function|null} [onended]        A callback function attached to the source node
 * @property {number} [volume=1.0]            The volume at which to play the sound
 */

/**
 * @callback SoundScheduleCallback
 * @param {Sound} sound                       The Sound instance being scheduled
 * @returns {any}                             A return value of the callback is returned as the resolved value of the
 *                                            Sound#schedule promise
 */
