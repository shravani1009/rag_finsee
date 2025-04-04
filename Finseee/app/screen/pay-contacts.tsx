import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, TouchableWithoutFeedback } from 'react-native';
import { Audio } from 'expo-av';
import { textToSpeech } from '../utils/tts';
import * as Speech from 'expo-speech';
import Voice from '@react-native-voice/voice';
import { useRouter } from 'expo-router';

const SARVAM_API_KEY = '9ede12ba-df25-4f8c-8429-eac58a72fc8f';

export default function PayContactsScreen() {
  const router = useRouter();
  const [selectedContact, setSelectedContact] = useState(null);
  const [amount, setAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const DOUBLE_TAP_DELAY = 300;
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

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

    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechResults = onSpeechResults;

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const onSpeechStart = () => {
    setIsRecording(true);
  };

  const onSpeechEnd = () => {
    setIsRecording(false);
  };

  const onSpeechResults = (e) => {
    const spokenText = e.value[0].toLowerCase();
    processVoiceCommand(spokenText);
  };

  const handleGeneralCommands = async (command: string) => {
    const normalizedCommand = command.toLowerCase();
    console.log("Processing general command:", normalizedCommand);

    // Navigation commands
    if (normalizedCommand.includes('back') || 
        normalizedCommand.includes('home') || 
        normalizedCommand.includes('return')) {
      await speakText('Going back to home screen');
      router.push('/screen/home');
      return true;
    }

    // Contact list request
    if (normalizedCommand.includes('contacts') || 
        normalizedCommand.includes('list') || 
        normalizedCommand.includes('show contacts')) {
      const contactList = contacts.map(c => c.name).join(', ');
      await speakText(`Here are your contacts: ${contactList}`);
      return true;
    }

    // Help command
    if (normalizedCommand.includes('help')) {
      await speakText('You can say: pay to followed by a contact name, or say an amount to pay, or ask me to list contacts, or say go back to home');
      return true;
    }

    return false;
  };

  const processVoiceCommand = async (transcript: string) => {
    const command = transcript.toLowerCase();
    console.log("Received command:", command);

    // First check for general commands
    const wasGeneralCommand = await handleGeneralCommands(command);
    if (wasGeneralCommand) return;

    // Handle payment flow
    if (!selectedContact) {
      // Try to match contact name from command
      const matchedContact = contacts.find(contact => {
        const commandWords = command.split(' ');
        return commandWords.some(word => 
          contact.name.toLowerCase().includes(word) ||
          command.includes(contact.name.toLowerCase())
        );
      });

      if (matchedContact) {
        await handleContactSelect(matchedContact);
      } else {
        await speakText("I couldn't find that contact. Available contacts are: " + 
          contacts.map(c => c.name).join(', '));
      }
      return;
    }

    // If contact is selected, look for amount
    if (selectedContact) {
      const amountMatch = command.match(/\d+/);
      if (amountMatch) {
        const spokenAmount = amountMatch[0];
        setAmount(spokenAmount);
        await handlePaymentAfterVoice(spokenAmount);
      } else {
        await speakText(`Please specify the amount you want to pay to ${selectedContact.name}`);
      }
    }
  };

  const handleDoubleTap = async () => {
    const now = Date.now();
    if (now - lastTap < DOUBLE_TAP_DELAY) {
      if (!isListening) {
        await startListening();
      } else {
        await stopListening();
      }
    }
    setLastTap(now);
  };

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
      await speakText(selectedContact ? 'How much would you like to pay?' : 'Who would you like to pay to?');
    } catch (error) {
      console.error('Recording Error:', error);
    }
  };

  const stopListening = async () => {
    if (!recording) return;
    
    try {
      setIsListening(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        const transcript = await sendAudioToSarvam(uri);
        await processVoiceCommand(transcript);
      }
    } catch (error) {
      console.error('Error:', error);
      await speakText('Sorry, I could not understand. Please try again.');
    } finally {
      setRecording(null);
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

      const response = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'api-subscription-key': SARVAM_API_KEY
        },
        body: form
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.transcript || '';
    } catch (error) {
      console.error('Sarvam API Error:', error);
      throw error;
    }
  };

  const handlePaymentAfterVoice = async (spokenAmount: string) => {
    await speakText(`Confirm payment of ${spokenAmount} rupees to ${selectedContact.name}?`);
    handlePayment();
  };

  const handleContactSelect = async (contact) => {
    setSelectedContact(contact);
    setShowSuccess(false);
    await speakText(`Selected ${contact.name}. How much would you like to pay?`);
  };

  const handlePayment = async () => {
    if (!amount) {
      speakText('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);
    await speakText(`Confirming payment of rupees ${amount} to ${selectedContact.name}`);
    
    try {
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
    <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View style={styles.container}>
        {isListening && (
          <View style={styles.recordingIndicator}>
            <Text style={styles.recordingText}>Listening...</Text>
          </View>
        )}
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
    </TouchableWithoutFeedback>
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
  recordingIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#4285F4',
    padding: 10,
    borderRadius: 20,
    zIndex: 1000,
  },
  recordingText: {
    color: 'white',
    fontSize: 14,
  },
});
