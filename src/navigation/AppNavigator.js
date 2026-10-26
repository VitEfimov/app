import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();
import { useSelector } from 'react-redux';
import { StatusBar } from 'react-native';

import BoardScreen from '../screens/BoardScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import DevLogsScreen from '../screens/DevLogsScreen';
import BottomMenu from '../components/BottomMenu';
import { useTheme } from '../styles/ThemeContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomMenu {...props} />}
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="Board"
    >
      <Tab.Screen name="Board" component={BoardScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { flex: 1, height: '100%', overflow: 'hidden' },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="DevLogs" component={DevLogsScreen} />
    </Stack.Navigator>
  );
}

const linking = {
  prefixes: ['taskmanager://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Board: 'board',
          Calendar: 'calendar',
          Settings: 'settings',
        },
      },
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
        backgroundColor={colors.bgMain} 
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
