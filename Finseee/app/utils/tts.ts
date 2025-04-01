import { Audio } from 'expo-av';

const SARVAM_API_KEY = '9ede12ba-df25-4f8c-8429-eac58a72fc8f';

export async function textToSpeech(text: string): Promise<Audio.Sound> {
  try {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': SARVAM_API_KEY
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: 'en-IN',
        speaker: 'vidya',
        pitch: 0,
        pace: 0.9,
        loudness: 1.5,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: 'bulbul:v2'
      })
    };

    const response = await fetch('https://api.sarvam.ai/text-to-speech', options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API Error:', errorText);
      throw new Error('TTS API failed');
    }

    const { audios, request_id } = await response.json();
    console.log('TTS Request ID:', request_id);
    
    if (!audios || !audios[0]) {
      throw new Error('No audio data received');
    }

    // Convert base64 to URI
    const audioUri = `data:audio/wav;base64,${audios[0]}`;
    const { sound } = await Audio.Sound.createAsync(
      { uri: audioUri },
      { shouldPlay: false }
    );

    return sound;
  } catch (error) {
    console.error('TTS Error:', error);
    throw error;
  }
}
