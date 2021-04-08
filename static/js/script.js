// riroriro

navigator.getMedia = (
	navigator.getUserMedia ||
	navigator.webkitGetUserMedia ||
	navigator.mozGetUserMedia ||
	navigator.msGetUserMedia
);

console.clear();

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext({sampleRate: 44100});
dbpsk.init({audioContext: audioCtx});

const convolver = audioCtx.createConvolver();
convolver.buffer = generatePreambleCarrier(true);

// audioCtx.audioWorklet.addModule('static/js/signal-detector.js').then(() => {
// 	let signalDetector = new AudioWorkletNode(audioCtx, 'signal-detector');
// 	convolver.connect(signalDetector);
// });

// initialized up here for testing
var convolverDataArr = [];
var timeDataArr = [];
var numLoops;
var timeNow;
var sampleTimes = [];
var sampleDiffs = [];
const RENDER_QUANTUM = 128;
const FFT_SIZE = 16384;	// 8192

document.getElementById("send").addEventListener('click', function(){
	let input = document.getElementById('input').value;
	// if (!input) return;
	console.log('Sending: ' + input);

	// create source node and fill buffer
	let source = audioCtx.createBufferSource();
	source.buffer = dbpsk.modulate(input);
	// source.buffer = generatePreambleCarrier();

	// processing nodes
	// let biquadFilter = _audioContext.createBiquadFilter();  // band pass filter
	// biquadFilter.type = 'bandpass';
	// biquadFilter.frequency.value = _freq;

	// convolver analyser
	let convolverAnalyser = audioCtx.createAnalyser();
	convolverAnalyser.fftSize = FFT_SIZE;
	// convolverAnalyser.smoothingTimeConstant = 0.0;
	// convolverAnalyser.minDecibels = -140;
  // convolverAnalyser.maxDecibels = 0;

	// time domain analyser
	let timeAnalyser = audioCtx.createAnalyser();
	timeAnalyser.fftSize = FFT_SIZE;

	// connect audio graph
	source.connect(timeAnalyser).connect(audioCtx.destination); // default output, usu speakers
	source.connect(convolver);
	convolver.connect(convolverAnalyser);

	// set up buffers
	convolverDataArr = [];
	timeDataArr = [];
	let convolverBuffer = new Float32Array(FFT_SIZE);
	let timeBuffer = new Float32Array(FFT_SIZE);

	numLoops = 0;
	timeNow = 0;
	sampleTimes = [];
	sampleDiffs = [];

	function sampleSignal() {
		timeNow = audioCtx.currentTime;
		// timeNow = audioCtx.getOutputTimestamp().contextTime;
		convolverAnalyser.getFloatTimeDomainData(convolverBuffer);
		timeAnalyser.getFloatTimeDomainData(timeBuffer);
		if (numLoops === 0) {
			convolverDataArr.push(...convolverBuffer);
			timeDataArr.push(...timeBuffer);
		} else {
			let timeDiff = timeNow - sampleTimes[sampleTimes.length - 1];
			let newSamples = audioCtx.sampleRate * timeDiff;
			sampleDiffs.push(newSamples);
			convolverDataArr.push(...convolverBuffer.slice(convolverBuffer.length - newSamples));
			timeDataArr.push(...timeBuffer.slice(timeBuffer.length - newSamples));
		}
		sampleTimes.push(timeNow);
		numLoops += 1;

		if (((new Date()) - startTime)/1000 < 1.5) {
			setTimeout(sampleSignal, 50);
		}
		else {
			// startIdx = convolverDataArr.findIndex(el => el > 0.0001);
			startIdx = 0;
			maxIdk = convolverDataArr.findIndex(el => el === getMax(convolverDataArr));
			convolverDataArr = convolverDataArr.slice(maxIdk);
			timeDataArr = timeDataArr.slice(maxIdk);
			console.log('max conv: ', getMax(convolverDataArr));
			console.log('decoded: ', dbpsk.demodulate(timeDataArr));
			// console.log(sampleTimes);
			// console.log(sampleDiffs);
			// console.log(timeDataArr);
			draw(timeDataArr);
		}
	}

	startTime = new Date();
	sampleSignal();
	source.start();
});

var WIDTH = 1000;
var HEIGHT = 600;

function draw(arr) {
	maxValue = Math.abs(getMax(arr));
	// VISUALIZE
	var canvas = document.getElementById('visualizer');
	var canvasCtx = canvas.getContext('2d');
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	canvasCtx.clearRect(0,0,WIDTH,HEIGHT);
	canvasCtx.fillStyle = 'rgb(200, 200, 200)';
	canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
	canvasCtx.lineWidth = 2;
	canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
	canvasCtx.beginPath();
	var sliceWidth = WIDTH * 1.0 / arr.length;
	var x = 0;

	// draw the time domain chart.
	for (var i = 0; i < arr.length; i++) {
		var v = arr[i]/maxValue;
		var y = v*HEIGHT/2.2 + 300;
		if (i==0) {
			canvasCtx.moveTo(x,y);
		} else {
			canvasCtx.lineTo(x, y);
		}
		x += sliceWidth;
	}
	canvasCtx.lineTo(canvas.width, canvas.height/2);
	canvasCtx.stroke();
}

