'use client';

import { useEffect, useRef } from 'react';
import { TranscriptionResult } from '@/services/transcriptionService';

interface TranscriptionDisplayProps {
  transcriptions: TranscriptionResult[];
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({ transcriptions }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to the bottom when new transcriptions arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcriptions]);

  if (transcriptions.length === 0) {
    return (
      <div className="w-full h-64 border border-gray-200 rounded-lg p-4 bg-gray-50 overflow-y-auto">
        <p className="text-gray-400 italic">No transcriptions yet. Start listening to see content here.</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-64 border border-gray-200 rounded-lg p-4 bg-white overflow-y-auto shadow-sm"
    >
      {transcriptions.map((result, index) => (
        <div key={index} className="mb-3 pb-3 border-b border-gray-100 last:border-0">
          <div className="text-xs text-gray-500 mb-1">
            {new Date(result.startTime).toLocaleTimeString()} - {new Date(result.endTime).toLocaleTimeString()} 
            ({((result.endTime - result.startTime) / 1000).toFixed(1)}s)
          </div>
          <p className="text-gray-800">
            {result.text}
          </p>
        </div>
      ))}
    </div>
  );
};

export default TranscriptionDisplay;
