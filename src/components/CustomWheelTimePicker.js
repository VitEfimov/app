import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import dayjs from 'dayjs';
import * as Localization from 'expo-localization';
import Animated, { 
  useSharedValue, 
  useAnimatedScrollHandler, 
  useAnimatedStyle, 
  interpolate, 
  Extrapolation, 
  runOnJS,
  useAnimatedRef,
  useAnimatedReaction,
  scrollTo,
  withSpring,
  withTiming,
  runOnUI
} from 'react-native-reanimated';

const ITEM_HEIGHT = 60;
const VISIBLE_ITEMS = 5;

const WheelItem = React.memo(({ index, item, scrollY, colors }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const itemOffset = index * ITEM_HEIGHT;
    const distanceFromCenter = Math.abs(scrollY.value - itemOffset);
    
    const scale = interpolate(
      distanceFromCenter,
      [0, ITEM_HEIGHT, ITEM_HEIGHT * 2],
      [1.1, 0.8, 0.6],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      distanceFromCenter,
      [0, ITEM_HEIGHT, ITEM_HEIGHT * 2],
      [1, 0.4, 0.15],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View style={[{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }, animatedStyle]}>
      <Text style={{ fontSize: 32, color: colors.textPrimary, fontWeight: '500' }}>{item.label}</Text>
    </Animated.View>
  );
});

const InfiniteWheel = ({ data, selectedValue, onValueChange, colors, infinite = true }) => {
  const originalLength = data.length;
  const loops = infinite ? 200 : 1;
  
  const renderData = useMemo(() => {
    if (!infinite) return data;
    const list = [];
    for (let i = 0; i < loops; i++) {
      for (let j = 0; j < originalLength; j++) {
        list.push({ ...data[j], realIndex: list.length });
      }
    }
    return list;
  }, [data, infinite, loops, originalLength]);

  const initialIndex = useMemo(() => {
    let idx = data.findIndex(d => d.value === selectedValue);
    if (idx === -1) idx = 0;
    if (infinite) {
      const middleLoop = Math.floor(loops / 2);
      idx = middleLoop * originalLength + idx;
    }
    return idx;
  }, []); 

  const flatListRef = React.useRef(null);
  const animatedRef = useAnimatedRef();
  const timeoutRef = React.useRef(null);

  const scrollY = useSharedValue(initialIndex * ITEM_HEIGHT);
  const isAutoScrolling = useSharedValue(false);

  const handleScrollRest = React.useCallback((y) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const index = Math.round(y / ITEM_HEIGHT);
      if (renderData[index]) {
        onValueChange(renderData[index].value);
        const targetOffset = index * ITEM_HEIGHT;
        if (Math.abs(y - targetOffset) > 1) {
          isAutoScrolling.value = true;
          runOnUI(() => {
            // Instant rigid hook
            scrollY.value = withTiming(targetOffset, { duration: 80 }, (finished) => {
              if (finished) isAutoScrolling.value = false;
            });
          })();
        }
      }
    }, 50); // extremely short delay
  }, [renderData, onValueChange]);

  useAnimatedReaction(
    () => scrollY.value,
    (val) => {
      if (isAutoScrolling.value) {
        scrollTo(animatedRef, 0, val, false);
      }
    }
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      if (!isAutoScrolling.value) {
        scrollY.value = event.contentOffset.y;
      }
      runOnJS(handleScrollRest)(event.contentOffset.y);
    }
  });

  return (
    <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width: 80, overflow: 'hidden' }}>
      <Animated.FlatList
        ref={animatedRef}
        data={renderData}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={() => {
              const targetOffset = index * ITEM_HEIGHT;
              isAutoScrolling.value = true;
              runOnUI(() => {
                scrollY.value = withTiming(targetOffset, { duration: 80 }, (finished) => {
                  if (finished) isAutoScrolling.value = false;
                });
              })();
              onValueChange(item.value);
            }}
          >
            <WheelItem index={index} item={item} scrollY={scrollY} colors={colors} />
          </TouchableOpacity>
        )}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        initialScrollIndex={initialIndex}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2)
        }}
        initialNumToRender={20}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
};

