import { AUDIO_INPUT_SAMPLE_RATE, AUDIO_OUTPUT_SAMPLE_RATE, AUDIO_CHUNK_SIZE, VAD_SPEECH_THRESHOLD, VAD_SILENCE_THRESHOLD, VAD_SILENCE_DURATION_MS, VAD_SPEECH_MIN_DURATION_MS } from '../constants';
import { VadState } from '../types';

let inputAudioContext: AudioContext | null = null;
let outputAudioContext: AudioContext | null = null;
let mediaStreamSource: MediaStreamAudioSourceNode | null = null;
let scriptProcessorNode: ScriptProcessorNode | null = null;
let analyserNode: AnalyserNode | null = null;
let audioProcessorCallback: ((data: Float32Array, vadState: VadState) => void) | null = null;
let audioDataQueue: Float32Array[] = [];
let vadState: VadState = { isSpeaking: false, silenceStartTime: 0, speechDuration: 0 };
let silenceTimeout: number | undefined;

export function getOrCreateInputAudioContext(): AudioContext {
  if (!inputAudioContext) {
    // Fix: Use standard AudioContext
    inputAudioContext = new window.AudioContext({ sampleRate: AUDIO_INPUT_SAMPLE_RATE });
  }
  return inputAudioContext;
}

export function getOrCreateOutputAudioContext(): AudioContext {
  if (!outputAudioContext) {
    // Fix: Use standard AudioContext
    outputAudioContext = new window.AudioContext({ sampleRate: AUDIO_OUTPUT_SAMPLE_RATE });
  }
  return outputAudioContext;
}

export async function startMicrophoneStream(onAudioChunk: (data: Float32Array, vadState: VadState) => void): Promise<AnalyserNode> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('getUserMedia not supported in this browser.');
  }

  audioProcessorCallback = onAudioChunk;

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const context = getOrCreateInputAudioContext();

  mediaStreamSource = context.createMediaStreamSource(stream);
  scriptProcessorNode = context.createScriptProcessor(AUDIO_CHUNK_SIZE, 1, 1);
  analyserNode = context.createAnalyser();
  analyserNode.fftSize = 2048; // For waveform visualization

  scriptProcessorNode.onaudioprocess = (event: AudioProcessingEvent) => {
    const inputData = event.inputBuffer.getChannelData(0);
    const rms = calculateRMS(inputData);
    const currentTime = Date.now();

    // VAD Logic
    if (rms > VAD_SPEECH_THRESHOLD) {
      if (!vadState.isSpeaking) {
        // Start of speech
        vadState.isSpeaking = true;
        vadState.silenceStartTime = 0; // Reset silence timer
        vadState.speechDuration = 0; // Reset speech duration
        clearTimeout(silenceTimeout);
      }
      vadState.speechDuration += (AUDIO_CHUNK_SIZE / AUDIO_INPUT_SAMPLE_RATE) * 1000; // Add chunk duration in ms
      audioDataQueue.push(inputData.slice()); // Queue audio data
    } else {
      if (vadState.isSpeaking) {
        if (vadState.silenceStartTime === 0) {
          vadState.silenceStartTime = currentTime; // Start silence timer
        }
        audioDataQueue.push(inputData.slice()); // Continue queuing during post-speech silence

        if (currentTime - vadState.silenceStartTime > VAD_SILENCE_DURATION_MS) {
          // End of speech
          if (vadState.speechDuration >= VAD_SPEECH_MIN_DURATION_MS) {
            // Valid speech detected, process queued audio
            onAudioChunk(new Float32Array(0), { ...vadState, isSpeaking: false }); // Signal end of speech
          }
          // Reset VAD state
          vadState.isSpeaking = false;
          vadState.silenceStartTime = 0;
          vadState.speechDuration = 0;
          audioDataQueue = [];
          clearTimeout(silenceTimeout);
        }
      }
    }
    
    if (vadState.isSpeaking && audioDataQueue.length > 0 && onAudioChunk) {
        const queuedData = audioDataQueue.shift();
        if (queuedData) {
            onAudioChunk(queuedData, vadState);
        }
    }

    // Pass audio data to analyser for visualization
    if (analyserNode) {
        const buffer = context.createBuffer(1, inputData.length, context.sampleRate);
        buffer.getChannelData(0).set(inputData);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(analyserNode);
        source.start();
    }
  };

  mediaStreamSource.connect(analyserNode);
  analyserNode.connect(scriptProcessorNode);
  scriptProcessorNode.connect(context.destination); // Connect to speakers to keep it alive

  return analyserNode;
}

export function stopMicrophoneStream() {
  if (mediaStreamSource) {
    const tracks = mediaStreamSource.mediaStream.getTracks();
    tracks.forEach(track => track.stop());
    mediaStreamSource.disconnect();
    mediaStreamSource = null;
  }
  if (scriptProcessorNode) {
    scriptProcessorNode.disconnect();
    scriptProcessorNode.onaudioprocess = null;
    scriptProcessorNode = null;
  }
  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
  }
  audioProcessorCallback = null;
  vadState = { isSpeaking: false, silenceStartTime: 0, speechDuration: 0 };
  audioDataQueue = [];
  clearTimeout(silenceTimeout);

  if (inputAudioContext) {
    // Keep context alive to prevent issues on rapid reconnects, or close if truly done
    // inputAudioContext.close(); 
    // inputAudioContext = null;
  }
}

function calculateRMS(data: Float32Array): number {
  let sumSquares = 0;
  for (let i = 0; i < data.length; i++) {
    sumSquares += data[i] * data[i];
  }
  return Math.sqrt(sumSquares / data.length);
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: `audio/pcm;rate=${AUDIO_INPUT_SAMPLE_RATE}`,
  };
}