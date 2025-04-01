import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { getUserData } from './utils/storage';

export default function Index() {
  useEffect(() => {
    checkUserRegistration();
  }, []);

  const checkUserRegistration = async () => {
    try {
      const userData = await getUserData();
      console.log('User data:', userData); // Debug log
      
      if (!userData || !userData.isRegistered) {
        console.log('Redirecting to onboarding'); // Debug log
        router.replace('/screen/home');
      } else {
        console.log('Redirecting to home'); // Debug log
        router.replace('/screen/home');
      }
    } catch (error) {
      console.error('Error checking user data:', error);
      router.replace('/onboarding');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#4285F4" />
    </View>
  );
}