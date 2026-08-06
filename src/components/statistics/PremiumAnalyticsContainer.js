import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import PremiumModal from '../PremiumModal';
import ProductivityScoreCard from './ProductivityScoreCard';
import HeatMapCard from './HeatMapCard';
import StreaksCard from './StreaksCard';
import ProductivityInsightsCard from './ProductivityInsightsCard';
import GoalProgressCard from './GoalProgressCard';

const LockedCard = ({ title, colors, onPress }) => (
  <TouchableOpacity style={[styles.lockedCard, { backgroundColor: colors.bgCard }]} onPress={onPress}>
    <View style={styles.lockedHeader}>
      <Text style={[styles.lockedTitle, { color: colors.textPrimary }]}>{title}</Text>
      <View style={styles.proBadge}>
        <Text style={styles.proText}>PRO</Text>
      </View>
    </View>
    <View style={styles.blurArea}>
      <Text style={styles.lockIcon}>🔒</Text>
    </View>
  </TouchableOpacity>
);

export default function PremiumAnalyticsContainer({ colors, isDark, currentDate, viewMode }) {
  const { t } = useTranslation();
  const isPremium = useSelector(state => state.entitlementReducer?.isPremium);
  
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState('');

  const handleOpenPremium = (feature) => {
    setSelectedFeature(feature);
    setModalVisible(true);
  };

  if (!isPremium) {
    return (
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('Productivity Analytics')}</Text>
        
        <LockedCard title={t("Productivity Score")} colors={colors} onPress={() => handleOpenPremium(t("Productivity Score"))} />
        <LockedCard title={t("Monthly Trends")} colors={colors} onPress={() => handleOpenPremium(t("Monthly Trends"))} />
        <LockedCard title={t("Activity Heat Map")} colors={colors} onPress={() => handleOpenPremium(t("Activity Heat Map"))} />
        <LockedCard title={t("Streaks & Records")} colors={colors} onPress={() => handleOpenPremium(t("Streaks & Records"))} />
        
        <PremiumModal 
          isVisible={isModalVisible} 
          onClose={() => setModalVisible(false)} 
          featureName={selectedFeature} 
        />
      </View>
    );
  }

  // Phase 4 & 5: Interactive Premium Components
  return (
    <View style={styles.container}>
       <ProductivityScoreCard colors={colors} isDark={isDark} />
       <HeatMapCard colors={colors} isDark={isDark} />
       <StreaksCard colors={colors} />
       <ProductivityInsightsCard colors={colors} />
       <GoalProgressCard colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
    gap: 15
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5
  },
  lockedCard: {
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    height: 120,
    overflow: 'hidden'
  },
  lockedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  proBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  proText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000'
  },
  blurArea: {
    flex: 1,
    backgroundColor: 'rgba(128,128,128,0.1)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.3)'
  },
  lockIcon: {
    fontSize: 24,
    opacity: 0.5
  }
});
