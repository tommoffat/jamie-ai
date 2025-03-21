'use client';

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) {
      // Clean up if stream is null
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
        analyserRef.current = null;
      }
      
      // Clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgb(30, 30, 30)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
      
      return;
    }
    
    // Set up visualization when stream is available
    const setupVisualization = async () => {
      try {
        // Create audio context if it doesn't exist
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        
        const audioContext = audioContextRef.current;
        
        // Create analyser if it doesn't exist
        if (!analyserRef.current) {
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;
        }
        
        const analyser = analyserRef.current;
        
        // Connect stream to analyser
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        // Start visualization
        visualize();
      } catch (err) {
        console.error('Error setting up audio visualization:', err);
      }
    };
    
    setupVisualization();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [stream]);

  const visualize = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = 'rgb(30, 30, 30)';
      ctx.fillRect(0, 0, width, height);
      
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 255 * height;
        
        const r = 100 + (barHeight * 0.7);
        const g = 50 + (barHeight * 0.5);
        const b = 150;
        
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
    };
    
    draw();
  };

  return (
    <div className="flex flex-col items-center">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={200} 
        className="border border-gray-300 rounded-lg"
      />
    </div>
  );
};

export default AudioVisualizer;