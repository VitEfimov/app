// import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
// import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
// import dayjs from 'dayjs';
// import * as Localization from 'expo-localization';
// import Svg, { Path, Circle, Line } from 'react-native-svg';
// import { GestureDetector, Gesture } from 'react-native-gesture-handler';
// import Animated, { useSharedValue, useAnimatedProps, runOnJS, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';



// const AnimatedLine = Animated.createAnimatedComponent(Line);
// const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// const AnimatedText = Animated.createAnimatedComponent(Text);

// const OUTER_RADIUS_THRESHOLD = 65;

// const angleToHour = (angle, dist, is24) => {
//   'worklet';

//   let h = Math.floor((angle + 15) / 30);

//   if (h === 12) h = 0;

//   if (!is24) {
//     return h === 0 ? 12 : h;
//   }

//   if (dist > OUTER_RADIUS_THRESHOLD) {
//     return h === 0 ? 12 : h;
//   }

//   return h === 0 ? 0 : h + 12;
// };

// const angleToMinute = (angle) => {
//   'worklet';

//   let m = Math.floor((angle + 3) / 6);

//   if (m === 60) m = 0;

//   return m;
// };

// const DialNumber = React.memo(({
//   item,
//   isHourMode,
//   is24HourSV,
//   sharedAngle,
//   sharedRadius,
//   colors,
//   styles,
// }) => {

//   const animatedTextStyle = useAnimatedStyle(() => {

//     const value = isHourMode.value
//       ? angleToHour(
//           sharedAngle.value,
//           sharedRadius.value,
//           is24HourSV.value
//         )
//       : angleToMinute(sharedAngle.value);

//     const isSelected = value === item.numericValue;

//     return {
//       color: isSelected
//         ? colors.textInverse
//         : item.isInner
//           ? colors.textSecondary
//           : colors.textPrimary,
//     };

//   }, []);

//   return (
//     <View
//       pointerEvents="none"
//       style={[
//         styles.dialNumberBtn,
//         {
//           left: item.x - 16,
//           top: item.y - 16,
//         },
//       ]}
//     >
//       <AnimatedText
//         style={[
//           styles.dialNumberText,
//           item.isInner && { fontSize: 13 },
//           animatedTextStyle,
//         ]}
//       >
//         {item.label}
//       </AnimatedText>
//     </View>
//   );
// });
// // const IconKeyboard = ({ color }) => (
// //   <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
// //     <Path d="M20 5H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2z" />
// //     <Path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 17h8" />
// //   </Svg>
// // );

// // const IconClock = ({ color }) => (
// //   <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
// //     <Circle cx="12" cy="12" r="10" />
// //     <Path d="M12 6v6l4 2" />
// //   </Svg>
// // );

// // export default function CustomTimePicker({ visible, value, onClose, onSave, colors, isDark }) {
// //   const [hour, setHour] = useState('12');
// //   const [minute, setMinute] = useState('00');
// //   const [isPM, setIsPM] = useState(false);
// //   const [inputMode, setInputMode] = useState('dial');
// //   const [dialMode, setDialMode] = useState('hour');
// //   const [is24Hour, setIs24Hour] = useState(false);
  
// //   const isDragging = useSharedValue(false);
// //   const sharedAngle = useSharedValue(0);
// //   const sharedRadius = useSharedValue(80);
// //   const is24HourSV = useSharedValue(false);
// //   const isHourMode = useSharedValue(true);
// //   const clockCenterX = useSharedValue(0);
// //   const clockCenterY = useSharedValue(0);

// //   useEffect(() => {
// //     const uses24Hour = Localization.getCalendars()[0]?.uses24hourClock ?? false;
// //     setIs24Hour(uses24Hour);
// //   }, []);

// //   useEffect(() => {
// //     is24HourSV.value = is24Hour;
// //   }, [is24Hour]);

// //   useEffect(() => {
// //     isHourMode.value = (dialMode === 'hour');
// //   }, [dialMode]);

// //   useEffect(() => {
// //     if (visible) {
// //       if (value && value !== '--:--') {
// //         const d = dayjs(`2000-01-01T${value}`);
// //         if (d.isValid()) {
// //           let h = d.hour();
// //           if (!is24Hour) {
// //             setIsPM(h >= 12);
// //             if (h > 12) h -= 12;
// //             if (h === 0) h = 12;
// //           }
// //           setHour(h.toString());
// //           setMinute(d.format('mm'));
// //         }
// //       } else {
// //         const now = dayjs();
// //         let h = now.hour();
// //         if (!is24Hour) {
// //           setIsPM(h >= 12);
// //           if (h > 12) h -= 12;
// //           if (h === 0) h = 12;
// //         }
// //         setHour(h.toString());
// //         setMinute(now.format('mm'));
// //       }
// //       setDialMode('hour');
// //     }
// //   }, [visible, value, is24Hour]);

// //   useEffect(() => {
// //     if (isDragging.value) return;
    
// //     let targetAngle = 0;
// //     let targetRadius = 80;
    
// //     if (dialMode === 'hour') {
// //       const currentValInt = parseInt(hour, 10) || 0;
// //       let displayI = currentValInt;
// //       if (is24Hour) {
// //         const isOuter = (currentValInt >= 1 && currentValInt <= 11) || currentValInt === 12;
// //         targetRadius = isOuter ? 80 : 50;
// //         displayI = (currentValInt === 0 || currentValInt === 12) ? 0 : (currentValInt % 12);
// //       } else {
// //         if (displayI === 12) displayI = 0;
// //       }
// //       targetAngle = displayI * 30;
// //     } else {
// //       const currentValInt = parseInt(minute, 10) || 0;
// //       targetAngle = currentValInt * 6;
// //       targetRadius = 80;
// //     }
    
// //     sharedAngle.value = withSpring(targetAngle, { damping: 20, stiffness: 200 });
// //     sharedRadius.value = withSpring(targetRadius, { damping: 20, stiffness: 200 });
// //   }, [hour, minute, dialMode, is24Hour]);

// //   useEffect(() => {
// //     if (!visible) return;
// //     requestAnimationFrame(() => {
// //       dialRef.current?.measureInWindow((x, y, w, h) => {
// //         clockCenterGlobal.current = {
// //           x: x + w / 2,
// //           y: y + h / 2
// //         };
// //         clockCenterX.value = x + w / 2;
// //         clockCenterY.value = y + h / 2;
// //       });
// //     });
// //   }, [visible]);

// //   const handleSave = () => {
// //     let h = parseInt(hour, 10) || 0;
// //     const m = parseInt(minute, 10) || 0;

// //     if (!is24Hour) {
// //       if (h < 1 || h > 12) h = 12;
// //       if (isPM && h !== 12) h += 12;
// //       if (!isPM && h === 12) h = 0;
// //     } else {
// //       if (h < 0 || h > 23) h = 0;
// //     }

// //     const formattedHour = h.toString().padStart(2, '0');
// //     const formattedMinute = m.toString().padStart(2, '0');
// //     onSave(`${formattedHour}:${formattedMinute}`);
// //   };

// const IconKeyboard = ({ color }) => (
//   <Svg
//     width="24"
//     height="24"
//     viewBox="0 0 24 24"
//     fill="none"
//     stroke={color}
//     strokeWidth="2"
//     strokeLinecap="round"
//     strokeLinejoin="round"
//   >
//     <Path d="M20 5H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2z" />
//     <Path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 17h8" />
//   </Svg>
// );

// const IconClock = ({ color }) => (
//   <Svg
//     width="24"
//     height="24"
//     viewBox="0 0 24 24"
//     fill="none"
//     stroke={color}
//     strokeWidth="2"
//     strokeLinecap="round"
//     strokeLinejoin="round"
//   >
//     <Circle cx="12" cy="12" r="10" />
//     <Path d="M12 6v6l4 2" />
//   </Svg>
// );

// export default function CustomTimePicker({
//   visible,
//   value,
//   onClose,
//   onSave,
//   colors,
//   isDark,
// }) {
//   const [hour, setHour] = useState("12");
//   const [minute, setMinute] = useState("00");
//   const [isPM, setIsPM] = useState(false);
//   const [inputMode, setInputMode] = useState("dial");
//   const [dialMode, setDialMode] = useState("hour");
//   const [is24Hour, setIs24Hour] = useState(false);

//   const isDragging = useSharedValue(false);
//   const sharedAngle = useSharedValue(0);
//   const sharedRadius = useSharedValue(80);
//   const lastValue = useSharedValue(-1);

//   const is24HourSV = useSharedValue(false);
//   const isHourMode = useSharedValue(true);

