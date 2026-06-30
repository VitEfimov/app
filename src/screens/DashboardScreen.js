import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import { useTheme } from '../styles/ThemeContext';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import getFilters from '../utils/filters';
import Svg, { Circle } from 'react-native-svg';
import TaskRow from '../components/TaskRow';

dayjs.extend(isSameOrBefore);

export default function DashboardScreen() {
  const { colors } = useTheme();
  const tasks = useSelector(state => state.taskReducer.tasks || []);

  const FILTERS = getFilters();
  
  const todayTasks = tasks.filter(task => dayjs(task.completionDate).isSame(dayjs(), 'day') && !task.completed);
  const tomorrowTasks = tasks.filter(task => dayjs(task.completionDate).isSame(FILTERS.tomorrow, 'day') && !task.completed);
  const thisWeekTasks = tasks.filter(task =>
    !dayjs(task.completionDate).isSameOrBefore(FILTERS.today) &&
    !dayjs(task.completionDate).isSame(FILTERS.tomorrow) &&
    dayjs(task.completionDate).isSameOrBefore(FILTERS['on-this-week']) && !task.completed
  );
  const nextWeekTasks = tasks.filter(task =>
    !dayjs(task.completionDate).isSame(FILTERS.tomorrow) &&
    dayjs(task.completionDate).isAfter(FILTERS['on-this-week']) &&
    dayjs(task.completionDate).isSameOrBefore(FILTERS['on-next-week']) && !task.completed
  );
  const laterTasks = tasks.filter(task => dayjs(task.completionDate).isAfter(FILTERS['on-next-week']) && !task.completed);
  const missedTasks = tasks.filter(task => dayjs(task.completionDate).isBefore(dayjs(), 'day') && !task.completed);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.completed).length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const currentFill = Math.max(0, Math.min(100, 100 - completionPercentage)); // dashoffset factor
  
  const circumference = 251.2; // 2 * pi * r (where r = 40)
  const strokeDashoffset = circumference - (circumference * completionPercentage) / 100;

  const getGreetingText = () => {
    if (completionPercentage === 100 && totalTasks > 0) return 'Perfect!';
    if (completionPercentage >= 50) return 'Great progress!';
    return 'Keep going!';
  };

  const CategoryCard = ({ title, sub, num, color }) => (
    <View style={[styles.catCard, { backgroundColor: colors.bgCard, borderTopColor: color }]}>
      <View style={styles.catInfo}>
        <Text style={[styles.catTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.catSub, { color: colors.textSecondary }]}>{sub}</Text>
      </View>
      <Text style={[styles.catNum, { color: colors.textPrimary }]}>{num}</Text>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgMain }]} contentContainerStyle={styles.scrollContent}>
      
      {/* Top Card */}
      <View style={styles.progressCard}>
        <View style={[styles.progressCircleContainer, { backgroundColor: colors.bgCard }]}>
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
        <View style={styles.progressInfo}>
          <Text style={[styles.progressGreeting, { color: colors.textPrimary }]}>{getGreetingText()}</Text>
          <Text style={[styles.progressDetails, { color: colors.textSecondary }]}>
            {completedTasks} of {totalTasks} tasks{"\n"}completed today
          </Text>
          <View style={styles.tagsContainer}>
            {missedTasks.length > 0 && (
              <View style={[styles.tag, { backgroundColor: 'rgba(255, 51, 51, 0.2)' }]}>
                <Text style={{ color: '#ff3333', fontSize: 12, fontWeight: 'bold' }}>{missedTasks.length} missed</Text>
              </View>
            )}
            {todayTasks.length > 0 && (
              <View style={[styles.tag, { backgroundColor: 'rgba(255, 170, 0, 0.2)' }]}>
                <Text style={{ color: '#ffaa00', fontSize: 12, fontWeight: 'bold' }}>{todayTasks.length} today</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Categories */}
      <View style={styles.categoriesGrid}>
        <CategoryCard title="Total tasks" sub="all tasks" num={totalTasks} color="#4caf50" />
        <CategoryCard title="Completed" sub="done" num={completedTasks} color="#4caf50" />
        <CategoryCard title="Today" sub="due today" num={todayTasks.length} color="#ff9800" />
        <CategoryCard title="Tomorrow" sub="coming up" num={tomorrowTasks.length} color="#2196f3" />
        <CategoryCard title="This week" sub="this week" num={thisWeekTasks.length} color="#9c27b0" />
        <CategoryCard title="Next week" sub="next week" num={nextWeekTasks.length} color="#009688" />
        <CategoryCard title="Later" sub="future" num={laterTasks.length} color="#d84315" />
        <CategoryCard title="Missed" sub="overdue" num={missedTasks.length} color="#f44336" />
      </View>
      
      {/* Today's Tasks */}
      {todayTasks.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={[styles.categoriesTitle, { color: colors.textSecondary }]}>TODAY'S TASKS</Text>
          {todayTasks.map(task => (
            <TaskRow key={task.id} task={task} hideDate={true} />
          ))}
        </View>
      )}

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
    flexDirection: 'row',
    paddingVertical: 10,
    marginBottom: 30,
    alignItems: 'center',
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
