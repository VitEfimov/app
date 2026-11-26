import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useContext,
  createContext,
} from 'react';
import { Animated, Easing, Platform, View, StyleSheet } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * ============================================================================
 * MANUAL SWIPE ANIMATION TUNING CONFIG
 * You can adjust these values to regulate the speed and feel of all row swipes:
 * - completeBannerRevealPx: Width (px) the "Complete" / "Mark Uncomplete" banner opens to (e.g. 250)
 * - completeRevealDurationMs: How long (ms) it takes to expand the banner to full width
 * - completeHoldBeforeCloseMs: How long (ms) "Complete" / "Mark Uncomplete" stays open & visible after finger release before closing (e.g. 550)
 * - completeGlideDurationMs: How long (ms) the row takes to smoothly close & fade out after the hold (e.g. 280)
 * - completeCollapseDurationMs: How long (ms) the items below smoothly move up while the task fades out (e.g. 280)
 * - completeBadgePopScale: Peak scale of the green/purple checkmark badge pop (e.g. 1.18)
 * - completeRowEndOpacity: Row opacity at the end of the close glide (0 = smoothly fade out disappearing task)
 * - completeRowEndScale: Row scale at the end of the close glide (0.96 = subtle shrink as it disappears)
 * - completeRowExitTranslateY: Subtle upward drift (px) of the disappearing task as it fades out (e.g. -10)
 * - leftSwipeOpenDurationMs: How long (ms) the left-swipe action menu takes to snap open
 * - snapCancelDurationMs: How long (ms) a canceled swipe takes to glide back to 0
 * - programmaticCloseDurationMs: How long (ms) closeRow() takes when closing an open menu
 * ============================================================================
 */
export const SWIPE_ANIMATION_CONFIG = {
  completeBannerRevealPx: 250,
  completeRevealDurationMs: 120,
  completeHoldBeforeCloseMs: 550,
  completeGlideDurationMs: 280,
  completeCollapseDurationMs: 280,
  completeBadgePopScale: 1.18,
  completeBadgePopUpMs: 120,
  completeBadgePopDownMs: 180,
  completeRowEndOpacity: 0,
  completeRowEndScale: 0.96,
  completeRowExitTranslateY: -10,
  leftSwipeOpenDurationMs: 200,
  leftSwipeReopenDurationMs: 180,
  snapCancelDurationMs: 190,
  programmaticCloseDurationMs: 160,
  easingCurve: Easing.bezier(0.25, 0.1, 0.25, 1),
};

const CellLayoutContext = createContext(null);

const taskRowCollapseRegistry = new Map();

export function collapseTaskRowById(taskId, onFinished) {
  if (taskId !== undefined && taskId !== null) {
    const fn = taskRowCollapseRegistry.get(String(taskId));
    if (typeof fn === 'function') {
      fn(onFinished);
      return true;
    }
  }
  if (typeof onFinished === 'function') {
    onFinished();
  }
  return false;
}

export const listCollapseShiftController = {
  cells: new Set(),
  sessionCounter: 0,
  settleTimer: null,
  activeSession: {
    active: false,
    phase: 'idle',
    sessionId: 0,
    collapsingTop: null,
    collapsingIndex: -1,
    collapseHeight: 56,
  },

  registerCell(cellRecord) {
    this.cells.add(cellRecord);
    return () => {
      this.cells.delete(cellRecord);
    };
  },

  prepareShiftAnimations({ top, index, height, duration, easing }) {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }

    const sessionId = ++this.sessionCounter;
    const collapseHeight = typeof height === 'number' && height > 10 ? height : 56;
    const collapsingTop = typeof top === 'number' ? top : null;
    const collapsingIndex = typeof index === 'number' ? index : -1;

    this.activeSession = {
      active: true,
      phase: 'animating',
      sessionId,
      collapsingTop,
      collapsingIndex,
      collapseHeight,
    };

    const animations = [];
    this.cells.forEach((cell) => {
      const cellTop = cell.getTop();
      const cellIndex = cell.getIndex();
      let isBelow = false;
      if (collapsingIndex >= 0 && cellIndex >= 0) {
        isBelow = cellIndex > collapsingIndex;
      } else if (collapsingTop !== null) {
        isBelow = cellTop > collapsingTop + 2;
      }

      if (isBelow) {
        cell.beginShift({
          sessionId,
          baseTop: cellTop,
          baseIndex: cellIndex,
          collapseHeight,
        });
        cell.translateY.stopAnimation();
        cell.translateY.setValue(0);
        animations.push(
          Animated.timing(cell.translateY, {
            toValue: -collapseHeight,
            duration,
            easing,
            useNativeDriver: USE_NATIVE_DRIVER,
          })
        );
      } else {
        cell.clearShift();
      }
    });

    return { sessionId, animations };
  },

  beginSettling(sessionId) {
    if (this.activeSession.sessionId !== sessionId) return;
    this.activeSession.phase = 'settling';
    this.cells.forEach((cell) => {
      if (cell.isShiftedForSession(sessionId)) {
        cell.notifySettling();
      }
    });
  },

  scheduleFinishSettling(sessionId) {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
    }
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      if (this.activeSession.sessionId !== sessionId) return;
      this.activeSession = {
        active: false,
        phase: 'idle',
        sessionId,
        collapsingTop: null,
        collapsingIndex: -1,
        collapseHeight: 56,
      };
      this.cells.forEach((cell) => {
        cell.finishShift(sessionId);
      });
    }, 80);
  },
};

