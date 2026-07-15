import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, PanResponder } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { setProgressMode } from '../features/themeSlice';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import getFilters from '../utils/filters';
import Svg, { Circle, Path } from 'react-native-svg';
import TaskDetailsModal from '../components/TaskDetailsModal';
import { useTranslation } from 'react-i18next';

const IconLeft = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const IconRight = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18l6-6-6-6" />
  </Svg>
);

dayjs.extend(isSameOrBefore);

export default function DashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const tasks = useSelector(state => state.taskReducer.tasks || []);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsVisible, setDetailsVisible] = useState(false);

  const FILTERS = getFilters();
  
  const todayTasks = tasks.filter(task => dayjs(task.completionDate).isSame(dayjs(), 'day') && !task.completed);
  const tomorrowTasks = tasks.filter(task => dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') && !task.completed);
  const thisWeekTasks = tasks.filter(task =>
    !dayjs(task.completionDate).isSameOrBefore(FILTERS.today, 'day') &&
    !dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') &&
    dayjs(task.completionDate).isSameOrBefore(FILTERS['on-this-week'], 'day') && !task.completed
  );
  const nextWeekTasks = tasks.filter(task =>
    !dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') &&
    dayjs(task.completionDate).isAfter(FILTERS['on-this-week'], 'day') &&
    dayjs(task.completionDate).isSameOrBefore(FILTERS['on-next-week'], 'day') && !task.completed
  );
  const laterTasks = tasks.filter(task => dayjs(task.completionDate).isAfter(FILTERS['on-next-week'], 'day') && !task.completed);
  const missedTasks = tasks.filter(task => dayjs(task.completionDate).isBefore(dayjs(), 'day') && !task.completed);

  const progressMode = useSelector(state => state.themeReducer.progressMode) || 'daily';
  
  const modes = ['daily', 'active', 'weekly', 'lifetime'];
  const handleNextMode = () => {
    const nextIdx = (modes.indexOf(progressMode) + 1) % modes.length;
    dispatch(setProgressMode(modes[nextIdx]));
  };
  const handlePrevMode = () => {
    const prevIdx = (modes.indexOf(progressMode) - 1 + modes.length) % modes.length;
    dispatch(setProgressMode(modes[prevIdx]));
  };

  const getModeTitle = () => {
    switch (progressMode) {
      case 'daily': return t('Daily Goal');
      case 'active': return t('Active Workload');
      case 'weekly': return t('Weekly Sprint');
      case 'lifetime': return t('Lifetime');
      default: return t('Progress');
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderEnd: (e, gestureState) => {
        if (gestureState.dx > 50) {
          handlePrevMode();
        } else if (gestureState.dx < -50) {
          handleNextMode();
        }
      },
    })
  ).current;

  const uncompletedTasks = tasks.filter(task => !task.completed);
  const totalTasks = uncompletedTasks.length;
  const completedTasks = tasks.filter(task => task.completed).length;
  
  let calcTotal = 0;
  let calcCompleted = 0;

  if (progressMode === 'daily') {
    const dueTodayAll = tasks.filter(task => dayjs(task.completionDate).isSame(dayjs(), 'day'));
    calcCompleted = dueTodayAll.filter(t => t.completed).length;
    calcTotal = dueTodayAll.length;
  } else if (progressMode === 'active') {
    const completedToday = tasks.filter(task => task.completed && dayjs(task.completionDate).isSame(dayjs(), 'day'));
    calcCompleted = completedToday.length;
    calcTotal = uncompletedTasks.length + calcCompleted;
  } else if (progressMode === 'weekly') {
    const startOfWeek = dayjs().startOf('week');
    const endOfWeek = dayjs().endOf('week');
    const dueThisWeekAll = tasks.filter(task => {
      const d = dayjs(task.completionDate);
      return !d.isBefore(startOfWeek, 'day') && !d.isAfter(endOfWeek, 'day');
    });
    calcCompleted = dueThisWeekAll.filter(t => t.completed).length;
    calcTotal = dueThisWeekAll.length;
  } else {
    calcCompleted = completedTasks;
    calcTotal = tasks.length;
  }

  const completionPercentage = calcTotal > 0 ? Math.round((calcCompleted / calcTotal) * 100) : (progressMode === 'daily' || progressMode === 'weekly' ? 100 : 0);
  const currentFill = Math.max(0, Math.min(100, 100 - completionPercentage)); 
  
  const circumference = 251.2;
  const strokeDashoffset = circumference - (circumference * completionPercentage) / 100;

  const getGreetingText = () => {
    if (completionPercentage === 100 && totalTasks > 0) return t('Perfect!');
    if (completionPercentage >= 50) return t('Great progress!');
    return t('Keep going!');
  };

  const CategoryCard = ({ title, sub, num, color, sectionId }) => (
    <TouchableOpacity 
      accessible={true} accessibilityRole="button" accessibilityLabel={`${title} category, ${sub}, ${num} tasks`}
      activeOpacity={0.8}
      onPress={() => {
        if (sectionId) {
          navigation.navigate('Board', { sectionId });
        } else {
          navigation.navigate('Board');
        }
      }}
      style={[
        styles.catCard, 
        { backgroundColor: colors.bgCard, borderTopColor: color }
      ]}
    >
      <View style={styles.catInfo}>
        <Text style={[styles.catTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.catSub, { color: colors.textSecondary }]}>{sub}</Text>
      </View>
      <Text style={[styles.catNum, { color: colors.textPrimary }]}>{num}</Text>
    </TouchableOpacity>
  );



  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgMain }]} contentContainerStyle={styles.scrollContent}>
      
      {/* Top Card */}
      <View 
        style={styles.progressCard}
        accessibilityRole="progressbar"
        accessibilityLabel={`${completionPercentage}% completed. ${getGreetingText()} ${calcCompleted} / ${calcTotal} tasks completed.`}
      >
        {/* Navigation Header Title */}
        <View style={{ alignItems: 'center', marginBottom: 15 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 16 }}>
            {getModeTitle()}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={handlePrevMode} hitSlop={{top:20, bottom:20, left:20, right:20}} style={{ marginRight: 10 }}>
            <IconLeft color={colors.textSecondary} />
          </TouchableOpacity>

          <View {...panResponder.panHandlers} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.progressCircleContainer, { backgroundColor: colors.bgCard }]} importantForAccessibility="no-hide-descendants">
          <Svg width="100" height="100" viewBox="0 0 100 100">
            <Circle 
              cx="50" cy="50" r="40" 
              stroke={colors.surfaceContainer} 
              strokeWidth="10" 
              fill="none" 
            />
            <Circle 
              cx="50" cy="50" r="40" 
              stroke={colors.primary} 
              strokeWidth="10" 
              fill="none" 
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </Svg>
          <View style={styles.progressTextInner}>
            <Text style={[styles.percent, { color: colors.textPrimary }]}>{completionPercentage}%</Text>
          </View>
        </View>
          <View style={[styles.progressInfo, { paddingLeft: 10, flex: 1 }]} importantForAccessibility="no-hide-descendants">
            <Text style={[styles.progressGreeting, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{getGreetingText()}</Text>
            <Text style={[styles.progressDetails, { color: colors.textSecondary }]}>
              {calcCompleted} / {calcTotal} {t('Completed')}
            </Text>
          <View style={styles.tagsContainer}>
            {missedTasks.length > 0 && (
              <View style={[styles.tag, { backgroundColor: 'rgba(255, 51, 51, 0.2)' }]}>
                <Text style={{ color: '#ff3333', fontSize: 12, fontWeight: 'bold' }}>{t('Missed').toLowerCase()}: {missedTasks.length}</Text>
              </View>
            )}
            {todayTasks.length > 0 && (
              <View style={[styles.tag, { backgroundColor: 'rgba(255, 170, 0, 0.2)' }]}>
                <Text style={{ color: '#ffaa00', fontSize: 12, fontWeight: 'bold' }}>{t('Today').toLowerCase()}: {todayTasks.length}</Text>
              </View>
            )}
          </View>
            </View>
          </View>
          <TouchableOpacity onPress={handleNextMode} hitSlop={{top:20, bottom:20, left:20, right:20}} style={{ marginLeft: 10 }}>
            <IconRight color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Categories */}
      <View style={styles.categoriesGrid}>
        <CategoryCard title={t("Tasks")} sub={t("all uncompleted")} num={totalTasks} color="#4caf50" sectionId={null} />
        <CategoryCard title={t("Completed")} sub={t("done")} num={completedTasks} color="#4caf50" sectionId="completed" />
        <CategoryCard title={t("Today")} sub={t("due today")} num={todayTasks.length} color="#ff9800" sectionId="today" />
        <CategoryCard title={t("Tomorrow")} sub={t("coming up")} num={tomorrowTasks.length} color="#2196f3" sectionId="tomorrow" />
        <CategoryCard title={t("This week")} sub={t("this week")} num={thisWeekTasks.length} color="#9c27b0" sectionId="on-this-week" />
        <CategoryCard title={t("Next week")} sub={t("next week")} num={nextWeekTasks.length} color="#009688" sectionId="on-next-week" />
        <CategoryCard title={t("Upcoming")} sub={t("future")} num={laterTasks.length} color="#d84315" sectionId="later" />
        <CategoryCard title={t("Missed")} sub={t("overdue")} num={missedTasks.length} color="#f44336" sectionId="missed" />
      </View>
      




      <TaskDetailsModal 
        task={selectedTask}
        isVisible={isDetailsVisible}
        onClose={() => setDetailsVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  progressCard: {
    paddingVertical: 10,
    marginBottom: 30,
  },
  progressCircleContainer: {
    width: 100,
    height: 100,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    borderRadius: 50,
  },
  progressTextInner: {
    position: 'absolute',
    alignItems: 'center',
  },
  percent: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  progressInfo: {
    flex: 1,
  },
  progressGreeting: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  progressDetails: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoriesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 15,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  catCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    borderTopWidth: 5,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  catInfo: {
    flex: 1,
    marginLeft: 10,
  },
  catTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  catSub: {
    fontSize: 12,
  },
  catNum: {
    fontSize: 28,
    fontWeight: 'bold',
  }
});
