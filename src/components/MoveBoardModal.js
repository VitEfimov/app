import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal as RNModal, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

const IconFolder = ({ color }) => (
  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </Svg>
);

const IconCheck = ({ color }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);

export default function MoveBoardModal({
  isVisible,
  onClose,
  onSelectBoard,
  boards = [],
  currentBoardId = 'main',
  taskCount = 1,
  colors
}) {
  const { t } = useTranslation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const allBoards = boards.length > 0 ? boards : [{ id: 'main', name: 'Main' }];

  return (
    <RNModal
      visible={Boolean(isVisible)}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.sheetOverlay, { width: windowWidth, height: windowHeight }]}>
        <TouchableOpacity
          style={{ flex: 1, width: windowWidth }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalContent, { backgroundColor: colors.bgCard || '#FFFFFF', width: windowWidth }]}>
          <View style={styles.dragHandle} />

          <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {taskCount > 1
                ? `${t('Move')} ${taskCount} ${t('Tasks to Board')}`
                : t('Move Task to Board')}
            </Text>
          </View>

          <ScrollView 
            style={{ maxHeight: Math.round(windowHeight * 0.5) }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {allBoards.map((b) => {
              const isSelected = (currentBoardId || 'main') === b.id;
              const displayName = b.name === 'Main' ? t('Main') : b.name;

              return (
                <TouchableOpacity
                  key={b.id}
                  testID={`move_board_option_${b.id}`}
                  style={[styles.boardRow, { borderBottomColor: colors.borderColor }]}
                  onPress={() => {
                    onSelectBoard(b.id);
                    onClose();
                  }}
                >
                  <View style={styles.leftContainer}>
                    <IconFolder color={isSelected ? colors.primary : colors.textSecondary} />
                    <Text
                      style={[
                        styles.boardName,
                        { color: isSelected ? colors.primary : colors.textPrimary, fontWeight: isSelected ? 'bold' : '500' }
                      ]}
                    >
                      {displayName}
                    </Text>
                  </View>
                  {isSelected && <IconCheck color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  sheetOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 15,
    paddingBottom: 35,
    paddingHorizontal: 20,
    zIndex: 2,
    elevation: 10,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#888',
    borderRadius: 3,
    marginBottom: 15,
    alignSelf: 'center'
  },
  header: {
    marginBottom: 10,
    paddingBottom: 12,
    borderBottomWidth: 1
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  boardName: {
    fontSize: 16
  }
});
