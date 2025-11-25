import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveSession, LiveServerMessage, Modality } from "@google/genai";
import {
  MATEO_INITIAL_SYSTEM_INSTRUCTION,
  AUDIO_OUTPUT_SAMPLE_RATE,
} from './constants';
import { GradeLevel, SpeakingSpeed, ChatMessage, VadState } from './types';
import * as audioService from './services/audioService';
import * as geminiService from './services/geminiService';

import ChatBubble from './components/ChatBubble';
import MicButton from './components/MicButton';
import Controls from './components/Controls';
import AudioWaveform from './components/AudioWaveform';

let nextStartTime = 0; // For seamless audio playback
const sources = new Set<AudioBufferSourceNode>(); // To manage audio playback

const App: React.FC = () => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false); // If microphone is active
  const [isMateoSpeaking, setIsMateoSpeaking] = useState(false);
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(GradeLevel.BEGINNER);
  const [speakingSpeed, setSpeakingSpeed] = useState<SpeakingSpeed>(SpeakingSpeed.NORMAL);
  const [currentInputTranscription, setCurrentInputTranscription] = useState('');
  const [currentOutputTranscription, setCurrentOutputTranscription] = useState('');
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [vadActive, setVadActive] = useState(false); // If VAD has detected speech and is sending audio
  const [initialGreetingSent, setInitialGreetingSent] = useState(false);

  const liveSessionRef = useRef<LiveSession | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Function to handle audio playback from Mateo
  const playMateoAudio = useCallback(async (base64Audio: string, playbackRate: number = 1) => {
    const outputAudioContext = outputAudioContextRef.current;
    if (!outputAudioContext) return;

    setIsMateoSpeaking(true);

    try {
      nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
      const audioBuffer = await audioService.decodeAudioData(
        audioService.decode(base64Audio),
        outputAudioContext,
        AUDIO_OUTPUT_SAMPLE_RATE,
        1,
      );
      const source = outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackRate; // Apply playback rate for speed control
      source.connect(outputAudioContext.destination);

      source.addEventListener('ended', () => {
        sources.delete(source);
        if (sources.size === 0) {
          setIsMateoSpeaking(false);
        }
      });

      source.start(nextStartTime);
      nextStartTime = nextStartTime + audioBuffer.duration / playbackRate; // Adjust next start time
      sources.add(source);
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsMateoSpeaking(false);
    }
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleControlCommands = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('easier')) {
      setGradeLevel((prev) => {
        if (prev === GradeLevel.ADVANCED) return GradeLevel.INTERMEDIATE;
        if (prev === GradeLevel.INTERMEDIATE) return GradeLevel.BEGINNER;
        return GradeLevel.BEGINNER;
      });
      console.log('Grade level set to easier.');
    } else if (lowerText.includes('harder')) {
      setGradeLevel((prev) => {
        if (prev === GradeLevel.BEGINNER) return GradeLevel.INTERMEDIATE;
        if (prev === GradeLevel.INTERMEDIATE) return GradeLevel.ADVANCED;
        return GradeLevel.ADVANCED;
      });
      console.log('Grade level set to harder.');
    } else if (lowerText.includes('slower')) {
      setSpeakingSpeed((prev) => {
        if (prev === SpeakingSpeed.FAST) return SpeakingSpeed.NORMAL;
        if (prev === SpeakingSpeed.NORMAL) return SpeakingSpeed.SLOW;
        return SpeakingSpeed.SLOW;
      });
      console.log('Speaking speed set to slower.');
    } else if (lowerText.includes('faster')) {
      setSpeakingSpeed((prev) => {
        if (prev === SpeakingSpeed.SLOW) return SpeakingSpeed.NORMAL;
        if (prev === SpeakingSpeed.NORMAL) return SpeakingSpeed.FAST;
        return SpeakingSpeed.FAST;
      });
      console.log('Speaking speed set to faster.');
    }
    if (lowerText.includes('change topic to')) {
        const topicMatch = lowerText.match(/change topic to (.*)/);
        if (topicMatch && topicMatch[1]) {
            console.log(`Topic change requested: ${topicMatch[1].trim()}`);
        }
    }
  }, []);

  const handleMateoMessage = useCallback(async (message: LiveServerMessage) => {
    // Process input transcription for live display
    if (message.serverContent?.inputTranscription) {
      setCurrentInputTranscription((prev) => prev + message.serverContent!.inputTranscription!.text);
    }

    // Process output transcription for live display
    if (message.serverContent?.outputTranscription) {
      setCurrentOutputTranscription((prev) => prev + message.serverContent!.outputTranscription!.text);
    }

    // Handle Mateo's audio output
    if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
      const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;

      let playbackRate = 1;
      if (speakingSpeed === SpeakingSpeed.SLOW) {
          playbackRate = 0.8;
      } else if (speakingSpeed === SpeakingSpeed.FAST) {
          playbackRate = 1.2;
      }

      // Check for contextual speed control commands
      const lastUserTranscription = currentInputTranscription;
      if (lastUserTranscription && (lastUserTranscription.toLowerCase().includes('what') || lastUserTranscription.toLowerCase().includes('repeat that'))) {
        playbackRate = 0.75; // Slower for repeats
      }

      playMateoAudio(base64Audio, playbackRate);
    }

    // When a full turn is complete (both user input and model output have potentially concluded)
    if (message.serverContent?.turnComplete) {
      // Finalize user's turn in chat history
      const finalUserText = currentInputTranscription.trim();
      if (finalUserText) {
        setChatHistory((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}`, // Unique ID
            type: 'user',
            text: finalUserText,
            timestamp: new Date(),
          },
        ]);
        // Process control commands from the finalized user text
        handleControlCommands(finalUserText);
      }
      // Clear current input transcription after it's been added to history
      setCurrentInputTranscription('');

      // Finalize Mateo's turn in chat history
      const finalMateoText = currentOutputTranscription.trim();
      if (finalMateoText) {
        setChatHistory((prev) => [
          ...prev,
          {
            id: `mateo-${Date.now()}`, // Unique ID
            type: 'mateo',
            text: finalMateoText,
            audioBase64: message.serverContent.modelTurn?.parts?.[0]?.inlineData?.data,
            timestamp: new Date(),
          },
        ]);
      }
      // Clear current output transcription after it's been added to history
      setCurrentOutputTranscription('');
    }

    // Handle interruption
    if (message.serverContent?.interrupted) {
      for (const source of sources.values()) {
        source.stop();
        sources.delete(source);
      }
      nextStartTime = 0;
      setIsMateoSpeaking(false);
      // Also clear transcriptions if interrupted mid-turn
      setCurrentInputTranscription('');
      setCurrentOutputTranscription('');
    }
  }, [playMateoAudio, speakingSpeed, currentInputTranscription, currentOutputTranscription, handleControlCommands]);

  const connectToGeminiLive = useCallback(async () => {
    if (!outputAudioContextRef.current) {
      outputAudioContextRef.current = audioService.getOrCreateOutputAudioContext();
    }

    try {
      // Construct the system instruction based on current gradeLevel and speakingSpeed
      const currentSystemInstruction = `${MATEO_INITIAL_SYSTEM_INSTRUCTION}
      Current Settings: [GRADE_LEVEL: ${gradeLevel}, SPEAKING_SPEED: ${speakingSpeed}]
      `;

      const session = await geminiService.connectLiveSession(currentSystemInstruction, {
        onOpen: () => {
          console.debug('Gemini Live Session Opened');
        },
        onMessage: handleMateoMessage,
        onError: (e) => {
          console.error('Gemini Live Session Error:', e);
          setIsListening(false);
          // If session closes due to error, ensure initialGreetingSent is reset
          setInitialGreetingSent(false);
        },
        onClose: (e) => {
          console.debug('Gemini Live Session Closed:', e);
          setIsListening(false);
          liveSessionRef.current = null;
          // When session closes, ensure initialGreetingSent is reset
          setInitialGreetingSent(false);
        },
      });
      liveSessionRef.current = session;

      if (!initialGreetingSent) {
          // Send an initial text message to trigger the greeting from Mateo
          // and provide the initial system instruction with current settings.
          await geminiService.sendTextToGemini(`[GRADE_LEVEL: ${gradeLevel}, SPEAKING_SPEED: ${speakingSpeed}] `);
          setInitialGreetingSent(true);
      }

    } catch (error) {
      console.error('Failed to connect to Gemini Live:', error);
      setIsListening(false);
      setInitialGreetingSent(false); // Reset if connection fails
    }
  }, [handleMateoMessage, initialGreetingSent, gradeLevel, speakingSpeed]);

  const handleAudioChunk = useCallback(async (data: Float32Array, vadState: VadState) => {
    // Update VAD Active for UI
    setVadActive(vadState.isSpeaking);

    // If speech is detected and there's audio data, send it to Gemini
    if (vadState.isSpeaking && data.length > 0) {
      const pcmBlob = audioService.createBlob(data);
      // Ensure sessionPromise is resolved before sending, as per guidelines.
      geminiService.sendAudioToGemini(pcmBlob);
    }
    // IMPORTANT: Do not attempt to finalize user turn or send text messages here based on VAD state.
    // That logic should be handled by the `turnComplete` message from Gemini Live API,
    // which also provides the final `inputAudioTranscription`.
  }, []);

  const toggleListening = useCallback(async () => {
    if (isMateoSpeaking) return;

    if (isListening) {
      setIsListening(false);
      audioService.stopMicrophoneStream(); // This clears VAD state in audioService
      await geminiService.closeLiveSession();
      setAnalyserNode(null);
      setVadActive(false); // Only keep UI state
    } else {
      setIsListening(true);
      setCurrentInputTranscription('');
      setCurrentOutputTranscription(''); // Clear previous output transcription when starting new listening
      try {
        const analyser = await audioService.startMicrophoneStream(handleAudioChunk);
        setAnalyserNode(analyser);
        await connectToGeminiLive();
      } catch (error) {
        console.error('Failed to start microphone stream or connect to Gemini:', error);
        setIsListening(false);
      }
    }
  }, [isListening, isMateoSpeaking, handleAudioChunk, connectToGeminiLive]);

  // Initial setup for output audio context
  useEffect(() => {
    outputAudioContextRef.current = audioService.getOrCreateOutputAudioContext();
  }, []);

  // Handlers for grade level and speaking speed changes, to restart session if listening
  const handleGradeLevelChange = useCallback(async (level: GradeLevel) => {
    setGradeLevel(level);
    if (isListening) {
      await geminiService.closeLiveSession();
      setInitialGreetingSent(false); // Reset to re-send initial greeting with new settings
      await connectToGeminiLive();
    }
  }, [isListening, connectToGeminiLive]);

  const handleSpeakingSpeedChange = useCallback(async (speed: SpeakingSpeed) => {
    setSpeakingSpeed(speed);
    if (isListening) {
      await geminiService.closeLiveSession();
      setInitialGreetingSent(false); // Reset to re-send initial greeting with new settings
      await connectToGeminiLive();
    }
  }, [isListening, connectToGeminiLive]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden">
      <header className="flex items-center justify-between p-4 bg-indigo-600 text-white shadow-md">
        <h1 className="text-xl font-bold">Mateo: Spanish Tutor</h1>
        <div className="flex items-center gap-2 text-sm">
          <span>{gradeLevel}</span>
          <span>•</span>
          <span>{speakingSpeed}</span>
        </div>
      </header>

      <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
        {chatHistory.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <p>Press the microphone button to start practicing Spanish!</p>
          </div>
        )}
        {chatHistory.map((message) => (
          <ChatBubble key={message.id} message={message} onReplayAudio={playMateoAudio} />
        ))}
        {isListening && currentInputTranscription && (
          <div className="self-end max-w-[80%] my-2 p-3 rounded-lg bg-blue-100 text-blue-800 text-sm">
            <p className="italic text-gray-600">You: {currentInputTranscription}</p>
          </div>
        )}
        {isMateoSpeaking && currentOutputTranscription && (
          <div className="self-start max-w-[80%] my-2 p-3 rounded-lg bg-gray-100 text-gray-800 text-sm">
            <p className="italic text-gray-600">Mateo: {currentOutputTranscription}</p>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 z-10 w-full bg-white border-t border-gray-200 p-4 flex flex-col items-center gap-4">
        <AudioWaveform analyser={analyserNode} isListening={isListening} />
        <MicButton
          isListening={isListening}
          isMateoSpeaking={isMateoSpeaking}
          onToggleListening={toggleListening}
          vadActive={vadActive}
        />
        <Controls
          gradeLevel={gradeLevel}
          speakingSpeed={speakingSpeed}
          onGradeLevelChange={handleGradeLevelChange}
          onSpeakingSpeedChange={handleSpeakingSpeedChange}
        />
      </footer>
    </div>
  );
};

export default App;