//   const clockCenterX = useSharedValue(0);
//   const clockCenterY = useSharedValue(0);

//   useEffect(() => {
//     const uses24Hour =
//       Localization.getCalendars()[0]?.uses24hourClock ?? false;
//     setIs24Hour(uses24Hour);
//   }, []);

//   useEffect(() => {
//     is24HourSV.value = is24Hour;
//   }, [is24Hour]);

//   useEffect(() => {
//     isHourMode.value = dialMode === "hour";
//   }, [dialMode]);

//   useEffect(() => {
//     if (!visible) return;

//     if (value && value !== "--:--") {
//       const d = dayjs(`2000-01-01T${value}`);

//       if (d.isValid()) {
//         let h = d.hour();

//         if (!is24Hour) {
//           setIsPM(h >= 12);

//           if (h > 12) h -= 12;
//           if (h === 0) h = 12;
//         }

//         setHour(h.toString());
//         setMinute(d.format("mm"));
//       }
//     } else {
//       const now = dayjs();
//       let h = now.hour();

//       if (!is24Hour) {
//         setIsPM(h >= 12);

//         if (h > 12) h -= 12;
//         if (h === 0) h = 12;
//       }

//       setHour(h.toString());
//       setMinute(now.format("mm"));
//     }

//     setDialMode("hour");
//   }, [visible, value, is24Hour]);

//   useEffect(() => {
//     if (isDragging.value) return;

//     let targetAngle = 0;
//     let targetRadius = 80;

//     if (dialMode === "hour") {
//       const currentValInt = parseInt(hour, 10) || 0;
//       let displayI = currentValInt;

//       if (is24Hour) {
//         const isOuter =
//           (currentValInt >= 1 && currentValInt <= 11) ||
//           currentValInt === 12;

//         targetRadius = isOuter ? 80 : 50;
//         displayI =
//           currentValInt === 0 || currentValInt === 12
//             ? 0
//             : currentValInt % 12;
//       } else {
//         if (displayI === 12) displayI = 0;
//       }

//       targetAngle = displayI * 30;
//     } else {
//       const currentValInt = parseInt(minute, 10) || 0;

//       targetAngle = currentValInt * 6;
//       targetRadius = 80;
//     }

//     sharedAngle.value = withSpring(targetAngle, {
//       damping: 12,
//       stiffness: 420,
//       mass: 0.4,
//     });

//     sharedRadius.value = withSpring(targetRadius, {
//       damping: 12,
//       stiffness: 420,
//       mass: 0.4,
//     });
//   }, [hour, minute, dialMode, is24Hour]);

//   useEffect(() => {
//     if (!visible || !dialRef.current) return;

//     requestAnimationFrame(() => {
//       dialRef.current?.measureInWindow((x, y, w, h) => {
//         clockCenterGlobal.current = {
//           x: x + w / 2,
//           y: y + h / 2,
//         };

//         clockCenterX.value = x + w / 2;
//         clockCenterY.value = y + h / 2;
//       });
//     });
//   }, [visible]);

//   const handleSave = () => {
//     let h = parseInt(hour, 10) || 0;
//     const m = parseInt(minute, 10) || 0;

//     if (!is24Hour) {
//       if (h < 1 || h > 12) h = 12;

//       if (isPM && h !== 12) h += 12;
//       if (!isPM && h === 12) h = 0;
//     } else {
//       if (h < 0 || h > 23) h = 0;
//     }

//     const formattedHour = h.toString().padStart(2, "0");
//     const formattedMinute = m.toString().padStart(2, "0");

//     onSave(`${formattedHour}:${formattedMinute}`);
//   };

//   const handleHourChange = (text) => {
//     const numeric = text.replace(/[^0-9]/g, '');
//     setHour(numeric);
//   };

// const handleHourBlur = () => {
//   let h = parseInt(hour, 10);

//   if (!is24Hour) {
//     if (isNaN(h) || h < 1 || h > 12) h = 12;
//   } else {
//     if (isNaN(h) || h < 0 || h > 23) h = 0;
//   }

//   setHour(h.toString());
// };

// const handleMinuteChange = (text) => {
//   const numeric = text.replace(/[^0-9]/g, '');
//   setMinute(numeric);
// };

// const handleMinuteBlur = () => {
//   let m = parseInt(minute, 10);

//   if (isNaN(m) || m < 0 || m > 59) m = 0;

//   setMinute(m.toString().padStart(2, '0'));
// };

// const stateRef = useRef();

// stateRef.current = {
//   dialMode,
//   is24Hour,
//   hour,
//   minute,
// };

// const dialRef = useRef(null);
// const clockCenterGlobal = useRef({ x: 0, y: 0 });

// const updateTimeFromAngle = (angle, dist) => {
//   if (stateRef.current.dialMode === 'hour') {
//     const h = angleToHour(angle, dist, stateRef.current.is24Hour);
//     const value = h.toString();

//     if (value !== stateRef.current.hour) {
//       setHour(value);
//     }
//   } else {
//     const m = angleToMinute(angle);
//     const value = m.toString().padStart(2, '0');

//     if (value !== stateRef.current.minute) {
//       setMinute(value);
//     }
//   }
// };

// const panGesture = Gesture.Pan()
//   .minDistance(0)
//   .hitSlop(20)
//   .shouldCancelWhenOutside(false)
//   .onStart((e) => {
//     'worklet';

//     isDragging.value = true;

//     const dx = e.absoluteX - clockCenterX.value;
//     const dy = e.absoluteY - clockCenterY.value;

//     const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360;

//     sharedAngle.value = angle;

//     const dist = Math.sqrt(dx * dx + dy * dy);
//     const value = isHourMode.value
//       ? angleToHour(angle, dist, is24HourSV.value)
//       : angleToMinute(angle);

//     if (value !== lastValue.value) {
//       lastValue.value = value;
//       runOnJS(updateTimeFromAngle)(angle, dist);
//     }
//   })
//   .onUpdate((e) => {
//     'worklet';

//     const dx = e.absoluteX - clockCenterX.value;
//     const dy = e.absoluteY - clockCenterY.value;

//     const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360;
//     const dist = Math.sqrt(dx * dx + dy * dy);

//     sharedAngle.value = angle;

//     sharedRadius.value =
//       isHourMode.value && is24HourSV.value
//         ? (dist < 65 ? 50 : 80)
//         : 80;

//     const value = isHourMode.value
//       ? angleToHour(angle, dist, is24HourSV.value)
//       : angleToMinute(angle);

//     if (value !== lastValue.value) {
//       lastValue.value = value;
//       runOnJS(updateTimeFromAngle)(angle, dist);
//     }
//   })
//   .onEnd(() => {
//     'worklet';

//     isDragging.value = false;

//     const snapped = isHourMode.value
//       ? Math.round(sharedAngle.value / 30) * 30
//       : Math.round(sharedAngle.value / 6) * 6;

//     sharedAngle.value = withSpring(snapped, {
//       damping: 12,
//       stiffness: 420,
//       mass: 0.4,
//     });

//     if (isHourMode.value) {
//       runOnJS(setDialMode)('minute');
//     }
//   });
//   // const ClockDial = () => {
//   //   const radius = 100;
//   //   const center = { x: 125, y: 125 };

//   //   const items = [];
//   //   if (dialMode === 'hour') {
//   //     if (!is24Hour) {
//   //       for (let i = 1; i <= 12; i++) {
//   //         const angle = (i * 30 - 90) * (Math.PI / 180);
//   //         items.push({
//   //           label: i.toString(),
//   //           x: center.x + radius * 0.8 * Math.cos(angle),
//   //           y: center.y + radius * 0.8 * Math.sin(angle),
//   //           value: i.toString(),
//   //           numericValue: i
//   //         });
//   //       }
//   //     } else {
//   //       for (let i = 0; i <= 23; i++) {
//   //         const isOuter = (i >= 1 && i <= 11) || i === 12;
//   //         const displayI = (i === 0 || i === 12) ? 0 : (i % 12);
//   //         const r = isOuter ? radius * 0.8 : radius * 0.5;
//   //         const angle = (displayI * 30 - 90) * (Math.PI / 180);
//   //         items.push({
//   //           label: i === 0 ? '00' : i.toString(),
//   //           x: center.x + r * Math.cos(angle),
//   //           y: center.y + r * Math.sin(angle),
//   //           value: i.toString(),
//   //           numericValue: i,
//   //           isInner: !isOuter
//   //         });
//   //       }
//   //     }
//   //   } else {
//   //     for (let i = 0; i < 60; i += 5) {
//   //       const angle = (i * 6 - 90) * (Math.PI / 180);
//   //       items.push({
//   //         label: i.toString().padStart(2, '0'),
//   //         x: center.x + radius * 0.8 * Math.cos(angle),
//   //         y: center.y + radius * 0.8 * Math.sin(angle),
//   //         value: i.toString(),
//   //         numericValue: i
//   //       });
//   //     }
//   //   }

