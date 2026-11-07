import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Animated,
  AppState,
  Easing,
  KeyboardAvoidingView,
  Modal as RNModal,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';

export function normalizeSwipeDirections(swipeDirection) {
  if (!swipeDirection) return [];
  if (Array.isArray(swipeDirection)) return swipeDirection.filter(Boolean);
  if (typeof swipeDirection === 'string') return [swipeDirection];
  return [];
}

/**
 * Fabric-safe, 60/120 FPS drop-in replacement for `react-native-modal`.
 *
 * Fixes React 18 / React Native 0.76+ New Architecture (Fabric) issues in `react-native-modal@13`:
 * 1. Never touches private `e._dispatchInstances.some(...)` (which throws `TypeError` on Fabric
 *    when `accumulateInto` stores a single FiberNode instead of an Array).
 * 2. Never steals `TOUCH_DOWN` via `onStartShouldSetPanResponder: () => true`, allowing child
 *    `TextInput`, `ScrollView`, and `TouchableOpacity` elements to receive taps/scrolls directly.
 * 3. Uses React Native `Animated` (`useNativeDriver` on native) instead of legacy `react-native-animatable`,
 *    with timeout & `AppState` guards so modals never freeze on initial mount or minimize/restore.
 */
export function AppModal({
  isVisible = false,
  children,
  style,
  testID,
  animationIn = 'slideInUp',
  animationOut = 'slideOutDown',
  animationInTiming = 220,
  animationOutTiming = 180,
  hasBackdrop = true,
  backdropColor = 'black',
  backdropOpacity = 0.7,
  customBackdrop = null,
  onBackdropPress,
  onBackButtonPress,
  onModalShow,
  onModalWillShow,
  onModalHide,
  onModalWillHide,
  swipeDirection,
  swipeThreshold = 100,
  onSwipeComplete,
  onSwipeStart,
  onSwipeMove,
  scrollOffset = 0,
  avoidKeyboard = false,
  coverScreen = true,
  statusBarTranslucent = true,
  supportedOrientations = ['portrait', 'landscape'],
}) {
  const { width: rawWidth, height: rawHeight } = useWindowDimensions();
  const windowWidth = rawWidth > 0 ? rawWidth : 360;
  const windowHeight = rawHeight > 0 ? rawHeight : 800;

  const [modalVisible, setModalVisible] = useState(Boolean(isVisible));
  const animProgress = useRef(new Animated.Value(0)).current;
  const swipeOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const wasVisibleRef = useRef(false);
  const transitionTimerRef = useRef(null);

  const useNative = Platform.OS !== 'web';

  const latestRef = useRef({
    isVisible,
    swipeDirection,
    scrollOffset,
    swipeThreshold,
    onSwipeComplete,
    onSwipeStart,
    onSwipeMove,
    onModalShow,
    onModalWillShow,
    onModalHide,
    onModalWillHide,
    windowWidth,
    windowHeight,
  });

  latestRef.current = {
    isVisible,
    swipeDirection,
    scrollOffset,
    swipeThreshold,
    onSwipeComplete,
    onSwipeStart,
    onSwipeMove,
    onModalShow,
    onModalWillShow,
    onModalHide,
    onModalWillHide,
    windowWidth,
    windowHeight,
  };

  useEffect(() => {
    const clearPendingTimer = () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };

    if (isVisible) {
      clearPendingTimer();
      setModalVisible(true);
      swipeOffset.setValue({ x: 0, y: 0 });

      if (!wasVisibleRef.current) {
        wasVisibleRef.current = true;
        if (latestRef.current.onModalWillShow) {
          latestRef.current.onModalWillShow();
        }
      }

      let settled = false;
      const finishOpen = () => {
        if (settled) return;
        settled = true;
        clearPendingTimer();
        if (latestRef.current.isVisible) {
          animProgress.setValue(1);
          if (latestRef.current.onModalShow) {
            latestRef.current.onModalShow();
          }
        }
      };

      const inDuration = Math.max(0, Number(animationInTiming) || 220);
      transitionTimerRef.current = setTimeout(finishOpen, inDuration + 80);

      Animated.timing(animProgress, {
        toValue: 1,
        duration: inDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }).start(({ finished }) => {
        if (finished) finishOpen();
      });
    } else if (wasVisibleRef.current || modalVisible) {
      wasVisibleRef.current = false;
      clearPendingTimer();

      if (latestRef.current.onModalWillHide) {
        latestRef.current.onModalWillHide();
      }

      let settled = false;
      const finishClose = () => {
        if (settled) return;
        settled = true;
        clearPendingTimer();
        if (!latestRef.current.isVisible) {
          swipeOffset.setValue({ x: 0, y: 0 });
          animProgress.setValue(0);
          setModalVisible(false);
          if (latestRef.current.onModalHide) {
            latestRef.current.onModalHide();
          }
        }
      };

      const outDuration = Math.max(0, Number(animationOutTiming) || 180);
      transitionTimerRef.current = setTimeout(finishClose, outDuration + 80);

      Animated.timing(animProgress, {
        toValue: 0,
        duration: outDuration,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: useNative,
      }).start(({ finished }) => {
        if (finished) finishClose();
      });
    }

    return clearPendingTimer;
  }, [isVisible, animationInTiming, animationOutTiming, animProgress, swipeOffset, useNative]);

  // Ensure modal stays fully visible & interactive if app is minimized and restored while open
  useEffect(() => {
    if (!isVisible) return undefined;
    const sub = AppState.addEventListener?.('change', (nextState) => {
      if (nextState === 'active' && latestRef.current.isVisible) {
        animProgress.setValue(1);
        swipeOffset.setValue({ x: 0, y: 0 });
      }
    });
    return () => {
      sub?.remove?.();
    };
  }, [isVisible, animProgress, swipeOffset]);

  const panResponder = useMemo(() => {
    const resolveMatchedDirection = (gestureState, dirs) => {
      const { dx, dy } = gestureState;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (dirs.includes('down') && dy > 14 && dy > absDx * 1.4) return 'down';
      if (dirs.includes('up') && dy < -14 && absDy > absDx * 1.4) return 'up';
      if (dirs.includes('right') && dx > 14 && dx > absDy * 1.4) return 'right';
      if (dirs.includes('left') && dx < -14 && absDx > absDy * 1.4) return 'left';
      return null;
    };

    return PanResponder.create({
      // Never intercept TOUCH_DOWN so child inputs, buttons, and scroll views receive taps cleanly
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const { swipeDirection: dir, scrollOffset: offset, onSwipeStart: startCb } = latestRef.current;
        const dirs = normalizeSwipeDirections(dir);
        if (dirs.length === 0) return false;
        if ((offset || 0) > 2) return false;

        const matched = resolveMatchedDirection(gestureState, dirs);
        if (matched) {
          if (startCb) startCb(gestureState);
          return true;
        }
        return false;
      },
      onPanResponderMove: (_evt, gestureState) => {
        const {
          swipeDirection: dir,
          onSwipeMove: moveCb,
          windowHeight: h,
          windowWidth: w,
        } = latestRef.current;
        const dirs = normalizeSwipeDirections(dir);
        if (dirs.length === 0) return;

        let nextX = 0;
        let nextY = 0;

        if (dirs.includes('down') && gestureState.dy > 0) {
          nextY = gestureState.dy;
        } else if (dirs.includes('up') && gestureState.dy < 0) {
          nextY = gestureState.dy;
        } else if (dirs.includes('right') && gestureState.dx > 0) {
          nextX = gestureState.dx;
        } else if (dirs.includes('left') && gestureState.dx < 0) {
          nextX = gestureState.dx;
        }

        swipeOffset.setValue({ x: nextX, y: nextY });

        if (moveCb) {
          const dist = Math.max(Math.abs(nextY) / Math.max(1, h), Math.abs(nextX) / Math.max(1, w));
          const percentageShown = Math.max(0, Math.min(1, 1 - dist));
          moveCb(percentageShown, gestureState);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const {
          swipeDirection: dir,
          swipeThreshold: threshold = 100,
          onSwipeComplete: completeCb,
        } = latestRef.current;
        const dirs = normalizeSwipeDirections(dir);

        let completedDirection = null;
        if (dirs.includes('down') && (gestureState.dy > threshold || (gestureState.dy > 36 && gestureState.vy > 0.85))) {
          completedDirection = 'down';
        } else if (dirs.includes('up') && (-gestureState.dy > threshold || (-gestureState.dy > 36 && gestureState.vy < -0.85))) {
          completedDirection = 'up';
        } else if (dirs.includes('right') && (gestureState.dx > threshold || (gestureState.dx > 36 && gestureState.vx > 0.85))) {
          completedDirection = 'right';
        } else if (dirs.includes('left') && (-gestureState.dx > threshold || (-gestureState.dx > 36 && gestureState.vx < -0.85))) {
          completedDirection = 'left';
        }

        if (completedDirection && completeCb) {
          completeCb({ swipingDirection: completedDirection }, gestureState);
          // Spring back smoothly in case onSwipeComplete opened a confirmation dialog instead of closing
          Animated.spring(swipeOffset, {
            toValue: { x: 0, y: 0 },
            damping: 24,
            stiffness: 260,
            useNativeDriver: useNative,
          }).start();
          return;
        }

        Animated.spring(swipeOffset, {
          toValue: { x: 0, y: 0 },
          damping: 24,
          stiffness: 260,
          useNativeDriver: useNative,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(swipeOffset, {
          toValue: { x: 0, y: 0 },
          damping: 24,
          stiffness: 260,
          useNativeDriver: useNative,
        }).start();
      },
    });
  }, [swipeOffset, useNative]);

  if (!modalVisible && !isVisible) {
    return null;
  }

  const isFadeOnly =
    animationIn === 'fadeIn' && (animationOut === 'fadeOut' || !animationOut);
  const isSubtleSlide =
    animationIn === 'fadeInUp' || animationOut === 'fadeOutDown';

  const slideDistance = isFadeOnly ? 0 : isSubtleSlide ? 42 : Math.min(windowHeight, 720);

  const animatedContentStyle = {
    opacity: isFadeOnly || isSubtleSlide
      ? animProgress
      : animProgress.interpolate({
          inputRange: [0, 0.12, 1],
          outputRange: [0, 1, 1],
        }),
    transform: [
      {
        translateY: isFadeOnly
          ? swipeOffset.y
          : Animated.add(
              animProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [slideDistance, 0],
              }),
              swipeOffset.y
            ),
      },
      {
        translateX: swipeOffset.x,
      },
    ],
  };

  const animatedBackdropOpacity = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, backdropOpacity],
  });

  const computedContentStyle = [
    { margin: windowWidth * 0.05 },
    styles.content,
    style,
  ];

  const backdropNode = hasBackdrop ? (
    customBackdrop ? (
      <Animated.View
        style={[styles.backdrop, { opacity: animatedBackdropOpacity }]}
        pointerEvents={isVisible ? 'auto' : 'none'}
      >
        {customBackdrop}
      </Animated.View>
    ) : (
      <TouchableWithoutFeedback onPress={isVisible ? onBackdropPress : undefined}>
        <Animated.View
          pointerEvents={isVisible ? 'auto' : 'none'}
          style={[
            styles.backdrop,
            {
              backgroundColor: backdropColor,
              opacity: animatedBackdropOpacity,
            },
          ]}
        />
      </TouchableWithoutFeedback>
    )
  ) : null;

  const hasActiveSwipe = normalizeSwipeDirections(swipeDirection).length > 0;

  const contentContainer = (
    <Animated.View
      testID={testID}
      pointerEvents={isVisible ? 'box-none' : 'none'}
      style={[computedContentStyle, animatedContentStyle]}
      {...(hasActiveSwipe ? panResponder.panHandlers : {})}
    >
      {children}
    </Animated.View>
  );

  const innerBody = avoidKeyboard ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      pointerEvents="box-none"
      style={styles.keyboardAvoiding}
    >
      {contentContainer}
    </KeyboardAvoidingView>
  ) : (
    contentContainer
  );

  if (!coverScreen) {
    return (
      <View pointerEvents="box-none" style={styles.inlineRoot}>
        {backdropNode}
        {innerBody}
      </View>
    );
  }

  const handleRequestClose = () => {
    if (typeof onBackButtonPress === 'function') {
      onBackButtonPress();
    } else if (typeof onBackdropPress === 'function') {
      onBackdropPress();
    }
  };

  return (
    <RNModal
      transparent={true}
      animationType="none"
      visible={modalVisible || Boolean(isVisible)}
      statusBarTranslucent={statusBarTranslucent}
      supportedOrientations={supportedOrientations}
      onRequestClose={handleRequestClose}
    >
      <View pointerEvents="box-none" style={styles.modalRoot}>
        {backdropNode}
        {innerBody}
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  inlineRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  keyboardAvoiding: {
    flex: 1,
  },
});

export default AppModal;
