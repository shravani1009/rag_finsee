import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { textToSpeech } from '../utils/tts';
import { storeUserData } from '../utils/storage';
import VoiceManager from '../utils/voiceManager';
import { sendAudioToSarvam } from '../utils/audioUtils';

const BACKEND_URL = 'http://192.168.0.109:5000';

export default function RegistrationScreen() {
  const router = useRouter();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [currentStep, setCurrentStep] = useState('phone');
  const [formData, setFormData] = useState({
    phone: '',
    otp: '',
    upiPin: '',
  });
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const silenceTimeout = useRef<NodeJS.Timeout>();
  const processingRef = useRef(false);
  const voiceManager = VoiceManager.getInstance();
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [doubleTapTimer, setDoubleTapTimer] = useState<NodeJS.Timeout | null>(null);
  const TAP_TIMEOUT = 300;
  const [tapHistory, setTapHistory] = useState<number[]>([]);
  const TAP_WINDOW = 1000;

  useEffect(() => {
    checkAccessibilityMode();
    return () => cleanup();
  }, []);

  const checkAccessibilityMode = async () => {
    const userData = await getUserData();
    const isAccessible = userData?.accessibilityMode || false;
    setAccessibilityMode(isAccessible);
    if (isAccessible) {
      await setupAudio();
      await startAssistant();
    }
  };

  const setupAudio = async () => {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
  };

  const cleanup = () => {
    if (sound) sound.unloadAsync();
    if (recording) recording.stopAndUnloadAsync();
    if (silenceTimeout.current) clearTimeout(silenceTimeout.current);
  };

  const startAssistant = async () => {
    await speakText('Welcome to registration. Please tell me your phone number.');
    await startListening();
  };

  const speakText = async (text: string) => {
    try {
      if (sound) await sound.unloadAsync();
      const newSound = await textToSpeech(text);
      setSound(newSound);
      await newSound.playAsync();
      return new Promise((resolve) => {
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) resolve(true);
        });
      });
    } catch (error) {
      console.error('TTS Error:', error);
    }
  };

  const startListening = async () => {
    if (isListening) return;
    try {
      setIsListening(true);
      await voiceManager.startRecording(() => {
        if (isListening) {
          stopListening();
        }
      });
    } catch (error) {
      console.error('Recording Error:', error);
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      const uri = await voiceManager.stopRecording();
      setIsListening(false);
      
      if (uri) {
        await processAudio(uri);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const processAudio = async (audioUri: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUri,
          currentStep,
          formData,
        }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        await handleResponse(data.data);
      }
    } catch (error) {
      console.error('Processing Error:', error);
      await speakText('Sorry, I could not process that. Please try again.');
      startListening();
    }
  };

  const handleResponse = async (data: any) => {
    const { step, value, message } = data;
    
    if (!value && step !== 'complete') {
      await speakText('I did not understand. Please try again.');
      startListening();
      return;
    }

    await speakText(message);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (value) {
      const updatedFormData = { ...formData, [step]: value };
      setFormData(updatedFormData);
      
      if (step === 'complete') {
        try {
          await storeUserData({
            phone: updatedFormData.phone,
            upiPin: updatedFormData.upiPin,
            isRegistered: true,
          });
          const userData = await getUserData();
          if (userData?.isRegistered) {
            await speakText('Registration complete. Taking you to the home screen.');
            router.replace('/screen/home');
          } else {
            await speakText('There was an error saving your data. Please try again.');
            startListening();
          }
        } catch (error) {
          console.error('Error storing completion data:', error);
          await speakText('There was an error. Please try again.');
          startListening();
        }
      }
    }

    if (step !== 'complete') {
      setCurrentStep(step);
      setTimeout(() => {
        startListening();
      }, 1000);
    }
  };

  const handleScreenTouch = () => {
    if (!accessibilityMode) return;

    const now = Date.now();
    const recentTaps = [...tapHistory, now].filter(tap => now - tap < TAP_WINDOW);
    setTapHistory(recentTaps);

    if (recentTaps.length === 2) { // Double tap
      setTapHistory([]); // Reset taps
      handleDoubleTap();
    }
  };

  const handleDoubleTap = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      if (isListening) {
        await stopListening();
      } else {
        await startListening();
      }
    } catch (error) {
      console.error('Double tap handling error:', error);
    }
  };

  const startRecording = async () => {
    if (isListening || isProcessing) return;
    
    try {
      setIsProcessing(true);
      await voiceManager.waitForSpeechToFinish();
      
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.wav',
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      setRecording(recording);
      setIsListening(true);
      await speakText('Listening. Double tap when done speaking.');
    } catch (error) {
      console.error('Recording error:', error);
      await speakText('Failed to start recording. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const stopAndProcessRecording = async () => {
    if (!recording || !isListening) return;
    
    try {
      setIsProcessing(true);
      setIsListening(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        const transcript = await sendAudioToSarvam(uri);
        await processVoiceInput(transcript);
      }
    } catch (error) {
      console.error('Processing error:', error);
      await speakText('Failed to process. Please try again.');
    } finally {
      setRecording(null);
      setIsProcessing(false);
    }
  };

  const processVoiceInput = async (transcript: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/process-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          currentStep,
          context: 'registration',
          formData
        })
      });

      const data = await response.json();
      if (data.status === 'success') {
        const { value, message, needs_confirmation } = data.data;
        
        if (needs_confirmation) {
          setPendingConfirmation(data.data);
          await speakText(`${message}. Double tap to confirm or speak again to retry.`);
        } else {
          await handleResponse(data.data);
        }
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      await speakText('Sorry, please try again.');
    }
  };

  return (
    <View 
      style={styles.container} 
      onTouchEnd={handleScreenTouch}
      accessible={true}
      accessibilityHint={
        isListening 
          ? "Double tap to stop recording" 
          : "Double tap to start recording"
      }
    >
      <Text style={styles.title}>Registration</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={formData.phone}
          editable={false}
        />
        {currentStep === 'otp' && (
          <TextInput
            style={styles.input}
            placeholder="OTP"
            value={formData.otp}
            editable={false}
          />
        )}
        {currentStep === 'upiPin' && (
          <TextInput
            style={styles.input}
            placeholder="UPI PIN"
            value={formData.upiPin}
            editable={false}
            secureTextEntry
          />
        )}
      </View>
      <Text style={styles.status}>
        {isListening ? 'Listening...' : 'Processing...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#4285F4',
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
  },
  status: {
    marginTop: 20,
    textAlign: 'center',
    color: '#666',
  },
});
