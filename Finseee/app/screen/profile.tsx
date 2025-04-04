import React from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { useDoubleTapListener } from '../hooks/useDoubleTapListener';

export default function ProfileScreen() {
  const handleDoubleTap = useDoubleTapListener();
  
  return (
    <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View style={styles.container}>
        <Text style={styles.text}>Profile Screen</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 20,
    color: '#4285F4',
  },
});
