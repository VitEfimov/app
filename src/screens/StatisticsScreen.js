import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../styles/ThemeContext';
import { clearStats } from '../features/statsSlice';
import dayjs from 'dayjs';

import RangeNavigator from '../components/statistics/RangeNavigator';
import FreeOverviewSection from '../components/statistics/FreeOverviewSection';
import PremiumAnalyticsContainer from '../components/statistics/PremiumAnalyticsContainer';

export default function StatisticsScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  
  const dailyStats = useSelector(state => state.statsReducer?.dailyStats || {});

  const [viewMode, setViewMode] = useState('week'); // 'week', 'month', 'year'
  const [currentDate, setCurrentDate] = useState(dayjs());

  const handleClearStats = () => {
    Alert.alert(
      t("Clear Statistics"),
      t("Are you sure you want to clear all your statistics? This cannot be undone."),
      [
        { text: t("Cancel"), style: "cancel" },
        { 
          text: t("Clear"), 
          style: "destructive",
          onPress: () => dispatch(clearStats())
        }
      ]
    );
  };

  const handlePrev = () => {
    if (viewMode === 'week') setCurrentDate(currentDate.subtract(1, 'week'));
    if (viewMode === 'month') setCurrentDate(currentDate.subtract(1, 'month'));
    if (viewMode === 'year') setCurrentDate(currentDate.subtract(1, 'year'));
  };

  const handleNext = () => {
    if (viewMode === 'week') setCurrentDate(currentDate.add(1, 'week'));
    if (viewMode === 'month') setCurrentDate(currentDate.add(1, 'month'));
    if (viewMode === 'year') setCurrentDate(currentDate.add(1, 'year'));
  };

  const modes = ['week', 'month', 'year'];
  const cycleMode = () => {
    const nextIdx = (modes.indexOf(viewMode) + 1) % modes.length;
    setViewMode(modes[nextIdx]);
    setCurrentDate(dayjs());
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgMain }]} contentContainerStyle={styles.scrollContent}>
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Your Statistics')}</Text>
      </View>

      <RangeNavigator 
        colors={colors} 
        viewMode={viewMode} 
        currentDate={currentDate} 
        handlePrev={handlePrev} 
        handleNext={handleNext} 
        cycleMode={cycleMode} 
      />

      <FreeOverviewSection 
        colors={colors}
        isDark={isDark}
        dailyStats={dailyStats}
        currentDate={currentDate}
        viewMode={viewMode}
      />

      <PremiumAnalyticsContainer 
        colors={colors}
        isDark={isDark}
        currentDate={currentDate}
        viewMode={viewMode}
      />

      <TouchableOpacity 
        style={[styles.clearBtn, { borderColor: '#f44336' }]} 
        onPress={handleClearStats}
      >
        <Text style={{ color: '#f44336', fontWeight: 'bold' }}>{t('Clear Statistics')}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { marginBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold' },
  clearBtn: { padding: 15, borderWidth: 1, borderRadius: 10, alignItems: 'center', marginTop: 10 }
});
