// [Differentially encoded] phase modulation is:
// - more robust than amplitude mod
// - less spectral width than frequency mod (transmit inaudibly)
// - diff coding allows phase demodulation with non-coherent receiver

// TODO:
// - implement forward error correction

var _amp = 1;
var _freq = 1000;
var _sampleRate = 44100;
var _periodsPerBit = 20;
var _encodedStartedBit = 1;
var _barkerCode = [1, 1, 1, 1, 1, -1, -1, 1, 1, -1, 1, -1, 1];
// var _barkerCode = [1, 1, 1, -1, -1, 1, -1];
var _sig_threshold = 0.001;

var _period;
var _samplesPerPeriod;
var _samplesPerBit;

var _audioContext;

// Calculated params
var _period = 1/_freq;
var _samplesPerPeriod = _period * _sampleRate;
var _samplesPerBit = _periodsPerBit * _samplesPerPeriod;

/*
 * util functions
 */
function cmp(a, b) {
  if (a<b) {return -1;}
  else if (a===b) {return 0;}
  else if (a>b) {return 1;}
  else {return -999;}
}

function arraysMatch(arr1, arr2) {
  // Check if the arrays are the same length
  if (arr1.length !== arr2.length) return false;

  // Check if all items exist and are in the same order
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }

  // Otherwise, return true
  return true;
};

function getMax(arr) {
    let len = arr.length;
    let max = 0;

    while (len--) {
        max = Math.abs(arr[len]) > Math.abs(max) ? arr[len] : max;
    }
    return max;
}

function decToBinArr(num, len) {
  let bin = [];
  while (len--) {
    bin.push((num >> len) & 1);
  }
  return bin;
}

function stringToBinArr(str) {
  let binArr = []
  for (let i = 0; i<str.length; i++) {
    binArr.push(...decToBinArr(str.charCodeAt(i) & 0xff, 8));   // get and truncate char code to correspond to ASCII code, convert to binary array
  }
  return binArr;
}

/*
 * dsp functions
 */
function calcSamplesPerBit(periodsPerBit, freq, sampleRate) {
  let period = 1/freq;
  let samplesPerPeriod = period * sampleRate;
  let samplesPerBit = periodsPerBit * samplesPerPeriod;
  return samplesPerBit;
}

function calcDuration(period, periodsPerBit, numBits) {
  return period * periodsPerBit * numBits;
}

function unipolarToBipolar(arr) {
  return arr.map(x=> 2*x-1);
}

function bipolarToUnipolar(arr) {
  return arr.map(x => Math.floor((x+1)/2));
}

function expandBits(arr, samplesPerBit) {
  let expanded = [];
  for (const el of arr) {
    for (let i = 0; i < samplesPerBit; i++) {
      expanded.push(el);
    }
  }
  return expanded;
}

function diffEncode(arr) {
  let encoded = [_encodedStartedBit];
  arr.forEach(bit => encoded.push(encoded[encoded.length-1] ^ bit));  // XOR to indicate if bit changes
  return encoded;
}

function diffDecode(arr) {
  let decoded = [];
  for (let i = 1; i < arr.length; i++) {
    decoded.push(arr[i] ^ arr[i-1]);
  }
  return decoded;
}

function isPhaseShifted(arr1, arr2) {
  // if sum of vec mult <0, then phase offset > pi/2
  let sum_mult = arr1.map((el, i) => el*arr2[i]).reduce((acc, val) => acc + val);
  return sum_mult < 0
}

function getPhaseShifts(sig, samplesPerBit) {
  let phaseOffset = []
  for (let i = 0; i < sig.length-samplesPerBit; i = i+samplesPerBit) {
    let seg1 = sig.slice(i, i + samplesPerBit);
    let seg2 = sig.slice(i + samplesPerBit, i + 2*samplesPerBit);
    if (seg1.len === seg2.len) {
      phaseOffset.push(isPhaseShifted(seg1, seg2) ? 1 : 0)
    }
  }
  return phaseOffset
}

function bpskModulate(arr) {
  let duration = calcDuration(_period, _periodsPerBit, arr.length);
  let carrier = generateCarrierSignal(duration);
  let modulation = expandBits(arr, _samplesPerBit);
  let modSignal = carrier.map((el, i) => el*modulation[i]);
  return modSignal;
}

function encode(msg) {
  return unipolarToBipolar(diffEncode(stringToBinArr(msg)));
}

function decode(msg) {

  msg = bipolarToUnipolar(msg);
  let decoded = diffDecode(msg);
  // console.log(decoded);

  let charCodes = [];
  for (let i = 0; i < decoded.length; i = i+8) {
    charCodes.push(parseInt(decoded.slice(i, i+8).join(''), 2));
  }
  return String.fromCharCode(...charCodes);
}