//   //   const currentValue = dialMode === 'hour' ? hour : minute;
//   //   const currentValInt = parseInt(currentValue, 10) || 0;

//   //   const animatedLineProps = useAnimatedProps(() => {
//   //     const angleRad = (sharedAngle.value - 90) * (Math.PI / 180);
//   //     const currentRadius = sharedRadius.value;
//   //     return {
//   //       x2: center.x + currentRadius * Math.cos(angleRad),
//   //       y2: center.y + currentRadius * Math.sin(angleRad),
//   //     };
//   //   });

//   //   const animatedCircleProps = useAnimatedProps(() => {
//   //     const angleRad = (sharedAngle.value - 90) * (Math.PI / 180);
//   //     const currentRadius = sharedRadius.value;
//   //     return {
//   //       cx: center.x + currentRadius * Math.cos(angleRad),
//   //       cy: center.y + currentRadius * Math.sin(angleRad),
//   //     };
//   //   });



//   //   return (
//   //     <View style={styles.dialContainer}>
//   //       <View style={[styles.dialCircle, { backgroundColor: colors.surfaceContainerHigh }]}>
//   //         <Svg width="250" height="250" style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
//   //           <Circle cx={center.x} cy={center.y} r="4" fill={colors.primary} />
//   //           <AnimatedLine
//   //             x1={center.x} y1={center.y}
//   //             animatedProps={animatedLineProps}
//   //             stroke={colors.primary} strokeWidth="2"
//   //           />
//   //           <AnimatedCircle animatedProps={animatedCircleProps} r="16" fill={colors.primary} />
//   //         </Svg>

//   //         {items.map((item, index) => (
//   //           <DialNumber
//   //             key={index}
//   //             item={item}
//   //             isHourMode={isHourMode}
//   //             is24HourSV={is24HourSV}
//   //             sharedAngle={sharedAngle}
//   //             sharedRadius={sharedRadius}
//   //             colors={colors}
//   //             styles={styles}
//   //           />
//   //         ))}

//   //         <GestureDetector gesture={panGesture}>
//   //           <View
//   //             ref={dialRef}
//   //             style={[StyleSheet.absoluteFillObject, { margin: -20 }]}
//   //             collapsable={false}
//   //           />
//   //         </GestureDetector>
//   //       </View>
//   //     </View>
//   //   );
//   // };
// const ClockDial = () => {
//   const radius = 100;
//   const center = { x: 125, y: 125 };

//   const items = useMemo(() => {
//     const list = [];

//     if (dialMode === 'hour') {
//       if (!is24Hour) {
//         for (let i = 1; i <= 12; i++) {
//           const angle = (i * 30 - 90) * (Math.PI / 180);

//           list.push({
//             label: i.toString(),
//             x: center.x + radius * 0.8 * Math.cos(angle),
//             y: center.y + radius * 0.8 * Math.sin(angle),
//             value: i.toString(),
//             numericValue: i,
//           });
//         }
//       } else {
//         for (let i = 0; i <= 23; i++) {
//           const isOuter =
//             (i >= 1 && i <= 11) || i === 12;

//           const displayI =
//             i === 0 || i === 12 ? 0 : i % 12;

//           const r = isOuter
//             ? radius * 0.8
//             : radius * 0.5;

//           const angle =
//             (displayI * 30 - 90) * (Math.PI / 180);

//           list.push({
//             label: i === 0 ? '00' : i.toString(),
//             x: center.x + r * Math.cos(angle),
//             y: center.y + r * Math.sin(angle),
//             value: i.toString(),
//             numericValue: i,
//             isInner: !isOuter,
//           });
//         }
//       }
//     } else {
//       for (let i = 0; i < 60; i += 5) {
//         const angle =
//           (i * 6 - 90) * (Math.PI / 180);

//         list.push({
//           label: i.toString().padStart(2, '0'),
//           x: center.x + radius * 0.8 * Math.cos(angle),
//           y: center.y + radius * 0.8 * Math.sin(angle),
//           value: i.toString(),
//           numericValue: i,
//         });
//       }
//     }
  
//     return list;
//   }, [dialMode, is24Hour]);

//   const animatedLineProps = useAnimatedProps(() => {
//     const angleRad = (sharedAngle.value - 90) * (Math.PI / 180);

//     return {
//       x2: center.x + sharedRadius.value * Math.cos(angleRad),
//       y2: center.y + sharedRadius.value * Math.sin(angleRad),
//     };
//   });

//   const animatedCircleProps = useAnimatedProps(() => {
//     const angleRad = (sharedAngle.value - 90) * (Math.PI / 180);

//     return {
//       cx: center.x + sharedRadius.value * Math.cos(angleRad),
//       cy: center.y + sharedRadius.value * Math.sin(angleRad),
//     };
//   });

//   return (
//     <View style={styles.dialContainer}>
//       <View
//         style={[
//           styles.dialCircle,
//           { backgroundColor: colors.surfaceContainerHigh },
//         ]}
//       >
//         <Svg
//           width="250"
//           height="250"
//           style={{ position: 'absolute', top: 0, left: 0 }}
//           pointerEvents="none"
//         >
//           <Circle
//             cx={center.x}
//             cy={center.y}
//             r="4"
//             fill={colors.primary}
//           />

//           <AnimatedLine
//             x1={center.x}
//             y1={center.y}
//             animatedProps={animatedLineProps}
//             stroke={colors.primary}
//             strokeWidth="2"
//           />

//           <AnimatedCircle
//             animatedProps={animatedCircleProps}
//             r="16"
//             fill={colors.primary}
//           />
//         </Svg>

//         {items.map((item) => (
//           <DialNumber
//             key={item.numericValue}
//             item={item}
//             isHourMode={isHourMode}
//             is24HourSV={is24HourSV}
//             sharedAngle={sharedAngle}
//             sharedRadius={sharedRadius}
//             colors={colors}
//             styles={styles}
//           />
//         ))}

//         <GestureDetector gesture={panGesture}>
//           <View
//             ref={dialRef}
//             style={[
//               StyleSheet.absoluteFillObject,
//               { margin: -20 },
//             ]}
//             collapsable={false}
//           />
//         </GestureDetector>
//       </View>
//     </View>
//   );
// };
// //   return (
// //     <Modal visible={visible} transparent animationType="fade">
// //       {/* <TouchableWithoutFeedback onPress={Keyboard.dismiss}> */}
// //       <View
// //     pointerEvents="box-none">
// //         <View style={styles.overlay}>
// //           <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'position'} style={{ width: '100%', alignItems: 'center' }}>
// //             <View style={[styles.container, { backgroundColor: colors.bgCard }]}>

// //               <Text style={[styles.title, { color: colors.textSecondary }]}>
// //                 {inputMode === 'dial' ? 'Select time' : 'Enter time'}
// //               </Text>

// //               <View style={styles.headerSelection}>
// //                 <TouchableOpacity onPress={() => setDialMode('hour')} style={[styles.timeDisplayBtn, dialMode === 'hour' && { backgroundColor: colors.surfaceContainerHigh }]}>
// //                   <Text style={[styles.timeDisplayText, { color: dialMode === 'hour' ? colors.primary : colors.textPrimary }]}>
// //                     {hour.padStart(2, '0')}
// //                   </Text>
// //                 </TouchableOpacity>
// //                 <Text style={[styles.separator, { color: colors.textPrimary }]}>:</Text>
// //                 <TouchableOpacity onPress={() => setDialMode('minute')} style={[styles.timeDisplayBtn, dialMode === 'minute' && { backgroundColor: colors.surfaceContainerHigh }]}>
// //                   <Text style={[styles.timeDisplayText, { color: dialMode === 'minute' ? colors.primary : colors.textPrimary }]}>
// //                     {minute.padStart(2, '0')}
// //                   </Text>
// //                 </TouchableOpacity>

