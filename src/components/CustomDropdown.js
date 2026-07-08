import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal as RNModal, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const IconChevronDown = ({ color }) => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

const CustomDropdown = ({ 
  label, 
  value, 
  options, 
  onSelect, 
  colors,
  layout = 'vertical', // 'vertical' or 'horizontal'
  customBtnStyle = {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Normalize options to handle both strings and {label, value} objects
  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );
  
  const selectedLabel = normalizedOptions.find(o => o.value === value)?.label || value;

  const isHorizontal = layout === 'horizontal';
  
  const labelComponent = label ? (
    <Text style={[styles.label, isHorizontal ? styles.horizontalLabel : styles.verticalLabel, { color: isHorizontal ? colors.textPrimary : colors.textSecondary }]}>
      {label}
    </Text>
  ) : null;

  return (
    <View style={[isHorizontal ? styles.horizontalContainer : styles.verticalContainer, { zIndex: 1 }]}>
      {labelComponent}
      
      <View style={isHorizontal ? styles.horizontalWrapper : styles.verticalWrapper}>
        <TouchableOpacity 
          accessible={true} accessibilityRole="button" accessibilityLabel={`${label || 'Select option'}, current value ${selectedLabel}`}
          style={[styles.dropdownBtn, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.borderColor }, customBtnStyle]} 
          onPress={() => setIsOpen(true)}
        >
          <Text style={[styles.dropdownBtnText, { color: colors.textPrimary }]} numberOfLines={1}>
            {selectedLabel}
          </Text>
          <IconChevronDown color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      
      <RNModal visible={isOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setIsOpen(false)}>
          <View style={[styles.modalMenu, { backgroundColor: colors.bgCard, borderColor: colors.borderColor }]}>
            {label && isHorizontal && (
               <Text style={[styles.modalMenuTitle, { color: colors.textSecondary }]}>{label}</Text>
            )}
            <ScrollView style={{ maxHeight: 400 }}>
              {normalizedOptions.map(opt => (
                <TouchableOpacity 
                  key={opt.value} 
                  accessible={true} accessibilityRole="button" accessibilityLabel={`Select ${opt.label}`}
                  style={[styles.modalMenuItem, { borderBottomColor: colors.borderColor }]} 
                  onPress={() => { onSelect(opt.value); setIsOpen(false); }}
                >
                  <Text style={[styles.modalMenuItemText, { 
                    color: opt.value === value ? colors.primary : colors.textPrimary, 
                    fontWeight: opt.value === value ? 'bold' : 'normal' 
                  }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </RNModal>
    </View>
  );
};

const styles = StyleSheet.create({
  horizontalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  verticalContainer: {
    marginBottom: 0,
  },
  horizontalWrapper: {
    width: 150,
    position: 'relative',
  },
  verticalWrapper: {
    position: 'relative',
  },
  label: {
    fontWeight: 'bold',
  },
  horizontalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  verticalLabel: {
    fontSize: 12,
    marginBottom: 8,
    marginTop: 20,
    letterSpacing: 1,
  },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 15, // Using SettingsScreen radius
    borderWidth: 1,
  },
  dropdownBtnText: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMenu: {
    width: 250,
    borderRadius: 15, // Using SettingsScreen radius
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  modalMenuTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  modalMenuItem: {
    padding: 15,
    borderBottomWidth: 1,
  },
  modalMenuItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default CustomDropdown;
