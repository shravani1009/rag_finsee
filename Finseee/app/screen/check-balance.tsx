import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';
import { textToSpeech } from '../utils/tts';

export default function CheckBalanceScreen() {
  const [passcode, setPasscode] = useState('');
  const [balance, setBalance] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const CORRECT_PASSCODE = '1234'; // This should be stored securely in a real app

  const speakText = async (text: string) => {
    try {
      if (sound) await sound.unloadAsync();
      const newSound = await textToSpeech(text);
      setSound(newSound);
      await newSound.playAsync();
    } catch (error) {
      console.error('TTS Error:', error);
    }
  };

  useEffect(() => {
    const initAudio = async () => {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      await speakText('Welcome to check balance. Please enter your 4-digit passcode');
    };

    initAudio();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const fetchBalance = async () => {
    // Simulate balance fetch
    await new Promise(resolve => setTimeout(resolve, 2000));
    return 50000; // Mock balance
  };

  const handleCheckBalance = async () => {
    if (passcode.length !== 4) {
      speakText('Please enter a valid 4-digit passcode');
      return;
    }

    setIsProcessing(true);
    await speakText('Verifying passcode');

    try {
      if (passcode === CORRECT_PASSCODE) {
        const fetchedBalance = await fetchBalance();
        setBalance(fetchedBalance);
        await speakText(`Your current balance is ${fetchedBalance} rupees`);
      } else {
        await speakText('Incorrect passcode. Please try again');
        setPasscode('');
      }
    } catch (error) {
      await speakText('Failed to fetch balance. Please try again');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      {balance === null ? (
        <View style={styles.form}>
          <Text style={styles.title}>Enter Passcode</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 4-digit passcode"
            value={passcode}
            onChangeText={setPasscode}
            keyboardType="numeric"
            maxLength={4}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, isProcessing && styles.buttonDisabled]}
            onPress={handleCheckBalance}
            disabled={isProcessing || passcode.length !== 4}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Check Balance</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceTitle}>Current Balance</Text>
          <Text style={styles.balanceAmount}>₹{balance}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  form: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#4285F4',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#B0C4DE',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceTitle: {
    fontSize: 20,
    color: '#333',
    marginBottom: 10,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4285F4',
  },
});
