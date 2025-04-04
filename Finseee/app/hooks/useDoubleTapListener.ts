import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { textToSpeech } from '../utils/tts';

export const useDoubleTapListener = () => {
  const router = useRouter();
  const [lastTap, setLastTap] = useState(0);
  const DOUBLE_TAP_DELAY = 300;

  return useCallback(async () => {
    const now = Date.now();
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      const sound = await textToSpeech('Going back to home');
      await sound.playAsync();
      setTimeout(() => {
        router.push('/screen/home');
      }, 1000);
    }
    setLastTap(now);
  }, [lastTap, router]);
};