function generateCarrierSignal(dur) {
  let data = [];
  let inc = 1 / _sampleRate; // time step
  for (let t = 0; t <= dur; t = t + inc)
  {
    data.push(_amp * Math.sin(2 * Math.PI * _freq * t));
  }
  return data;
}

function generatePreambleCarrier(isReversed) {
  let duration = calcDuration(_period, _periodsPerBit, _barkerCode.length);
  let carrier = generateCarrierSignal(duration);
  let modulation = expandBits(_barkerCode, _samplesPerBit);
  let modSignal = carrier.map((el, i) => el*modulation[i]);
  if (isReversed) {
    modSignal = modSignal.reverse();
  }
  let buffer = _audioContext.createBuffer(1, modSignal.length, _sampleRate);
  buffer.getChannelData(0).set(modSignal);
  return buffer;
}

var dbpsk = dbpsk || (function() {
  function init(audioContext) {
    _audioContext = audioContext || _audioContext || new AudioContext();
  }

  function updateConfig(opts) {
    // Set default for opts
    opts = typeof opts !== 'undefined' ? opts : {};

    _amp              = opts.amp            || _amp;
    _freq             = opts.freq           || _freq;
    _sampleRate       = opts.sampleRate     || _sampleRate;
    _periodsPerBit    = opts.periodsPerBit  || _periodsPerBit;
    _encodedStartedBit= opts.encodedStartBit|| _encodedStartedBit;
    _barkerCode       = opts.barkerCode     || _barkerCode;
    _sig_threshold    = opts.sig_threshold  || _sig_threshold;

    // Calculated params
    _period = 1/_freq;
    _samplesPerPeriod = _period * _sampleRate;
    _samplesPerBit = _periodsPerBit * _samplesPerPeriod;
  }

  function modulate(msg) {
    // encode message
    let msgEnc = '';
    if (msg.length) {
      msgEnc = encode(msg);
    }

    // add barker code
    msgEnc = _barkerCode.concat(msgEnc);

    // modulate signal
    let modSignal = bpskModulate(msgEnc);

    let buffer = _audioContext.createBuffer(1, modSignal.length, _sampleRate);
    buffer.getChannelData(0).set(modSignal);
    return buffer;
  }

  function demodulate(signal) {
    signal = signal.map(el => Math.abs(el) > _sig_threshold ? cmp(el, 0) : 0);

    // remove barker code
    let preamble = signal.slice(0, _barkerCode.length);
    if (arraysMatch(preamble, _barkerCode)) {
      signal = signal.slice(_barkerCode.length);
    }
    if (!signal.length) {return;}

    let phaseOffset = getPhaseShifts(signal, _samplesPerBit);
    let phaseUnoffset = [1];
    let phase;
    for (const x of phaseOffset) {
      let prev = phaseUnoffset[phaseUnoffset.length - 1];
      phaseUnoffset.push(x === 0 ? prev : -1*prev);
    }
    let decodedMsg = decode(bipolarToUnipolar(phaseUnoffset));
    return decodedMsg;
  }

  var oPublic =
  {
    init: init,
    updateConfig: updateConfig,
    modulate: modulate,
    demodulate: demodulate,
  };
  return oPublic;
})();


// tests
var testing = testing || (function(){

  let testResults = [];

  let msg = 'abc123ABC.+/='
  testResults.push(decode(encode(msg))===msg)
  // testResults.push(arraysMatch(encode('ab1!'), unipolarToBipolar(_barkerCode).concat([1, 1, -1, 1, 1, 1, 1, 1, -1, -1, 1, -1, -1, -1, -1, 1, 1, 1, 1, -1, 1, 1, 1, 1, -1, -1, -1, 1, 1, 1, 1, 1, -1])));
  testResults.push(arraysMatch(diffEncode(stringToBinArr('ab1!')), [1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0]));

  let arr1 = [1,2,3];
  let arr2 = [3,5,-10];
  let arr3 = [3,5,10];
  testResults.push(isPhaseShifted(arr1, arr2)===true);
  testResults.push(isPhaseShifted(arr1, arr3)===false);

  testResults.push(arraysMatch(expandBits(arr1, 3), [1,1,1,2,2,2,3,3,3]));

  testResults.push(calcSamplesPerBit(20,1000,44100)===882);

  if (testResults.every(el => el)) {
    console.log('All tests passed');
  }
  else {
    console.log('Failing tests: ');
    console.log(testResults);
  }
});
// testing();

export {dbpsk, generatePreambleCarrier, getMax};
