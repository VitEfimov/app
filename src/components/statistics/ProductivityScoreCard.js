import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import Modal from 'react-native-modal';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { selectProductivityScore } from '../../features/statsSelectors';

export default function ProductivityScoreCard({ colors }) {
  const { t } = useTranslation();
  const [isModalVisible, setModalVisible] = useState(false);
  const scoreData = useSelector(selectProductivityScore);
  
  if (!scoreData.hasEnoughData) {
    return (
      <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Productivity Score')}</Text>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('Keep using TaskFlow to build your Productivity Score.')}
          </Text>
        </View>
      </View>
    );
  }

  // Circular progress SVG setup
  const size = 100;
  const strokeWidth = 10;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const progress = scoreData.score / 100;
  const strokeDashoffset = circumference - progress * circumference;

  let progressColor = colors.primary;
  if (scoreData.score < 55) progressColor = '#f44336';
  else if (scoreData.score >= 90) progressColor = '#4caf50';

  return (
    <>
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.bgCard }]} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('Productivity Score')}</Text>
        
        <View style={styles.scoreRow}>
          <View style={styles.circleContainer}>
            <Svg width={size} height={size}>
              <Circle
                stroke={colors.borderColor}
                cx={center}
                cy={center}
                r={radius}
                strokeWidth={strokeWidth}
                fill="none"
              />
              <Circle
                stroke={progressColor}
                cx={center}
                cy={center}
                r={radius}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                transform={`rotate(-90 ${center} ${center})`}
              />
              <SvgText
                x={center}
                y={center + 10}
                textAnchor="middle"
                fill={colors.textPrimary}
                fontSize="24"
                fontWeight="bold"
              >
                {scoreData.score}
              </SvgText>
            </Svg>
          </View>
          
          <View style={styles.scoreInfo}>
            <Text style={[styles.scoreLabel, { color: progressColor }]}>{t(scoreData.label)}</Text>
            <Text style={[styles.scoreSub, { color: colors.textSecondary }]}>{t('Based on last 30 days')}</Text>
            <Text style={[styles.detailsLink, { color: colors.primary }]}>{t('View Breakdown')} &gt;</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Breakdown Modal */}
      <Modal
        isVisible={isModalVisible}
        onSwipeComplete={() => setModalVisible(false)}
        swipeDirection={['down']}
        propagateSwipe={true}
        onBackdropPress={() => setModalVisible(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
          <View style={styles.dragHandle} />
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('Score Breakdown')}</Text>
          
          <View style={styles.breakdownList}>
            <BreakdownRow title={t("Completion")} data={scoreData.breakdown.completion} colors={colors} />
            <BreakdownRow title={t("On-time tasks")} data={scoreData.breakdown.onTime} colors={colors} />
            <BreakdownRow title={t("Focus consistency")} data={scoreData.breakdown.focus} colors={colors} />
            <BreakdownRow title={t("Task consistency")} data={scoreData.breakdown.task} colors={colors} />
            <BreakdownRow title={t("Overdue control")} data={scoreData.breakdown.overdue} colors={colors} />
          </View>

          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.primary }]} onPress={() => setModalVisible(false)}>
            <Text style={styles.closeBtnText}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const BreakdownRow = ({ title, data, colors }) => {
  const percent = data.max > 0 ? (data.score / data.max) * 100 : 0;
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownHeader}>
        <Text style={[styles.breakdownTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.breakdownScore, { color: colors.textSecondary }]}>{data.score} / {data.max}</Text>
      </View>
      <View style={[styles.breakdownBarBg, { backgroundColor: 'rgba(128,128,128,0.2)' }]}>
        <View style={[styles.breakdownBarFill, { backgroundColor: colors.primary, width: `${percent}%` }]} />
      </View>
    </View>
  );
};

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
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  circleContainer: {
    marginRight: 20
  },
  scoreInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  scoreLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4
  },
  scoreSub: {
    fontSize: 12,
    marginBottom: 10
  },
  detailsLink: {
    fontSize: 14,
    fontWeight: 'bold'
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
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center'
  },
  breakdownList: {
    gap: 20,
    marginBottom: 30
  },
  breakdownRow: {
    width: '100%'
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: 'bold'
  },
  breakdownScore: {
    fontSize: 14
  },
  breakdownBarBg: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden'
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 4
  },
  closeBtn: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  }
});
