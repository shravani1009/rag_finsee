import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { textToSpeech } from '../utils/tts';

export default function PayPhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
      await speakText('Welcome to payment screen. Please enter the phone number and amount');
    };

    initAudio();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const handlePayment = async () => {
    if (phoneNumber.length !== 10) {
      speakText('Please enter a valid 10-digit phone number');
      return;
    }
    if (!amount || isNaN(Number(amount))) {
      speakText('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);
    await speakText(`Confirming payment of rupees ${amount} to ${phoneNumber}`);
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 8000));
      await speakText('Payment successful');
      setPhoneNumber('');
      setAmount('');
    } catch (error) {
      await speakText('Payment failed. Please try again');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pay via Phone Number</Text>
      
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="10-digit phone number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            maxLength={10}
            onBlur={() => {
              if (phoneNumber.length === 10) {
                speakText('Phone number entered. Please enter the amount');
              }
            }}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            onBlur={() => {
              if (amount && !isNaN(Number(amount))) {
                speakText(`Amount entered: ${amount} rupees`);
              }
            }}
          />
        </View>

        <TouchableOpacity 
          style={[
            styles.button,
            ((!phoneNumber || !amount) || isProcessing) && styles.buttonDisabled
          ]} 
          onPress={handlePayment}
          disabled={!phoneNumber || !amount || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Make Payment</Text>
          )}
        </TouchableOpacity>
      </View>
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
    gap: 15,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#B0C4DE',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  }
});
