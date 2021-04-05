navigator.getMedia = (
	navigator.getUserMedia ||
	navigator.webkitGetUserMedia ||
	navigator.mozGetUserMedia ||
	navigator.msGetUserMedia
);

window.AudioContext = (
	window.AudioContext ||
	window.webkitAudioContext ||
	window.mozAudioContext ||
	window.msAudioContext
);

// shim layer with setTimeout fallback
window.requestAnimFrame = (function(){
return  window.requestAnimationFrame       ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame    ||
  window.oRequestAnimationFrame      ||
  window.msRequestAnimationFrame     ||
  function( callback ){
  window.setTimeout(callback, 1000 / 60);
};
})();

// create audio context
// var audioCtx =  new window.AudioContext();
// Existing code unchanged.
// if (!audioCtx) alert("WebAudio API not supported");

// create precursor node to to final destination node, so we can virtually wire output back to input
// audioCtx.dst = audioCtx.createGain();
// audioCtx.dst.connect(audioCtx.destination);

//$(window).load(function({}); for when entire page loaded (DOM + images/iframes
// run once document (DOM only) ready
// $(document).ready(function() {
window.onload = function() {
  var audioCtx; // =  new window.AudioContext();
  audioCtx = new AudioContext();
  audioCtx.resume();
  console.log(audioCtx);

  audioCtx.dst = audioCtx.createGain();
  audioCtx.dst.connect(audioCtx.destination);

  //'use strict';

  dbpsk.init({audioContext:audioCtx});

  // receive data
  function receive(data) {
    $('#rx').val($('#rx').val() + data); //String.fromCharCode(data);
    //console.log(String.fromCharCode(byte),byte, byte.toString(2));
    console.log(data);
  }

  // wire signal to demodulator
  function wireInputSignalSource() {
    dbpsk.demodulate(audioCtx.dst, receive);
    return;

    // if debug, wire speaker output virtually to demod input
    if ($('#debug').checked) {
      dbpsk.demodulate(audioCtx.dst, receive);
    } else {
      navigator.getMedia({ video: false, audio: true }, function (stream) {
  			var source = FSK.context.createMediaStreamSource(stream);
  			fsk.demodulate(source, receive);
  		}, function (e) {
  			alert(e);
  		});
    }
  }

  //wireInputSignalSource();
  //on checkbox value change

  // receive source
  var receiveSource = audioCtx.dst;

  // wire to demodulator
  wireInputSignalSource();

  // visualizations
  var WIDTH = 640;
  var HEIGHT = 360;

  var SMOOTHING = 0.85;
  var FFT_SIZE = 2048;

  var analyser = audioCtx.createAnalyser();
  analyser.connect(audioCtx.destination);
  analyser.minDecibels = -140;
  analyser.maxDecibels = 0;
  analyser.smoothingTimeConstant = SMOOTHING;
  analyser.fftSize = FFT_SIZE;

  // audio graph
  receiveSource.connect(analyser);

  var freqData = new Uint8Array(analyser.frequencyBinCount);
  var timeData = new Uint8Array(analyser.frequencyBinCount);

  function draw() {

    // get frequency and time data
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    var canvas = $('#visualizer')[0];
    var canvasCtx = canvas.getContext('2d');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    canvasCtx.clearRect(0,0,WIDTH,HEIGHT);

    // draw freq domain chart
    for (var i = 0; i < analyser.frequencyBinCount; i++) {
      var value = freqData[i];
      var percent = value / 256;
      var height = HEIGHT * percent;
      var offset = HEIGHT - height - 1;
      var barWidth = WIDTH/analyser.frequencyBinCount;
      var hue = i/analyser.frequencyBinCount * 360;
      canvasCtx.fillStyle = 'hsl(' + hue + ', 100%, 50%)';
      canvasCtx.fillRect(i * barWidth, offset, barWidth, height);
    }

    // draw the time domain chart.
    for (var i = 0; i < analyser.frequencyBinCount; i++) {
      var value = timeData[i];
      var percent = value / 256;
      var height = HEIGHT * percent;
      var offset = HEIGHT - height - 1;
      var barWidth = WIDTH/analyser.frequencyBinCount;
      canvasCtx.fillStyle = 'black';
      canvasCtx.fillRect(i * barWidth, offset, 1, 2);
    }

    requestAnimFrame(draw);
  }


  // send data
  $('#send').click(function(){
    var input = $('#input').val();
    if (!input) return;

    console.log('Sending: ' + input);

    // create source node and fill buffer
    var source = audioCtx.createBufferSource();
    source.buffer = dbpsk.modulate(input);

    // create gain node to control volume
    var gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.5;

    // connect audio graph
    source.connect(gainNode);
    gainNode.connect(audioCtx.dst); // default output, usu speakers

    source.start(0);

    // var osc = audioCtx.createOscillator();
    // osc.frequency.value = 440;
    // var ct = audioCtx.currentTime;
    // osc.start(ct);
    // osc.stop(ct+1);
    // osc.connect(gainNode);

    requestAnimFrame(draw);
  });

};
