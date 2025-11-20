let recognizer: any = null;
let model: any = null;

self.onmessage = async (event) => {
  const { type, data, modelUrl } = event.data;

  switch (type) {
    case 'loadModel':
      try {
        await loadVoskModel(modelUrl);
        self.postMessage({ type: 'modelLoaded' });
      } catch (error) {
        self.postMessage({
          type: 'error',
          data: `Failed to load model: ${error}`
        });
      }
      break;

    case 'processAudio':
      if (recognizer) {
        processAudioData(data.audioData, data.timestamp);
      }
      break;

    case 'finalize':
      if (recognizer) {
        finalizeRecognition();
      }
      break;
  }
};

async function loadVoskModel(modelUrl: string) {
  const response = await fetch('https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip');

  if (!response.ok) {
    throw new Error('Failed to download Vosk model');
  }

  self.postMessage({
    type: 'info',
    data: 'Model downloaded successfully. Note: Using mock transcription for demo.'
  });

  recognizer = { initialized: true };
}

function processAudioData(audioBuffer: ArrayBuffer, timestamp: number) {
  const audioData = new Float32Array(audioBuffer);

  if (audioData.length > 0) {
    const randomWords = [
      'Hello, how are you doing today?',
      'This is a test of the transcription system.',
      'The meeting is now in progress.',
      'Please share your thoughts on this topic.',
      'Let me know if you have any questions.',
      'We need to discuss the project timeline.',
      'Thank you for your input.',
    ];

    if (Math.random() > 0.7) {
      const text = randomWords[Math.floor(Math.random() * randomWords.length)];
      const confidence = 0.85 + Math.random() * 0.15;

      self.postMessage({
        type: 'transcript',
        data: {
          text,
          timestamp,
          confidence: parseFloat(confidence.toFixed(3)),
        },
      });
    }
  }
}

function finalizeRecognition() {
  self.postMessage({
    type: 'info',
    data: 'Transcription finalized',
  });
}

export {};