// //                 {!is24Hour && (
// //                   <View style={[styles.ampmContainer, { borderColor: colors.borderColor }]}>
// //                     <TouchableOpacity
// //                       style={[styles.ampmBtn, !isPM && { backgroundColor: colors.primaryContainer }]}
// //                       onPress={() => setIsPM(false)}
// //                     >
// //                       <Text style={[styles.ampmText, { color: !isPM ? colors.textInverse : colors.textSecondary }, !isPM && { color: colors.primary, fontWeight: 'bold' }]}>AM</Text>
// //                     </TouchableOpacity>
// //                     <View style={[styles.ampmDivider, { backgroundColor: colors.borderColor }]} />
// //                     <TouchableOpacity
// //                       style={[styles.ampmBtn, isPM && { backgroundColor: colors.primaryContainer }]}
// //                       onPress={() => setIsPM(true)}
// //                     >
// //                       <Text style={[styles.ampmText, { color: isPM ? colors.textInverse : colors.textSecondary }, isPM && { color: colors.primary, fontWeight: 'bold' }]}>PM</Text>
// //                     </TouchableOpacity>
// //                   </View>
// //                 )}
// //               </View>

// //               {inputMode === 'keyboard' ? (
// //                 <View style={styles.inputContainer}>
// //                   <View style={styles.inputGroup}>
// //                     <TextInput
// //                       style={[styles.input, { backgroundColor: colors.surfaceContainerHigh, color: colors.textPrimary, borderColor: colors.primary }]}
// //                       value={hour}
// //                       onChangeText={handleHourChange}
// //                       onBlur={handleHourBlur}
// //                       keyboardType="number-pad"
// //                       maxLength={2}
// //                       selectTextOnFocus
// //                     />
// //                     <Text style={[styles.label, { color: colors.textSecondary }]}>Hour</Text>
// //                   </View>

// //                   <Text style={[styles.separatorKeyboard, { color: colors.textPrimary }]}>:</Text>

// //                   <View style={styles.inputGroup}>
// //                     <TextInput
// //                       style={[styles.input, { backgroundColor: colors.surfaceContainerHigh, color: colors.textPrimary, borderColor: colors.primary }]}
// //                       value={minute}
// //                       onChangeText={handleMinuteChange}
// //                       onBlur={handleMinuteBlur}
// //                       keyboardType="number-pad"
// //                       maxLength={2}
// //                       selectTextOnFocus
// //                     />
// //                     <Text style={[styles.label, { color: colors.textSecondary }]}>Minute</Text>
// //                   </View>
// //                 </View>
// //               ) : (
// //                 <ClockDial />
// //               )}

// //               <View style={styles.bottomRow}>
// //                 <TouchableOpacity onPress={() => setInputMode(inputMode === 'dial' ? 'keyboard' : 'dial')} style={styles.toggleBtn}>
// //                   {inputMode === 'dial' ? <IconKeyboard color={colors.textSecondary} /> : <IconClock color={colors.textSecondary} />}
// //                 </TouchableOpacity>

// //                 <View style={styles.actions}>
// //                   <TouchableOpacity onPress={onClose} style={styles.actionBtn}>
// //                     <Text style={[styles.actionText, { color: colors.textSecondary }]}>Cancel</Text>
// //                   </TouchableOpacity>
// //                   <TouchableOpacity onPress={handleSave} style={styles.actionBtn}>
// //                     <Text style={[styles.actionText, { color: colors.primary, fontWeight: 'bold' }]}>OK</Text>
// //                   </TouchableOpacity>
// //                 </View>
// //               </View>

// //             </View>
// //           </KeyboardAvoidingView>
// //         </View>
// //         </View>
// //       {/* </TouchableWithoutFeedback> */}
// //     </Modal>
// //   );
// // }
// const toggleInputMode = useCallback(() => {
//   setInputMode((prev) => (prev === 'dial' ? 'keyboard' : 'dial'));
// }, []);

// return (
//   <Modal
//     visible={visible}
//     transparent
//     animationType="fade"
//   >
//     <View pointerEvents="box-none" style={{ flex: 1, width: '100%' }}>
//       <View style={styles.overlay}>
//         <KeyboardAvoidingView
//           behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
//           style={{
//             width: '100%',
//             alignItems: 'center',
//           }}
//         >
//           <View
//             style={[
//               styles.container,
//               { backgroundColor: colors.bgCard },
//             ]}
//           >
//             <Text
//               style={[
//                 styles.title,
//                 { color: colors.textSecondary },
//               ]}
//             >
//               {inputMode === 'dial'
//                 ? 'Select time'
//                 : 'Enter time'}
//             </Text>

//             <View style={styles.headerSelection}>
//               <TouchableOpacity
//                 onPress={() => setDialMode('hour')}
//                 style={[
//                   styles.timeDisplayBtn,
//                   dialMode === 'hour' && {
//                     backgroundColor:
//                       colors.surfaceContainerHigh,
//                   },
//                 ]}
//               >
//                 <Text
//                   style={[
//                     styles.timeDisplayText,
//                     {
//                       color:
//                         dialMode === 'hour'
//                           ? colors.primary
//                           : colors.textPrimary,
//                     },
//                   ]}
//                 >
//                   {hour.padStart(2, '0')}
//                 </Text>
//               </TouchableOpacity>

//               <Text
//                 style={[
//                   styles.separator,
//                   { color: colors.textPrimary },
//                 ]}
//               >
//                 :
//               </Text>

//               <TouchableOpacity
//                 onPress={() => setDialMode('minute')}
//                 style={[
//                   styles.timeDisplayBtn,
//                   dialMode === 'minute' && {
//                     backgroundColor:
//                       colors.surfaceContainerHigh,
//                   },
//                 ]}
//               >
//                 <Text
//                   style={[
//                     styles.timeDisplayText,
//                     {
//                       color:
//                         dialMode === 'minute'
//                           ? colors.primary
//                           : colors.textPrimary,
//                     },
//                   ]}
//                 >
//                   {minute.padStart(2, '0')}
//                 </Text>
//               </TouchableOpacity>

//               {!is24Hour && (
//                 <View
//                   style={[
//                     styles.ampmContainer,
//                     {
//                       borderColor:
//                         colors.borderColor,
//                     },
//                   ]}
//                 >
//                   <TouchableOpacity
//                     style={[
//                       styles.ampmBtn,
//                       !isPM && {
//                         backgroundColor:
//                           colors.primaryContainer,
//                       },
//                     ]}
//                     onPress={() => setIsPM(false)}
//                   >
//                     <Text
//                       style={[
//                         styles.ampmText,
//                         {
//                           color: !isPM
//                             ? colors.primary
//                             : colors.textSecondary,
//                         },
//                         !isPM && {
//                           fontWeight: 'bold',
//                         },
//                       ]}
//                     >
//                       AM
//                     </Text>
//                   </TouchableOpacity>

//                   <View
//                     style={[
//                       styles.ampmDivider,
//                       {
//                         backgroundColor:
//                           colors.borderColor,
//                       },
//                     ]}
//                   />

//                   <TouchableOpacity
//                     style={[
//                       styles.ampmBtn,
//                       isPM && {
//                         backgroundColor:
//                           colors.primaryContainer,
//                       },
//                     ]}
//                     onPress={() => setIsPM(true)}
//                   >
//                     <Text
//                       style={[
//                         styles.ampmText,
//                         {
//                           color: isPM
//                             ? colors.primary
//                             : colors.textSecondary,
//                         },
//                         isPM && {
//                           fontWeight: 'bold',
//                         },
//                       ]}
//                     >
//                       PM
//                     </Text>
//                   </TouchableOpacity>
//                 </View>
//               )}
//             </View>

//             {inputMode === 'keyboard' ? (
//               <View style={styles.inputContainer}>
//                 <View style={styles.inputGroup}>
//                   <TextInput
//                     style={[
//                       styles.input,
//                       {
//                         backgroundColor:
//                           colors.surfaceContainerHigh,
//                         color: colors.textPrimary,
//                         borderColor: colors.primary,
//                       },
//                     ]}
//                     value={hour}
//                     onChangeText={handleHourChange}
//                     onBlur={handleHourBlur}
//                     keyboardType="number-pad"
//                     maxLength={2}
//                     selectTextOnFocus
//                   />

//                   <Text
//                     style={[
//                       styles.label,
//                       { color: colors.textSecondary },
//                     ]}
//                   >
//                     Hour
//                   </Text>
//                 </View>

//                 <Text
//                   style={[
//                     styles.separatorKeyboard,
//                     { color: colors.textPrimary },
//                   ]}
//                 >
//                   :
//                 </Text>

