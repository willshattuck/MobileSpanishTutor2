import { GoogleGenAI, LiveSession, Modality, LiveServerMessage } from "@google/genai";
import { API_KEY, MATEO_INITIAL_SYSTEM_INSTRUCTION, MATEO_VOICE_NAME } from '../constants';

let ai: GoogleGenAI | null = null;
let liveSessionPromise: Promise<LiveSession> | null = null;
let isSessionActive: boolean = false;

// Initialize GoogleGenAI client (create a new one for each connection to ensure API key freshness)
function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: API_KEY });
}

interface ConnectLiveSessionCallbacks {
  onOpen: () => void;
  onMessage: (message: LiveServerMessage) => void;
  onError: (event: Event) => void;
  onClose: (event: CloseEvent) => void;
}

export async function connectLiveSession(
  systemInstruction: string,
  callbacks: ConnectLiveSessionCallbacks,
): Promise<LiveSession> {
  if (isSessionActive && liveSessionPromise) {
    return liveSessionPromise; // Return existing session if active
  }

  ai = getGeminiClient();

  liveSessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => {
        isSessionActive = true;
        callbacks.onOpen();
      },
      onmessage: (message: LiveServerMessage) => {
        callbacks.onMessage(message);
      },
      onerror: (e: Event) => {
        isSessionActive = false;
        callbacks.onError(e);
        console.error('Gemini Live Session Error:', e);
      },
      onclose: (e: CloseEvent) => {
        isSessionActive = false;
        callbacks.onClose(e);
        console.debug('Gemini Live Session Closed:', e);
      },
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: MATEO_VOICE_NAME } },
      },
      systemInstruction: systemInstruction,
      inputAudioTranscription: { enableTranscription: true },
      outputAudioTranscription: { enableTranscription: true },
    },
  });

  return liveSessionPromise;
}

export async function sendAudioToGemini(audioBlob: { data: string; mimeType: string }) {
  if (!liveSessionPromise) {
    console.warn('Gemini Live session not connected.');
    return;
  }
  const session = await liveSessionPromise;
  session.sendRealtimeInput({ media: audioBlob });
}

export async function sendTextToGemini(text: string) {
    if (!liveSessionPromise) {
        console.warn('Gemini Live session not connected.');
        return;
    }
    const session = await liveSessionPromise;
    session.sendRealtimeInput({ text: { text: text } });
}

export async function closeLiveSession() {
  if (liveSessionPromise) {
    try {
      const session = await liveSessionPromise;
      session.close();
    } catch (error) {
      console.error('Error closing Gemini Live session:', error);
    } finally {
      liveSessionPromise = null;
      isSessionActive = false;
    }
  }
}

export function getIsSessionActive(): boolean {
  return isSessionActive;
}
