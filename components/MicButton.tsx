import React from 'react';

interface MicButtonProps {
  isListening: boolean;
  isMateoSpeaking: boolean;
  onToggleListening: () => void;
  vadActive: boolean;
}

const MicButton: React.FC<MicButtonProps> = ({ isListening, isMateoSpeaking, onToggleListening, vadActive }) => {
  const buttonClasses = `
    w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out
    ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-500 hover:bg-indigo-600'}
    ${isMateoSpeaking ? 'opacity-70 cursor-not-allowed' : ''}
    ${isListening && vadActive ? 'animate-pulse' : ''}
  `;

  return (
    <button
      onClick={onToggleListening}
      disabled={isMateoSpeaking}
      className={buttonClasses}
      aria-label={isListening ? 'Stop listening' : 'Start listening'}
    >
      {isListening ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
};

export default MicButton;
