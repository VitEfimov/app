import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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

export default function RangeNavigator({ colors, viewMode, currentDate, handlePrev, handleNext, cycleMode }) {
  const { t } = useTranslation();

  const getModeTitle = () => {
    if (viewMode === 'week') return t('Week view');
    if (viewMode === 'month') return t('Month view');
    if (viewMode === 'year') return t('Year view');
    return '';
  };

  const getDateLabel = () => {
    if (viewMode === 'week') {
      const start = currentDate.subtract(6, 'day');
      return `${start.format('MMM D')} - ${currentDate.format('MMM D')}`;
    }
    if (viewMode === 'month') return currentDate.format('MMMM YYYY');
    if (viewMode === 'year') return currentDate.format('YYYY');
  };

  return (
    <View style={styles.controlsContainer}>
      <TouchableOpacity style={styles.arrowBtn} onPress={handlePrev}>
        <IconLeft color={colors.textSecondary} />
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.dateSelector} onPress={cycleMode}>
        <Text style={[styles.dateText, { color: colors.textPrimary }]}>{getDateLabel()}</Text>
        <Text style={[styles.modeSubtitle, { color: colors.textSecondary }]}>{getModeTitle()}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.arrowBtn} onPress={handleNext}>
        <IconRight color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  controlsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 },
  arrowBtn: { padding: 10 },
  dateSelector: { alignItems: 'center' },
  dateText: { fontSize: 18, fontWeight: 'bold' },
  modeSubtitle: { fontSize: 12, marginTop: 2 },
});
