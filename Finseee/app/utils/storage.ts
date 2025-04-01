import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserData {
  phone: string;
  upiPin: string;
  language: string;
  isRegistered: boolean;
  accessibilityMode: boolean;
}

const USER_KEY = '@finsee_user';

const defaultUserData: UserData = {
  phone: '',
  upiPin: '',
  language: '',
  isRegistered: false,
  accessibilityMode: false,
};

export const storeUserData = async (userData: Partial<UserData>): Promise<void> => {
  try {
    const existingData = await getUserData();
    const updatedData = {
      ...defaultUserData,
      ...existingData,
      ...userData,
    };
    console.log('Storing user data:', updatedData); // Debug log
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedData));
  } catch (error) {
    console.error('Error storing user data:', error);
    throw error;
  }
};

export const getUserData = async (): Promise<UserData | null> => {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    console.log('Retrieved raw data:', data); // Debug log
    if (!data) return null;
    
    const parsedData = JSON.parse(data);
    console.log('Parsed user data:', parsedData); // Debug log
    return parsedData;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

export const clearUserData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Error clearing user data:', error);
  }
};
