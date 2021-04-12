# riroriro

*ting-tiing-ting-tiiing-ting-krrrrrrr*. (Nostalgia). Those dialup modems used to send data over a network that was designed to carry only voice - so they communicated in the audible range. That sound you heard when first connecting to the internet, or when you accidentally picking up the phone while someone else was on the internet? Data being exchanged.

**riroriro** is based on a similar idea to transfer data using sound. Play with it [here](https://djanana.live/riroriro/).

### data -> sound -> data

##### Sending Data

There are [many ways](https://en.wikipedia.org/wiki/Modem) of encoding the data and modulating the sound. We'll start off with the basics.

Data - string of ASCII characters

Encoding - convert data into binary (1's and 0's if we want a unipolar signal, 1's and -1's if we want an equivalent bipolar signal )

Modulation - map the two states of the binary representation of the data onto a periodic signal. 

There are three basic forms of modulation:

* Amplitude-shift keying (ASK): data is represented as variations in amplitude. Morse code is an example of this.
* Frequency-shift keying (FSK): data is represented as variations in frequency. As an example, you can represent bits in an 8-bit character as different notes, resulting in a musical representation of the data.
* Phase-shift keying (PSK): data is represented as variations in the phase of a single-frequency signal.

![2.5: Digital Modulation - Engineering LibreTexts](https://eng.libretexts.org/@api/deki/files/32726/clipboard_e8308393d47847bbd9deaad903693b368.png?revision=1)

We'll be using PSK for riroriro. The most basic implementation represents 1's and 0's as 2 different phases, 0º and 180º - this is binary phase-shift keying (BPSK). Multiple bits can also be grouped together to be represented by multiple phases, resultng in potentially higher data transfer rates. riroriro implements BPSK.

A challenge with PSK at the receiving end is figuring out the phase of the signal. The phase can be utilised in 2 ways to convey information:

* The phase conveys the information. In this case, demodulation requires a reference signal to compare to the received signal to figure out the phase. A phase shift during transmission would also introduce ambiguity in the demodulation.
* A change in phase represents a change in state of the transmitted data. Hence, information can be unambiguously extracted by comparing the received signal to itself, negating the need for a reference signal. Data that is transmitted using this method (DPSK - differential phase-shift keying) needs to be [differentially encoded](https://en.wikipedia.org/wiki/Differential_coding): for example, a binary 1 can be transmitted by add a 180º phase offset, and a binary 0 by keeping the previous phase. The downside of using differential encoding is that a single transmission error can cascade.

![img](https://imgr.whimsical.com/object/NvkHb7Fse1wXjBnRsr4PdJ)

##### Receiving

Sounds travels through a noisy environment and comes in through the microphone, so it's going to be noisy. Because we are using a single frequency carrier, we can use a bandpass filter to reduce noise elsewhere in the frequency spectrum.

The next piece of the demodulation puzzle is to figure out when a signal actually starts; some sort of pre-determined pattern to synchronise between the sender and receiver; something that would be easy to recognise. Enter: [Barker codes](https://en.wikipedia.org/wiki/Barker_code), a sequence of bits that can be easily recognised using correlation - aka when the sequence can only be identified when it perfectl overlaps. The autocorrelation function of the 7-bit code (riroriro uses the 13-bit code):

![img](https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Barker7corr.svg/220px-Barker7corr.svg.png)

To detect the presence of the Barker code, we correlate a generated signal modulated with the Barker code with the received signal (or equivalently, convolve the time-reversed Barker code signal with the received signal) until we get a strong match - that's when the signal starts and the demodulation can begin.

The received signal is then turned into 1's and -1's using thesholding, the Barker code is removed, the phase shifts are identified, and the final message is differentially decoded. The end of the signal is identified as the signal being consistently below a low threshold.

![img](https://imgr.whimsical.com/object/8LREnQTjDd81QQcabj6tqs)

##### Implementation

We use Web Audio API to generate, receive, and analyse the signal. The audio graph is below:

![img](https://imgr.whimsical.com/object/KZKoEVSfTTb2bYRxKbAjY)

The AnalyserNode is used to receive audio data; however, each iteration to pull samples from the AnalyserNode's buffer results in significant overlap. To account for this, the time between samplings is used to calculate the number of samples that will be overlapping so the appropriate deduping can happen. An AudioWorkletNode is the preferred way to do deterministically receive the data - perhaps for a future iteration.

