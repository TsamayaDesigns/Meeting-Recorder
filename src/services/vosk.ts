export class VoskTranscriptionService {
  private worker: Worker | null = null;
  private onTranscriptCallback: ((text: string, timestamp: number, confidence: number) => void) | null = null;

  async initialize() {
    try {
      this.worker = new Worker(
        new URL('../workers/vosk-worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event) => {
        const { type, data } = event.data;

        if (type === 'transcript' && this.onTranscriptCallback) {
          this.onTranscriptCallback(data.text, data.timestamp, data.confidence);
        }

        if (type === 'error') {
          console.error('Vosk worker error:', data);
        }
      };

      await this.loadModel();
    } catch (error) {
      console.error('Failed to initialize Vosk:', error);
      throw error;
    }
  }

  private async loadModel() {
    if (!this.worker) return;

    this.worker.postMessage({
      type: 'loadModel',
      modelUrl: '/models/vosk-model-small-en-us-0.15.zip',
    });
  }

  processAudioChunk(audioData: Float32Array, timestamp: number) {
    if (!this.worker) {
      console.warn('Worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'processAudio',
      data: {
        audioData: audioData.buffer,
        timestamp,
      },
    }, [audioData.buffer]);
  }

  onTranscript(callback: (text: string, timestamp: number, confidence: number) => void) {
    this.onTranscriptCallback = callback;
  }

  finalize() {
    if (this.worker) {
      this.worker.postMessage({ type: 'finalize' });
    }
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const createAudioContext = () => {
  return new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: 16000,
  });
};

export const convertAudioToFloat32 = async (
  audioBlob: Blob,
  onChunk: (chunk: Float32Array, timestamp: number) => void
): Promise<void> => {
  const audioContext = createAudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channelData = audioBuffer.getChannelData(0);
  const chunkSize = 8000;

  for (let i = 0; i < channelData.length; i += chunkSize) {
    const chunk = channelData.slice(i, Math.min(i + chunkSize, channelData.length));
    const timestamp = Math.floor((i / audioBuffer.sampleRate) * 1000);
    onChunk(chunk, timestamp);
  }

  await audioContext.close();
};
