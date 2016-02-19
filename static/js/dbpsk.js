
var dbpsk = dbpsk || (function() {

// [Differentially encoded] phase modulation is:
// - more robust than amplitude mod
// - less spectral width than frequency mod (transmit inaudibly)
// - diff coding allows phase demodulation with non-coherent receiver

// TODO:
// - implement forward error correction
  
  var _audioContext;

  var _amp;
  var _freq;
  var _sampleRate;
  var _periodsPerBit;
  var _encodedStartedBit;
  var _barkerCode;
  
  var _period;
  var _samplesPerPeriod;
  var _samplesPerBit;
  
  // Private methods
  function _unipolarToBipolar(arr) {
    return _.map(arr, function(x){ return 2*x-1; });
  }
  
  function _decToBinArr(num, len) {
    var bin = [];
    while (len--) {
      bin.push((num >> len) & 1);
    }
    return bin;
  }
  
  function _encode(msg) {
    var encoded = [_encodedStartedBit];
    _.each(msg, function(char) {
      var binarr = _decToBinArr(char.charCodeAt(0) & 0xff, 8);  //get and truncate char code to correspond to Ascii code, convert to binary array
      _.each(binarr, function(bit) {
        encoded.push(encoded[encoded.length - 1] ^ bit);  //XOR to indicate if bit changes
      });
    });
    return encoded;
  }
  
  function _generateCarrierSignal(dur) {
    var data = [];
    var inc = 1 / _sampleRate; // time step
    for (var t = 0; t <= dur; t = t + inc)
    {
      data.push(_amp * Math.sin(2 * Math.PI * _freq * t));
    }
    return data;
  }
  
  // Public Functions
  
  function init(opts) {
    // Set default for opts
    opts = typeof opts !== 'undefined' ? opts : {};
    
    _audioContext     = opts.audioContext   || _audioContext || new window.AudioContext();
    
    _amp              = opts.amp            || 1;
    _freq             = opts.freq           || 1000;
    _sampleRate       = opts.sampleRate     || 44100;
    _periodsPerBit    = opts.periodsPerBit  || 20;
    _encodedStartedBit= opts.encodedStartBit||1;
    _barkerCode       = opts.barkerCode     || [1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1];
    
    // Calculated params
    _period = 1/_freq;
    _samplesPerPeriod = _period * _sampleRate;
    _samplesPerBit = _periodsPerBit * _samplesPerPeriod;
  }
  
  function modulate(msg)
  {
    // Encode message and convert to bipolar signal
    var msgEnc = _unipolarToBipolar(_encode(msg));
    
    // Modulate signal
    var duration = _period * _periodsPerBit * msgEnc.length;
    var carrier = _generateCarrierSignal(duration);
    var msgExp = _.flatten(_.map(msgEnc, function(x){return _.times(_samplesPerBit, _.constant(x));}));  // expand to match signal length
    var modSignal = _.map(_.zip(carrier, msgExp), function(x){ return x[0]*x[1]; });
    
    var buffer = _audioContext.createBuffer(1, modSignal.length, _sampleRate);
		var data = buffer.getChannelData(0);
		data.set(modSignal);
    return buffer;
  }
  
  function demodulate(source, callback) {
    
    // processing nodes
    var bpfilter = _audioContext.createBiquadFilter();  // band pass filter
    var threshold = _audioContext.createScriptProcessor(4096, 1, 1);
    var detector = _audioContext.createScriptProcessor(4096, 1, 1);
    
    // audio graph
    source.connect(bpfilter);
    bpfilter.connect(threshold);
    threshold.connect(detector);
    
    
  }
  
  var oPublic =
  {
    sampleRate: _sampleRate,
    init: init,
    modulate: modulate,
    demodulate: demodulate,
    test: _unipolarToBipolar,
  };
  return oPublic;
})();