export default function CustomWheelTimePicker({ visible, value, onClose, onSave, colors, isDark }) {
  const [hour, setHour] = useState('12');
  const [minute, setMinute] = useState('00');
  const [isPM, setIsPM] = useState(false);
  const [is24Hour, setIs24Hour] = useState(false);
  const [internalVisible, setInternalVisible] = useState(false);

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
      // Ensure the wheels don't mount until the state is fully updated
      setInternalVisible(true);
    } else {
      setInternalVisible(false);
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

    const formattedHour = h.toString().padStart(2, "0");
    const formattedMinute = m.toString().padStart(2, "0");

    onSave(`${formattedHour}:${formattedMinute}`);
  };

  const hourData = useMemo(() => {
    const arr = [];
    if (is24Hour) {
      for (let i = 0; i < 24; i++) {
        arr.push({ label: i.toString().padStart(2, '0'), value: i.toString() });
      }
    } else {
      for (let i = 1; i <= 12; i++) {
        arr.push({ label: i.toString().padStart(2, '0'), value: i.toString() });
      }
    }
    return arr;
  }, [is24Hour]);

  const minuteData = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 60; i++) {
      arr.push({ label: i.toString().padStart(2, '0'), value: i.toString().padStart(2, '0') });
    }
    return arr;
  }, []);

  const amPmData = useMemo(() => [
    { label: 'AM', value: 'AM' },
    { label: 'PM', value: 'PM' }
  ], []);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View pointerEvents="box-none" style={{ flex: 1, width: '100%' }}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'position'} style={{ width: '100%', alignItems: 'center' }}>
            <View style={[styles.container, { backgroundColor: colors.bgCard }]}>
              
              <Text style={[styles.title, { color: colors.textSecondary }]}>Select time</Text>

              {/* Only mount the picker once the state has fully parsed the incoming `value` */}
              {internalVisible ? (
                <View style={styles.pickerContainer}>
                  
                  {/* Horizontal Highlights overlay */}
                  <View style={[styles.highlightArea, { borderColor: colors.primary }]} pointerEvents="none" />

                  <InfiniteWheel 
                    data={hourData} 
                    selectedValue={hour} 
                    onValueChange={setHour} 
                    colors={colors} 
                    infinite={true} 
                  />
                  
                  <Text style={[styles.separator, { color: colors.textPrimary }]}>:</Text>
                  
                  <InfiniteWheel 
                    data={minuteData} 
                    selectedValue={minute.padStart(2, '0')} 
                    onValueChange={setMinute} 
                    colors={colors} 
                    infinite={true} 
                  />

                  {!is24Hour && (
                    <>
                      <View style={{ width: 10 }} />
                      <InfiniteWheel 
                        data={amPmData} 
                        selectedValue={isPM ? 'PM' : 'AM'} 
                        onValueChange={(val) => setIsPM(val === 'PM')} 
                        colors={colors} 
                        infinite={false} 
                      />
                    </>
                  )}

                </View>
              ) : (
                <View style={styles.pickerContainer} />
              )}

              <View style={styles.actions}>
                <TouchableOpacity onPress={onClose} style={styles.actionBtn}>
                  <Text style={[styles.actionText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={styles.actionBtn}>
                  <Text style={[styles.actionText, { color: colors.primary, fontWeight: 'bold' }]}>OK</Text>
                </TouchableOpacity>
              </View>

            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
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
    width: 340,
    borderRadius: 24,
    padding: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    marginLeft: 4,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: ITEM_HEIGHT * 5,
    marginBottom: 30,
    position: 'relative'
  },
  separator: {
    fontSize: 40,
    marginHorizontal: 10,
    fontWeight: '300'
  },
  highlightArea: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2, // Centered (5 items tall, so middle is at index 2)
    left: 10,
    right: 10,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  actionBtn: {
    marginLeft: 20,
    padding: 10,
  },
  actionText: {
    fontSize: 16,
  }
});
