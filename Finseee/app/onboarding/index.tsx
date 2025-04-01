import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { textToSpeech } from '../utils/tts';
import { storeUserData } from '../utils/storage';
import VoiceManager from '../utils/voiceManager';

const LANGUAGES = ['English', 'Hindi', 'Telugu', 'Tamil'];
const TAP_TIMEOUT = 300; // Reduced timeout for better responsiveness

export default function OnboardingScreen() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [accessibilityMode, setAccessibilityMode] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const voiceManager = VoiceManager.getInstance();
  const [tapHistory, setTapHistory] = useState<number[]>([]);
  const TAP_WINDOW = 1000; // 1 second window for multi-taps

  useEffect(() => {
    playWelcomeMessage();
    return () => cleanup();
  }, []);

  const cleanup = async () => {
    if (sound) {
      await sound.unloadAsync();
    }
    voiceManager.cleanup();
  };

  const playWelcomeMessage = async () => {
    const welcomeMsg = `Welcome to Finsee. Here's how to use the app:
    Triple tap anywhere to enable or disable accessibility mode.
    In accessibility mode, double tap to speak and double tap again to stop.
    Please select your preferred language to continue.`;
    await speakText(welcomeMsg);
  };

  const speakText = async (text: string) => {
    try {
      await voiceManager.waitForSpeechToFinish();
      if (sound) await sound.unloadAsync();
      voiceManager.setSpeaking(true);
      const newSound = await textToSpeech(text);
      setSound(newSound);
      await newSound.playAsync();
      return new Promise<void>((resolve) => {
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            voiceManager.setSpeaking(false);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('TTS Error:', error);
      voiceManager.setSpeaking(false);
    }
  };

  const handleScreenTouch = async () => {
    const now = Date.now();
    const recentTaps = [...tapHistory, now].filter(tap => now - tap < TAP_WINDOW);
    setTapHistory(recentTaps);

    if (recentTaps.length === 3) { // Triple tap detected
      setTapHistory([]); // Reset taps
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newAccessibilityMode = !accessibilityMode;
      setAccessibilityMode(newAccessibilityMode);
      await storeUserData({ accessibilityMode: newAccessibilityMode });
      await speakText(
        newAccessibilityMode 
          ? 'Accessibility mode enabled. Double tap anywhere to start speaking.' 
          : 'Accessibility mode disabled.'
      );
    } else if (recentTaps.length === 2 && accessibilityMode) { // Double tap in accessibility mode
      setTapHistory([]); // Reset taps
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (voiceManager.isRecording) {
        await voiceManager.stopRecording();
        setIsListening(false);
      } else {
        await startRecording();
        setIsListening(true);
      }
    }
  };

  const startRecording = async () => {
    try {
      await voiceManager.waitForSpeechToFinish();
      await voiceManager.startRecording(async () => {
        if (isListening) {
          const uri = await voiceManager.stopRecording();
          if (uri) {
            const transcript = await sendAudioToSarvam(uri);
            await processVoiceInput(transcript);
          }
        }
      });
    } catch (error) {
      console.error('Recording error:', error);
    }
  };

  const handleLanguageSelect = async (language: string) => {
    setSelectedLanguage(language);
    await storeUserData({
      language: language.toLowerCase(),
      isRegistered: false,
    });
    
    if (accessibilityMode) {
      await speakText(
        `You have selected ${language}. Triple tap anywhere to disable accessibility mode, or double tap to continue to registration.`
      );
    }
    
    if (!accessibilityMode) {
      router.push('/onboarding/registration');
    }
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={handleScreenTouch}
      activeOpacity={1}
    >
      <Text style={styles.title}>Select Language</Text>
      <View style={styles.languageGrid}>
        {LANGUAGES.map((language) => (
          <TouchableOpacity
            key={language}
            style={[
              styles.languageButton,
              selectedLanguage === language && styles.selectedButton
            ]}
            onPress={() => handleLanguageSelect(language)}
          >
            <Text style={[
              styles.languageText,
              selectedLanguage === language && styles.selectedLanguageText
            ]}>
              {language}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.instructions}>
        {accessibilityMode 
          ? 'Triple tap to exit accessibility mode\nDouble tap to speak'
          : 'Triple tap to enable accessibility mode'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#4285F4',
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
  },
  languageButton: {
    padding: 15,
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    width: '45%',
    alignItems: 'center',
    marginBottom: 15,
  },
  selectedButton: {
    backgroundColor: '#4285F4',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
  },
  instructions: {
    marginTop: 40,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  selectedLanguageText: {
    color: '#fff'
  },
});
