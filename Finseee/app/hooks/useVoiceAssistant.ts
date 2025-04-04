import { useState, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { textToSpeech } from '../utils/tts';

export const useVoiceAssistant = () => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      if (sound) await sound.unloadAsync();
      const newSound = await textToSpeech(text);
      setSound(newSound);
      await newSound.playAsync();
    } catch (error) {
      console.error('TTS Error:', error);
    }
  }, [sound]);

  const initAudio = useCallback(async () => {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
  }, []);

  useEffect(() => {
    initAudio();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  return {
    speakText,
    sound,
  };
};
