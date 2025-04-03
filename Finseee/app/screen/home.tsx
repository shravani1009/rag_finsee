// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { textToSpeech } from '../utils/tts';

const ServiceButton = ({ icon, title, onPress }) => (
  <TouchableOpacity style={styles.serviceButton} onPress={onPress}>
    <Ionicons name={icon} size={24} color="#4285F4" />
    <Text style={styles.serviceText}>{title}</Text>
  </TouchableOpacity>
);

const HomeScreen = () => {
  const router = useRouter();
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const DOUBLE_TAP_DELAY = 300;

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

      const welcomeMessage = 'Welcome to FinSee. Double tap anywhere to start recording, and double tap again to stop.';
      const sound = await textToSpeech(welcomeMessage);
      await sound.playAsync();

      return () => {
        sound.unloadAsync();
      };
    })();
  }, []);

  const handleDoubleTap = async () => {
    const now = Date.now();
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      router.push({
        pathname: '/screen/assistance',
        params: { autoStart: true }
      });
    }
    setLastTap(now);
  };

  const startRecording = async () => {
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
      setIsRecording(true);
      const sound = await textToSpeech('Recording started. Double tap again to stop.');
      await sound.playAsync();
    } catch (error) {
      console.error('Recording Error:', error);
      const sound = await textToSpeech('Failed to start recording. Please try again.');
      await sound.playAsync();
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      const sound = await textToSpeech('Processing your request');
      await sound.playAsync();
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        router.push('/screen/assistance');
      }
    } catch (error) {
      console.error('Error:', error);
      const sound = await textToSpeech('Failed to process audio. Please try again.');
      await sound.playAsync();
    } finally {
      setRecording(null);
      setIsRecording(false);
    }
  };

  const services = [
    { icon: 'qr-code-outline', title: 'Scan QR code', route: '/screen/scan-qr' },
    { icon: 'phone-portrait-outline', title: 'Pay phone number', route: '/screen/pay-phone' },
    { icon: 'people-outline', title: 'Pay contacts', route: '/screen/pay-contacts' },
    { icon: 'business-outline', title: 'Bank transfer', route: '/screen/bank-transfer' },
    { icon: 'wallet-outline', title: 'Check Balance', route: '/screen/check-balance' },
    { icon: 'headset-outline', title: 'Assistance', route: '/screen/assistance' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.fullScreenTouchable}
        onPress={handleDoubleTap}
        activeOpacity={1}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Home</Text>
          <TouchableOpacity onPress={() => router.push('/screen/profile')}>
            <Ionicons name="person-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Banking Services</Text>

        <View style={styles.servicesContainer}>
          {services.map((service, index) => (
            <ServiceButton
              key={index}
              icon={service.icon}
              title={service.title}
              onPress={() => router.push(service.route)}
            />
          ))}
        </View>

        <View style={styles.assistantBar}>
          <View style={styles.assistantContent}>
            <Ionicons name="headset" size={24} color="white" />
            <View>
              <Text style={styles.assistantTitle}>FinSee</Text>
              <Text style={styles.assistantSubtitle}>
                {isRecording ? 'Listening...' : 'Double tap anywhere to start'}
              </Text>
            </View>
          </View>
          <Ionicons
            name={isRecording ? 'radio' : 'mic-outline'}
            size={24}
            color="white"
          />
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4285F4',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  sectionTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
    padding: 16,
  },
  servicesContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    margin: 16,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceButton: {
    width: '46%',
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceText: {
    marginTop: 8,
    color: '#4B5563',
    textAlign: 'center',
  },
  assistantBar: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assistantContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assistantTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  assistantSubtitle: {
    color: 'white',
    opacity: 0.8,
  },
  fullScreenTouchable: {
    flex: 1,
    width: '100%',
  },
});

export default HomeScreen;