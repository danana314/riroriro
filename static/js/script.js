// riroriro
import {dbpsk, generatePreambleCarrier, getMax} from './dbpsk.js';

// setup audio
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext({sampleRate: 44100});
dbpsk.init(audioCtx);

const convolver = audioCtx.createConvolver();

// microphone
var microphone;

// audioCtx.audioWorklet.addModule('static/js/signal-detector.js').then(() => {
// 	let signalDetector = new AudioWorkletNode(audioCtx, 'signal-detector');
// 	convolver.connect(signalDetector);
// });

// config
let config = {
	fft_size: 8192,	// 8192 or 16384
	conv_threshold: 2,
	sig_threshold: 0.001,
	sig_end_window: 500,
	freq: 1000,
	periods_per_bit: 20,
	amp: 1
}
for (const c in config) {
	document.getElementById(c).value = config[c];
}
dbpsk.updateConfig(config);

function configChangeHandler(event) {
	config[event.srcElement.id] = event.target.value;
	dbpsk.updateConfig(config);
	console.log('Config updated', config);
}

let configSelection = document.getElementsByClassName('config');
for (let i = 0; i < configSelection.length; i++) {
	configSelection[i].addEventListener('change', configChangeHandler);
}

// clear
document.getElementById('clear').addEventListener('click', function() {
	document.getElementById('rx').value = '';
});

// receive
var isReceiving = false;
document.getElementById('receive').addEventListener('click', function() {
	isReceiving = !isReceiving;

	if (!isReceiving) {
		document.getElementById('receive').textContent = 'Receive';
		return;
	} else {
		console.log('starting receive')
		document.getElementById('receive').textContent = 'Stop Receiving';
	}

	// convolver
	convolver.buffer = generatePreambleCarrier(true);

	// processing nodes
	let biquadFilter = audioCtx.createBiquadFilter();  // band pass filter
	biquadFilter.type = 'bandpass';
	biquadFilter.frequency.value = 1000;

	// convolver analyser
	let convolverAnalyser = audioCtx.createAnalyser();
	convolverAnalyser.fftSize = config.fft_size;

	// time domain analyser
	let timeAnalyser = audioCtx.createAnalyser();
	timeAnalyser.fftSize = config.fft_size;

	// microphone
	navigator.mediaDevices.getUserMedia({audio: true})
		.then(stream => {
			var microphone = audioCtx.createMediaStreamSource(stream);
			microphone.connect(biquadFilter).connect(timeAnalyser);
			microphone.connect(biquadFilter).connect(convolver).connect(convolverAnalyser);
			audioCtx.resume();
		})
		.catch(err => { console.log(err); alert("Microphone is required."); });

	// set up buffers
	let convolverDataArr = [];
	let timeDataArr = [];
	let convolverBuffer = new Float32Array(config.fft_size);
	let timeBuffer = new Float32Array(config.fft_size);

	let numLoops = 0;
	let timeNow = 0;
	let sampleTimes = [];
	// let sampleDiffs = [];
	let isSigDetected = false;

	function sampleSignal() {
		timeNow = audioCtx.currentTime;
		convolverAnalyser.getFloatTimeDomainData(convolverBuffer);
		timeAnalyser.getFloatTimeDomainData(timeBuffer);
		draw(timeBuffer);
		document.getElementById('max_sig_level').value = getMax(timeBuffer);

		if (numLoops === 0) {
			convolverDataArr.push(...convolverBuffer);
			timeDataArr.push(...timeBuffer);
		} else {
			let timeDiff = timeNow - sampleTimes[sampleTimes.length - 1];		// time since last loop
			let newSamples = audioCtx.sampleRate * timeDiff;								// number of new samples since last iteration. should be integer multiple of RENDER_QUANTUM
			// sampleDiffs.push(newSamples);																		// to keep track of new sample additions. to verify that they are indeed integer multiples of RENDER_QUANTUM
			convolverDataArr.push(...convolverBuffer.slice(convolverBuffer.length - newSamples));	// add new samples to existing buffer
			timeDataArr.push(...timeBuffer.slice(timeBuffer.length - newSamples));		// add new samples to existing buffer
		}
		sampleTimes.push(timeNow);		// keep track of loop times
		numLoops += 1;

		// detect peak in convolved wave
		let maxConv = Math.abs(getMax(convolverDataArr));
		document.getElementById('max_conv').value = maxConv;
		if (maxConv > config.conv_threshold && !isSigDetected) {
			isSigDetected = true;
			let maxIdk = convolverDataArr.findIndex(el => el === maxConv);
			timeDataArr = timeDataArr.slice(maxIdk);
		}

		// detect end of message
		let isBelowThreshold = (currentValue) => currentValue < config.sig_threshold;
		let recentValues = timeDataArr.slice(timeDataArr.length - config.sig_end_window);
		if (isSigDetected && recentValues.every(isBelowThreshold)) {
			let decodedMsg = dbpsk.demodulate(timeDataArr);
			document.getElementById('rx').value += decodedMsg;
			console.log('decoded: ', decodedMsg);
			isSigDetected = false;
			convolverDataArr = [];
			timeDataArr = [];
			numLoops = 0;
			sampleTimes = [];
		}

		if (isReceiving) {
			setTimeout(sampleSignal, 30);
		}
		else {
			isSigDetected = false;
			isReceiving = false;
		}
	}
	sampleSignal();
});

// send
document.getElementById('send').addEventListener('click', function(){
	let input = document.getElementById('tx').value;
	if (!input) return;

	// create source node and fill buffer
	let source = audioCtx.createBufferSource();
	source.buffer = dbpsk.modulate(input);

	// connect audio graph
	source.connect(audioCtx.destination); // default output, usu speakers
	source.start();
});

// draw
const WIDTH = 1000;
const HEIGHT = 600;

function draw(arr) {
	let maxValue = 1;

	// VISUALIZE
	let canvas = document.getElementById('visualizer');
	let canvasCtx = canvas.getContext('2d');
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

	function scaleY(y) {
		let v = y/maxValue;
		return v*HEIGHT + HEIGHT/2;
	}

	// draw the time domain chart.
	for (let i = 0; i < arr.length; i++) {
		let y = scaleY(arr[i]);
		if (i==0) {
			canvasCtx.moveTo(x, y);
		} else {
			canvasCtx.lineTo(x, y);
		}
		x += sliceWidth;
	}
	canvasCtx.lineTo(canvas.width, canvas.height/2);
	canvasCtx.stroke();

	// write y axis
	canvasCtx.font = "30px Arial";
	canvasCtx.fillStyle = 'rgb(255, 0, 0)';
	canvasCtx.fillText("0", 0, HEIGHT/2);
	canvasCtx.fillText(maxValue, 0, 30);
}

