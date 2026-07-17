import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, PanResponder } from 'react-native';
import dayjs from 'dayjs';
import * as Localization from 'expo-localization';
import Svg, { Path, Circle, Line } from 'react-native-svg';

const IconKeyboard = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 5H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2z" />
    <Path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 17h8" />
  </Svg>
);

const IconClock = ({ color }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

export default function CustomTimePicker({ visible, value, onClose, onSave, colors, isDark }) {
  const [hour, setHour] = useState('12');
  const [minute, setMinute] = useState('00');
  const [isPM, setIsPM] = useState(false);
  const [inputMode, setInputMode] = useState('dial');
  const [dialMode, setDialMode] = useState('hour');
  const [is24Hour, setIs24Hour] = useState(false);

  useEffect(() => {
    const uses24Hour = Localization.getCalendars()[0]?.uses24hourClock ?? false;
    setIs24Hour(uses24Hour);
  }, []);

  useEffect(() => {
    if (visible) {
      if (value && value !== '--:--') {
        const d = dayjs(`2000-01-01T${value}`);
        if (d.isValid()) {
          let h = d.hour();
          if (!is24Hour) {
            setIsPM(h >= 12);
            if (h > 12) h -= 12;
            if (h === 0) h = 12;
          }
          setHour(h.toString());
          setMinute(d.format('mm'));
        }
      } else {
        const now = dayjs();
        let h = now.hour();
        if (!is24Hour) {
          setIsPM(h >= 12);
          if (h > 12) h -= 12;
          if (h === 0) h = 12;
        }
        setHour(h.toString());
        setMinute(now.format('mm'));
      }
      setDialMode('hour');
    }
  }, [visible, value, is24Hour]);

  const handleSave = () => {
    let h = parseInt(hour, 10) || 0;
    const m = parseInt(minute, 10) || 0;
    
    if (!is24Hour) {
      if (h < 1 || h > 12) h = 12;
      if (isPM && h !== 12) h += 12;
      if (!isPM && h === 12) h = 0;
    } else {
      if (h < 0 || h > 23) h = 0;
    }

    const formattedHour = h.toString().padStart(2, '0');
    const formattedMinute = m.toString().padStart(2, '0');
    onSave(`${formattedHour}:${formattedMinute}`);
  };

  const handleHourChange = (text) => {
    const numeric = text.replace(/[^0-9]/g, '');
    setHour(numeric);
  };

  const handleHourBlur = () => {
    let h = parseInt(hour, 10);
    if (!is24Hour) {
      if (isNaN(h) || h < 1 || h > 12) h = 12;
    } else {
      if (isNaN(h) || h < 0 || h > 23) h = 0;
    }
    setHour(h.toString());
  };

  const handleMinuteChange = (text) => {
    const numeric = text.replace(/[^0-9]/g, '');
    setMinute(numeric);
  };

  const handleMinuteBlur = () => {
    let m = parseInt(minute, 10);
    if (isNaN(m) || m < 0 || m > 59) m = 0;
    setMinute(m.toString().padStart(2, '0'));
  };

  const stateRef = useRef({ dialMode, is24Hour, hour, minute });
  useEffect(() => {
    stateRef.current = { dialMode, is24Hour, hour, minute };
  }, [dialMode, is24Hour, hour, minute]);

  const clockCenterGlobal = useRef({ x: 0, y: 0 });

  const handleDialMove = (globalX, globalY, isRelease = false) => {
    if (!clockCenterGlobal.current.x) return;

    const dx = globalX - clockCenterGlobal.current.x;
    const dy = globalY - clockCenterGlobal.current.y;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    angle = angle + 90;
    if (angle < 0) angle += 360;

    const currentDialMode = stateRef.current.dialMode;
    const currentIs24Hour = stateRef.current.is24Hour;

    if (currentDialMode === 'hour') {
      let h = Math.round(angle / 30);
      if (h === 12) h = 0; 
      
      if (!currentIs24Hour) {
        h = h === 0 ? 12 : h;
        setHour(h.toString());
      } else {
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 75) {
          h = h === 0 ? 12 : h;
        } else {
          h = h === 0 ? 0 : h + 12;
        }
        setHour(h.toString());
      }
      if (isRelease) {
        setDialMode('minute');
      }
    } else {
      let m = Math.round(angle / 6);
      if (m === 60) m = 0;
      setMinute(m.toString().padStart(2, '0'));
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        const { pageX, pageY, locationX, locationY } = evt.nativeEvent;
        if (locationX !== undefined && pageX !== undefined) {
          clockCenterGlobal.current = {
            x: pageX - locationX + 125,
            y: pageY - locationY + 125,
          };
        }
        handleDialMove(gestureState.x0, gestureState.y0, false);
      },
      onPanResponderMove: (evt, gestureState) => {
        handleDialMove(gestureState.moveX, gestureState.moveY, false);
      },
      onPanResponderRelease: (evt, gestureState) => {
        handleDialMove(gestureState.moveX, gestureState.moveY, true);
      },
      onPanResponderTerminate: (evt, gestureState) => {
        handleDialMove(gestureState.moveX, gestureState.moveY, true);
      }
    })
  ).current;

  const ClockDial = () => {
    const radius = 100;
    const center = { x: 125, y: 125 };
    
    const items = [];
    if (dialMode === 'hour') {
      if (!is24Hour) {
        for (let i = 1; i <= 12; i++) {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          items.push({
            label: i.toString(),
            x: center.x + radius * 0.8 * Math.cos(angle),
            y: center.y + radius * 0.8 * Math.sin(angle),
            value: i.toString()
          });
        }
      } else {
        for (let i = 0; i <= 23; i++) {
          const isOuter = (i >= 1 && i <= 12);
          const displayI = (i === 0 || i === 12) ? 0 : (i % 12);
          const r = isOuter ? radius * 0.8 : radius * 0.5;
          const angle = (displayI * 30 - 90) * (Math.PI / 180);
          items.push({
            label: i.toString().padStart(2, '0'),
            x: center.x + r * Math.cos(angle),
            y: center.y + r * Math.sin(angle),
            value: i.toString(),
            isInner: !isOuter
          });
        }
      }
    } else {
      for (let i = 0; i < 60; i += 5) {
        const angle = (i * 6 - 90) * (Math.PI / 180);
        items.push({
          label: i.toString().padStart(2, '0'),
          x: center.x + radius * 0.8 * Math.cos(angle),
          y: center.y + radius * 0.8 * Math.sin(angle),
          value: i.toString()
        });
      }
    }

    const currentValue = dialMode === 'hour' ? hour : minute;
    const currentValInt = parseInt(currentValue, 10) || 0;

    let arrowAngle = 0;
    let arrowRadius = radius * 0.8;

    if (dialMode === 'hour') {
      let displayI = currentValInt;
      if (is24Hour) {
        const isOuter = (currentValInt >= 1 && currentValInt <= 12);
        arrowRadius = isOuter ? radius * 0.8 : radius * 0.5;
        displayI = (currentValInt === 0 || currentValInt === 12) ? 0 : (currentValInt % 12);
      } else {
        if (displayI === 12) displayI = 0;
      }
      arrowAngle = (displayI * 30 - 90) * (Math.PI / 180);
    } else {
      arrowAngle = (currentValInt * 6 - 90) * (Math.PI / 180);
    }

    const arrowX = center.x + arrowRadius * Math.cos(arrowAngle);
    const arrowY = center.y + arrowRadius * Math.sin(arrowAngle);

    return (
      <View style={styles.dialContainer}>
        <View style={[styles.dialCircle, { backgroundColor: colors.surfaceContainerHigh }]}>
          <Svg width="250" height="250" style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
            <Circle cx={center.x} cy={center.y} r="4" fill={colors.primary} />
            <Line 
              x1={center.x} y1={center.y} 
              x2={arrowX} y2={arrowY} 
              stroke={colors.primary} strokeWidth="2" 
            />
            <Circle cx={arrowX} cy={arrowY} r="16" fill={colors.primary} />
          </Svg>
          
          {items.map((item, index) => {
            const isSelected = parseInt(item.value, 10) === currentValInt;
            return (
              <View
                key={index}
                style={[
                  styles.dialNumberBtn,
                  { left: item.x - 16, top: item.y - 16 }
                ]}
                pointerEvents="none"
              >
                <Text style={[
                  styles.dialNumberText,
                  { color: isSelected ? colors.textInverse : colors.textPrimary },
                  item.isInner && !isSelected && { fontSize: 13, color: colors.textSecondary }
                ]}>
                  {item.label}
                </Text>
              </View>
            );
          })}
          
          <View 
            style={{ position: 'absolute', top: 0, left: 0, width: 250, height: 250, backgroundColor: 'transparent' }}
            {...panResponder.panHandlers}
          />
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'position'} style={{ width: '100%', alignItems: 'center' }}>
            <View style={[styles.container, { backgroundColor: colors.bgCard }]}>
              
              <Text style={[styles.title, { color: colors.textSecondary }]}>
                {inputMode === 'dial' ? 'Select time' : 'Enter time'}
              </Text>
              
              <View style={styles.headerSelection}>
                 <TouchableOpacity onPress={() => setDialMode('hour')} style={[styles.timeDisplayBtn, dialMode === 'hour' && { backgroundColor: colors.surfaceContainerHigh }]}>
                   <Text style={[styles.timeDisplayText, { color: dialMode === 'hour' ? colors.primary : colors.textPrimary }]}>
                     {hour.padStart(2, '0')}
                   </Text>
                 </TouchableOpacity>
                 <Text style={[styles.separator, { color: colors.textPrimary }]}>:</Text>
                 <TouchableOpacity onPress={() => setDialMode('minute')} style={[styles.timeDisplayBtn, dialMode === 'minute' && { backgroundColor: colors.surfaceContainerHigh }]}>
                   <Text style={[styles.timeDisplayText, { color: dialMode === 'minute' ? colors.primary : colors.textPrimary }]}>
                     {minute.padStart(2, '0')}
                   </Text>
                 </TouchableOpacity>

                 {!is24Hour && (
                    <View style={[styles.ampmContainer, { borderColor: colors.borderColor }]}>
                      <TouchableOpacity
                        style={[styles.ampmBtn, !isPM && { backgroundColor: colors.primaryContainer }]}
                        onPress={() => setIsPM(false)}
                      >
                        <Text style={[styles.ampmText, { color: !isPM ? colors.textInverse : colors.textSecondary }, !isPM && { color: colors.primary, fontWeight: 'bold' }]}>AM</Text>
                      </TouchableOpacity>
                      <View style={[styles.ampmDivider, { backgroundColor: colors.borderColor }]} />
                      <TouchableOpacity
                        style={[styles.ampmBtn, isPM && { backgroundColor: colors.primaryContainer }]}
                        onPress={() => setIsPM(true)}
                      >
                        <Text style={[styles.ampmText, { color: isPM ? colors.textInverse : colors.textSecondary }, isPM && { color: colors.primary, fontWeight: 'bold' }]}>PM</Text>
                      </TouchableOpacity>
                    </View>
                 )}
              </View>

              {inputMode === 'keyboard' ? (
                <View style={styles.inputContainer}>
                  <View style={styles.inputGroup}>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surfaceContainerHigh, color: colors.textPrimary, borderColor: colors.primary }]}
                      value={hour}
                      onChangeText={handleHourChange}
                      onBlur={handleHourBlur}
                      keyboardType="number-pad"
                      maxLength={2}
                      selectTextOnFocus
                    />
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Hour</Text>
                  </View>

                  <Text style={[styles.separatorKeyboard, { color: colors.textPrimary }]}>:</Text>

                  <View style={styles.inputGroup}>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.surfaceContainerHigh, color: colors.textPrimary, borderColor: colors.primary }]}
                      value={minute}
                      onChangeText={handleMinuteChange}
                      onBlur={handleMinuteBlur}
                      keyboardType="number-pad"
                      maxLength={2}
                      selectTextOnFocus
                    />
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Minute</Text>
                  </View>
                </View>
              ) : (
                <ClockDial />
              )}

              <View style={styles.bottomRow}>
                <TouchableOpacity onPress={() => setInputMode(inputMode === 'dial' ? 'keyboard' : 'dial')} style={styles.toggleBtn}>
                  {inputMode === 'dial' ? <IconKeyboard color={colors.textSecondary} /> : <IconClock color={colors.textSecondary} />}
                </TouchableOpacity>
                
                <View style={styles.actions}>
                  <TouchableOpacity onPress={onClose} style={styles.actionBtn}>
                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSave} style={styles.actionBtn}>
                    <Text style={[styles.actionText, { color: colors.primary, fontWeight: 'bold' }]}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 320,
    borderRadius: 24,
    padding: 24,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
    marginLeft: 4,
  },
  headerSelection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  timeDisplayBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  timeDisplayText: {
    fontSize: 40,
  },
  separator: {
    fontSize: 40,
    marginHorizontal: 8,
  },
  separatorKeyboard: {
    fontSize: 40,
    marginHorizontal: 10,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  inputGroup: {
    alignItems: 'center',
  },
  input: {
    width: 90,
    height: 70,
    borderRadius: 8,
    fontSize: 40,
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    marginTop: 8,
  },
  ampmContainer: {
    flexDirection: 'column',
    borderWidth: 1,
    borderRadius: 8,
    marginLeft: 15,
    overflow: 'hidden',
  },
  ampmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ampmText: {
    fontSize: 14,
    fontWeight: '500',
  },
  ampmDivider: {
    height: 1,
    width: '100%',
  },
  dialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  dialCircle: {
    width: 250,
    height: 250,
    borderRadius: 125,
    position: 'relative',
  },
  dialNumberBtn: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialNumberText: {
    fontSize: 15,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleBtn: {
    padding: 10,
  },
  actions: {
    flexDirection: 'row',
  },
  actionBtn: {
    marginLeft: 10,
    padding: 10,
  },
  actionText: {
    fontSize: 15,
  },
});
