import { TranscriptionService, MockTranscriptionService, WhisperTranscriptionService } from './transcriptionService';

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
const USE_MOCK_SERVICE = process.env.NEXT_PUBLIC_USE_MOCK_SERVICES === 'true';

export function getTranscriptionService(): TranscriptionService {
  if (USE_MOCK_SERVICE) {
    console.log('Factory: Using mock transcription service');
    return new MockTranscriptionService();
  }
  
  if (!OPENAI_API_KEY) {
    console.warn('Factory: OpenAI API key not found, falling back to mock service');
    return new MockTranscriptionService();
  }
  
  console.log('Factory: Using OpenAI Whisper transcription service');
  return new WhisperTranscriptionService(OPENAI_API_KEY);
}