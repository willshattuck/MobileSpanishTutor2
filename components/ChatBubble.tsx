import React, { useState, useRef } from 'react';
import { ChatMessage } from '../types';
import { getOrCreateOutputAudioContext, decodeAudioData, decode } from '../services/audioService';

interface ChatBubbleProps {
  message: ChatMessage;
  onReplayAudio: (audioBase64: string, playbackRate?: number) => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onReplayAudio }) => {
  const isUser = message.type === 'user';
  const bubbleClasses = isUser
    ? 'bg-blue-500 text-white self-end rounded-br-none'
    : 'bg-gray-200 text-gray-800 self-start rounded-bl-none';

  return (
    <div className={`flex flex-col max-w-[80%] my-2 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`p-3 rounded-lg shadow-md ${bubbleClasses} text-sm`}>
        <p>{message.text}</p>
        {message.audioBase64 && (
          <button
            onClick={() => onReplayAudio(message.audioBase64!)}
            className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-full flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197 2.132A1 1 0 0110 13.82V10.18a1 1 0 011.555-.832l3.197 2.132c.207.138.207.485 0 .623z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Play</span>
          </button>
        )}
      </div>
      <span className="text-xs text-gray-500 mt-1 px-1">{message.timestamp.toLocaleTimeString()}</span>
      {message.type === 'user' && message.confidence !== undefined && (
        <span className="text-xs text-gray-500 mt-1 px-1">Pronunciation Confidence: {(message.confidence * 100).toFixed(0)}%</span>
      )}
    </div>
  );
};

export default ChatBubble;
