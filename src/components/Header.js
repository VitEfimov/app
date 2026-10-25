import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, SafeAreaView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import { useTheme } from '../styles/ThemeContext';
import { setThemeMode } from '../features/themeSlice';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

const IconCalendar = ({ color = '#4285F4', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
);

const IconBoard = ({ color = '#4285F4', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </Svg>
);

const IconSettings = ({ color = '#666', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </Svg>
);

export default function Header(props) {
  const dispatch = useDispatch();
  const navigation = props?.navigation || useNavigation();
  const route = props?.route;
  const { colors, mode, isDark } = useTheme();
  const { t } = useTranslation();
  
  const themeReducer = useSelector(state => state.themeReducer || {});
  const userPicture = themeReducer.userPicture;
  
  // Active route
  const currentRouteName = route?.name || (navigation?.getState ? navigation.getState()?.routes?.[navigation.getState()?.index]?.name : 'Board');
  const isCalendar = currentRouteName === 'Calendar';
  
  // Pomodoro state
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
    const modes = ['light', 'dark', 'contrast'];
    let currentIndex = modes.indexOf(mode);
    if (currentIndex === -1) {
      currentIndex = isDark ? 1 : 0; 
    }
    const nextIndex = (currentIndex + 1) % modes.length;
    dispatch(setThemeMode(modes[nextIndex]));
  };

  const renderThemeIcon = () => {
    if (mode === 'contrast') {
      return (
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth="2">
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 2a10 10 0 0 0 0 20V2z" fill={colors.textPrimary} />
        </Svg>
      );
    }
    if (isDark) {
      return (
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill={`${colors.primary}33`} />
        </Svg>
      );
    }
    return (
      <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="12" cy="12" r="5" fill={`${colors.primary}33`} />
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
  };

  const handleToggleView = () => {
    if (isCalendar) {
      navigation.navigate('Board');
    } else {
      navigation.navigate('Calendar');
    }
  };

  const renderHeaderContent = () => (
    <View style={[styles.headerContainer, { backgroundColor: userPicture ? 'rgba(0,0,0,0.5)' : colors.bgHeader }]}>
      {/* Left side: single button (icon) switcher for List / Calendar */}
      <View style={styles.leftSection}>
        <TouchableOpacity
          testID="toggle_view_btn"
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isCalendar ? "Switch to Board view" : "Switch to Calendar view"}
          style={[
            styles.viewSwitchBtn,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              borderColor: colors.borderColor || 'rgba(0,0,0,0.1)',
            }
          ]}
          onPress={handleToggleView}
        >
          {isCalendar ? (
            <>
              <IconBoard color={colors.primary} size={18} />
              <Text style={[styles.viewSwitchText, { color: colors.textPrimary }]}>
                {t('Board') || 'Board'}
              </Text>
            </>
          ) : (
            <>
              <IconCalendar color={colors.primary} size={18} />
              <Text style={[styles.viewSwitchText, { color: colors.textPrimary }]}>
                {t('Calendar') || 'Calendar'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Right side: Pomodoro, Date, Theme, Settings */}
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
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Toggle Theme Mode"
          style={[styles.iconBtn, { backgroundColor: colors.surfaceContainerHigh }]}
          onPress={handleToggleTheme}
        >
          {renderThemeIcon()}
        </TouchableOpacity>

        <TouchableOpacity
          testID="header_settings_btn"
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={[styles.iconBtn, { backgroundColor: colors.surfaceContainerHigh, marginLeft: 8 }]}
          onPress={() => navigation.navigate('Settings')}
        >
          <IconSettings color={colors.textPrimary} size={18} />
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
          {renderHeaderContent()}
        </ImageBackground>
      ) : (
        renderHeaderContent()
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
    paddingVertical: 10,
    minHeight: 56,
  },
  bgImage: {
    width: '100%',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  viewSwitchText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
    marginRight: 10,
  },
  pomodoroBadge: {
    backgroundColor: 'rgba(255, 99, 71, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  pomodoroText: {
    fontSize: 12,
    color: '#ff6347',
    fontWeight: 'bold',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
