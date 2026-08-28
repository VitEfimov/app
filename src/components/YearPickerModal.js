import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { useTranslation } from 'react-i18next';

export default function YearPickerModal({
  isVisible,
  onClose,
  currentYear,
  onSelectYear,
  colors,
  minYear = 2020,
  maxYear = 2040
}) {
  const { t } = useTranslation();
  const selectedYear = Number(currentYear) || new Date().getFullYear();

  const years = [];
  for (let y = minYear; y <= maxYear; y++) {
    years.push(y);
  }

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={styles.modal}
    >
      <View style={[styles.content, { backgroundColor: colors.bgCard || '#1e1e1e' }]}>
        <View style={styles.dragHandleContainer}>
          <View style={[styles.dragHandle, { backgroundColor: colors.textSecondary || '#888' }]} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary || '#fff' }]}>
          {t('Select Year') || 'Select Year'}
        </Text>

        <ScrollView contentContainerStyle={styles.grid}>
          {years.map((year) => {
            const isSelected = year === selectedYear;
            return (
              <TouchableOpacity
                key={year}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Select year ${year}`}
                style={[
                  styles.yearBtn,
                  {
                    borderColor: colors.borderColor || 'rgba(255,255,255,0.1)',
                    backgroundColor: isSelected ? (colors.primary || '#6200ee') : 'transparent'
                  }
                ]}
                onPress={() => {
                  onSelectYear(year);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.yearText,
                    {
                      color: isSelected ? (colors.textInverse || '#ffffff') : (colors.textPrimary || '#ffffff'),
                      fontWeight: isSelected ? 'bold' : 'normal'
                    }
                  ]}
                >
                  {year}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: 380,
  },
  dragHandleContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 10,
    paddingBottom: 20,
  },
  yearBtn: {
    width: '28%',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 4,
  },
  yearText: {
    fontSize: 16,
  },
});
