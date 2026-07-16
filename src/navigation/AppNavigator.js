import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();
import { useSelector } from 'react-redux';
import { StatusBar } from 'react-native';
import { useTranslation } from 'react-i18next';

import DashboardScreen from '../screens/DashboardScreen';
import BoardScreen from '../screens/BoardScreen';
import CalendarScreen from '../screens/CalendarScreen';
import PomodoroScreen from '../screens/PomodoroScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import Header from '../components/Header';
import { useTheme } from '../styles/ThemeContext';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const IconDashboard = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="7" height="9" rx="1" />
    <Rect x="14" y="3" width="7" height="5" rx="1" />
    <Rect x="14" y="12" width="7" height="9" rx="1" />
    <Rect x="3" y="16" width="7" height="5" rx="1" />
  </Svg>
);

const IconBoard = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </Svg>
);

const IconCalendar = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);

const IconSettings = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </Svg>
);

const IconPomodoro = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 22V12l4.5-4.5" />
  </Svg>
);

function TabNavigator() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Tab.Navigator 
      initialRouteName="Dashboard"
      sceneContainerStyle={{ backgroundColor: colors.bgMain }}
      screenOptions={({ route }) => ({
        header: (props) => <Header {...props} />,
        tabBarIcon: ({ color }) => {
          if (route.name === 'Dashboard') return <IconDashboard color={color} />;
          if (route.name === 'Board') return <IconBoard color={color} />;
          if (route.name === 'Calendar') return <IconCalendar color={color} />;
          if (route.name === 'Pomodoro') return <IconPomodoro color={color} />;
          if (route.name === 'Settings') return <IconSettings color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.surfaceContainerHigh,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarHideOnKeyboard: true,
        headerStyle: {
          backgroundColor: colors.bgHeader
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: t('Dashboard') }} />
      <Tab.Screen name="Board" component={BoardScreen} options={{ tabBarLabel: t('Board') }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarLabel: t('Calendar') }} />
      <Tab.Screen name="Pomodoro" component={PomodoroScreen} options={{ tabBarLabel: t('Pomodoro') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('Settings') }} />
    </Tab.Navigator>
  );
}

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
    <NavigationContainer ref={navigationRef} theme={MyTheme}>
      <StatusBar 
        backgroundColor={colors.bgHeader} 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
      />
      {/* VERCEL BACKEND AUTH CHECK (COMMENTED OUT FOR LOCAL-ONLY MODE) 
      {isAuthenticated || isGuest ? (
        <TabNavigator />
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      )}
      */}
      <TabNavigator />
    </NavigationContainer>
  );
}
