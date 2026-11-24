import React, { forwardRef, useImperativeHandle, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, View, StyleSheet } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * ============================================================================
 * MANUAL SWIPE ANIMATION TUNING CONFIG
 * You can adjust these values to regulate the speed and feel of all row swipes:
 * - completeGlideDurationMs: How long (ms) the row takes to smoothly close on right-swipe complete (e.g. 180 - 280)
 * - completeBadgePopScale: Peak scale of the green checkmark badge pop (e.g. 1.0 = no pop, 1.16 = subtle pop)
 * - completeRowEndOpacity: Row opacity at the end of the close glide (1 = keep row solid with no dark gap)
 * - completeRowEndScale: Row scale at the end of the close glide (1 = normal size)
 * - leftSwipeOpenDurationMs: How long (ms) the left-swipe action menu takes to snap open
 * - snapCancelDurationMs: How long (ms) a canceled swipe takes to glide back to 0
 * - programmaticCloseDurationMs: How long (ms) closeRow() takes when closing an open menu
 * ============================================================================
 */
export const SWIPE_ANIMATION_CONFIG = {
  completeGlideDurationMs: 210,
  completeBadgePopScale: 1.15,
  completeBadgePopUpMs: 85,
  completeBadgePopDownMs: 125,
  completeRowEndOpacity: 1,
  completeRowEndScale: 1,
  leftSwipeOpenDurationMs: 200,
  leftSwipeReopenDurationMs: 180,
  snapCancelDurationMs: 190,
  programmaticCloseDurationMs: 160,
  easingCurve: Easing.bezier(0.25, 0.1, 0.25, 1),
};

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
    // Also flush native animated nodes to 0 on the UI thread in case a trailing RNGH event fired during recycle
    Animated.parallel([
      Animated.timing(dragX, { toValue: 0, duration: 1, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(rowTranslation, { toValue: 0, duration: 1, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
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
    rowExitOpacity.setValue(1);
    rowExitScale.setValue(1);
    completeBadgePop.setValue(1);
    Animated.parallel([
      Animated.timing(dragX, {
        toValue: 0,
        duration: SWIPE_ANIMATION_CONFIG.programmaticCloseDurationMs,
        easing: SWIPE_ANIMATION_CONFIG.easingCurve,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(rowTranslation, {
        toValue: 0,
        duration: SWIPE_ANIMATION_CONFIG.programmaticCloseDurationMs,
        easing: SWIPE_ANIMATION_CONFIG.easingCurve,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(({ finished }) => {
      dragX.setValue(0);
      rowTranslation.setValue(0);
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

      const startOffset = isOpenRef.current ? -rightActionsWidth : 0;
      const rawOffset = startOffset + translationX;

      if (!isOpenRef.current) {
        if (rawOffset >= leftThreshold || (rawOffset > leftThreshold * 0.55 && velocityX > 650)) {
          isOpenRef.current = false;
          isCompletingRef.current = true;
          if (onSwipeLeftThresholdReach) {
            try { onSwipeLeftThresholdReach(); } catch (_) {}
          }

          // Smooth natural completion glide configured via SWIPE_ANIMATION_CONFIG.
          // Uses deterministic Animated.timing (never open-ended Animated.spring) so there is zero ~1s pause/gap.
          const {
            completeGlideDurationMs,
            completeBadgePopScale,
            completeBadgePopUpMs,
            completeBadgePopDownMs,
            completeRowEndOpacity,
            completeRowEndScale,
            easingCurve,
          } = SWIPE_ANIMATION_CONFIG;

          Animated.parallel([
            Animated.sequence([
              Animated.timing(completeBadgePop, {
                toValue: completeBadgePopScale,
                duration: completeBadgePopUpMs,
                easing: Easing.out(Easing.quad),
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.timing(completeBadgePop, {
                toValue: 1,
                duration: completeBadgePopDownMs,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
            ]),
            Animated.timing(dragX, {
              toValue: 0,
              duration: completeGlideDurationMs,
              easing: easingCurve,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(rowTranslation, {
              toValue: 0,
              duration: completeGlideDurationMs,
              easing: easingCurve,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(rowExitOpacity, {
              toValue: completeRowEndOpacity,
              duration: completeGlideDurationMs,
              easing: easingCurve,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(rowExitScale, {
              toValue: completeRowEndScale,
              duration: completeGlideDurationMs,
              easing: easingCurve,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]).start(() => {
            isCompletingRef.current = false;
            dragX.setValue(0);
            rowTranslation.setValue(0);
            rowExitOpacity.setValue(1);
            rowExitScale.setValue(1);
            completeBadgePop.setValue(1);
            setActionsMounted(false);
            notifyLeftComplete();
          });
          return;
        }

        if (rawOffset < -rightThreshold || (rawOffset < -18 && velocityX < -500)) {
          isOpenRef.current = true;
          notifyWillOpen('right');
          Animated.parallel([
            Animated.timing(dragX, {
              toValue: 0,
              duration: SWIPE_ANIMATION_CONFIG.leftSwipeOpenDurationMs,
              easing: SWIPE_ANIMATION_CONFIG.easingCurve,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.timing(rowTranslation, {
              toValue: -rightActionsWidth,
              duration: SWIPE_ANIMATION_CONFIG.leftSwipeOpenDurationMs,
              easing: SWIPE_ANIMATION_CONFIG.easingCurve,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]).start(() => {
            dragX.setValue(0);
            rowTranslation.setValue(-rightActionsWidth);
          });
          return;
        }
      } else if (translationX <= rightThreshold && velocityX <= 400 && rawOffset < -10) {
        Animated.parallel([
          Animated.timing(dragX, {
            toValue: 0,
            duration: SWIPE_ANIMATION_CONFIG.leftSwipeReopenDurationMs,
            easing: SWIPE_ANIMATION_CONFIG.easingCurve,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(rowTranslation, {
            toValue: -rightActionsWidth,
            duration: SWIPE_ANIMATION_CONFIG.leftSwipeReopenDurationMs,
            easing: SWIPE_ANIMATION_CONFIG.easingCurve,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]).start(() => {
          dragX.setValue(0);
          rowTranslation.setValue(-rightActionsWidth);
        });
        return;
      }

      const wasOpen = isOpenRef.current;
      isOpenRef.current = false;
      Animated.parallel([
        Animated.timing(dragX, {
          toValue: 0,
          duration: SWIPE_ANIMATION_CONFIG.snapCancelDurationMs,
          easing: SWIPE_ANIMATION_CONFIG.easingCurve,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(rowTranslation, {
          toValue: 0,
          duration: SWIPE_ANIMATION_CONFIG.snapCancelDurationMs,
          easing: SWIPE_ANIMATION_CONFIG.easingCurve,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start(({ finished }) => {
        dragX.setValue(0);
        rowTranslation.setValue(0);
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

  const leftContainerAnimStyle = useMemo(
    () => ({
      opacity: Animated.multiply(
        rowExitOpacity,
        transX.interpolate({
          inputRange: [0, 2, 16],
          outputRange: [0, 1, 1],
          extrapolate: 'clamp',
        })
      ),
    }),
    [transX, rowExitOpacity]
  );

  const rightContainerAnimStyle = useMemo(
    () => ({
      opacity: transX.interpolate({
        inputRange: [-16, -2, 0],
        outputRange: [1, 1, 0],
        extrapolate: 'clamp',
      }),
    }),
    [transX]
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
          {renderLeftDrawer ? (
            <Animated.View style={[StyleSheet.absoluteFill, leftContainerAnimStyle]} pointerEvents="none">
              {renderLeftDrawer(leftDrawerAnimStyle)}
            </Animated.View>
          ) : null}
          {renderRightDrawer ? (
            <Animated.View style={[StyleSheet.absoluteFill, rightContainerAnimStyle]} pointerEvents="box-none">
              {renderRightDrawer(rightDrawerAnimStyle)}
            </Animated.View>
          ) : null}
        </View>
      )}
      <PanGestureHandler
        key={itemKey}
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
