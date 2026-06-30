import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Provider, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import store from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';

import { hydrateUserState } from './src/features/userSlice';
import { hydrateThemeState } from './src/features/themeSlice';
import axios from 'axios';
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from './src/utils/notifications';

// Polyfill for Hermes / Reanimated warnings
if (typeof structuredClone === 'undefined') {
  global.structuredClone = function(obj) {
    return JSON.parse(JSON.stringify(obj));
  };
}
if (typeof queueMicrotask === 'undefined') {
  global.queueMicrotask = function(callback) {
    Promise.resolve().then(callback);
  };
}

// Configure Axios for remote Vercel backend
axios.defaults.baseURL = 'https://task-manager-v2-indol.vercel.app';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: 'red' }}>Oops! Something went wrong.</Text>
          <Text style={{ textAlign: 'center', color: '#333', marginBottom: 20 }}>{this.state.error?.toString()}</Text>
          <TouchableOpacity 
            onPress={() => this.setState({ hasError: false, error: null })} 
            style={{ padding: 12, backgroundColor: '#2196f3', borderRadius: 8 }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

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
        await registerForPushNotificationsAsync();
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

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/styles/ThemeContext';

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Provider store={store}>
            <ThemeProvider>
              <InitApp />
            </ThemeProvider>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
