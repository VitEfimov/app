import React, { forwardRef, useImperativeHandle, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, View, StyleSheet } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * High-Performance Native-Driven Swipeable Row (RNGH PanGestureHandler + Native Animated)
 *
 * Designed specifically for React Native 0.76+ Fabric + FlashList v2:
 * 1. Drives pan tracking via `Animated.event(..., { useNativeDriver: true })` (RNGH NATIVE_ANIMATED_EVENT)
 *    and native `Animated.spring` / `Animated.timing` — zero JS bridge drag frames.
 * 2. Avoids `react-native-reanimated` `useAnimatedStyle` on list items so `ReanimatedCommitHook`
 *    never triggers Fabric Issue #6659 (`ModalHostView` collapsing to 0x0 on `BoardScreen`/`CalendarScreen`).
 * 3. Lazily mounts left/right background action drawers ONLY when a horizontal swipe crosses the active
 *    threshold (`State.ACTIVE`), cutting idle TaskRow view & SVG count during vertical FlashList scrolling.
 * 4. Plays a choreographed 60fps right-swipe completion glide, checkmark badge pop, and row fade-out
 *    before committing state update so the task completion transition feels fluid and tactile.
 */
const ReanimatedSwipeRow = forwardRef(function ReanimatedSwipeRow(
  {
    children,
    itemKey,
    leftThreshold = 140,
    rightActionsWidth = 144,
    rightThreshold = 40,
    onSwipeLeftOpen,
    onSwipeLeftThresholdReach,
    onWillOpen,
    onClose,
    renderLeftDrawer,
    renderRightDrawer,
    enabled = true,
  },
  ref
) {
  const dragX = useRef(new Animated.Value(0)).current;
  const rowTranslation = useRef(new Animated.Value(0)).current;
  const rowExitOpacity = useRef(new Animated.Value(1)).current;
  const rowExitScale = useRef(new Animated.Value(1)).current;
  const completeBadgePop = useRef(new Animated.Value(1)).current;
  const isOpenRef = useRef(false);
  const isCompletingRef = useRef(false);
  const [actionsMounted, setActionsMounted] = useState(false);

  // Reset swipe offset & unmount drawers cleanly when FlashList recycles this row
  useEffect(() => {
    dragX.stopAnimation();
    rowTranslation.stopAnimation();
    rowExitOpacity.stopAnimation();
    rowExitScale.stopAnimation();
    completeBadgePop.stopAnimation();
    dragX.setValue(0);
    rowTranslation.setValue(0);
    rowExitOpacity.setValue(1);
    rowExitScale.setValue(1);
    completeBadgePop.setValue(1);
    isOpenRef.current = false;
    isCompletingRef.current = false;
    setActionsMounted(prev => (prev ? false : prev));
  }, [itemKey, dragX, rowTranslation, rowExitOpacity, rowExitScale, completeBadgePop]);

  useEffect(() => {
    return () => {
      dragX.stopAnimation();
      rowTranslation.stopAnimation();
      rowExitOpacity.stopAnimation();
      rowExitScale.stopAnimation();
      completeBadgePop.stopAnimation();
    };
  }, [dragX, rowTranslation, rowExitOpacity, rowExitScale, completeBadgePop]);

  const ensureMounted = useCallback(() => {
    setActionsMounted(prev => (prev ? prev : true));
  }, []);

  const notifyWillOpen = useCallback(
    (dir) => {
      if (onWillOpen) onWillOpen(dir);
    },
    [onWillOpen]
  );

  const notifyClose = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  const notifyLeftComplete = useCallback(() => {
    if (onSwipeLeftOpen) onSwipeLeftOpen();
  }, [onSwipeLeftOpen]);

  const closeRow = useCallback(() => {
    isOpenRef.current = false;
    isCompletingRef.current = false;
    dragX.setValue(0);
    rowExitOpacity.setValue(1);
    rowExitScale.setValue(1);
    completeBadgePop.setValue(1);
    Animated.timing(rowTranslation, {
      toValue: 0,
      duration: 160,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished) {
        notifyClose();
      }
    });
  }, [dragX, rowTranslation, rowExitOpacity, rowExitScale, completeBadgePop, notifyClose]);

  useImperativeHandle(
    ref,
    () => ({
      close: closeRow,
    }),
    [closeRow]
  );

  const onGestureEvent = useMemo(
    () =>
      Animated.event([{ nativeEvent: { translationX: dragX } }], {
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    [dragX]
  );

  const onHandlerStateChange = useCallback(
    (event) => {
      const { state, oldState, translationX, velocityX } = event.nativeEvent;

      if (state === State.ACTIVE) {
        ensureMounted();
        return;
      }

      if (oldState !== State.ACTIVE || isCompletingRef.current) {
        return;
      }

      const maxRight = Math.max(80, leftThreshold * 2.2);
      const maxLeft = Math.max(40, rightActionsWidth);
      const startOffset = isOpenRef.current ? -rightActionsWidth : 0;
      const rawOffset = startOffset + translationX;
      const clampedCurrent = Math.max(-maxLeft * 1.08, Math.min(maxRight, rawOffset));

      // Transfer active drag displacement into base translation cleanly so zero visual jump occurs
      rowTranslation.setValue(clampedCurrent);
      dragX.setValue(0);

      if (!isOpenRef.current) {
        if (rawOffset >= leftThreshold || (rawOffset > leftThreshold * 0.55 && velocityX > 650)) {
          isOpenRef.current = false;
          isCompletingRef.current = true;
          if (onSwipeLeftThresholdReach) {
            try { onSwipeLeftThresholdReach(); } catch (_) {}
          }

          // Choreographed 2-stage Right-Swipe Complete animation:
          // 1. Pop the checkmark badge while sliding the row smoothly across to the right
          // 2. Fade & subtly scale the row out before dispatching the completion state change
          const slideOutTarget = Math.max(leftThreshold * 1.85, 260);
          Animated.parallel([
            Animated.sequence([
              Animated.spring(completeBadgePop, {
                toValue: 1.28,
                friction: 4,
                tension: 240,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.spring(completeBadgePop, {
                toValue: 1.05,
                friction: 6,
                tension: 180,
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
            ]),
            Animated.timing(rowTranslation, {
              toValue: slideOutTarget,
              duration: 210,
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(rowExitOpacity, {
              toValue: 0,
              duration: 195,
              delay: 15,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(rowExitScale, {
              toValue: 0.96,
              duration: 200,
              easing: Easing.out(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]).start(() => {
            isCompletingRef.current = false;
            notifyLeftComplete();
            // Reset values after dispatch so if the row stays in the list or is recycled, it is clean
            rowTranslation.setValue(0);
            rowExitOpacity.setValue(1);
            rowExitScale.setValue(1);
            completeBadgePop.setValue(1);
          });
          return;
        }

        if (rawOffset < -rightThreshold || (rawOffset < -18 && velocityX < -500)) {
          isOpenRef.current = true;
          notifyWillOpen('right');
          Animated.spring(rowTranslation, {
            toValue: -rightActionsWidth,
            velocity: velocityX,
            bounciness: 4,
            speed: 18,
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start();
          return;
        }
      } else if (translationX <= rightThreshold && velocityX <= 400 && rawOffset < -10) {
        Animated.spring(rowTranslation, {
          toValue: -rightActionsWidth,
          velocity: velocityX,
          bounciness: 4,
          speed: 18,
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start();
        return;
      }

      const wasOpen = isOpenRef.current;
      isOpenRef.current = false;
      Animated.spring(rowTranslation, {
        toValue: 0,
        velocity: velocityX,
        bounciness: 4,
        speed: 18,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start(({ finished }) => {
        if (finished && wasOpen) {
          notifyClose();
        }
      });
    },
    [
      ensureMounted,
      leftThreshold,
      rightActionsWidth,
      rightThreshold,
      rowTranslation,
      dragX,
      rowExitOpacity,
      rowExitScale,
      completeBadgePop,
      onSwipeLeftThresholdReach,
      notifyLeftComplete,
      notifyWillOpen,
      notifyClose,
    ]
  );

  const transX = useMemo(() => {
    const maxRight = Math.max(80, leftThreshold * 2.2);
    const maxLeft = Math.max(40, rightActionsWidth);
    return Animated.add(rowTranslation, dragX).interpolate({
      inputRange: [-maxLeft * 1.3, -maxLeft, 0, maxRight * 0.9, maxRight],
      outputRange: [-maxLeft * 1.08, -maxLeft, 0, maxRight * 0.9, maxRight],
      extrapolate: 'clamp',
    });
  }, [rowTranslation, dragX, leftThreshold, rightActionsWidth]);

  const foregroundStyle = useMemo(
    () => ({
      opacity: rowExitOpacity,
      transform: [
        { translateX: transX },
        { scale: rowExitScale },
      ],
    }),
    [transX, rowExitOpacity, rowExitScale]
  );

  const leftDrawerAnimStyle = useMemo(() => {
    const halfLeft = Math.max(20, leftThreshold * 0.5);
    const fullLeft = Math.max(40, leftThreshold);
    const dragScale = transX.interpolate({
      inputRange: [0, halfLeft, fullLeft, fullLeft * 1.6],
      outputRange: [0.68, 0.96, 1.12, 1.18],
      extrapolate: 'clamp',
    });
    return {
      opacity: Animated.multiply(
        rowExitOpacity,
        transX.interpolate({
          inputRange: [0, 6, 24, 55],
          outputRange: [0, 0.25, 0.75, 1],
          extrapolate: 'clamp',
        })
      ),
      transform: [
        {
          translateX: transX.interpolate({
            inputRange: [0, fullLeft, fullLeft * 1.8],
            outputRange: [-18, 4, 18],
            extrapolate: 'clamp',
          }),
        },
        {
          scale: Animated.multiply(dragScale, completeBadgePop),
        },
      ],
    };
  }, [transX, leftThreshold, rowExitOpacity, completeBadgePop]);

  const rightDrawerAnimStyle = useMemo(
    () => ({
      opacity: transX.interpolate({
        inputRange: [-10, -1, 0],
        outputRange: [1, 0.2, 0],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          scale: transX.interpolate({
            inputRange: [-90, 0],
            outputRange: [1, 0.4],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [transX]
  );

  return (
    <View style={styles.root}>
      {actionsMounted && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {renderLeftDrawer ? renderLeftDrawer(leftDrawerAnimStyle) : null}
          {renderRightDrawer ? renderRightDrawer(rightDrawerAnimStyle) : null}
        </View>
      )}
      <PanGestureHandler
        enabled={enabled}
        activeOffsetX={[-16, 16]}
        failOffsetY={[-10, 10]}
        touchAction="pan-y"
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View style={foregroundStyle}>{children}</Animated.View>
      </PanGestureHandler>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    overflow: 'hidden',
  },
});

export default ReanimatedSwipeRow;
