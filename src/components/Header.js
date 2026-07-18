import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, SafeAreaView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import { useTheme } from '../styles/ThemeContext';
import { setThemeMode } from '../features/themeSlice';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

// Custom icons

const IconLightMode = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="5" />
    <Line x1="12" y1="1" x2="12" y2="3" />
    <Line x1="12" y1="21" x2="12" y2="23" />
    <Line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <Line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <Line x1="1" y1="12" x2="3" y2="12" />
    <Line x1="21" y1="12" x2="23" y2="12" />
    <Line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <Line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </Svg>
);

const IconDarkMode = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Svg>
);

const IconContrast = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 2a10 10 0 0 0 0 20V2z" fill={color} />
  </Svg>
);

export default function Header() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { colors, mode, isDark } = useTheme();
  const { t } = useTranslation();
  
  const themeReducer = useSelector(state => state.themeReducer || {});
  const userPicture = themeReducer.userPicture;
  
  // Try to grab Pomodoro state if available
  const pomodoroState = useSelector(state => state.pomodoroReducer?.pomodoro?.[0]);
  const isPomodoroActive = pomodoroState?.isActive;
  const timeRemaining = pomodoroState?.time;
  const isTimeOver = isPomodoroActive && timeRemaining === 0;

  const formatBadgeTime = (timeInSeconds) => {
    if (typeof timeInSeconds !== 'number') return '00:00';
    const hrs = Math.floor(timeInSeconds / 3600);
    const mins = Math.floor((timeInSeconds % 3600) / 60);
    const secs = timeInSeconds % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleToggleTheme = () => {
    let newTheme = 'light';
    if (mode === 'light') newTheme = 'dark';
    else if (mode === 'dark') newTheme = 'contrast';
    else if (mode === 'contrast') newTheme = 'light';
    
    dispatch(setThemeMode(newTheme));
  };

  const getThemeIcon = () => {
    if (mode === 'contrast') return <IconContrast color={colors.textPrimary} />;
    if (mode === 'dark' || (mode === 'system' && isDark)) return <IconDarkMode color={colors.textPrimary} />;
    return <IconLightMode color={colors.textPrimary} />;
  };

  const HeaderContent = () => (
    <View style={[styles.headerContainer, { backgroundColor: userPicture ? 'rgba(0,0,0,0.5)' : colors.bgHeader }]}>
      <View />
      <View style={styles.rightSection}>
        {(!!isPomodoroActive && !isTimeOver) ? (
          <View style={styles.pomodoroBadge}>
            <Text style={styles.pomodoroText}>{t('Pomodoro')}: {formatBadgeTime(timeRemaining)}</Text>
          </View>
        ) : null}
        
        {!!isTimeOver ? (
          <View style={[styles.pomodoroBadge, { backgroundColor: colors.danger }]}>
            <Text style={[styles.pomodoroText, { color: '#fff' }]}>{t("Time's Up!")}</Text>
          </View>
        ) : null}

        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          {dayjs().format('ddd, MMM D')}
        </Text>

        <TouchableOpacity 
          style={[styles.themeButton, { backgroundColor: colors.surfaceContainerHigh }]} 
          onPress={handleToggleTheme}
        >
          {getThemeIcon()}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ backgroundColor: colors.bgHeader }}>
      {userPicture ? (
        <ImageBackground 
          source={{ uri: userPicture }} 
          style={styles.bgImage}
          imageStyle={{ resizeMode: themeReducer.headerBackgroundFit === 'contain' ? 'contain' : 'cover' }}
        >
          <HeaderContent />
        </ImageBackground>
      ) : (
        <HeaderContent />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    minHeight: 60,
  },
  bgImage: {
    width: '100%',
  },
  menuButton: {
    padding: 5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 15,
  },
  pomodoroBadge: {
    backgroundColor: 'rgba(255, 99, 71, 0.2)', // tomato with opacity
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 15,
  },
  pomodoroText: {
    fontSize: 12,
    color: '#ff6347',
    fontWeight: 'bold',
  },
  themeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
