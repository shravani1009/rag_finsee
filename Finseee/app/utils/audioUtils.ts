const SARVAM_API_KEY = '9ede12ba-df25-4f8c-8429-eac58a72fc8f';

export const sendAudioToSarvam = async (audioUri: string, language: string = 'hi-IN'): Promise<string> => {
  try {
    const form = new FormData();
    form.append("file", {
      uri: audioUri,
      type: 'audio/wav',
      name: 'recording.wav'
    });
    form.append("model", "saarika:v2");
    form.append("language_code", language);
    form.append("domain", "finance"); // Add finance domain hint
    
    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'api-subscription-key': SARVAM_API_KEY
      },
      body: form
    });
    
    if (!response.ok) throw new Error('STT API failed');
    const data = await response.json();
    return data.transcript || '';
  } catch (error) {
    console.error('Sarvam API Error:', error);
    throw error;
  }
};
