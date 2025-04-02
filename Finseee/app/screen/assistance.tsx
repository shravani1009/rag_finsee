import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useRouter } from 'expo-router';
import { textToSpeech } from '../utils/tts';

const SARVAM_API_KEY = '9ede12ba-df25-4f8c-8429-eac58a72fc8f'; // Replace with your actual API key
const BACKEND_URL = 'http://192.168.29.114:5000';  // Update with your local IP

export default function AssistanceScreen() {
  const router = useRouter();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [translation, setTranslation] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [responseSound, setResponseSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow microphone access');
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    })();
  }, []);

  // Cleanup sounds on unmount
  useEffect(() => {
    return () => {
      if (responseSound) {
        responseSound.unloadAsync();
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [responseSound, sound]);

  const startListening = async () => {
    try {
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 16000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 16000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });
      setRecording(recording);
      setIsListening(true);
      setSpokenText('Recording...');
      setAudioUri(null);
      setTranslation('');
    } catch (error) {
      console.error('Recording Error:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const sendAudioToSarvam = async (audioUri: string) => {
    try {
      const form = new FormData();
      
      form.append("file", {
        uri: audioUri,
        type: 'audio/wav',
        name: 'recording.wav'
      });
      
      form.append("model", "saarika:v2");
      form.append("language_code", "hi-IN");
      form.append("with_timestamps", "false");
      form.append("with_diarization", "false");
      form.append("num_speakers", "1");

      console.log('Preparing to send WAV file:', audioUri);
      
      const response = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'api-subscription-key': SARVAM_API_KEY
        },
        body: form
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Sarvam API Response:', data);
      
      return data.transcript || '';
    } catch (error) {
      console.error('Sarvam API Error:', error);
      throw error;
    }
  };

  const processTranscript = async (text: string) => {
    try {
      setIsLoading(true);
      console.log('Processing:', text);

      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text })
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      console.log('Server response:', data);

      if (data.status === 'success') {
        const { response: aiResponse, action } = data.data;
        setSpokenText(aiResponse);
        
        // Convert response to speech using Sarvam AI
        try {
          if (responseSound) {
            await responseSound.unloadAsync();
          }
          const newSound = await textToSpeech(aiResponse);
          setResponseSound(newSound);
          await newSound.playAsync();
          
          // Handle navigation after speech starts
          if (action && action !== 'none') {
            setTimeout(() => {
              router.push(action);
            }, 1000); // Give speech a chance to start before navigation
          }
        } catch (ttsError) {
          console.error('TTS error:', ttsError);
        }
      }
    } catch (error) {
      console.error('Processing error:', error);
      Alert.alert('Error', 'Failed to process your request');
    } finally {
      setIsLoading(false);
    }
  };

  const stopListening = async () => {
    if (!recording || !isListening) return;
    
    try {
      setIsLoading(true);
      setIsListening(false);
      
      const status = await recording.getStatusAsync();
      if (status.isRecording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        
        if (uri) {
          setAudioUri(uri);
          const transcript = await sendAudioToSarvam(uri);
          setSpokenText('Processing...');
          await processTranscript(transcript);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to process audio');
    } finally {
      setIsLoading(false);
      setRecording(null);
    }
  };

  const playSound = async () => {
    try {
      if (!audioUri) return;
      if (sound) {
        await sound.unloadAsync();
      }
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: audioUri });
      setSound(newSound);
      setIsPlaying(true);
      await newSound.playAsync();
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finsee Assistant</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.status}>
          {isLoading ? 'Processing...' : 
           isListening ? 'Listening...' : 
           'Tap to start speaking'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Processing audio...</Text>
        </View>
      ) : (
        <Text style={styles.transcription}>{spokenText}</Text>
      )}

      <TouchableOpacity
        style={[styles.button, isListening && styles.buttonListening]}
        onPress={isListening ? stopListening : startListening}
      >
        <Text style={styles.buttonText}>
          {isListening ? 'Stop Recording' : 'Start Recording'}
        </Text>
      </TouchableOpacity>

      {audioUri && (
        <TouchableOpacity 
          style={[styles.button, isPlaying && styles.buttonPlaying]}
          onPress={playSound}
        >
          <Text style={styles.buttonText}>
            {isPlaying ? 'Playing...' : 'Play Recording'}
          </Text>
        </TouchableOpacity>
      )}

      {translation && (
        <Text style={styles.translation}>
          Translation: {translation}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#4285F4',
  },
  transcription: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 25,
    marginTop: 20,
  },
  buttonListening: {
    backgroundColor: '#DC3545',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonPlaying: {
    backgroundColor: '#28a745',
  },
  translation: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  statusContainer: {
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    color: '#666',
  },
});
