import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { storeUserData } from '../utils/storage';
import { Audio } from 'expo-av';
import { textToSpeech } from '../utils/tts';

const route = '/onboarding/registration';
export { route };

const BACKEND_URL = 'http://192.168.0.109:5000';

const BANK_LIST = [
  // Private Sector Banks
  'Axis Bank', 'Bandhan Bank', 'City Union Bank', 'CSB Bank', 'DCB Bank',
  'Federal Bank', 'HDFC Bank', 'ICICI Bank', 'IDBI Bank', 'IDFC First Bank',
  'IndusInd Bank', 'Jammu & Kashmir Bank', 'Karnataka Bank', 'Karur Vysya Bank',
  'Kotak Mahindra Bank', 'RBL Bank', 'South Indian Bank', 'Tamilnad Mercantile Bank',
  'Yes Bank',
  // Small Finance Banks
  'AU Small Finance Bank', 'Capital Small Finance Bank', 'Equitas Small Finance Bank',
  'ESAF Small Finance Bank', 'Jana Small Finance Bank', 'North East Small Finance Bank',
  'Shivalik Small Finance Bank', 'Suryoday Small Finance Bank', 'Ujjivan Small Finance Bank',
  'Unity Small Finance Bank', 'Utkarsh Small Finance Bank',
  // Regional Rural Banks
  'Andhra Pradesh Grameena Vikas Bank', 'Aryavart Bank', 'Assam Gramin Vikash Bank',
  'Baroda Gujarat Gramin Bank', 'Baroda Rajasthan Kshetriya Gramin Bank',
  'Baroda UP Bank', 'Chaitanya Godavari Grameena Bank', 'Kerala Gramin Bank',
  'Madhya Pradesh Gramin Bank', 'Punjab Gramin Bank', 'Tamil Nadu Grama Bank',
  'Utkal Grameen Bank'
];

export default function RegistrationScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    bankName: '',
    accountNumber: '',
    voice_features: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [filteredBanks, setFilteredBanks] = useState(BANK_LIST);
  const [isRecording, setIsRecording] = useState(false);

  const validateForm = () => {
    if (!formData.name || !formData.phone || !formData.bankName || !formData.accountNumber) {
      Alert.alert('Error', 'All fields are required');
      return false;
    }

    if (formData.phone.length !== 10) {
      Alert.alert('Error', 'Phone number must be 10 digits');
      return false;
    }

    if (formData.accountNumber.length < 9) {
      Alert.alert('Error', 'Account number must be at least 9 characters');
      return false;
    }

    return true;
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

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setIsLoading(true);
      await storeUserData({
        ...formData,
        isRegistered: true,
      });
      await speakText('Registration successful');
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/screen/home');
    } catch (error) {
      console.error('Registration error:', error);
      await speakText('Registration unsuccessful');
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBankSearch = (text: string) => {
    setBankSearch(text);
    setFormData({ ...formData, bankName: text });
    const filtered = BANK_LIST.filter(bank => 
      bank.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredBanks(filtered);
    setShowBankDropdown(true);
  };

  const selectBank = (bank: string) => {
    setFormData({ ...formData, bankName: bank });
    setBankSearch(bank);
    setShowBankDropdown(false);
  };

  const handleVoiceRecording = () => {
    setIsRecording(!isRecording);
    // TODO: Implement voice recording logic
    Alert.alert('Voice Recording', 'Voice recording feature will be implemented here');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registration</Text>
      <View style={styles.form}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your phone number"
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          keyboardType="phone-pad"
          maxLength={10}
        />

        <Text style={styles.label}>Bank Name</Text>
        <View style={styles.bankInputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Search bank name"
            value={formData.bankName}
            onChangeText={handleBankSearch}
            onFocus={() => setShowBankDropdown(true)}
          />
          {showBankDropdown && (
            <View style={styles.dropdown}>
              <ScrollView style={styles.dropdownList}>
                {filteredBanks.map((bank, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.dropdownItem}
                    onPress={() => selectBank(bank)}
                  >
                    <Text>{bank}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <Text style={styles.label}>Account Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your account number"
          value={formData.accountNumber}
          onChangeText={(text) => setFormData({ ...formData, accountNumber: text })}
          maxLength={18}
        />

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleSubmit}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Register</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.voiceButton]} 
          onPress={handleVoiceRecording}
        >
          <Text style={styles.buttonText}>
            {isRecording ? 'Stop Recording' : 'Add Your Voice'}
          </Text>
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
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
  },
  bankInputContainer: {
    position: 'relative',
    zIndex: 1,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    maxHeight: 200,
    zIndex: 2,
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  button: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  voiceButton: {
    backgroundColor: '#34A853',
    marginTop: 10,
  },
});
