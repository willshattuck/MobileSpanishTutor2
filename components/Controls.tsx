import React from 'react';
import { GradeLevel, SpeakingSpeed } from '../types';

interface ControlsProps {
  gradeLevel: GradeLevel;
  speakingSpeed: SpeakingSpeed;
  onGradeLevelChange: (level: GradeLevel) => void;
  onSpeakingSpeedChange: (speed: SpeakingSpeed) => void;
}

const Controls: React.FC<ControlsProps> = ({
  gradeLevel,
  speakingSpeed,
  onGradeLevelChange,
  onSpeakingSpeedChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 p-4 bg-gray-100 border-t border-gray-200">
      <div className="flex items-center gap-2">
        <label htmlFor="grade-level" className="text-sm font-medium text-gray-700">
          Grade:
        </label>
        <select
          id="grade-level"
          value={gradeLevel}
          onChange={(e) => onGradeLevelChange(e.target.value as GradeLevel)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-1"
        >
          {Object.values(GradeLevel).map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="speaking-speed" className="text-sm font-medium text-gray-700">
          Speed:
        </label>
        <select
          id="speaking-speed"
          value={speakingSpeed}
          onChange={(e) => onSpeakingSpeedChange(e.target.value as SpeakingSpeed)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-1"
        >
          {Object.values(SpeakingSpeed).map((speed) => (
            <option key={speed} value={speed}>
              {speed}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default Controls;
