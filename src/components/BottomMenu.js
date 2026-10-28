import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../styles/ThemeContext';

const IconTasks = ({ color, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="9" />
    <Path d="M8.5 12.5l2.5 2.5 5-5" />
  </Svg>
);

const IconCalendar = ({ color, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
);

const IconSettings = ({ color, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="4" y1="7" x2="20" y2="7" />
    <Line x1="4" y1="17" x2="20" y2="17" />
    <Circle cx="9" cy="7" r="2.5" fill="none" />
    <Circle cx="15" cy="17" r="2.5" fill="none" />
  </Svg>
);

export default function BottomMenu(props) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  // Support both React Navigation TabBar props and direct props
  const { state, navigation, activeTab, onTabPress } = props;

  const currentRouteName = state 
    ? state.routes[state.index]?.name 
    : (activeTab || 'Board');

  const tabs = [
    {
      name: 'Board',
      label: t('Tasks') || 'Tasks',
      Icon: IconTasks,
    },
    {
      name: 'Calendar',
      label: t('Calendar') || 'Calendar',
      Icon: IconCalendar,
    },
    {
      name: 'Settings',
      label: t('Settings') || 'Settings',
      Icon: IconSettings,
    },
  ];

  const handlePress = (tabName) => {
    if (navigation) {
      if (currentRouteName !== tabName) {
        navigation.navigate(tabName);
      }
    } else if (onTabPress) {
      onTabPress(tabName);
    }
  };


  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: colors.bgCard || (isDark ? '#1F1E26' : '#FFFFFF'), 
        borderTopColor: colors.borderColor || (isDark ? '#2E2D3A' : '#ECECEF') 
      }
    ]}>
      {tabs.map((tab) => {
        const isFocused = currentRouteName === tab.name;
        const color = isFocused ? colors.primary : colors.textSecondary;
        const TabIcon = tab.Icon;

        return (
          <TouchableOpacity
            key={tab.name}
            testID={`tab_${tab.name.toLowerCase()}`}
            onPress={() => handlePress(tab.name)}
            activeOpacity={0.7}
            style={styles.tabButton}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
          >
            <View style={styles.iconWrapper}>
              <TabIcon color={color} size={22} />
            </View>
            <Text style={[
              styles.tabLabel, 
              { color },
              isFocused && styles.activeTabLabel
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 82 : 66,
    paddingBottom: Platform.OS === 'ios' ? 22 : 6,
    paddingTop: 6,
    borderTopWidth: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 999,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconWrapper: {
    width: 58,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  activePill: {
    // pill background color applied dynamically from theme
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  activeTabLabel: {
    fontWeight: '700',
  },
});
