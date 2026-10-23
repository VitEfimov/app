import React from 'react';
import { TouchableOpacity, StyleSheet, Platform, View } from 'react-native';
import { IconPlus, GooglePlusIcon } from './CalendarIcons';

export default function GoogleFAB({ onPress, colors, isDark }) {
  return (
    <TouchableOpacity
      accessible={true}
      accessibilityLabel="Create new task"
      accessibilityRole="button"
      style={[
        styles.fabContainer,
        {
          backgroundColor: isDark ? colors.primaryContainer : '#ffffff',
          borderColor: colors.borderColor,
        }
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <GooglePlusIcon size={26} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 99,
  },
});
