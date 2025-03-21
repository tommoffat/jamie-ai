export interface AudioSegment {
  blob: Blob;
  startTime: number;
  endTime: number;
}

// Simple utility to convert volume levels to dB for visualization
export function volumeToDecibels(volume: number, minDb = -60, maxDb = 0): number {
  // Avoid log(0)
  if (volume < 0.0001) return minDb;
  
  // Convert to dB scale (20 * log10(amplitude))
  const db = 20 * Math.log10(volume);
  
  // Clamp between min and max dB
  return Math.max(minDb, Math.min(maxDb, db));
}

export class SilenceDetector {
  private readonly minSilenceLength: number;
  private readonly silenceThreshold: number;
  private isSilent: boolean = false;
  private silenceStartTime: number = 0;

  constructor(silenceThreshold = 0.01, minSilenceLength = 1000) {
    this.silenceThreshold = silenceThreshold; // Volume threshold to consider as silence
    this.minSilenceLength = minSilenceLength; // Minimum silence duration in ms
  }

  detectSilence(volume: number, currentTime: number): boolean {
    const isSilentNow = volume < this.silenceThreshold;
    
    // Transition from sound to silence
    if (!this.isSilent && isSilentNow) {
      this.isSilent = true;
      this.silenceStartTime = currentTime;
      return false;
    }
    
    // Transition from silence to sound
    if (this.isSilent && !isSilentNow) {
      this.isSilent = false;
      return false;
    }
    
    // Check if silence has been long enough
    if (this.isSilent && currentTime - this.silenceStartTime >= this.minSilenceLength) {
      return true;
    }
    
    return false;
  }

  getThreshold(): number {
    return this.silenceThreshold;
  }

  reset() {
    this.isSilent = false;
    this.silenceStartTime = 0;
  }
}

// Calculate RMS (Root Mean Square) volume from audio buffer
export function calculateRMS(dataArray: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  return Math.sqrt(sum / dataArray.length);
}