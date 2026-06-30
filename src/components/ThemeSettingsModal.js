import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { useDispatch, useSelector } from 'react-redux';
import { setSourceColor, setUserPicture, setHeaderBackgroundFit, resetTheme } from '../features/themeSlice';
import { useTheme } from '../styles/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import ColorPicker, { Panel1, HueSlider } from 'reanimated-color-picker';

const PREDEFINED_COLORS = ['#4caf50', '#2196f3', '#9c27b0', '#ffeb3b', '#e91e63'];

export default function ThemeSettingsModal({ isVisible, onClose }) {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  
  const currentSourceColor = useSelector(state => state.themeReducer.sourceColor);
  const currentFit = useSelector(state => state.themeReducer.headerBackgroundFit) || 'cover';
  const currentUserPicture = useSelector(state => state.themeReducer.userPicture);

  const [tempColor, setTempColor] = useState(currentSourceColor);
  const [tempFit, setTempFit] = useState(currentFit);
  const [tempImage, setTempImage] = useState(currentUserPicture);
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to upload an image.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setTempImage(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    dispatch(setSourceColor(tempColor));
    dispatch(setHeaderBackgroundFit(tempFit));
    if (tempImage !== currentUserPicture) {
      dispatch(setUserPicture(tempImage));
    }
    onClose();
  };

  const handleReset = () => {
    Alert.alert(
      "Reset Defaults",
      "Are you sure you want to reset all theme settings to defaults?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Reset", 
          style: "destructive",
          onPress: () => {
            dispatch(resetTheme());
            onClose();
          }
        }
      ]
    );
  };

  return (
    <Modal
      isVisible={isVisible}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      onBackdropPress={onClose}
      style={{ margin: 0, justifyContent: 'flex-end' }}
    >
      <View style={styles.modalContent}>
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>
          
          <View style={styles.header}>
            <Text style={styles.title}>Theme Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea}>
            <Text style={styles.sectionTitle}>Material You Theme</Text>
            <Text style={styles.subtitle}>
              Choose a source color and we'll generate a complete, accessible theme palette for you automatically.
            </Text>

            <View style={styles.colorRow}>
              {PREDEFINED_COLORS.map((c, i) => (
                <TouchableOpacity 
                  key={i} 
                  style={[styles.colorCircle, { backgroundColor: c }, tempColor === c && styles.selectedColor]} 
                  onPress={() => setTempColor(c)}
                />
              ))}
            </View>

            <View style={styles.customColorRow}>
              <Text style={styles.customColorLabel}>Custom Color:</Text>
              <View style={[styles.customColorPreview, { backgroundColor: tempColor }]} />
              <TextInput 
                style={styles.colorInput}
                value={tempColor}
                onChangeText={setTempColor}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.colorPickerContainer}>
              <ColorPicker 
                style={styles.colorPicker} 
                value={tempColor || '#4caf50'} 
                onComplete={({ hex }) => setTempColor(hex)}
              >
                <Panel1 style={styles.colorPanel} />
                <HueSlider style={styles.hueSlider} />
              </ColorPicker>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Header banner image</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={handlePickImage}>
              {tempImage ? (
                <Text style={styles.uploadText}>Image selected. Tap to change.</Text>
              ) : (
                <Text style={styles.uploadText}>📷 Tap to upload (max 1MB)</Text>
              )}
            </TouchableOpacity>
            {tempImage && (
              <TouchableOpacity onPress={() => setTempImage(null)} style={{ marginTop: 5 }}>
                <Text style={{ color: '#d32f2f', fontSize: 12 }}>Remove Image</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Header Image Fit</Text>
            
            <TouchableOpacity 
              style={styles.dropdownToggle} 
              onPress={() => setDropdownOpen(!isDropdownOpen)}
            >
              <Text style={styles.dropdownText}>
                {tempFit === 'cover' ? 'Cover (Crop to fill)' : 'Contain (Show entire image)'}
              </Text>
              <Text>▼</Text>
            </TouchableOpacity>
            
            {isDropdownOpen && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity 
                  style={styles.dropdownItem} 
                  onPress={() => { setTempFit('cover'); setDropdownOpen(false); }}
                >
                  <Text>Cover (Crop to fill)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.dropdownItem, { borderBottomWidth: 0 }]} 
                  onPress={() => { setTempFit('contain'); setDropdownOpen(false); }}
                >
                  <Text>Contain (Show entire image)</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetText}>Reset Defaults</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 10,
  },
  dragHandleContainer: {
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#666',
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeBtn: {
    padding: 5,
  },
  closeText: {
    fontSize: 20,
    color: '#666',
  },
  scrollArea: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  colorCircle: {
    width: 45,
    height: 45,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#333',
  },
  selectedColor: {
    borderWidth: 4,
    borderColor: '#000',
  },
  customColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  customColorLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 15,
  },
  customColorPreview: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 10,
  },
  colorInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
  },
  colorPickerContainer: {
    height: 250,
    marginBottom: 10,
  },
  colorPicker: {
    width: '100%',
    height: '100%',
  },
  colorPanel: {
    flex: 1,
    borderRadius: 10,
    marginBottom: 10,
  },
  hueSlider: {
    borderRadius: 10,
    height: 30,
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    borderRadius: 10,
    backgroundColor: '#f9f9fa',
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    color: '#666',
    fontSize: 14,
  },
  dropdownToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#e6e6ea',
    padding: 15,
    borderRadius: 20,
    marginTop: 5,
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginTop: 5,
    backgroundColor: '#fff',
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    justifyContent: 'space-between',
  },
  resetBtn: {
    backgroundColor: '#c62828',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 0.45,
    alignItems: 'center',
  },
  resetText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  doneBtn: {
    backgroundColor: '#285da1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 0.45,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
