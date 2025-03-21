'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioSegment } from '@/utils/audioProcessing';
import { TranscriptionResult, TranscriptionService } from '@/services/transcriptionService';
import { getTranscriptionService } from '@/services/transcriptionServiceFactory';

interface AudioRecorderProps {
  onTranscriptionUpdate: (result: TranscriptionResult) => void;
  onStreamChange?: (stream: MediaStream | null) => void;
  chunkInterval?: number; // In milliseconds
  transcriptionService?: TranscriptionService;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onTranscriptionUpdate,
  onStreamChange,
  chunkInterval = 6000, // Default to 6 seconds
  transcriptionService = getTranscriptionService()
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [pendingChunks, setPendingChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastChunkTimeRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>('audio/webm');
  const chunkCountRef = useRef<number>(0);
  
  // Helper function to check if browser is Safari
  const isSafari = () => {
    return (
      navigator.userAgent.includes('Safari') &&
      !navigator.userAgent.includes('Chrome')
    );
  };
  
  // Create a single blob with the right format for OpenAI
  const createAudioBlob = (chunks: Blob[]): Blob => {
    console.log(`AudioRecorder: Creating audio blob from ${chunks.length} chunks`);
    
    // Always force a consistent MIME type
    const finalType = 'audio/webm';
    const blob = new Blob(chunks, { type: finalType });
    
    console.log(`AudioRecorder: Blob created, size: ${blob.size} bytes, type: ${blob.type}`);
    return blob;
  };
  
  const processChunk = async () => {
    if (chunksRef.current.length === 0) {
      console.log("AudioRecorder: No chunks to process");
      return;
    }
    
    const currentTime = Date.now();
    console.log(`AudioRecorder: Processing ${chunksRef.current.length} chunks (chunk #${++chunkCountRef.current})`);
    
    // Clear any previous errors
    setError(null);
    
    try {
      setIsTranscribing(true);
      setPendingChunks(prev => prev + 1);
      
      // Make a copy of current chunks before clearing
      const chunksToProcess = [...chunksRef.current];
      
      // Get time info before clearing
      const chunkStartTime = lastChunkTimeRef.current || startTimeRef.current;
      
      // Clear chunks immediately to allow new chunks to accumulate
      chunksRef.current = [];
      
      // Update last chunk time
      lastChunkTimeRef.current = currentTime;
      
      // Create properly formatted blob
      const audioBlob = createAudioBlob(chunksToProcess);
      
      // Skip tiny segments
      if (currentTime - chunkStartTime < 500 || audioBlob.size < 100) {
        console.log("AudioRecorder: Segment too small, skipping transcription");
        setPendingChunks(prev => prev - 1);
        if (pendingChunks <= 1) {
          setIsTranscribing(false);
        }
        return;
      }
      
      // Create debug URL for audio testing (uncomment to test playback)
      /*
      const audioUrl = URL.createObjectURL(audioBlob);
      console.log(`AudioRecorder: Debug audio URL: ${audioUrl}`);
      const audio = new Audio(audioUrl);
      audio.play();
      */
      
      // Create audio segment
      const audioSegment: AudioSegment = {
        blob: audioBlob,
        startTime: chunkStartTime,
        endTime: currentTime
      };
      
      console.log(`AudioRecorder: Segment #${chunkCountRef.current} duration: ${(audioSegment.endTime - audioSegment.startTime) / 1000}s`);
      
      // Transcribe
      console.log(`AudioRecorder: Sending chunk #${chunkCountRef.current} for transcription`);
      
      try {
        const result = await transcriptionService.transcribe(audioSegment);
        
        // Update with result
        if (result.text.trim()) {
          console.log(`AudioRecorder: Transcription successful: "${result.text}"`);
          onTranscriptionUpdate({
            ...result,
            text: `${result.text} [Chunk #${chunkCountRef.current}]` // Add chunk number for debugging
          });
        } else {
          console.log("AudioRecorder: Empty transcription result");
        }
      } catch (error: unknown) {
        console.error("AudioRecorder: Transcription error:", error);
        setError(error instanceof Error ? error.message : "Unknown transcription error");
      }
    } catch (error: unknown) {
      console.error("AudioRecorder: Error processing chunk", error);
      setError("Error processing audio: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setPendingChunks(prev => Math.max(0, prev - 1));
      if (pendingChunks <= 1) {
        setIsTranscribing(false);
      }
    }
  };
  
  const startRecording = async () => {
    if (isRecording) {
      console.log("AudioRecorder: Already recording");
      return;
    }
    
    try {
      console.log("AudioRecorder: Starting recording");
      setError(null);
      
      // Reset state
      chunksRef.current = [];
      startTimeRef.current = Date.now();
      lastChunkTimeRef.current = startTimeRef.current;
      chunkCountRef.current = 0;
      
      // Request microphone access
      console.log("AudioRecorder: Requesting microphone");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;
      
      if (onStreamChange) {
        onStreamChange(stream);
      }
      
      // Determine best supported format
      let mimeType = '';
      
      // Safari has issues with some formats, so we need different handling
      if (isSafari()) {
        console.log("AudioRecorder: Safari detected, using audio/mp4");
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else {
        // Fall back to default (browser's choice)
        mimeType = '';
      }
      
      if (mimeType) {
        console.log(`AudioRecorder: Using explicit MIME type: ${mimeType}`);
        mimeTypeRef.current = mimeType;
      } else {
        console.log(`AudioRecorder: Using default MIME type`);
      }
      
      // Create media recorder with selected mime type
      const options = mimeType ? { mimeType } : undefined;
      
      try {
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        console.log(`AudioRecorder: MediaRecorder created with options: ${JSON.stringify(options || {})}`);
      } catch (e) {
        console.warn(`AudioRecorder: Failed to create MediaRecorder with ${mimeType}, falling back to default`);
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
      }
      
      if (mediaRecorderRef.current) {
        console.log(`AudioRecorder: MediaRecorder actual mimeType: ${mediaRecorderRef.current.mimeType}`);
        mimeTypeRef.current = mediaRecorderRef.current.mimeType;
      }
      
      // Set up event handlers
      mediaRecorderRef.current!.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`AudioRecorder: Got data: ${event.data.size} bytes, type: ${event.data.type || 'unknown'}`);
          chunksRef.current.push(event.data);
        }
      };
      
      // Start the recorder with frequent small chunks for better control
      mediaRecorderRef.current!.start(500);
      console.log("AudioRecorder: MediaRecorder started");
      
      // Set up processing timer
      console.log(`AudioRecorder: Setting up ${chunkInterval/1000}s processing interval`);
      const timer = setInterval(() => {
        console.log(`AudioRecorder: Timer triggered (${chunksRef.current.length} chunks available)`);
        if (chunksRef.current.length > 0) {
          processChunk();
        }
      }, chunkInterval);
      
      chunkTimerRef.current = timer;
      setIsRecording(true);
      console.log("AudioRecorder: Recording started successfully");
      
    } catch (error: unknown) {
      console.error("AudioRecorder: Failed to start recording", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError("Could not access microphone: " + errorMessage);
    }
  };
  
  const stopRecording = async () => {
    console.log("AudioRecorder: Stopping recording");
    
    // Clear timer
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
      console.log("AudioRecorder: Cleared chunk timer");
    }
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        // Request final data
        if (mediaRecorderRef.current.state === 'recording') {
          console.log("AudioRecorder: Requesting final data");
          mediaRecorderRef.current.requestData();
        }
        
        console.log("AudioRecorder: Stopping MediaRecorder");
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error("AudioRecorder: Error stopping MediaRecorder", e);
      }
    }
    
    // Stop all tracks
    if (streamRef.current) {
      try {
        console.log("AudioRecorder: Stopping audio tracks");
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        
        streamRef.current = null;
        if (onStreamChange) {
          onStreamChange(null);
        }
      } catch (e) {
        console.error("AudioRecorder: Error stopping tracks", e);
      }
    }
    
    // Process any remaining chunks with a delay to ensure all data arrives
    setTimeout(() => {
      if (chunksRef.current.length > 0) {
        console.log(`AudioRecorder: Processing ${chunksRef.current.length} remaining chunks`);
        processChunk();
      } else {
        console.log("AudioRecorder: No remaining chunks to process");
      }
      
      setIsRecording(false);
      console.log("AudioRecorder: Recording stopped completely");
    }, 1000);
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        console.log("AudioRecorder: Unmounting, cleaning up");
        stopRecording();
      }
    };
  }, []);
  
  return (
    <div className="flex flex-col items-center gap-4 p-4 rounded-lg bg-white shadow-sm">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`px-6 py-3 rounded-lg font-medium text-white transition-all
          ${isRecording 
            ? 'bg-red-500 hover:bg-red-600 active:bg-red-700' 
            : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
          }`}
        disabled={isTranscribing && !isRecording}
      >
        {isRecording ? 'Stop Listening' : 'Start Listening'}
      </button>
      
      <div className="flex items-center gap-2">
        {isTranscribing && (
          <div className="text-amber-600 animate-pulse flex items-center">
            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Transcribing...
          </div>
        )}
        
        <div className="text-sm text-gray-600">
          {isRecording 
            ? `Listening (processing every ${chunkInterval/1000}s)`
            : 'Ready to listen'
          }
        </div>
      </div>
      
      {error && (
        <div className="text-red-500 text-sm bg-red-50 p-2 rounded-md w-full">
          Error: {error}
        </div>
      )}
      
      <div className="text-xs text-gray-500 flex items-center gap-2">
        <span>Status:</span>
        {isRecording ? (
          <span className="text-green-600 font-medium flex items-center">
            <span className="inline-block h-2 w-2 bg-green-600 rounded-full mr-1 animate-pulse"></span>
            Recording ({mimeTypeRef.current})
          </span>
        ) : (
          <span className="text-gray-500">Idle</span>
        )}
        
        {isTranscribing && (
          <>
            <span className="mx-1">|</span>
            <span className="text-amber-600 font-medium">
              Processing {pendingChunks} chunk{pendingChunks !== 1 ? 's' : ''}
            </span>
          </>
        )}
        
        {isRecording && chunksRef.current.length > 0 && (
          <>
            <span className="mx-1">|</span>
            <span>
              {chunksRef.current.length} pending chunk{chunksRef.current.length !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
