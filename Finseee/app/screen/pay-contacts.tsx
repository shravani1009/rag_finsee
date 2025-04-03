import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { textToSpeech } from '../utils/tts';

export default function PayContactsScreen() {
  const [selectedContact, setSelectedContact] = useState(null);
  const [amount, setAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const contacts = [
    { id: '1', name: 'John Smith' },
    { id: '2', name: 'Jack Wilson' },
    { id: '3', name: 'Emma Davis' },
    { id: '4', name: 'Sarah Johnson' },
    { id: '5', name: 'Michael Brown' },
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
      setTimeout(async () => {
        await speakText('Welcome to payment screen. Please select the contact and enter the amount');
      }, 1000);
    };

    initAudio();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const handleContactSelect = async (contact) => {
    setSelectedContact(contact);
    setShowSuccess(false);
    await speakText(`Selected contact ${contact.name}. Please enter the amount`);
  };

  const handlePayment = async () => {
    if (!amount) {
      speakText('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);
    await speakText(`Confirming payment of rupees ${amount} to ${selectedContact.name}`);
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      await speakText('Payment successful');
      setShowSuccess(true);
      setAmount('');
      setSelectedContact(null);
    } catch (error) {
      await speakText('Payment failed. Please try again');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      {showSuccess ? (
        <Text style={styles.successText}>Payment Successful!</Text>
      ) : (
        <>
          <Text style={styles.title}>Select Contact</Text>
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[
                  styles.contactItem,
                  selectedContact?.id === item.id && styles.selectedContact
                ]} 
                onPress={() => handleContactSelect(item)}
              >
                <Text style={styles.contactName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          
          {selectedContact && (
            <View style={styles.paymentContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter amount"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                onBlur={() => {
                  if (amount && !isNaN(Number(amount))) {
                    speakText(`Amount entered: ${amount} rupees`);
                  }
                }}
              />
              <TouchableOpacity 
                style={[styles.payButton, isProcessing && styles.buttonDisabled]}
                onPress={handlePayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.payButtonText}>Send Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  contactItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  selectedContact: {
    backgroundColor: '#e3efff',
  },
  contactName: {
    fontSize: 18,
  },
  paymentContainer: {
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    fontSize: 16,
  },
  payButton: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  payButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  successText: {
    fontSize: 24,
    color: 'green',
    textAlign: 'center',
    marginTop: 50,
  },
  buttonDisabled: {
    backgroundColor: '#B0C4DE',
  },
});
