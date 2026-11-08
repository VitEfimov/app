import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import Modal from 'react-native-modal';
import dayjs from 'dayjs';
import { addGoal, updateGoal, deleteGoal } from '../../features/statsSlice';
import { selectWeeklyAnalytics, selectMonthlyAnalytics } from '../../features/statsSelectors';
import CustomDropdown from '../CustomDropdown';

export default function GoalProgressCard({ colors }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const goals = useSelector(state => state.statsReducer.goals || []);
  
  const currentWeekStats = useSelector(selectWeeklyAnalytics(dayjs()));
  const currentMonthStats = useSelector(selectMonthlyAnalytics(dayjs()));

  const [isSetupVisible, setSetupVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  
  const [goalType, setGoalType] = useState('tasks'); // 'tasks' or 'focusMinutes'
  const [goalPeriod, setGoalPeriod] = useState('weekly'); // 'weekly' or 'monthly'
  const [goalTarget, setGoalTarget] = useState('10');

  const handleOpenSetup = (goal = null) => {
    if (goal) {
      setEditingGoal(goal);
      setGoalType(goal.type);
      setGoalPeriod(goal.period);
      setGoalTarget(goal.target.toString());
    } else {
      setEditingGoal(null);
      setGoalType('tasks');
      setGoalPeriod('weekly');
      setGoalTarget('10');
    }
    setSetupVisible(true);
  };

  const handleSaveGoal = () => {
    const targetNum = parseInt(goalTarget, 10);
    if (isNaN(targetNum) || targetNum <= 0) return;

    if (editingGoal) {
      dispatch(updateGoal({
        ...editingGoal,
        type: goalType,
        period: goalPeriod,
        target: targetNum
      }));
    } else {
      dispatch(addGoal({
        id: Math.random().toString(36).substr(2, 9),
        type: goalType,
        period: goalPeriod,
        target: targetNum,
        createdAt: dayjs().toISOString(),
        enabled: true
      }));
    }
    setSetupVisible(false);
  };

  const handleDeleteGoal = () => {
    if (editingGoal) {
      dispatch(deleteGoal(editingGoal.id));
    }
    setSetupVisible(false);
  };

  const calculateProgress = (goal) => {
    const stats = goal.period === 'weekly' ? currentWeekStats : currentMonthStats;
    const currentVal = goal.type === 'tasks' ? stats.tasksCompleted : stats.pomodoroMinutes;
    return {
      current: currentVal,
      target: goal.target,
      percent: Math.min((currentVal / goal.target) * 100, 100)
    };
  };

  const typeOptions = [
    { label: t('Tasks Completed'), value: 'tasks' },
    { label: t('Focus Minutes'), value: 'focusMinutes' }
  ];

  const periodOptions = [
    { label: t('Weekly'), value: 'weekly' },
    { label: t('Monthly'), value: 'monthly' }
  ];

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Goals')}</Text>
          <TouchableOpacity onPress={() => handleOpenSetup()}>
            <Text style={{ color: colors.primary, fontSize: 20 }}>+</Text>
          </TouchableOpacity>
        </View>
        
        {goals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('Set productivity goals to track your progress.')}
            </Text>
            <TouchableOpacity style={[styles.ctaButton, { backgroundColor: colors.primary }]} onPress={() => handleOpenSetup()}>
              <Text style={styles.ctaButtonText}>{t('+ Set a goal')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.goalsList}>
            {goals.map(goal => {
              const { current, target, percent } = calculateProgress(goal);
              const isComplete = current >= target;
              const titleText = `${t(goal.period === 'weekly' ? 'Weekly' : 'Monthly')} ${t(goal.type === 'tasks' ? 'Task' : 'Focus')} ${t('Goal')}`;
              
              return (
                <TouchableOpacity key={goal.id} style={styles.goalItem} onPress={() => handleOpenSetup(goal)}>
                  <View style={styles.goalHeader}>
                    <Text style={[styles.goalTitle, { color: colors.textPrimary }]}>
                      {isComplete ? t('Goal reached') : titleText}
                    </Text>
                    <Text style={[styles.goalScore, { color: isComplete ? '#4caf50' : colors.textSecondary }]}>
                      {current} / {target}
                    </Text>
                  </View>
                  <View style={[styles.barBg, { backgroundColor: 'rgba(128,128,128,0.2)' }]}>
                    <View style={[styles.barFill, { backgroundColor: isComplete ? '#4caf50' : colors.primary, width: `${percent}%` }]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <Modal
        isVisible={isSetupVisible}
        onSwipeComplete={() => setSetupVisible(false)}
        swipeDirection={['down']}
        propagateSwipe={true}
        onBackdropPress={() => setSetupVisible(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.dragHandle} />
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {editingGoal ? t('Edit Goal') : t('New Goal')}
          </Text>
          
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('Metric')}</Text>
            <CustomDropdown 
              label="" 
              value={goalType} 
              options={typeOptions} 
              onSelect={setGoalType} 
              colors={colors}
              layout="vertical"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('Period')}</Text>
            <CustomDropdown 
              label="" 
              value={goalPeriod} 
              options={periodOptions} 
              onSelect={setGoalPeriod} 
              colors={colors}
              layout="vertical"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('Target Amount')}</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderColor, backgroundColor: colors.bgMain }]}
              value={goalTarget}
              onChangeText={setGoalTarget}
              keyboardType="numeric"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveGoal}>
            <Text style={styles.saveBtnText}>{t('Save Goal')}</Text>
          </TouchableOpacity>

          {editingGoal && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteGoal}>
              <Text style={{ color: '#f44336', fontWeight: 'bold' }}>{t('Delete Goal')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 10
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20
  },
  ctaButton: {
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  ctaButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  },
  goalsList: {
    gap: 15
  },
  goalItem: {
    width: '100%'
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  goalTitle: {
    fontSize: 15,
    fontWeight: 'bold'
  },
  goalScore: {
    fontSize: 14
  },
  barBg: {
    height: 10,
    borderRadius: 5,
    width: '100%',
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: 5
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 25,
    paddingBottom: 40
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#888',
    borderRadius: 3,
    marginBottom: 20,
    alignSelf: 'center'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  formGroup: {
    marginBottom: 15
  },
  label: {
    fontSize: 12,
    marginBottom: 5,
    textTransform: 'uppercase'
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    fontSize: 16
  },
  saveBtn: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  deleteBtn: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#f44336'
  }
});
