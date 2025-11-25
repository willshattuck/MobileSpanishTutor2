export enum GradeLevel {
  BEGINNER = 'Beginner (A1/A2)',
  INTERMEDIATE = 'Intermediate (B1/B2)',
  ADVANCED = 'Advanced (C1/C2)',
}

export enum SpeakingSpeed {
  SLOW = 'Slow',
  NORMAL = 'Normal',
  FAST = 'Fast',
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'mateo';
  text: string;
  audioBase64?: string;
  timestamp: Date;
  confidence?: number; // Placeholder for future pronunciation scoring
}

export interface VadState {
  isSpeaking: boolean;
  silenceStartTime: number;
  speechDuration: number;
}