/**
 * Custom CellRendererComponent for FlashList v2 that allows all cells below a completed or deleted
 * task to smoothly glide upward on the Native UI thread (useNativeDriver: true) at the exact same time
 * as the disappearing task's opacity fades from 1 to 0.
 */
export const FlashListCollapseCellRenderer = forwardRef(function FlashListCollapseCellRenderer(
  { children, style, index, onLayout, ...rest },
  ref
) {
  const flatStyle = StyleSheet.flatten(style) || {};
  const currentTop = typeof flatStyle.top === 'number' ? flatStyle.top : 0;
  const currentIndex = typeof index === 'number' ? index : -1;

  const topRef = useRef(currentTop);
  const indexRef = useRef(currentIndex);
  topRef.current = currentTop;
  indexRef.current = currentIndex;

  const cellTranslateY = useRef(new Animated.Value(0)).current;
  const shiftInfoRef = useRef({
    active: false,
    sessionId: 0,
    baseTop: 0,
    baseIndex: -1,
    collapseHeight: 56,
  });
  const [, setRenderTick] = useState(0);

  useEffect(() => {
    const cellRecord = {
      getTop: () => topRef.current,
      getIndex: () => indexRef.current,
      translateY: cellTranslateY,
      beginShift: ({ sessionId, baseTop, baseIndex, collapseHeight }) => {
        shiftInfoRef.current = {
          active: true,
          sessionId,
          baseTop,
          baseIndex,
          collapseHeight,
        };
      },
      clearShift: () => {
        if (shiftInfoRef.current.active) {
          shiftInfoRef.current.active = false;
          cellTranslateY.stopAnimation();
          cellTranslateY.setValue(0);
        }
      },
      isShiftedForSession: (sessionId) =>
        Boolean(shiftInfoRef.current.active && shiftInfoRef.current.sessionId === sessionId),
      notifySettling: () => {
        setRenderTick((t) => t + 1);
      },
      finishShift: (sessionId) => {
        if (shiftInfoRef.current.active && shiftInfoRef.current.sessionId === sessionId) {
          shiftInfoRef.current.active = false;
          cellTranslateY.stopAnimation();
          cellTranslateY.setValue(0);
          setRenderTick((t) => t + 1);
        }
      },
    };
    return listCollapseShiftController.registerCell(cellRecord);
  }, [cellTranslateY]);

  const activeSession = listCollapseShiftController.activeSession;
  const isSettlingThisCell =
    shiftInfoRef.current.active &&
    activeSession.active &&
    activeSession.phase === 'settling' &&
    activeSession.sessionId === shiftInfoRef.current.sessionId;

  useLayoutEffect(() => {
    if (isSettlingThisCell) {
      cellTranslateY.stopAnimation();
      cellTranslateY.setValue(0);
      Animated.timing(cellTranslateY, {
        toValue: 0,
        duration: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }
  }, [isSettlingThisCell, currentTop, cellTranslateY]);

  const cellContext = useMemo(
    () => ({
      isFlashListCell: true,
      getTop: () => topRef.current,
      getIndex: () => indexRef.current,
    }),
    []
  );

  const animatedShiftStyle = useMemo(
    () => ({
      transform: [{ translateY: cellTranslateY }],
    }),
    [cellTranslateY]
  );

  let innerStyle = animatedShiftStyle;
  if (isSettlingThisCell) {
    let remainingShift = 0;
    const { baseTop, collapseHeight } = shiftInfoRef.current;
    if (currentTop < baseTop) {
      const targetTop = baseTop - collapseHeight;
      const diff = Math.round(targetTop - currentTop);
      if (diff < 0 && Math.abs(diff) <= collapseHeight) {
        remainingShift = diff;
      }
    }
    innerStyle = remainingShift !== 0 ? { transform: [{ translateY: remainingShift }] } : null;
  }

  return (
    <View ref={ref} onLayout={onLayout} style={style} {...rest}>
      <CellLayoutContext.Provider value={cellContext}>
        <Animated.View style={innerStyle}>{children}</Animated.View>
      </CellLayoutContext.Provider>
    </View>
  );
});

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
    taskId,
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
  const cellContext = useContext(CellLayoutContext);
  const isInsideFlashListCell = Boolean(cellContext?.isFlashListCell);

  const dragX = useRef(new Animated.Value(0)).current;
  const rowTranslation = useRef(new Animated.Value(0)).current;
  const rowExitOpacity = useRef(new Animated.Value(1)).current;
  const rowExitScale = useRef(new Animated.Value(1)).current;
  const rowExitTranslateY = useRef(new Animated.Value(0)).current;
  const completeBadgePop = useRef(new Animated.Value(1)).current;
  const measuredHeightRef = useRef(56);
  const collapseHeightAnim = useRef(new Animated.Value(56)).current;
  const collapseOpacityAnim = useRef(new Animated.Value(1)).current;
  const isOpenRef = useRef(false);
  const isCompletingRef = useRef(false);
  const [actionsMounted, setActionsMounted] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);

  const handleRootLayout = useCallback(
    (e) => {
      if (isCollapsing || isCompletingRef.current) return;
      const h = e?.nativeEvent?.layout?.height;
      if (typeof h === 'number' && h > 10) {
        measuredHeightRef.current = h;
      }
    },
    [isCollapsing]
  );

  // Reset swipe offset & unmount drawers cleanly when FlashList recycles this row
  useEffect(() => {
    dragX.stopAnimation();
    rowTranslation.stopAnimation();
    rowExitOpacity.stopAnimation();
    rowExitScale.stopAnimation();
    rowExitTranslateY.stopAnimation();
    completeBadgePop.stopAnimation();
    collapseHeightAnim.stopAnimation();
    collapseOpacityAnim.stopAnimation();
    dragX.setValue(0);
    rowTranslation.setValue(0);
    rowExitOpacity.setValue(1);
    rowExitScale.setValue(1);
    rowExitTranslateY.setValue(0);
    completeBadgePop.setValue(1);
    collapseHeightAnim.setValue(measuredHeightRef.current || 56);
    collapseOpacityAnim.setValue(1);
    // Also flush native animated nodes to 0 on the UI thread in case a trailing RNGH event fired during recycle
    Animated.parallel([
      Animated.timing(dragX, { toValue: 0, duration: 1, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(rowTranslation, { toValue: 0, duration: 1, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
    isOpenRef.current = false;
    isCompletingRef.current = false;
    setIsCollapsing(prev => (prev ? false : prev));
    setActionsMounted(prev => (prev ? false : prev));
  }, [itemKey, dragX, rowTranslation, rowExitOpacity, rowExitScale, rowExitTranslateY, completeBadgePop, collapseHeightAnim, collapseOpacityAnim]);

  useEffect(() => {
    return () => {
      dragX.stopAnimation();
      rowTranslation.stopAnimation();
      rowExitOpacity.stopAnimation();
      rowExitScale.stopAnimation();
      rowExitTranslateY.stopAnimation();
      completeBadgePop.stopAnimation();
      collapseHeightAnim.stopAnimation();
      collapseOpacityAnim.stopAnimation();
    };
  }, [dragX, rowTranslation, rowExitOpacity, rowExitScale, rowExitTranslateY, completeBadgePop, collapseHeightAnim, collapseOpacityAnim]);

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
    rowExitTranslateY.setValue(0);
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
  }, [dragX, rowTranslation, rowExitOpacity, rowExitScale, rowExitTranslateY, completeBadgePop, notifyClose]);

  const runCollapseExit = useCallback(
    (onFinished) => {
      const startHeight = measuredHeightRef.current > 10 ? measuredHeightRef.current : 56;
      const glideDuration = SWIPE_ANIMATION_CONFIG.completeGlideDurationMs || 280;
      const collapseDuration = SWIPE_ANIMATION_CONFIG.completeCollapseDurationMs || glideDuration;
      const endOpacity = SWIPE_ANIMATION_CONFIG.completeRowEndOpacity ?? 0;
      const endScale = SWIPE_ANIMATION_CONFIG.completeRowEndScale ?? 0.96;
      const endTranslateY = SWIPE_ANIMATION_CONFIG.completeRowExitTranslateY ?? -10;
      const curve = SWIPE_ANIMATION_CONFIG.easingCurve;

      const collapsingTop = isInsideFlashListCell ? cellContext.getTop() : null;
      const collapsingIndex = isInsideFlashListCell ? cellContext.getIndex() : -1;

      const { sessionId: collapseSessionId, animations: cellShiftAnimations } =
        listCollapseShiftController.prepareShiftAnimations({
          top: collapsingTop,
          index: collapsingIndex,
          height: startHeight,
          duration: collapseDuration,
          easing: curve,
        });

      const parallelAnims = [
        Animated.timing(dragX, {
          toValue: 0,
          duration: glideDuration,
          easing: curve,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(rowTranslation, {
          toValue: 0,
          duration: glideDuration,
          easing: curve,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(rowExitOpacity, {
          toValue: endOpacity,
          duration: Math.max(140, Math.round(glideDuration * 0.85)),
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(rowExitScale, {
          toValue: endScale,
          duration: glideDuration,
          easing: curve,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(rowExitTranslateY, {
          toValue: endTranslateY,
          duration: glideDuration,
          easing: curve,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        ...cellShiftAnimations,
      ];

      if (!isInsideFlashListCell) {
        collapseHeightAnim.stopAnimation();
        collapseOpacityAnim.stopAnimation();
        collapseHeightAnim.setValue(startHeight);
        collapseOpacityAnim.setValue(1);
        setIsCollapsing(true);
        parallelAnims.push(
          Animated.timing(collapseHeightAnim, {
            toValue: 0,
            duration: collapseDuration,
            easing: curve,
            useNativeDriver: false,
          }),
          Animated.timing(collapseOpacityAnim, {
            toValue: 0,
            duration: Math.max(140, Math.round(collapseDuration * 0.85)),
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          })
        );
      }

      Animated.parallel(parallelAnims).start(() => {
        isCompletingRef.current = false;
        setActionsMounted(false);
        listCollapseShiftController.beginSettling(collapseSessionId);
        if (typeof onFinished === 'function') {
          onFinished();
        }
        listCollapseShiftController.scheduleFinishSettling(collapseSessionId);
      });
    },
    [
      dragX,
      rowTranslation,
      rowExitOpacity,
      rowExitScale,
      rowExitTranslateY,
      collapseHeightAnim,
      collapseOpacityAnim,
      isInsideFlashListCell,
      cellContext,
    ]
  );

  const triggerCollapse = useCallback(
    (cb) => {
      if (isCompletingRef.current) return;
      isCompletingRef.current = true;
      isOpenRef.current = false;
      runCollapseExit(cb || notifyLeftComplete);
    },
    [runCollapseExit, notifyLeftComplete]
  );

  useEffect(() => {
    if (taskId === undefined || taskId === null) return undefined;
    const key = String(taskId);
    taskRowCollapseRegistry.set(key, triggerCollapse);
    return () => {
      if (taskRowCollapseRegistry.get(key) === triggerCollapse) {
        taskRowCollapseRegistry.delete(key);
      }
    };
  }, [taskId, triggerCollapse]);

  useImperativeHandle(
    ref,
    () => ({
      close: closeRow,
      collapse: triggerCollapse,
    }),
    [closeRow, triggerCollapse]
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

          // Smooth natural completion reveal + hold + collapse glide configured via SWIPE_ANIMATION_CONFIG.
          // 1. Expands the row to at least `completeBannerRevealPx` (250px) so the full "Complete" / "Mark Uncomplete" banner is uncovered
          // 2. Holds the banner open for `completeHoldBeforeCloseMs` while popping the checkmark badge
          // 3. Smoothly glides closed, fades out the task, and collapses the row height to 0 so remaining tasks below slide up smoothly
          const {
            completeBannerRevealPx,
            completeRevealDurationMs,
            completeHoldBeforeCloseMs,
            completeBadgePopScale,
            completeBadgePopUpMs,
            completeBadgePopDownMs,
          } = SWIPE_ANIMATION_CONFIG;

          const revealTarget = Math.max(rawOffset, completeBannerRevealPx || 250);
          const revealMs = completeRevealDurationMs || 120;
          const holdMs = completeHoldBeforeCloseMs || 0;

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
            Animated.sequence([
              Animated.timing(dragX, {
                toValue: revealTarget,
                duration: revealMs,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: USE_NATIVE_DRIVER,
              }),
              Animated.delay(holdMs),
            ]),
          ]).start(() => {
            runCollapseExit(notifyLeftComplete);
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
      runCollapseExit,
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
        { translateY: rowExitTranslateY },
        { scale: rowExitScale },
      ],
    }),
    [transX, rowExitOpacity, rowExitTranslateY, rowExitScale]
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
      opacity: Animated.multiply(
        rowExitOpacity,
        transX.interpolate({
          inputRange: [-16, -2, 0],
          outputRange: [1, 1, 0],
          extrapolate: 'clamp',
        })
      ),
    }),
    [transX, rowExitOpacity]
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
          inputRange: [0, 4, 14, 28],
          outputRange: [0, 0.45, 0.9, 1],
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
    <Animated.View
      onLayout={handleRootLayout}
      style={[
        styles.root,
        isCollapsing && {
          height: collapseHeightAnim,
          opacity: collapseOpacityAnim,
        },
      ]}
    >
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
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    overflow: 'hidden',
  },
});

export default ReanimatedSwipeRow;