//                 <View style={styles.inputGroup}>
//                   <TextInput
//                     style={[
//                       styles.input,
//                       {
//                         backgroundColor:
//                           colors.surfaceContainerHigh,
//                         color: colors.textPrimary,
//                         borderColor: colors.primary,
//                       },
//                     ]}
//                     value={minute}
//                     onChangeText={handleMinuteChange}
//                     onBlur={handleMinuteBlur}
//                     keyboardType="number-pad"
//                     maxLength={2}
//                     selectTextOnFocus
//                   />

//                   <Text
//                     style={[
//                       styles.label,
//                       { color: colors.textSecondary },
//                     ]}
//                   >
//                     Minute
//                   </Text>
//                 </View>
//               </View>
//             ) : (
//               <ClockDial />
//             )}

//             <View style={styles.bottomRow}>
//               <TouchableOpacity
//                 onPress={toggleInputMode}
//                 style={styles.toggleBtn}
//               >
//                 {inputMode === 'dial' ? (
//                   <IconKeyboard
//                     color={colors.textSecondary}
//                   />
//                 ) : (
//                   <IconClock
//                     color={colors.textSecondary}
//                   />
//                 )}
//               </TouchableOpacity>

//               <View style={styles.actions}>
//                 <TouchableOpacity
//                   onPress={onClose}
//                   style={styles.actionBtn}
//                 >
//                   <Text
//                     style={[
//                       styles.actionText,
//                       {
//                         color:
//                           colors.textSecondary,
//                       },
//                     ]}
//                   >
//                     Cancel
//                   </Text>
//                 </TouchableOpacity>

//                 <TouchableOpacity
//                   onPress={handleSave}
//                   style={styles.actionBtn}
//                 >
//                   <Text
//                     style={[
//                       styles.actionText,
//                       {
//                         color: colors.primary,
//                         fontWeight: 'bold',
//                       },
//                     ]}
//                   >
//                     OK
//                   </Text>
//                 </TouchableOpacity>
//               </View>
//             </View>
//           </View>
//         </KeyboardAvoidingView>
//       </View>
//     </View>
//   </Modal>
// );
// }

