import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();
import { useSelector } from 'react-redux';
import { StatusBar } from 'react-native';

import CalendarScreen from '../screens/CalendarScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import DevLogsScreen from '../screens/DevLogsScreen';
import { useTheme } from '../styles/ThemeContext';

const Stack = createNativeStackNavigator();

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="DevLogs" component={DevLogsScreen} />
    </Stack.Navigator>
  );
}

const linking = {
  prefixes: ['taskmanager://'],
  config: {
    screens: {
      Calendar: 'calendar',
      Settings: 'settings',
      DevLogs: 'devlogs',
      Login: 'login',
    },
  },
};

export default function AppNavigator() {
  const { isAuthenticated, isGuest } = useSelector((state) => state.userReducer);
  const { colors, isDark } = useTheme();

  const MyTheme = {
    dark: isDark,
    colors: {
      primary: colors.primary,
      background: colors.bgMain,
      card: colors.bgCard,
      text: colors.textPrimary,
      border: colors.borderColor,
      notification: colors.primary,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={MyTheme} linking={linking}>
      <StatusBar 
        backgroundColor={colors.bgHeader} 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
      />
      {isAuthenticated || isGuest ? (
        <MainStack />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
