import { AudioSegment } from '@/utils/audioProcessing';

export interface TranscriptionResult {
  text: string;
  startTime: number;
  endTime: number;
}

export interface TranscriptionService {
  transcribe(audioSegment: AudioSegment): Promise<TranscriptionResult>;
}

export class WhisperTranscriptionService implements TranscriptionService {
  private apiKey: string;
  private apiEndpoint: string = 'https://api.openai.com/v1/audio/transcriptions';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async transcribe(audioSegment: AudioSegment): Promise<TranscriptionResult> {
    try {
      console.log(`WhisperService: Transcribing segment (${audioSegment.endTime - audioSegment.startTime}ms)`);
      
      // Check if blob is valid
      if (audioSegment.blob.size === 0) {
        throw new Error("Empty audio blob");
      }
      
      const formData = new FormData();
      
      // Force extension to webm for consistency
      const filename = "audio.webm";
      console.log(`WhisperService: Using filename ${filename} for blob type ${audioSegment.blob.type}`);
      
      // Create a new blob with explicit type to ensure consistency
      const newBlob = new Blob([audioSegment.blob], { type: 'audio/webm' });
      
      // Append as a File object with correct filename
      const file = new File([newBlob], filename, { type: 'audio/webm' });
      formData.append('file', file);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      
      // Log the request payload for debugging
      console.log(`WhisperService: Sending file of size ${file.size} bytes, type ${file.type}`);
      
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`WhisperService: Error ${response.status} - ${response.statusText}`);
        console.error(`WhisperService: Error details: ${errorText}`);
        throw new Error(`Transcription failed (${response.status}): ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`WhisperService: Received result - "${result.text}"`);
      
      return {
        text: result.text,
        startTime: audioSegment.startTime,
        endTime: audioSegment.endTime
      };
    } catch (error) {
      console.error('WhisperService: Transcription error:', error);
      throw error;
    }
  }
}

// Mock service for development/testing without using API credits
export class MockTranscriptionService implements TranscriptionService {
  async transcribe(audioSegment: AudioSegment): Promise<TranscriptionResult> {
    // Simulate API delay - shorter for testing
    console.log(`MockService: Pretending to transcribe segment (${audioSegment.endTime - audioSegment.startTime}ms)`);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockText = `This is a mock transcription for ${Math.round((audioSegment.endTime - audioSegment.startTime) / 1000)} seconds of audio recorded at ${new Date(audioSegment.startTime).toLocaleTimeString()}`;
    console.log(`MockService: Returning mock text - "${mockText}"`);
    
    return {
      text: mockText,
      startTime: audioSegment.startTime,
      endTime: audioSegment.endTime
    };
  }
}

// Factory to get the right service based on configuration
export function createTranscriptionService(apiKey: string, useMock: boolean = false): TranscriptionService {
  if (useMock) {
    console.log('Using mock transcription service');
    return new MockTranscriptionService();
  }
  
  if (!apiKey) {
    console.warn('No API key provided, falling back to mock service');
    return new MockTranscriptionService();
  }
  
  console.log('Using OpenAI Whisper transcription service');
  return new WhisperTranscriptionService(apiKey);
}