// const styles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   container: {
//     width: 320,
//     borderRadius: 24,
//     padding: 24,
//   },
//   title: {
//     fontSize: 14,
//     fontWeight: '500',
//     marginBottom: 20,
//     marginLeft: 4,
//   },
//   headerSelection: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginBottom: 30,
//   },
//   timeDisplayBtn: {
//     paddingVertical: 12,
//     paddingHorizontal: 16,
//     borderRadius: 8,
//   },
//   timeDisplayText: {
//     fontSize: 40,
//   },
//   separator: {
//     fontSize: 40,
//     marginHorizontal: 8,
//   },
//   separatorKeyboard: {
//     fontSize: 40,
//     marginHorizontal: 10,
//     marginBottom: 24,
//   },
//   inputContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: 30,
//   },
//   inputGroup: {
//     alignItems: 'center',
//   },
//   input: {
//     width: 90,
//     height: 70,
//     borderRadius: 8,
//     fontSize: 40,
//     textAlign: 'center',
//   },
//   label: {
//     fontSize: 12,
//     marginTop: 8,
//   },
//   ampmContainer: {
//     flexDirection: 'column',
//     borderWidth: 1,
//     borderRadius: 8,
//     marginLeft: 15,
//     overflow: 'hidden',
//   },
//   ampmBtn: {
//     paddingVertical: 10,
//     paddingHorizontal: 15,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   ampmText: {
//     fontSize: 14,
//     fontWeight: '500',
//   },
//   ampmDivider: {
//     height: 1,
//     width: '100%',
//   },
//   dialContainer: {
//     width: '100%',
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: 30,
//   },
//   dialCircle: {
//     width: 250,
//     height: 250,
//     borderRadius: 125,
//     position: 'relative',
//   },
//   dialNumberBtn: {
//     position: 'absolute',
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   dialNumberText: {
//     fontSize: 15,
//   },
//   bottomRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },
//   toggleBtn: {
//     padding: 10,
//   },
//   actions: {
//     flexDirection: 'row',
//   },
//   actionBtn: {
//     marginLeft: 10,
//     padding: 10,
//   },
//   actionText: {
//     fontSize: 15,
//   },
// });


import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import dayjs from 'dayjs';
import * as Localization from 'expo-localization';

import Svg, {
  Circle,
  Line,
  Path,
} from 'react-native-svg';

import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';

import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedLine =
  Animated.createAnimatedComponent(Line);

const AnimatedCircle =
  Animated.createAnimatedComponent(Circle);

const AnimatedText =
  Animated.createAnimatedComponent(Text);

const DIAL_SIZE = 250;
const CENTER = DIAL_SIZE / 2;

const OUTER_RADIUS = 80;
const INNER_RADIUS = 50;
const OUTER_RADIUS_THRESHOLD = 65;

const SPRING_CONFIG = {
  damping: 14,
  stiffness: 400,
  mass: 0.45,
};

const angleToHour = (
  angle,
  distance,
  is24Hour
) => {
  'worklet';

  let hour = Math.floor((angle + 15) / 30);

  if (hour === 12) {
    hour = 0;
  }

  if (!is24Hour) {
    return hour === 0 ? 12 : hour;
  }

  const isOuter =
    distance >= OUTER_RADIUS_THRESHOLD;

  if (isOuter) {
    return hour === 0 ? 12 : hour;
  }

  return hour === 0 ? 0 : hour + 12;
};

const angleToMinute = (angle) => {
  'worklet';

  let minute = Math.floor((angle + 3) / 6);

  if (minute >= 60) {
    minute = 0;
  }

  return minute;
};

const resolveMaterialScheme = (
  colors = {},
  isDark = false
) => {
  const fallback = isDark
    ? {
        primary: '#D0BCFF',
        onPrimary: '#381E72',

        primaryContainer: '#4F378B',
        onPrimaryContainer: '#EADDFF',

        surface: '#141218',
        surfaceContainer: '#211F26',
        surfaceContainerHigh: '#2B2930',
        surfaceContainerHighest: '#36343B',

        onSurface: '#E6E0E9',
        onSurfaceVariant: '#CAC4D0',

        outline: '#938F99',
        scrim: 'rgba(0,0,0,0.60)',
      }
    : {
        primary: '#6750A4',
        onPrimary: '#FFFFFF',

        primaryContainer: '#EADDFF',
        onPrimaryContainer: '#21005D',

        surface: '#FFFBFE',
        surfaceContainer: '#F3EDF7',
        surfaceContainerHigh: '#ECE6F0',
        surfaceContainerHighest: '#E6E0E9',

        onSurface: '#1D1B20',
        onSurfaceVariant: '#49454F',

        outline: '#79747E',
        scrim: 'rgba(0,0,0,0.32)',
      };

  return {
    primary:
      colors.primary ??
      fallback.primary,

    onPrimary:
      colors.onPrimary ??
      colors.textInverse ??
      fallback.onPrimary,

    primaryContainer:
      colors.primaryContainer ??
      fallback.primaryContainer,

    onPrimaryContainer:
      colors.onPrimaryContainer ??
      colors.primary ??
      fallback.onPrimaryContainer,

    surface:
      colors.surface ??
      colors.background ??
      fallback.surface,

    surfaceContainer:
      colors.surfaceContainer ??
      colors.background ??
      fallback.surfaceContainer,

    surfaceContainerHigh:
      colors.surfaceContainerHigh ??
      colors.background ??
      fallback.surfaceContainerHigh,

    surfaceContainerHighest:
      colors.surfaceContainerHighest ??
      colors.surfaceContainerHigh ??
      fallback.surfaceContainerHighest,

    onSurface:
      colors.onSurface ??
      colors.textPrimary ??
      fallback.onSurface,

    onSurfaceVariant:
      colors.onSurfaceVariant ??
      colors.textSecondary ??
      fallback.onSurfaceVariant,

    outline:
      colors.outline ??
      colors.borderColor ??
      fallback.outline,

    scrim:
      colors.scrim ??
      fallback.scrim,
  };
};

const valueToAngleAndRadius = ({
  mode,
  hour,
  minute,
  is24Hour,
}) => {
  if (mode === 'minute') {
    return {
      angle:
        (parseInt(minute, 10) || 0) * 6,

      radius: OUTER_RADIUS,
    };
  }

  const numericHour =
    parseInt(hour, 10) || 0;

  if (!is24Hour) {
    const displayHour =
      numericHour === 12
        ? 0
        : numericHour;

    return {
      angle: displayHour * 30,
      radius: OUTER_RADIUS,
    };
  }

  const isOuter =
    numericHour >= 1 &&
    numericHour <= 12;

  const displayHour =
    numericHour === 0 ||
    numericHour === 12
      ? 0
      : numericHour % 12;

  return {
    angle: displayHour * 30,

    radius:
      isOuter
        ? OUTER_RADIUS
        : INNER_RADIUS,
  };
};

const IconKeyboard = ({ color }) => (
  <Svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20 5H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2z" />

    <Path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 17h8" />
  </Svg>
);

const IconClock = ({ color }) => (
  <Svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle
      cx="12"
      cy="12"
      r="10"
    />

    <Path d="M12 6v6l4 2" />
  </Svg>
);

const DialNumber = React.memo(
  function DialNumber({
    item,
    isHourMode,
    is24HourSV,
    sharedAngle,
    sharedRadius,
    scheme,
  }) {
    const animatedStyle =
      useAnimatedStyle(() => {
        const selectedValue =
          isHourMode.value
            ? angleToHour(
                sharedAngle.value,
                sharedRadius.value,
                is24HourSV.value
              )
            : angleToMinute(
                sharedAngle.value
              );

        const isSelected =
          selectedValue ===
          item.numericValue;

        return {
          color: isSelected
            ? scheme.onPrimary
            : item.isInner
              ? scheme.onSurfaceVariant
              : scheme.onSurface,
        };
      });

    return (
      <View
        pointerEvents="none"
        style={[
          styles.dialNumberButton,
          {
            left: item.x - 16,
            top: item.y - 16,
          },
        ]}
      >
        <AnimatedText
          style={[
            styles.dialNumberText,

            item.isInner &&
              styles.innerDialNumberText,

            animatedStyle,
          ]}
        >
          {item.label}
        </AnimatedText>
      </View>
    );
  }
);

function ClockDial({
  dialMode,
  is24Hour,
  hour,
  minute,
  scheme,
  onHourChange,
  onMinuteChange,
  onHourGestureEnd,
}) {
  const dialRef = useRef(null);

  const sharedAngle =
    useSharedValue(0);

  const sharedRadius =
    useSharedValue(OUTER_RADIUS);

  const isDragging =
    useSharedValue(false);

  const lastValue =
    useSharedValue(-1);

  const is24HourSV =
    useSharedValue(is24Hour);

  const isHourMode =
    useSharedValue(
      dialMode === 'hour'
    );

  const globalCenterX =
    useSharedValue(0);

  const globalCenterY =
    useSharedValue(0);

  const modeRef =
    useRef(dialMode);

  const is24HourRef =
    useRef(is24Hour);

  useEffect(() => {
    modeRef.current = dialMode;

    isHourMode.value =
      dialMode === 'hour';

    lastValue.value = -1;
  }, [
    dialMode,
    isHourMode,
    lastValue,
  ]);

  useEffect(() => {
    is24HourRef.current =
      is24Hour;

    is24HourSV.value =
      is24Hour;
  }, [
    is24Hour,
    is24HourSV,
  ]);

  const measureDial =
    useCallback(() => {
      requestAnimationFrame(() => {
        dialRef.current?.measureInWindow(
          (
            x,
            y,
            width,
            height
          ) => {
            globalCenterX.value =
              x + width / 2;

            globalCenterY.value =
              y + height / 2;
          }
        );
      });
    }, [
      globalCenterX,
      globalCenterY,
    ]);

  useEffect(() => {
    measureDial();
  }, [
    measureDial,
    dialMode,
    is24Hour,
  ]);

  useEffect(() => {
    if (isDragging.value) {
      return;
    }

    const target =
      valueToAngleAndRadius({
        mode: dialMode,
        hour,
        minute,
        is24Hour,
      });

    sharedAngle.value =
      withSpring(
        target.angle,
        SPRING_CONFIG
      );

    sharedRadius.value =
      withSpring(
        target.radius,
        SPRING_CONFIG
      );
  }, [
    dialMode,
    hour,
    minute,
    is24Hour,
    isDragging,
    sharedAngle,
    sharedRadius,
  ]);

  const commitValueFromAngle =
    useCallback(
      (
        angle,
        distance
      ) => {
        if (
          modeRef.current ===
          'hour'
        ) {
          const nextHour =
            angleToHour(
              angle,
              distance,
              is24HourRef.current
            );

          onHourChange(
            String(nextHour)
          );

          return;
        }

        const nextMinute =
          angleToMinute(angle);

        onMinuteChange(
          String(
            nextMinute
          ).padStart(2, '0')
        );
      },
      [
        onHourChange,
        onMinuteChange,
      ]
    );

  const panGesture =
    useMemo(
      () =>
        Gesture.Pan()
          .minDistance(0)
          .hitSlop(20)
          .shouldCancelWhenOutside(
            false
          )

          .onBegin((event) => {
            'worklet';

            isDragging.value =
              true;

            lastValue.value =
              -1;

            const dx =
              event.absoluteX -
              globalCenterX.value;

            const dy =
              event.absoluteY -
              globalCenterY.value;

            const distance =
              Math.sqrt(
                dx * dx +
                dy * dy
              );

            const angle =
              (
                Math.atan2(
                  dy,
                  dx
                ) *
                  180 /
                  Math.PI +
                450
              ) % 360;

            sharedAngle.value =
              angle;

            sharedRadius.value =
              isHourMode.value &&
              is24HourSV.value
                ? distance <
                  OUTER_RADIUS_THRESHOLD
                  ? INNER_RADIUS
                  : OUTER_RADIUS
                : OUTER_RADIUS;

            const value =
              isHourMode.value
                ? angleToHour(
                    angle,
                    distance,
                    is24HourSV.value
                  )
                : angleToMinute(
                    angle
                  );

            lastValue.value =
              value;

            runOnJS(
              commitValueFromAngle
            )(
              angle,
              distance
            );
          })

          .onUpdate((event) => {
            'worklet';

            const dx =
              event.absoluteX -
              globalCenterX.value;

            const dy =
              event.absoluteY -
              globalCenterY.value;

            const distance =
              Math.sqrt(
                dx * dx +
                dy * dy
              );

            const angle =
              (
                Math.atan2(
                  dy,
                  dx
                ) *
                  180 /
                  Math.PI +
                450
              ) % 360;

            /*
             * These shared values move
             * continuously with the finger.
             */
            sharedAngle.value =
              angle;

            sharedRadius.value =
              isHourMode.value &&
              is24HourSV.value
                ? distance <
                  OUTER_RADIUS_THRESHOLD
                  ? INNER_RADIUS
                  : OUTER_RADIUS
                : OUTER_RADIUS;

            const value =
              isHourMode.value
                ? angleToHour(
                    angle,
                    distance,
                    is24HourSV.value
                  )
                : angleToMinute(
                    angle
                  );

            /*
             * React state changes only when
             * the selected number changes.
             */
            if (
              value !==
              lastValue.value
            ) {
              lastValue.value =
                value;

              runOnJS(
                commitValueFromAngle
              )(
                angle,
                distance
              );
            }
          })

          .onFinalize(() => {
            'worklet';

            const wasHourMode =
              isHourMode.value;

            isDragging.value =
              false;

            const step =
              wasHourMode
                ? 30
                : 6;

            let snappedAngle =
              Math.round(
                sharedAngle.value /
                  step
              ) * step;

            if (
              snappedAngle >= 360
            ) {
              snappedAngle = 0;
            }

            sharedAngle.value =
              withSpring(
                snappedAngle,
                SPRING_CONFIG
              );

            if (wasHourMode) {
              runOnJS(
                onHourGestureEnd
              )();
            }
          }),
      [
        commitValueFromAngle,
        globalCenterX,
        globalCenterY,
        is24HourSV,
        isDragging,
        isHourMode,
        lastValue,
        onHourGestureEnd,
        sharedAngle,
        sharedRadius,
      ]
    );

  const items =
    useMemo(() => {
      const list = [];

      if (
        dialMode === 'hour'
      ) {
        if (!is24Hour) {
          for (
            let value = 1;
            value <= 12;
            value += 1
          ) {
            const angle =
              (
                value * 30 -
                90
              ) *
              (
                Math.PI /
                180
              );

            list.push({
              label:
                String(value),

              numericValue:
                value,

              x:
                CENTER +
                OUTER_RADIUS *
                  Math.cos(angle),

              y:
                CENTER +
                OUTER_RADIUS *
                  Math.sin(angle),

              isInner: false,
            });
          }
        } else {
          for (
            let value = 0;
            value <= 23;
            value += 1
          ) {
            const isOuter =
              value >= 1 &&
              value <= 12;

            const displayValue =
              value === 0 ||
              value === 12
                ? 0
                : value % 12;

            const radius =
              isOuter
                ? OUTER_RADIUS
                : INNER_RADIUS;

            const angle =
              (
                displayValue *
                  30 -
                90
              ) *
              (
                Math.PI /
                180
              );

            list.push({
              label:
                value === 0
                  ? '00'
                  : String(value),

              numericValue:
                value,

              x:
                CENTER +
                radius *
                  Math.cos(angle),

              y:
                CENTER +
                radius *
                  Math.sin(angle),

              isInner:
                !isOuter,
            });
          }
        }
      } else {
        for (
          let value = 0;
          value < 60;
          value += 5
        ) {
          const angle =
            (
              value * 6 -
              90
            ) *
            (
              Math.PI /
              180
            );

          list.push({
            label:
              String(
                value
              ).padStart(
                2,
                '0'
              ),

            numericValue:
              value,

            x:
              CENTER +
              OUTER_RADIUS *
                Math.cos(angle),

            y:
              CENTER +
              OUTER_RADIUS *
                Math.sin(angle),

            isInner: false,
          });
        }
      }

      return list;
    }, [
      dialMode,
      is24Hour,
    ]);

  const animatedLineProps =
    useAnimatedProps(() => {
      const angleRadians =
        (
          sharedAngle.value -
          90
        ) *
        (
          Math.PI /
          180
        );

      return {
        x2:
          CENTER +
          sharedRadius.value *
            Math.cos(
              angleRadians
            ),

        y2:
          CENTER +
          sharedRadius.value *
            Math.sin(
              angleRadians
            ),
      };
    });

  const animatedCircleProps =
    useAnimatedProps(() => {
      const angleRadians =
        (
          sharedAngle.value -
          90
        ) *
        (
          Math.PI /
          180
        );

      return {
        cx:
          CENTER +
          sharedRadius.value *
            Math.cos(
              angleRadians
            ),

        cy:
          CENTER +
          sharedRadius.value *
            Math.sin(
              angleRadians
            ),
      };
    });

  return (
    <View
      style={
        styles.dialContainer
      }
    >
      <View
        ref={dialRef}
        collapsable={false}
        onLayout={measureDial}
        style={[
          styles.dialCircle,
          {
            backgroundColor:
              scheme.surfaceContainerHighest,
          },
        ]}
      >
        <Svg
          width={DIAL_SIZE}
          height={DIAL_SIZE}
          style={
            StyleSheet.absoluteFill
          }
          pointerEvents="none"
        >
          <Circle
            cx={CENTER}
            cy={CENTER}
            r="4"
            fill={scheme.primary}
          />

          <AnimatedLine
            x1={CENTER}
            y1={CENTER}
            animatedProps={
              animatedLineProps
            }
            stroke={
              scheme.primary
            }
            strokeWidth="2"
          />

          <AnimatedCircle
            animatedProps={
              animatedCircleProps
            }
            r="16"
            fill={
              scheme.primary
            }
          />
        </Svg>

        {items.map((item) => (
          <DialNumber
            key={`${dialMode}-${item.numericValue}`}
            item={item}
            isHourMode={
              isHourMode
            }
            is24HourSV={
              is24HourSV
            }
            sharedAngle={
              sharedAngle
            }
            sharedRadius={
              sharedRadius
            }
            scheme={scheme}
          />
        ))}

        <GestureDetector
          gesture={panGesture}
        >
          <Animated.View
            style={
              StyleSheet.absoluteFillObject
            }
          />
        </GestureDetector>
      </View>
    </View>
  );
}

export default function CustomTimePicker({
  visible,
  value,
  onClose,
  onSave,
  colors = {},
  isDark = false,
}) {
  const scheme =
    useMemo(
      () =>
        resolveMaterialScheme(
          colors,
          isDark
        ),
      [
        colors,
        isDark,
      ]
    );

  const [hour, setHour] =
    useState('12');

  const [minute, setMinute] =
    useState('00');

  const [isPM, setIsPM] =
    useState(false);

  const [
    inputMode,
    setInputMode,
  ] = useState('dial');

  const [
    dialMode,
    setDialMode,
  ] = useState('hour');

  const [
    is24Hour,
    setIs24Hour,
  ] = useState(false);

  useEffect(() => {
    const calendar =
      Localization.getCalendars?.()?.[0];

    setIs24Hour(
      calendar?.uses24hourClock ??
        false
    );
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const hasValue =
      typeof value ===
        'string' &&
      value.trim() !== '' &&
      value.trim() !==
        '--:--';

    const parsedValue =
      hasValue
        ? dayjs(
            `2000-01-01T${value}`
          )
        : null;

    const selectedTime =
      parsedValue?.isValid()
        ? parsedValue
        : dayjs();

    let selectedHour =
      selectedTime.hour();

    if (!is24Hour) {
      setIsPM(
        selectedHour >= 12
      );

      selectedHour =
        selectedHour % 12 ||
        12;
    }

    setHour(
      String(
        selectedHour
      )
    );

    setMinute(
      selectedTime.format(
        'mm'
      )
    );

    setDialMode('hour');
    setInputMode('dial');
  }, [
    visible,
    value,
    is24Hour,
  ]);

  const handleHourChange =
    useCallback(
      (nextHour) => {
        setHour(nextHour);
      },
      []
    );

  const handleMinuteChange =
    useCallback(
      (nextMinute) => {
        setMinute(
          nextMinute
        );
      },
      []
    );

  const handleHourGestureEnd =
    useCallback(() => {
      setDialMode('minute');
    }, []);

  const handleSave =
    useCallback(() => {
      let numericHour =
        parseInt(
          hour,
          10
        );

      let numericMinute =
        parseInt(
          minute,
          10
        );

      if (
        Number.isNaN(
          numericMinute
        )
      ) {
        numericMinute = 0;
      }

      numericMinute =
        Math.max(
          0,
          Math.min(
            59,
            numericMinute
          )
        );

      if (is24Hour) {
        if (
          Number.isNaN(
            numericHour
          )
        ) {
          numericHour = 0;
        }

        numericHour =
          Math.max(
            0,
            Math.min(
              23,
              numericHour
            )
          );
      } else {
        if (
          Number.isNaN(
            numericHour
          )
        ) {
          numericHour = 12;
        }

        numericHour =
          Math.max(
            1,
            Math.min(
              12,
              numericHour
            )
          );

        if (
          isPM &&
          numericHour !== 12
        ) {
          numericHour += 12;
        }

        if (
          !isPM &&
          numericHour === 12
        ) {
          numericHour = 0;
        }
      }

      const formattedHour =
        String(
          numericHour
        ).padStart(
          2,
          '0'
        );

      const formattedMinute =
        String(
          numericMinute
        ).padStart(
          2,
          '0'
        );

      onSave(
        `${formattedHour}:${formattedMinute}`
      );
    }, [
      hour,
      minute,
      is24Hour,
      isPM,
      onSave,
    ]);

  const handleHourInputChange =
    useCallback(
      (text) => {
        setHour(
          text.replace(
            /[^0-9]/g,
            ''
          )
        );
      },
      []
    );

  const handleMinuteInputChange =
    useCallback(
      (text) => {
        setMinute(
          text.replace(
            /[^0-9]/g,
            ''
          )
        );
      },
      []
    );

  const handleHourBlur =
    useCallback(() => {
      setHour(
        (current) => {
          let numericValue =
            parseInt(
              current,
              10
            );

          if (is24Hour) {
            if (
              Number.isNaN(
                numericValue
              )
            ) {
              numericValue = 0;
            }

            return String(
              Math.max(
                0,
                Math.min(
                  23,
                  numericValue
                )
              )
            );
          }

          if (
            Number.isNaN(
              numericValue
            )
          ) {
            numericValue = 12;
          }

          return String(
            Math.max(
              1,
              Math.min(
                12,
                numericValue
              )
            )
          );
        }
      );
    }, [
      is24Hour,
    ]);

  const handleMinuteBlur =
    useCallback(() => {
      setMinute(
        (current) => {
          let numericValue =
            parseInt(
              current,
              10
            );

          if (
            Number.isNaN(
              numericValue
            )
          ) {
            numericValue = 0;
          }

          return String(
            Math.max(
              0,
              Math.min(
                59,
                numericValue
              )
            )
          ).padStart(
            2,
            '0'
          );
        }
      );
    }, []);

  const toggleInputMode =
    useCallback(() => {
      setInputMode(
        (current) =>
          current ===
          'dial'
            ? 'keyboard'
            : 'dial'
      );
    }, []);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={[
            styles.overlay,
            {
              backgroundColor:
                scheme.scrim,
            },
          ]}
        >
          <KeyboardAvoidingView
            behavior={
              Platform.OS ===
              'ios'
                ? 'padding'
                : undefined
            }
            style={
              styles.keyboardAvoidingView
            }
          >
          <View
            style={[
              styles.container,
              {
                backgroundColor:
                  colors.bgCard || scheme.surfaceContainerHigh,
              },
            ]}
          >
            <Text
              style={[
                styles.title,
                {
                  color:
                    scheme.onSurfaceVariant,
                },
              ]}
            >
              {inputMode ===
              'dial'
                ? 'Select time'
                : 'Enter time'}
            </Text>

            <View
              style={
                styles.headerSelection
              }
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  setDialMode(
                    'hour'
                  )
                }
                style={[
                  styles.timeDisplayButton,

                  dialMode ===
                    'hour' && {
                    backgroundColor:
                      scheme.primaryContainer,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.timeDisplayText,
                    {
                      color:
                        dialMode ===
                        'hour'
                          ? scheme.onPrimaryContainer
                          : scheme.onSurface,
                    },
                  ]}
                >
                  {hour.padStart(
                    2,
                    '0'
                  )}
                </Text>
              </TouchableOpacity>

              <Text
                style={[
                  styles.timeSeparator,
                  {
                    color:
                      scheme.onSurface,
                  },
                ]}
              >
                :
              </Text>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  setDialMode(
                    'minute'
                  )
                }
                style={[
                  styles.timeDisplayButton,

                  dialMode ===
                    'minute' && {
                    backgroundColor:
                      scheme.primaryContainer,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.timeDisplayText,
                    {
                      color:
                        dialMode ===
                        'minute'
                          ? scheme.onPrimaryContainer
                          : scheme.onSurface,
                    },
                  ]}
                >
                  {minute.padStart(
                    2,
                    '0'
                  )}
                </Text>
              </TouchableOpacity>

              {!is24Hour && (
                <View
                  style={[
                    styles.ampmContainer,
                    {
                      borderColor:
                        scheme.outline,
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() =>
                      setIsPM(false)
                    }
                    style={[
                      styles.ampmButton,

                      !isPM && {
                        backgroundColor:
                          scheme.primaryContainer,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ampmText,
                        {
                          color:
                            !isPM
                              ? scheme.onPrimaryContainer
                              : scheme.onSurfaceVariant,
                        },

                        !isPM &&
                          styles.selectedAmPmText,
                      ]}
                    >
                      AM
                    </Text>
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.ampmDivider,
                      {
                        backgroundColor:
                          scheme.outline,
                      },
                    ]}
                  />

                  <TouchableOpacity
                    onPress={() =>
                      setIsPM(true)
                    }
                    style={[
                      styles.ampmButton,

                      isPM && {
                        backgroundColor:
                          scheme.primaryContainer,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ampmText,
                        {
                          color:
                            isPM
                              ? scheme.onPrimaryContainer
                              : scheme.onSurfaceVariant,
                        },

                        isPM &&
                          styles.selectedAmPmText,
                      ]}
                    >
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {inputMode ===
            'keyboard' ? (
              <View
                style={
                  styles.inputContainer
                }
              >
                <View
                  style={
                    styles.inputGroup
                  }
                >
                  <TextInput
                    value={hour}
                    onChangeText={
                      handleHourInputChange
                    }
                    onBlur={
                      handleHourBlur
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                    style={[
                      styles.input,
                      {
                        color:
                          scheme.onSurface,

                        backgroundColor:
                          scheme.surfaceContainerHighest,

                        borderColor:
                          scheme.primary,
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          scheme.onSurfaceVariant,
                      },
                    ]}
                  >
                    Hour
                  </Text>
                </View>

                <Text
                  style={[
                    styles.keyboardSeparator,
                    {
                      color:
                        scheme.onSurface,
                    },
                  ]}
                >
                  :
                </Text>

                <View
                  style={
                    styles.inputGroup
                  }
                >
                  <TextInput
                    value={minute}
                    onChangeText={
                      handleMinuteInputChange
                    }
                    onBlur={
                      handleMinuteBlur
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                    style={[
                      styles.input,
                      {
                        color:
                          scheme.onSurface,

                        backgroundColor:
                          scheme.surfaceContainerHighest,

                        borderColor:
                          scheme.primary,
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          scheme.onSurfaceVariant,
                      },
                    ]}
                  >
                    Minute
                  </Text>
                </View>
              </View>
            ) : (
              <ClockDial
                dialMode={
                  dialMode
                }
                is24Hour={
                  is24Hour
                }
                hour={hour}
                minute={
                  minute
                }
                scheme={
                  scheme
                }
                onHourChange={
                  handleHourChange
                }
                onMinuteChange={
                  handleMinuteChange
                }
                onHourGestureEnd={
                  handleHourGestureEnd
                }
              />
            )}

            <View
              style={
                styles.bottomRow
              }
            >
              <TouchableOpacity
                onPress={
                  toggleInputMode
                }
                style={
                  styles.iconButton
                }
              >
                {inputMode ===
                'dial' ? (
                  <IconKeyboard
                    color={
                      scheme.onSurfaceVariant
                    }
                  />
                ) : (
                  <IconClock
                    color={
                      scheme.onSurfaceVariant
                    }
                  />
                )}
              </TouchableOpacity>

              <View
                style={
                  styles.actions
                }
              >
                <TouchableOpacity
                  onPress={
                    onClose
                  }
                  style={
                    styles.actionButton
                  }
                >
                  <Text
                    style={[
                      styles.actionText,
                      {
                        color:
                          scheme.primary,
                      },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={
                    handleSave
                  }
                  style={
                    styles.actionButton
                  }
                >
                  <Text
                    style={[
                      styles.actionText,
                      styles.okText,
                      {
                        color:
                          scheme.primary,
                      },
                    ]}
                  >
                    OK
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles =
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 20,
    },

    keyboardAvoidingView: {
      width: '100%',
      alignItems:
        'center',
    },

    container: {
      width: 328,
      maxWidth: '100%',
      borderRadius: 28,
      paddingTop: 24,
      paddingHorizontal: 24,
      paddingBottom: 12,
      elevation: 6,

      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    },

    title: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      letterSpacing: 0.1,
      marginBottom: 20,
    },

    headerSelection: {
      flexDirection: 'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 24,
    },

    timeDisplayButton: {
      minWidth: 72,
      height: 64,
      borderRadius: 8,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 10,
    },

    timeDisplayText: {
      fontSize: 40,
      lineHeight: 48,
      fontWeight: '400',
      letterSpacing: 0,
    },

    timeSeparator: {
      fontSize: 40,
      lineHeight: 48,
      marginHorizontal: 4,
    },

    ampmContainer: {
      width: 52,
      height: 64,
      borderWidth: 1,
      borderRadius: 8,
      marginLeft: 12,
      overflow: 'hidden',
    },

    ampmButton: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    ampmDivider: {
      height: 1,
      width: '100%',
    },

    ampmText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
    },

    selectedAmPmText: {
      fontWeight: '700',
    },

    dialContainer: {
      width: '100%',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 20,
    },

    dialCircle: {
      width: DIAL_SIZE,
      height: DIAL_SIZE,
      borderRadius:
        DIAL_SIZE / 2,
      position:
        'relative',
      overflow: 'visible',
    },

    dialNumberButton: {
      position:
        'absolute',
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    dialNumberText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      textAlign:
        'center',
    },

    innerDialNumberText: {
      fontSize: 12,
      lineHeight: 16,
    },

    inputContainer: {
      minHeight: 250,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 20,
    },

    inputGroup: {
      alignItems:
        'center',
    },

    input: {
      width: 96,
      height: 72,
      borderWidth: 2,
      borderRadius: 8,
      textAlign:
        'center',
      fontSize: 40,
      lineHeight: 48,
      paddingHorizontal: 8,
    },

    inputLabel: {
      marginTop: 8,
      fontSize: 12,
      lineHeight: 16,
    },

    keyboardSeparator: {
      fontSize: 40,
      lineHeight: 48,
      marginHorizontal: 10,
      marginBottom: 24,
    },

    bottomRow: {
      minHeight: 52,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    iconButton: {
      width: 48,
      height: 48,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius: 24,
    },

    actions: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    actionButton: {
      minWidth: 64,
      height: 48,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 12,
    },

    actionText: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      letterSpacing: 0.1,
    },

    okText: {
      fontWeight: '700',
    },
  });