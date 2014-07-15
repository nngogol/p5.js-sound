define(function (require) {
  'use strict';

  var p5sound = require('master');

  /**
   * Similar to p5.dom createCapture() but for audio, without
   * creating a DOM element.
   *
   * @class AudioIn
   * @constructor
   * @return {Object} capture
   * @example
   * <div><code>
   * mic = new AudioIn()
   * mic.on();
   * </code></div>
   */
  p5.prototype.AudioIn = function() {
    // set up audio input
    this.p5s = p5sound;
    this.input = this.p5s.audiocontext.createGain();
    this.output = this.p5s.audiocontext.createGain();

    this.stream = null;
    this.mediaStream = null;

    this.currentSource = 0;

    // create an amplitude, connect to it by default but not to master out
    this.amplitude = new Amplitude();
    this.output.connect(this.amplitude.input);

    // Some browsers let developer determine their input sources
    if (typeof window.MediaStreamTrack === 'undefined'){
      window.alert('This browser does not support MediaStreamTrack');
    } else if (typeof window.MediaStreamTrack.getSources !== 'undefined') {
      // Chrome supports getSources to list inputs. Dev picks default
      window.MediaStreamTrack.getSources(this._gotSources);
    } else {
      // Firefox lhas no getSources() but lets user choose their input
    }

    // add to soundArray so we can dispose on close
    this.p5s.soundArray.push(this);
  };

  // connect to unit if given, otherwise connect to p5sound (master)
  p5.prototype.AudioIn.prototype.connect = function(unit) {
    if (unit) {
      if (unit.hasOwnProperty('input')) {
        this.output.connect(unit.input);
      }
      else {
        this.output.connect(unit);
      }
    }
    else {
      this.output.connect(this.p5s.input);
    }
  };

  /**
   *  Returns a list of available input sources.
   *
   *  @method  listSources
   *  @return {Array}
   */
  p5.prototype.AudioIn.prototype.listSources = function() {
    console.log('input sources: ');
    console.log(p5sound.inputSources);
    if (p5sound.inputSources.length > 0) {
      return p5sound.inputSources;
    } else {
      return 'This browser does not support MediaStreamTrack.getSources()';
    }
  };

  /**
   *  Set the input source. Accepts a number representing a
   *  position in the array returned by listSources().
   *  This is only supported in browsers that support 
   *  MediaStreamTrack.getSources(). Instead, some browsers
   *  give users the option to set their own media source.
   *  
   *  @method setSource
   *  @param {number} num position of input source in the array
   */
  p5.prototype.AudioIn.prototype.setSource = function(num) {
    // TO DO - set input by string or # (array position)
    var self = this;
    if ((p5sound.inputSources.length > 0) && (num < p5sound.inputSources.length)) {
      // set the current source
      self.currentSource = num;
      console.log('set source to ' + p5sound.inputSources[self.currentSource].id);
    } else {
      console.log('unable to set input source');
    }
  };

  p5.prototype.AudioIn.prototype.disconnect = function(unit) {
      this.output.disconnect(unit);
      // stay connected to amplitude even if not outputting to p5
      this.output.connect(this.amplitude.input);
  };

  /**
   *  <p>Read the Amplitude (volume level) of an AudioIn. The AudioIn
   *  class contains its own instance of the Amplitude class to help
   *  make it easy to get a microphone's volume level.</p>
   *
   *  <p>Accepts an optional smoothing value (0.0 < 1.0).</p>
   *
   *  <p>AudioIn must be .on() before using .getLevel().</p>
   *  
   *  @method  getLevel
   *  @param  {[Number]} smoothing Smoothing is 0.0 by default.
   *                               Smooths values based on previous values.
   *  @return {Number}           Volume level (between 0.0 and 1.0)
   */
  p5.prototype.AudioIn.prototype.getLevel = function(smoothing) {
    if (smoothing) {
      this.amplitude.smoothing = smoothing;
    }
    return this.amplitude.getLevel();
  };

  /**
   *  Turn the AudioIn on. This enables the use of other AudioIn
   *  methods like getLevel().
   *
   *  @method on
   */
  p5.prototype.AudioIn.prototype.on = function() {
    var self = this;

    // if _gotSources() i.e. developers determine which source to use
    if (p5sound.inputSources[self.currentSource]) {
      // set the audio source
      var audioSource = p5sound.inputSources[self.currentSource].id;
      var constraints = {
          audio: {
            optional: [{sourceId: audioSource}]
          }};
      navigator.getUserMedia( constraints,
        this._onStream = function(stream) {
        self.stream = stream;
        // Wrap a MediaStreamSourceNode around the live input
        self.mediaStream = self.p5s.audiocontext.createMediaStreamSource(stream);
        self.mediaStream.connect(self.output);

        // only send to the Amplitude reader, so we can see it but not hear it.
        self.amplitude.setInput(self.output);
      }, this._onStreamError = function(stream) {
        console.error(e);
      });
    } else {
    // if Firefox where users select their source via browser
    // if (typeof MediaStreamTrack.getSources === 'undefined') {
      // Only get the audio stream.
      window.navigator.getUserMedia( {'audio':true},
        this._onStream = function(stream) {
        self.stream = stream;
        // Wrap a MediaStreamSourceNode around the live input
        self.mediaStream = self.p5s.audiocontext.createMediaStreamSource(stream);
        self.mediaStream.connect(self.output);
        // only send to the Amplitude reader, so we can see it but not hear it.
        self.amplitude.setInput(self.output);
      }, this._onStreamError = function(stream) {
        console.error(e);
      });
    }
  };

  /**
   *  Turn the AudioIn off. If the AudioIn is off, it cannot getLevel().
   *
   *  @method off
   */
  p5.prototype.AudioIn.prototype.off = function() {
    if (this.stream) {
      this.stream.stop();
    }
  };

  /**
   *  Add input sources to the list of available sources.
   *  
   *  @private
   */
  p5.prototype.AudioIn.prototype._gotSources = function(sourceInfos) {
    for (var i = 0; i!== sourceInfos.length; i++) {
      var sourceInfo = sourceInfos[i];
      if (sourceInfo.kind === 'audio') {
        // add the inputs to inputSources
        p5sound.inputSources.push(sourceInfo);
      }
    }
  };

  /**
   *  Set amplitude (volume) of a mic input between 0 and 1.0
   *
   *  @method  amp
   *  @param  {Number} vol between 0 and 1.0
   *  @param {Number} [time] ramp time (optional)
   */
  p5.prototype.AudioIn.prototype.amp = function(vol, t){
    if (t) {
      var rampTime = t || 0;
      var currentVol = this.output.gain.value;
      this.output.gain.cancelScheduledValues(this.p5s.audiocontext.currentTime);
      this.output.gain.setValueAtTime(currentVol, this.p5s.audiocontext.currentTime);
      this.output.gain.linearRampToValueAtTime(vol, rampTime + this.p5s.audiocontext.currentTime);
    } else {
      this.output.gain.cancelScheduledValues(this.p5s.audiocontext.currentTime);
      this.output.gain.setValueAtTime(vol, this.p5s.audiocontext.currentTime);
    }
  };

  p5.prototype.AudioIn.prototype.dispose = function(){
    this.off();
    this.output.disconnect();
    this.amplitude.disconnect();
    this.amplitude = null;
    this.output = null;
  };

});