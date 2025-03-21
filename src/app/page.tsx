'use client';

import { useState } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import TranscriptionDisplay from '@/components/TranscriptionDisplay';
import { TranscriptionResult } from '@/services/transcriptionService';

export default function Home() {
  const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>([]);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  
  const handleTranscriptionUpdate = (result: TranscriptionResult) => {
    console.log(`Home: Received new transcription: "${result.text}"`);
    setTranscriptions(prev => [...prev, result]);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-center mb-4">Jamie AI</h1>
        
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Audio Input</h2>
          <AudioRecorder 
            onTranscriptionUpdate={handleTranscriptionUpdate}
            onStreamChange={setAudioStream}
            chunkInterval={6000} // 6 seconds
          />
        </div>
        
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Transcription</h2>
          <TranscriptionDisplay transcriptions={transcriptions} />
        </div>
      </div>
    </main>
  );
}
