import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import { textToSpeech } from '../utils/tts';

export default function BankTransferScreen() {
  const [selectedBank, setSelectedBank] = useState(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const banks = [
    { id: '1', name: 'State Bank of India' },
    { id: '2', name: 'HDFC Bank' },
    { id: '3', name: 'ICICI Bank' },
    { id: '4', name: 'Axis Bank' },
    { id: '5', name: 'Punjab National Bank' },
  ];

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
      // Add delay before welcome message
      setTimeout(async () => {
        await speakText('Welcome to bank transfer. Please select your bank and enter account details');
      }, 1000);
    };

    initAudio();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const handleBankSelect = async (bank) => {
    setSelectedBank(bank);
    await speakText(`Selected ${bank.name}. Please enter account number`);
  };

  const handleTransfer = async () => {
    if (!accountNumber || accountNumber.length < 8) {
      speakText('Please enter a valid account number');
      return;
    }
    if (!amount || isNaN(Number(amount))) {
      speakText('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);
    await speakText(`Confirming transfer of rupees ${amount} to account ${accountNumber} in ${selectedBank.name}`);
    
    try {
      // Simulate transfer processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      await speakText('Transfer successful');
      setShowSuccess(true);
      resetForm();
    } catch (error) {
      await speakText('Transfer failed. Please try again');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedBank(null);
    setAccountNumber('');
    setAmount('');
  };

  if (showSuccess) {
    return (
      <View style={styles.container}>
        <Text style={styles.successText}>Transfer Successful!</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Bank Transfer</Text>
      
      <View style={styles.bankList}>
        {banks.map((bank) => (
          <TouchableOpacity
            key={bank.id}
            style={[
              styles.bankItem,
              selectedBank?.id === bank.id && styles.selectedBank
            ]}
            onPress={() => handleBankSelect(bank)}
          >
            <Text style={styles.bankName}>{bank.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedBank && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Enter Account Number"
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="numeric"
            onBlur={() => {
              if (accountNumber.length >= 8) {
                speakText('Account number entered. Please enter amount');
              }
            }}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Enter Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            onBlur={() => {
              if (amount && !isNaN(Number(amount))) {
                speakText(`Amount entered: ${amount} rupees`);
              }
            }}
          />

          <TouchableOpacity
            style={[styles.button, isProcessing && styles.buttonDisabled]}
            onPress={handleTransfer}
            disabled={isProcessing || !accountNumber || !amount}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Transfer Money</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
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
    marginBottom: 20,
    color: '#4285F4',
    textAlign: 'center',
  },
  bankList: {
    marginBottom: 20,
  },
  bankItem: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 10,
  },
  selectedBank: {
    backgroundColor: '#e3efff',
    borderColor: '#4285F4',
  },
  bankName: {
    fontSize: 16,
  },
  form: {
    gap: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 15,
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
  successText: {
    fontSize: 24,
    color: 'green',
    textAlign: 'center',
    marginTop: 50,
  },
});
