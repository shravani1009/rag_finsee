import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { textToSpeech } from '../utils/tts';
import { Audio } from 'expo-av';

export default function FinancialAdviceScreen() {
  const [advice, setAdvice] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const { transactionData } = useLocalSearchParams();

  useEffect(() => {
    readAdvice();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const readAdvice = async () => {
    try {
      if (advice && advice.length > 0) {
        if (sound) {
          await sound.unloadAsync();
        }
        const newSound = await textToSpeech(advice);
        setSound(newSound);
        await newSound.playAsync();
      }
    } catch (error) {
      console.error('Error reading advice:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Your Financial Analysis</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4285F4" />
            <Text style={styles.loadingText}>Analyzing your transactions...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.adviceText}>{advice}</Text>
            {transactionData && (
              <View style={styles.transactionSummary}>
                <Text style={styles.summaryTitle}>Transaction Summary</Text>
                <Text style={styles.summaryText}>
                  {JSON.stringify(transactionData, null, 2)}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#4285F4',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  adviceText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
    color: '#333',
  },
  transactionSummary: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
  }
});
