import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import dayjs from 'dayjs';
import * as Localization from 'expo-localization';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  interpolateColor,
  Extrapolation,
  runOnJS,
  useAnimatedRef,
  scrollTo,
} from 'react-native-reanimated';

const ITEM_HEIGHT = 60;
const VISIBLE_ITEMS = 5;

const AnimatedText = Animated.createAnimatedComponent(Text);

const WheelItem = React.memo(({ index, item, scrollY, colors }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const itemOffset = index * ITEM_HEIGHT;
    const distanceFromCenter = Math.abs(scrollY.value - itemOffset);

    const opacity = interpolate(
      distanceFromCenter,
      [0, ITEM_HEIGHT, ITEM_HEIGHT * 2],
      [1, 0.5, 0.2],
      Extrapolation.CLAMP
    );

    return { opacity };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    const itemOffset = index * ITEM_HEIGHT;
    const distanceFromCenter = Math.abs(scrollY.value - itemOffset);

    const color = interpolateColor(
      distanceFromCenter,
      [0, ITEM_HEIGHT / 2, ITEM_HEIGHT],
      [colors.primary, colors.textSecondary, colors.textSecondary]
    );

    const fontSize = interpolate(
      distanceFromCenter,
      [0, ITEM_HEIGHT],
      [32, 26],
      Extrapolation.CLAMP
    );

    return { color, fontSize };
  });

  return (
    <Animated.View style={[{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }, animatedStyle]}>
      <AnimatedText style={[{ fontWeight: '400' }, animatedTextStyle]}>{item.label}</AnimatedText>
    </Animated.View>
  );
});

const InfiniteWheel = ({ data, selectedValue, onValueChange, colors, infinite = true }) => {
  const originalLength = data.length;
  const loops = infinite ? 20 : 1;

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

  const flatListRef = useAnimatedRef();
  const scrollY = useSharedValue(initialIndex * ITEM_HEIGHT);
  const currentIndex = useSharedValue(initialIndex);

  const handleIndexChange = React.useCallback((index) => {
    if (!renderData[index]) return;
    onValueChange(renderData[index].value);
  }, [renderData, onValueChange]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const index = Math.round(event.contentOffset.y / ITEM_HEIGHT);
      if (currentIndex.value !== index) {
        currentIndex.value = index;
        runOnJS(handleIndexChange)(index);
      }
    },
    onEndDrag: (event) => {
      if (Math.abs(event.velocity?.y || 0) < 0.2) {
        const targetIndex = Math.round(event.contentOffset.y / ITEM_HEIGHT);
        scrollTo(flatListRef, 0, targetIndex * ITEM_HEIGHT, true);
      }
    },
    onMomentumEnd: (event) => {
      const targetIndex = Math.round(event.contentOffset.y / ITEM_HEIGHT);
      scrollTo(flatListRef, 0, targetIndex * ITEM_HEIGHT, true);
    },
  });

  return (
    <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width: 80, overflow: 'hidden' }}>
      <Animated.FlatList
        ref={flatListRef}
        data={renderData}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              const targetOffset = index * ITEM_HEIGHT;
              flatListRef.current?.scrollToOffset({
                offset: targetOffset,
                animated: true,
              });
              onValueChange(item.value);
            }}
          >
            <WheelItem index={index} item={item} scrollY={scrollY} colors={colors} />
          </TouchableOpacity>
        )}
        showsVerticalScrollIndicator={false}
        decelerationRate={0.9}
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

  const dividerColor = isDark ? '#333333' : '#e0e0e0';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View pointerEvents="box-none" style={{ flex: 1, width: '100%' }}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'position'} style={{ width: '100%', alignItems: 'center' }}>
            <View style={[styles.container, { backgroundColor: colors.bgCard }]}>

              {/* Only rendering title if needed, left out in mockup but good for context, we can keep it hidden or styled subtly */}
              {/* <Text style={[styles.title, { color: colors.textSecondary }]}>Select time</Text> */}

              {internalVisible ? (
                <View style={styles.pickerContainer}>

                  <View style={[styles.highlightArea, { borderColor: colors.primary }]} pointerEvents="none" />

                  <InfiniteWheel
                    data={hourData}
                    selectedValue={hour}
                    onValueChange={setHour}
                    colors={colors}
                    infinite={true}
                  />

                  <Text style={[styles.separator, { color: colors.primary }]}>:</Text>

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

              <View style={[styles.divider, { backgroundColor: dividerColor }]} />

              <View style={styles.actions}>
                <TouchableOpacity onPress={onClose} style={[styles.actionBtn, { borderRightWidth: 1, borderColor: dividerColor }]}>
                  <Text style={[styles.actionText, { color: colors.textPrimary, fontWeight: '600' }]}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={styles.actionBtn}>
                  <Text style={[styles.actionText, { color: colors.primary, fontWeight: '600' }]}>SAVE</Text>
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
    width: 320,
    borderRadius: 16,
    paddingTop: 30,
    overflow: 'hidden',
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    marginLeft: 24,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: ITEM_HEIGHT * 5,
    marginBottom: 20,
    position: 'relative'
  },
  separator: {
    fontSize: 40,
    marginHorizontal: 10,
    fontWeight: '400',
    paddingBottom: 4,
  },
  highlightArea: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 20,
    right: 20,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    height: 55,
  },
  actionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    letterSpacing: 0.5,
  }
});
