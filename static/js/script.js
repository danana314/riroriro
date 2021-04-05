navigator.getMedia = (
	navigator.getUserMedia ||
	navigator.webkitGetUserMedia ||
	navigator.mozGetUserMedia ||
	navigator.msGetUserMedia
);

console.clear();

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// tui or riroriro

// initial
dbpsk.init({audioContext: audioCtx});

// initialized up here for testing
var dataArr = [];
var numLoops;

document.getElementById("send").addEventListener('click', function(){
	let input = document.getElementById('input').value;
	if (!input) return;
	console.log('Sending: ' + input);

	// create source node and fill buffer
	let source = audioCtx.createBufferSource();
	source.buffer = dbpsk.modulate(input);

	// analyser
	let analyser = audioCtx.createAnalyser();
	analyser.fftSize = 16384; // 8192;
	// analyser.fftSize = 8192;
	analyser.smoothingTimeConstant = 0.0;

	// connect audio graph
	source.connect(audioCtx.destination); // default output, usu speakers
	source.connect(analyser);

	// set up buffers
	let bufferLength = analyser.frequencyBinCount;
	// var dataArr = [];
	dataArr = [];
	numLoops = 0;
	let buffer = new Float32Array(bufferLength);

	function sampleSignal() {
		analyser.getFloatTimeDomainData(buffer);
		dataArr.push(...buffer);
		numLoops += 1;
		// if (dataArr.length > 8*samplesPerBit) {
			// console.log(dbpsk.demodulate(dataArr.slice(0, 8*samplesPerBit)));
			// dataArr = dataArr.slice(8*samplesPerBit, dataArr.length);
		// }

		if (((new Date()) - startTime)/1000 < 1.5) {
			setTimeout(sampleSignal, 50);
		}
		else {
			startIndex = dataArr.findIndex((el) => el > 0);
			decodedMsg = dbpsk.demodulate(dataArr.slice(startIndex, dataArr.length-1));
			console.log(decodedMsg);
			console.log(dataArr);
		}
	}

	startTime = new Date();
	sampleSignal();
	source.start();
});

