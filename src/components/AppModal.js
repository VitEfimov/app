import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Modal as RNModal,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableOpacity,
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
 * Fabric-safe drop-in replacement for `react-native-modal`.
 *
 * Designed specifically for React 18 + React Native 0.76+ New Architecture (Fabric):
 * 1. Renders plain `<View>` elements inside OS-native `<Modal animationType="fade">` with concrete
 *    initial opacity (`backdropOpacity` / `1`) and zero offscreen `Animated.View` transforms.
 *    Avoids RN 0.76 Fabric's `useAnimatedProps([props])` detachment bug where child `onLayout` /
 *    `onContentSizeChange` re-renders freeze `useNativeDriver: true` views at `opacity: 0`.
 * 2. Never accesses private React Fiber fields and never claims responder on `TOUCH_DOWN`
 *    (`onStartShouldSetPanResponder: () => false`), keeping all child inputs, buttons, and
 *    `ScrollView`s 100% interactive.
 * 3. Defaults `statusBarTranslucent` to `false` (matching `react-native-modal`) so Android 15
 *    `Dialog` windows automatically fit system status and navigation bars.
 */
export function AppModal({
  isVisible = false,
  children,
  style,
  testID,
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
  statusBarTranslucent = false,
  supportedOrientations = ['portrait', 'landscape'],
}) {
  const { width: rawWidth, height: rawHeight } = useWindowDimensions();
  const windowWidth = rawWidth > 0 ? rawWidth : 360;
  const windowHeight = rawHeight > 0 ? rawHeight : 800;

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const wasVisibleRef = useRef(false);
  const didFireShowRef = useRef(false);

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
    if (isVisible && !wasVisibleRef.current) {
      wasVisibleRef.current = true;
      didFireShowRef.current = false;
      setDragOffset({ x: 0, y: 0 });
      if (latestRef.current.onModalWillShow) {
        latestRef.current.onModalWillShow();
      }
      if (Platform.OS === 'web') {
        didFireShowRef.current = true;
        if (latestRef.current.onModalShow) {
          latestRef.current.onModalShow();
        }
      }
    } else if (!isVisible && wasVisibleRef.current) {
      wasVisibleRef.current = false;
      didFireShowRef.current = false;
      setDragOffset({ x: 0, y: 0 });
      if (latestRef.current.onModalWillHide) {
        latestRef.current.onModalWillHide();
      }
      if (latestRef.current.onModalHide) {
        latestRef.current.onModalHide();
      }
    }
  }, [isVisible]);

  // Reset any partial swipe drag if app is minimized and restored while modal is open
  useEffect(() => {
    if (!isVisible) return undefined;
    const sub = AppState.addEventListener?.('change', (nextState) => {
      if (nextState === 'active' && latestRef.current.isVisible) {
        setDragOffset({ x: 0, y: 0 });
      }
    });
    return () => {
      sub?.remove?.();
    };
  }, [isVisible]);

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

        setDragOffset({ x: nextX, y: nextY });

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

        setDragOffset({ x: 0, y: 0 });

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
        }
      },
      onPanResponderTerminate: () => {
        setDragOffset({ x: 0, y: 0 });
      },
    });
  }, []);

  if (!isVisible) {
    return null;
  }

  const isDragging = dragOffset.x !== 0 || dragOffset.y !== 0;
  const dragProgress = isDragging
    ? Math.min(
        1,
        Math.max(
          Math.abs(dragOffset.y) / Math.max(1, windowHeight),
          Math.abs(dragOffset.x) / Math.max(1, windowWidth)
        )
      )
    : 0;

  const effectiveBackdropOpacity = Math.max(
    0,
    backdropOpacity * (1 - dragProgress * 0.65)
  );

  const computedContentStyle = [
    { margin: windowWidth * 0.05 },
    styles.content,
    style,
    styles.contentLayer,
    isDragging
      ? {
          transform: [
            { translateX: dragOffset.x },
            { translateY: dragOffset.y },
          ],
        }
      : null,
  ];

  const backdropNode = hasBackdrop ? (
    customBackdrop ? (
      <View
        style={[styles.backdrop, { opacity: effectiveBackdropOpacity }]}
        pointerEvents="auto"
      >
        {customBackdrop}
      </View>
    ) : (
      <TouchableOpacity
        activeOpacity={1}
        accessible={false}
        onPress={onBackdropPress}
        style={[
          styles.backdrop,
          {
            backgroundColor: backdropColor,
            opacity: effectiveBackdropOpacity,
          },
        ]}
      />
    )
  ) : null;

  const hasActiveSwipe = normalizeSwipeDirections(swipeDirection).length > 0;

  const contentContainer = (
    <View
      testID={testID}
      pointerEvents="box-none"
      collapsable={false}
      style={computedContentStyle}
      {...(hasActiveSwipe ? panResponder.panHandlers : {})}
    >
      {children}
    </View>
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

  const handleNativeShow = () => {
    if (!didFireShowRef.current) {
      didFireShowRef.current = true;
      if (latestRef.current.onModalShow) {
        latestRef.current.onModalShow();
      }
    }
  };

  const nativeModalProps =
    Platform.OS === 'web'
      ? {}
      : {
          hardwareAccelerated: true,
          statusBarTranslucent,
          supportedOrientations,
        };

  return (
    <RNModal
      transparent={true}
      animationType="fade"
      visible={true}
      onRequestClose={handleRequestClose}
      onShow={handleNativeShow}
      {...nativeModalProps}
    >
      <View pointerEvents="box-none" collapsable={false} style={styles.modalRoot}>
        {backdropNode}
        {innerBody}
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  inlineRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  contentLayer: {
    zIndex: 2,
  },
  keyboardAvoiding: {
    flex: 1,
    zIndex: 2,
  },
});

export default AppModal;
