import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../features/userSlice';
import { clearTasks } from '../features/taskSlice';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';

// Simple SVG Icons since we can't easily rely on vector-icons without pre-configuring them sometimes
import Svg, { Path, Polyline, Rect, Line, Circle } from 'react-native-svg';

const IconDashboard = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="7" height="7" rx="1.5" />
    <Rect x="14" y="3" width="7" height="7" rx="1.5" />
    <Rect x="14" y="14" width="7" height="7" rx="1.5" />
    <Rect x="3" y="14" width="7" height="7" rx="1.5" />
  </Svg>
);

const IconBoard = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </Svg>
);

const IconCalendar = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2"></Rect>
    <Line x1="16" y1="2" x2="16" y2="6"></Line>
    <Line x1="8" y1="2" x2="8" y2="6"></Line>
    <Line x1="3" y1="10" x2="21" y2="10"></Line>
  </Svg>
);

const IconPomodoro = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Polyline points="12 6 12 12 16 14" />
  </Svg>
);

const IconSettings = ({ color }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

const IconLogout = ({ color }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <Polyline points="16 17 21 12 16 7" />
    <Line x1="21" y1="12" x2="9" y2="12" />
  </Svg>
);

export default function CustomDrawerContent(props) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  
  const isAuthenticated = useSelector(state => state.userReducer.isAuthenticated);
  const tasks = useSelector(state => state.taskReducer.tasks || []);
  
  const todayTasks = tasks.filter(task => dayjs(task.completionDate).isSame(dayjs(), 'day'));
  const completedToday = todayTasks.filter(task => task.completed).length;
  const totalToday = todayTasks.length;
  const progressPercent = totalToday === 0 ? 0 : Math.round((completedToday / totalToday) * 100);

  const handleLogout = () => {
    if (isAuthenticated) {
      dispatch(logoutUser());
      dispatch(clearTasks());
    }
  };

  const currentRoute = props.state.routeNames[props.state.index];

  const NavItem = ({ label, routeName, Icon }) => {
    const isActive = currentRoute === routeName;
    return (
      <TouchableOpacity 
        accessible={true} accessibilityRole="button" accessibilityLabel={`Navigate to ${label}`} accessibilityState={{ selected: isActive }}
        style={[styles.navItem, isActive && { backgroundColor: colors.surfaceContainerHigh }]}
        onPress={() => props.navigation.navigate(routeName)}
      >
        <Icon color={isActive ? colors.primary : colors.textSecondary} />
        <Text style={[styles.navItemText, { color: isActive ? colors.primary : colors.textSecondary }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSidebar }]}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollContent}>
        
        {/* Logo Area */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoIconBg, { backgroundColor: colors.primary }]}>
            <Svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.textInverse} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="9 11 12 14 22 4" />
              <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </Svg>
          </View>
          <Text style={[styles.logoText, { color: colors.textPrimary }]}>TaskFlow</Text>
        </View>

        {/* Stats Area */}
        <View 
          style={[styles.statsContainer, { backgroundColor: colors.surfaceContainer }]}
          accessible={true}
          accessibilityLabel={`Today's progress: ${completedToday} out of ${totalToday} tasks completed, ${totalToday - completedToday} tasks remaining`}
        >
          <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Today's progress</Text>
          <View style={styles.statsCounts}>
            <Text style={[styles.statsDone, { color: colors.primary }]}>{completedToday}</Text>
            <Text style={[styles.statsTotal, { color: colors.textSecondary }]}> / {totalToday}</Text>
          </View>
          <View style={[styles.statsBarBg, { backgroundColor: colors.surfaceContainerHigh }]}>
            <View style={[styles.statsBarFill, { backgroundColor: colors.primary, width: `${progressPercent}%` }]} />
          </View>
          <Text style={[styles.statsRemaining, { color: colors.textTertiary }]}>{totalToday - completedToday} tasks remaining</Text>
        </View>

        {/* Navigation Items */}
        <View style={styles.navContainer}>
          <NavItem label="Dashboard" routeName="Dashboard" Icon={IconDashboard} />
          <NavItem label="Tasks" routeName="Board" Icon={IconBoard} />
          <NavItem label="Calendar" routeName="Calendar" Icon={IconCalendar} />
          <NavItem label="Pomodoro" routeName="Pomodoro" Icon={IconPomodoro} />
          <NavItem label="Settings" routeName="Settings" Icon={IconSettings} />
        </View>

      </DrawerContentScrollView>

      {/* Footer / Logout */}
      <View style={[styles.footer, { borderTopColor: colors.borderColor }]}>
        <TouchableOpacity 
          accessible={true} accessibilityRole="button" accessibilityLabel="Log Out"
          style={[styles.navItem, { opacity: isAuthenticated ? 1 : 0.5 }]} 
          onPress={handleLogout}
          disabled={!isAuthenticated}
        >
          <IconLogout color={colors.textSecondary} />
          <Text style={[styles.navItemText, { color: colors.textSecondary }]}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 40,
    paddingHorizontal: 15,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  logoIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsContainer: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
  },
  statsLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  statsCounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  statsDone: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsTotal: {
    fontSize: 14,
  },
  statsBarBg: {
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  statsBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsRemaining: {
    fontSize: 12,
  },
  navContainer: {
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 8,
  },
  navItemText: {
    fontSize: 17,
    marginLeft: 18,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  }
});
