import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Provider, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import store from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { View, Text, ActivityIndicator } from 'react-native';

import { hydrateUserState } from './src/features/userSlice';
import { hydrateThemeState } from './src/features/themeSlice';
import axios from 'axios';
import { Platform } from 'react-native';

// Configure Axios for local backend testing
axios.defaults.baseURL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

function InitApp() {
  const dispatch = useDispatch();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loadStorage = async () => {
      try {
        const theme = await AsyncStorage.getItem('customTheme');
        if (theme) dispatch(hydrateThemeState(JSON.parse(theme)));

        const isGuest = await AsyncStorage.getItem('isGuest') === 'true';
        if (isGuest) dispatch(hydrateUserState({ isGuest }));

        // Check auth with backend here if needed
      } catch (e) {
        console.error(e);
      } finally {
        setReady(true);
      }
    };
    loadStorage();
  }, [dispatch]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <AppNavigator />;
}

export default function App() {
  return (
    <Provider store={store}>
      <InitApp />
    </Provider>
  );
}
