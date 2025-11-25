import React, { useRef, useEffect } from 'react';

interface AudioWaveformProps {
  analyser: AnalyserNode | null;
  isListening: boolean;
}

const AudioWaveform: React.FC<AudioWaveformProps> = ({ analyser, isListening }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!analyser || !isListening) {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear if not listening
        return;
      }

      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6366f1'; // Indigo-500

      ctx.beginPath();
      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      animationFrameId.current = requestAnimationFrame(draw);
    };

    if (analyser && isListening) {
      draw();
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear when not listening
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [analyser, isListening]);

  return <canvas ref={canvasRef} className="w-full h-16 bg-gray-50 rounded-lg"></canvas>;
};

export default AudioWaveform;
