// // import React, {
// //   useCallback,
// //   useEffect,
// //   useMemo,
// //   useRef,
// //   useState,
// // } from 'react';

// // import {
// //   View,
// //   Text,
// //   StyleSheet,
// //   Modal,
// //   TouchableOpacity,
// //   KeyboardAvoidingView,
// //   Platform,
// // } from 'react-native';

// // import dayjs from 'dayjs';
// // import * as Localization from 'expo-localization';

// // import Animated, {
// //   Extrapolation,
// //   interpolate,
// //   interpolateColor,
// //   useAnimatedScrollHandler,
// //   useAnimatedStyle,
// //   useSharedValue,
// // } from 'react-native-reanimated';

// // const ITEM_HEIGHT = 60;
// // const VISIBLE_ITEMS = 5;

// // const CENTER_PADDING =
// //   ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

// // const AnimatedText =
// //   Animated.createAnimatedComponent(Text);

// // /* -------------------------------------------------------------------------- */
// // /* Wheel item                                                                 */
// // /* -------------------------------------------------------------------------- */

// // const WheelItem = React.memo(
// //   ({ index, item, scrollY, colors }) => {
// //     const animatedContainerStyle =
// //       useAnimatedStyle(() => {
// //         const itemOffset = index * ITEM_HEIGHT;

// //         const distanceFromCenter = Math.abs(
// //           scrollY.value - itemOffset
// //         );

// //         const opacity = interpolate(
// //           distanceFromCenter,
// //           [
// //             0,
// //             ITEM_HEIGHT,
// //             ITEM_HEIGHT * 2,
// //           ],
// //           [1, 0.5, 0.2],
// //           Extrapolation.CLAMP
// //         );

// //         return {
// //           opacity,
// //         };
// //       });

// //     const animatedTextStyle =
// //       useAnimatedStyle(() => {
// //         const itemOffset = index * ITEM_HEIGHT;

// //         const distanceFromCenter = Math.abs(
// //           scrollY.value - itemOffset
// //         );

// //         const color = interpolateColor(
// //           distanceFromCenter,
// //           [
// //             0,
// //             ITEM_HEIGHT / 2,
// //             ITEM_HEIGHT,
// //           ],
// //           [
// //             colors.primary,
// //             colors.textSecondary,
// //             colors.textSecondary,
// //           ]
// //         );

// //         const fontSize = interpolate(
// //           distanceFromCenter,
// //           [0, ITEM_HEIGHT],
// //           [32, 26],
// //           Extrapolation.CLAMP
// //         );

// //         return {
// //           color,
// //           fontSize,
// //         };
// //       });

// //     return (
// //       <Animated.View
// //         style={[
// //           styles.wheelItem,
// //           animatedContainerStyle,
// //         ]}
// //       >
// //         <AnimatedText
// //           style={[
// //             styles.wheelItemText,
// //             animatedTextStyle,
// //           ]}
// //         >
// //           {item.label}
// //         </AnimatedText>
// //       </Animated.View>
// //     );
// //   }
// // );

// // /* -------------------------------------------------------------------------- */
// // /* Infinite wheel                                                             */
// // /* -------------------------------------------------------------------------- */

// // const InfiniteWheel = ({
// //   data,
// //   selectedValue,
// //   onValueChange,
// //   colors,
// //   infinite = true,
// // }) => {
// //   const originalLength = data.length;
// //   const loops = infinite ? 20 : 1;

// //   const flatListRef = useRef(null);

// //   /*
// //    * Store the starting index only once.
// //    *
// //    * This is important. If initialIndex were recalculated every time
// //    * selectedValue changed while scrolling, the wheel would jump back
// //    * toward the middle repeatedly.
// //    */
// //   const initialIndexRef = useRef(null);

// //   const lastSelectedIndexRef = useRef(-1);

// //   const renderData = useMemo(() => {
// //     if (!infinite) {
// //       return data;
// //     }

// //     const result = [];

// //     for (
// //       let loop = 0;
// //       loop < loops;
// //       loop += 1
// //     ) {
// //       for (
// //         let index = 0;
// //         index < originalLength;
// //         index += 1
// //       ) {
// //         result.push({
// //           ...data[index],
// //           repeatedIndex: result.length,
// //         });
// //       }
// //     }

// //     return result;
// //   }, [
// //     data,
// //     infinite,
// //     loops,
// //     originalLength,
// //   ]);

// //   if (initialIndexRef.current === null) {
// //     let selectedIndex = data.findIndex(
// //       (item) => item.value === selectedValue
// //     );

// //     if (selectedIndex < 0) {
// //       selectedIndex = 0;
// //     }

// //     if (infinite && originalLength > 0) {
// //       selectedIndex +=
// //         Math.floor(loops / 2) *
// //         originalLength;
// //     }

// //     initialIndexRef.current = selectedIndex;
// //     lastSelectedIndexRef.current =
// //       selectedIndex;
// //   }

// //   const initialIndex =
// //     initialIndexRef.current ?? 0;

// //   const initialOffset =
// //     initialIndex * ITEM_HEIGHT;

// //   const scrollY =
// //     useSharedValue(initialOffset);

// //   /*
// //    * Position the wheel once after mounting.
// //    *
// //    * initialScrollIndex is intentionally not used because it can
// //    * conflict with content padding on web.
// //    */
// //   useEffect(() => {
// //     if (!renderData.length) {
// //       return undefined;
// //     }

// //     const targetOffset =
// //       initialIndex * ITEM_HEIGHT;

// //     const frame = requestAnimationFrame(() => {
// //       flatListRef.current?.scrollToOffset({
// //         offset: targetOffset,
// //         animated: false,
// //       });

// //       scrollY.value = targetOffset;
// //     });

// //     return () => {
// //       cancelAnimationFrame(frame);
// //     };
// //   }, [
// //     initialIndex,
// //     renderData.length,
// //     scrollY,
// //   ]);

// //   const getSafeIndex = useCallback(
// //     (index) => {
// //       if (!renderData.length) {
// //         return 0;
// //       }

// //       return Math.max(
// //         0,
// //         Math.min(
// //           index,
// //           renderData.length - 1
// //         )
// //       );
// //     },
// //     [renderData.length]
// //   );

// //   const selectIndex = useCallback(
// //     (index) => {
// //       const safeIndex = getSafeIndex(index);

// //       if (
// //         safeIndex ===
// //         lastSelectedIndexRef.current
// //       ) {
// //         return;
// //       }

// //       const selectedItem =
// //         renderData[safeIndex];

// //       if (!selectedItem) {
// //         return;
// //       }

// //       lastSelectedIndexRef.current =
// //         safeIndex;

// //       onValueChange(selectedItem.value);
// //     },
// //     [
// //       getSafeIndex,
// //       renderData,
// //       onValueChange,
// //     ]
// //   );

// //   const getIndexFromOffset = useCallback(
// //     (offsetY) => {
// //       return getSafeIndex(
// //         Math.round(offsetY / ITEM_HEIGHT)
// //       );
// //     },
// //     [getSafeIndex]
// //   );

// //   /*
// //    * Native Android/iOS scrolling stays on the UI thread.
// //    */
// //   const nativeScrollHandler =
// //     useAnimatedScrollHandler({
// //       onScroll: (event) => {
// //         scrollY.value =
// //           event.contentOffset.y;
// //       },
// //     });

// //   /*
// //    * On web, use the browser's native CSS scroll snapping.
// //    *
// //    * There is no timeout and no delayed correction.
// //    * The value changes only when the nearest row changes.
// //    */
// //   const handleWebScroll = useCallback(
// //     (event) => {
// //       const offsetY =
// //         event.nativeEvent.contentOffset.y;

// //       scrollY.value = offsetY;

// //       const index =
// //         getIndexFromOffset(offsetY);

// //       selectIndex(index);
// //     },
// //     [
// //       getIndexFromOffset,
// //       scrollY,
// //       selectIndex,
// //     ]
// //   );

// //   /*
// //    * Final native correction.
// //    *
// //    * snapToInterval normally aligns the row itself. This only corrects
// //    * the position when a slow Android drag stops between two rows.
// //    */
// //   const finishNativeScroll = useCallback(
// //     (offsetY) => {
// //       const index =
// //         getIndexFromOffset(offsetY);

// //       const targetOffset =
// //         index * ITEM_HEIGHT;

// //       if (
// //         Math.abs(offsetY - targetOffset) >
// //         0.5
// //       ) {
// //         flatListRef.current?.scrollToOffset({
// //           offset: targetOffset,
// //           animated: true,
// //         });
// //       }

// //       scrollY.value = targetOffset;
// //       selectIndex(index);
// //     },
// //     [
// //       getIndexFromOffset,
// //       scrollY,
// //       selectIndex,
// //     ]
// //   );

// //   const handleNativeScrollEndDrag =
// //     useCallback(
// //       (event) => {
// //         const velocityY =
// //           event.nativeEvent.velocity?.y ??
// //           0;

// //         /*
// //          * With velocity, momentum continues and
// //          * onMomentumScrollEnd handles selection.
// //          *
// //          * Without velocity, finalize immediately.
// //          */
// //         if (Math.abs(velocityY) < 0.05) {
// //           finishNativeScroll(
// //             event.nativeEvent
// //               .contentOffset.y
// //           );
// //         }
// //       },
// //       [finishNativeScroll]
// //     );

// //   const handleNativeMomentumEnd =
// //     useCallback(
// //       (event) => {
// //         finishNativeScroll(
// //           event.nativeEvent
// //             .contentOffset.y
// //         );
// //       },
// //       [finishNativeScroll]
// //     );

// //   const handleItemPress = useCallback(
// //     (index, item) => {
// //       const targetOffset =
// //         index * ITEM_HEIGHT;

// //       lastSelectedIndexRef.current = index;

// //       flatListRef.current?.scrollToOffset({
// //         offset: targetOffset,
// //         animated: true,
// //       });

// //       onValueChange(item.value);
// //     },
// //     [onValueChange]
// //   );

// //   const renderItem = useCallback(
// //     ({ item, index }) => (
// //       <TouchableOpacity
// //         activeOpacity={1}
// //         style={
// //           Platform.OS === 'web'
// //             ? styles.webSnapItem
// //             : undefined
// //         }
// //         onPress={() => {
// //           handleItemPress(index, item);
// //         }}
// //       >
// //         <WheelItem
// //           index={index}
// //           item={item}
// //           scrollY={scrollY}
// //           colors={colors}
// //         />
// //       </TouchableOpacity>
// //     ),
// //     [
// //       colors,
// //       handleItemPress,
// //       scrollY,
// //     ]
// //   );

// //   if (!renderData.length) {
// //     return (
// //       <View style={styles.wheelContainer} />
// //     );
// //   }

// //   return (
// //     <View style={styles.wheelContainer}>
// //       <Animated.FlatList
// //         ref={flatListRef}
// //         data={renderData}
// //         renderItem={renderItem}
// //         keyExtractor={(_, index) =>
// //           index.toString()
// //         }
// //         showsVerticalScrollIndicator={false}
// //         contentContainerStyle={{
// //           paddingVertical: CENTER_PADDING,
// //         }}
// //         /*
// //          * Native React Native snapping.
// //          */
// //         snapToInterval={ITEM_HEIGHT}
// //         snapToAlignment="start"
// //         decelerationRate={
// //           Platform.OS === 'web'
// //             ? 'normal'
// //             : 'fast'
// //         }
// //         /*
// //          * Do not use disableIntervalMomentum.
// //          * It makes the stop feel too abrupt.
// //          */
// //         onScroll={
// //           Platform.OS === 'web'
// //             ? handleWebScroll
// //             : nativeScrollHandler
// //         }
// //         onScrollEndDrag={
// //           Platform.OS === 'web'
// //             ? undefined
// //             : handleNativeScrollEndDrag
// //         }
// //         onMomentumScrollEnd={
// //           Platform.OS === 'web'
// //             ? undefined
// //             : handleNativeMomentumEnd
// //         }
// //         scrollEventThrottle={16}
// //         getItemLayout={(_, index) => ({
// //           length: ITEM_HEIGHT,
// //           offset: ITEM_HEIGHT * index,
// //           index,
// //         })}
// //         initialNumToRender={20}
// //         maxToRenderPerBatch={20}
// //         windowSize={7}
// //         removeClippedSubviews={
// //           Platform.OS === 'android'
// //         }
// //         style={
// //           Platform.OS === 'web'
// //             ? styles.webWheelScroll
// //             : undefined
// //         }
// //         onScrollToIndexFailed={(info) => {
// //           flatListRef.current?.scrollToOffset({
// //             offset:
// //               info.averageItemLength *
// //               info.index,
// //             animated: false,
// //           });
// //         }}
// //       />
// //     </View>
// //   );
// // };

// // /* -------------------------------------------------------------------------- */
// // /* Time picker                                                                */
// // /* -------------------------------------------------------------------------- */

// // export default function CustomWheelTimePicker({
// //   visible,
// //   value,
// //   onClose,
// //   onSave,
// //   colors,
// //   isDark,
// // }) {
// //   const [hour, setHour] =
// //     useState('12');

// //   const [minute, setMinute] =
// //     useState('00');

// //   const [isPM, setIsPM] =
// //     useState(false);

// //   const [is24Hour, setIs24Hour] =
// //     useState(false);

// //   const [
// //     internalVisible,
// //     setInternalVisible,
// //   ] = useState(false);

// //   useEffect(() => {
// //     const calendar =
// //       Localization.getCalendars()[0];

// //     setIs24Hour(
// //       calendar?.uses24hourClock ??
// //       false
// //     );
// //   }, []);

// //   useEffect(() => {
// //     if (!visible) {
// //       setInternalVisible(false);
// //       return undefined;
// //     }

// //     let parsedHour;
// //     let parsedMinute;

// //     if (
// //       value &&
// //       value !== '--:--'
// //     ) {
// //       const parsedDate = dayjs(
// //         `2000-01-01T${value}`
// //       );

// //       if (parsedDate.isValid()) {
// //         parsedHour = parsedDate.hour();
// //         parsedMinute =
// //           parsedDate.format('mm');
// //       }
// //     }

// //     if (
// //       parsedHour === undefined ||
// //       parsedMinute === undefined
// //     ) {
// //       const now = dayjs();

// //       parsedHour = now.hour();
// //       parsedMinute =
// //         now.format('mm');
// //     }

// //     if (!is24Hour) {
// //       setIsPM(parsedHour >= 12);

// //       if (parsedHour > 12) {
// //         parsedHour -= 12;
// //       }

// //       if (parsedHour === 0) {
// //         parsedHour = 12;
// //       }
// //     }

// //     setHour(parsedHour.toString());
// //     setMinute(parsedMinute);

// //     /*
// //      * Mount after the hour/minute state is ready.
// //      */
// //     const frame = requestAnimationFrame(() => {
// //       setInternalVisible(true);
// //     });

// //     return () => {
// //       cancelAnimationFrame(frame);
// //     };
// //   }, [
// //     visible,
// //     value,
// //     is24Hour,
// //   ]);

// //   const handleSave = () => {
// //     let numericHour =
// //       Number.parseInt(hour, 10);

// //     let numericMinute =
// //       Number.parseInt(minute, 10);

// //     if (
// //       Number.isNaN(numericHour)
// //     ) {
// //       numericHour = is24Hour
// //         ? 0
// //         : 12;
// //     }

// //     if (
// //       Number.isNaN(numericMinute)
// //     ) {
// //       numericMinute = 0;
// //     }

// //     numericMinute = Math.max(
// //       0,
// //       Math.min(59, numericMinute)
// //     );

// //     if (!is24Hour) {
// //       if (
// //         numericHour < 1 ||
// //         numericHour > 12
// //       ) {
// //         numericHour = 12;
// //       }

// //       if (
// //         isPM &&
// //         numericHour !== 12
// //       ) {
// //         numericHour += 12;
// //       }

// //       if (
// //         !isPM &&
// //         numericHour === 12
// //       ) {
// //         numericHour = 0;
// //       }
// //     } else {
// //       numericHour = Math.max(
// //         0,
// //         Math.min(23, numericHour)
// //       );
// //     }

// //     const formattedHour =
// //       numericHour
// //         .toString()
// //         .padStart(2, '0');

// //     const formattedMinute =
// //       numericMinute
// //         .toString()
// //         .padStart(2, '0');

// //     onSave(
// //       `${formattedHour}:${formattedMinute}`
// //     );
// //   };

// //   const hourData = useMemo(() => {
// //     const result = [];

// //     if (is24Hour) {
// //       for (
// //         let index = 0;
// //         index < 24;
// //         index += 1
// //       ) {
// //         result.push({
// //           label: index
// //             .toString()
// //             .padStart(2, '0'),
// //           value: index.toString(),
// //         });
// //       }
// //     } else {
// //       for (
// //         let index = 1;
// //         index <= 12;
// //         index += 1
// //       ) {
// //         result.push({
// //           label: index
// //             .toString()
// //             .padStart(2, '0'),
// //           value: index.toString(),
// //         });
// //       }
// //     }

// //     return result;
// //   }, [is24Hour]);

// //   const minuteData = useMemo(() => {
// //     const result = [];

// //     for (
// //       let index = 0;
// //       index < 60;
// //       index += 1
// //     ) {
// //       const formatted =
// //         index
// //           .toString()
// //           .padStart(2, '0');

// //       result.push({
// //         label: formatted,
// //         value: formatted,
// //       });
// //     }

// //     return result;
// //   }, []);

// //   const amPmData = useMemo(
// //     () => [
// //       {
// //         label: 'AM',
// //         value: 'AM',
// //       },
// //       {
// //         label: 'PM',
// //         value: 'PM',
// //       },
// //     ],
// //     []
// //   );

// //   const dividerColor = isDark
// //     ? '#333333'
// //     : '#e0e0e0';

// //   return (
// //     <Modal
// //       visible={visible}
// //       transparent
// //       animationType="fade"
// //       onRequestClose={onClose}
// //     >
// //       <View style={styles.modalRoot}>
// //         <View style={styles.overlay}>
// //           <KeyboardAvoidingView
// //             behavior={
// //               Platform.OS === 'ios'
// //                 ? 'padding'
// //                 : undefined
// //             }
// //             style={
// //               styles.keyboardAvoidingView
// //             }
// //           >
// //             <View
// //               style={[
// //                 styles.container,
// //                 {
// //                   backgroundColor:
// //                     colors.bgCard,
// //                 },
// //               ]}
// //             >
// //               {internalVisible ? (
// //                 <View
// //                   style={
// //                     styles.pickerContainer
// //                   }
// //                 >
// //                   <View
// //                     pointerEvents="none"
// //                     style={[
// //                       styles.highlightArea,
// //                       {
// //                         borderColor:
// //                           colors.primary,
// //                       },
// //                     ]}
// //                   />

// //                   <InfiniteWheel
// //                     key={
// //                       is24Hour
// //                         ? 'hour-24'
// //                         : 'hour-12'
// //                     }
// //                     data={hourData}
// //                     selectedValue={hour}
// //                     onValueChange={setHour}
// //                     colors={colors}
// //                     infinite
// //                   />

// //                   <Text
// //                     style={[
// //                       styles.separator,
// //                       {
// //                         color:
// //                           colors.primary,
// //                       },
// //                     ]}
// //                   >
// //                     :
// //                   </Text>

// //                   <InfiniteWheel
// //                     key="minute-wheel"
// //                     data={minuteData}
// //                     selectedValue={
// //                       minute.padStart(
// //                         2,
// //                         '0'
// //                       )
// //                     }
// //                     onValueChange={
// //                       setMinute
// //                     }
// //                     colors={colors}
// //                     infinite
// //                   />

// //                   {!is24Hour && (
// //                     <>
// //                       <View
// //                         style={
// //                           styles.amPmSpacer
// //                         }
// //                       />

// //                       <InfiniteWheel
// //                         key="ampm-wheel"
// //                         data={amPmData}
// //                         selectedValue={
// //                           isPM
// //                             ? 'PM'
// //                             : 'AM'
// //                         }
// //                         onValueChange={(
// //                           selectedPeriod
// //                         ) => {
// //                           setIsPM(
// //                             selectedPeriod ===
// //                               'PM'
// //                           );
// //                         }}
// //                         colors={colors}
// //                         infinite={false}
// //                       />
// //                     </>
// //                   )}
// //                 </View>
// //               ) : (
// //                 <View
// //                   style={
// //                     styles.pickerContainer
// //                   }
// //                 />
// //               )}

// //               <View
// //                 style={[
// //                   styles.divider,
// //                   {
// //                     backgroundColor:
// //                       dividerColor,
// //                   },
// //                 ]}
// //               />

// //               <View style={styles.actions}>
// //                 <TouchableOpacity
// //                   onPress={onClose}
// //                   style={[
// //                     styles.actionButton,
// //                     {
// //                       borderRightWidth: 1,
// //                       borderColor:
// //                         dividerColor,
// //                     },
// //                   ]}
// //                 >
// //                   <Text
// //                     style={[
// //                       styles.actionText,
// //                       {
// //                         color:
// //                           colors.textPrimary,
// //                       },
// //                     ]}
// //                   >
// //                     CANCEL
// //                   </Text>
// //                 </TouchableOpacity>

// //                 <TouchableOpacity
// //                   onPress={handleSave}
// //                   style={styles.actionButton}
// //                 >
// //                   <Text
// //                     style={[
// //                       styles.actionText,
// //                       {
// //                         color:
// //                           colors.primary,
// //                       },
// //                     ]}
// //                   >
// //                     SAVE
// //                   </Text>
// //                 </TouchableOpacity>
// //               </View>
// //             </View>
// //           </KeyboardAvoidingView>
// //         </View>
// //       </View>
// //     </Modal>
// //   );
// // }

// // /* -------------------------------------------------------------------------- */
// // /* Styles                                                                     */
// // /* -------------------------------------------------------------------------- */

// // const styles = StyleSheet.create({
// //   modalRoot: {
// //     flex: 1,
// //     width: '100%',
// //   },

// //   overlay: {
// //     flex: 1,
// //     backgroundColor:
// //       'rgba(0,0,0,0.5)',
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },

// //   keyboardAvoidingView: {
// //     width: '100%',
// //     alignItems: 'center',
// //   },

// //   container: {
// //     width: 320,
// //     borderRadius: 16,
// //     paddingTop: 30,
// //     overflow: 'hidden',
// //   },

// //   pickerContainer: {
// //     flexDirection: 'row',
// //     alignItems: 'center',
// //     justifyContent: 'center',
// //     height:
// //       ITEM_HEIGHT * VISIBLE_ITEMS,
// //     marginBottom: 20,
// //     position: 'relative',
// //   },

// //   wheelContainer: {
// //     height:
// //       ITEM_HEIGHT * VISIBLE_ITEMS,
// //     width: 80,
// //     overflow: 'hidden',
// //   },

// //   wheelItem: {
// //     height: ITEM_HEIGHT,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },

// //   wheelItemText: {
// //     fontWeight: '400',
// //   },

// //   separator: {
// //     fontSize: 40,
// //     marginHorizontal: 10,
// //     fontWeight: '400',
// //     paddingBottom: 4,
// //   },

// //   amPmSpacer: {
// //     width: 10,
// //   },

// //   highlightArea: {
// //     position: 'absolute',
// //     top:
// //       ITEM_HEIGHT *
// //       Math.floor(
// //         VISIBLE_ITEMS / 2
// //       ),
// //     left: 20,
// //     right: 20,
// //     height: ITEM_HEIGHT,
// //     borderTopWidth: 1,
// //     borderBottomWidth: 1,
// //   },

// //   divider: {
// //     height: 1,
// //     width: '100%',
// //   },

// //   actions: {
// //     flexDirection: 'row',
// //     height: 55,
// //   },

// //   actionButton: {
// //     flex: 1,
// //     justifyContent: 'center',
// //     alignItems: 'center',
// //   },

// //   actionText: {
// //     fontSize: 16,
// //     fontWeight: '600',
// //     letterSpacing: 0.5,
// //   },

// //   /*
// //    * These properties are passed through by react-native-web
// //    * to the browser scrolling element.
// //    */
// //   webWheelScroll: {
// //     scrollSnapType: 'y mandatory',
// //     overscrollBehaviorY: 'contain',
// //   },

// //   webSnapItem: {
// //     scrollSnapAlign: 'center',
// //     scrollSnapStop: 'always',
// //   },
// // });


// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from 'react';

// import {
//   View,
//   Text,
//   StyleSheet,
//   Modal,
//   TouchableOpacity,
//   KeyboardAvoidingView,
//   Platform,
// } from 'react-native';

// import dayjs from 'dayjs';
// import * as Localization from 'expo-localization';

// import Animated, {
//   Extrapolation,
//   interpolate,
//   interpolateColor,
//   useAnimatedScrollHandler,
//   useAnimatedStyle,
//   useSharedValue,
// } from 'react-native-reanimated';

// const ITEM_HEIGHT = 60;
// const VISIBLE_ITEMS = 5;
// const LOOPS = 20;

// const CENTER_PADDING =
//   ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

// const AnimatedText =
//   Animated.createAnimatedComponent(Text);

// /* -------------------------------------------------------------------------- */
// /* Wheel item                                                                 */
// /* -------------------------------------------------------------------------- */

// const WheelItem = React.memo(
//   ({ index, item, scrollY, colors }) => {
//     const animatedContainerStyle =
//       useAnimatedStyle(() => {
//         const itemOffset = index * ITEM_HEIGHT;

//         const distanceFromCenter = Math.abs(
//           scrollY.value - itemOffset
//         );

//         const opacity = interpolate(
//           distanceFromCenter,
//           [
//             0,
//             ITEM_HEIGHT,
//             ITEM_HEIGHT * 2,
//           ],
//           [1, 0.5, 0.2],
//           Extrapolation.CLAMP
//         );

//         return {
//           opacity,
//         };
//       });

//     const animatedTextStyle =
//       useAnimatedStyle(() => {
//         const itemOffset = index * ITEM_HEIGHT;

//         const distanceFromCenter = Math.abs(
//           scrollY.value - itemOffset
//         );

//         const color = interpolateColor(
//           distanceFromCenter,
//           [
//             0,
//             ITEM_HEIGHT / 2,
//             ITEM_HEIGHT,
//           ],
//           [
//             colors.primary,
//             colors.textSecondary,
//             colors.textSecondary,
//           ]
//         );

//         const fontSize = interpolate(
//           distanceFromCenter,
//           [0, ITEM_HEIGHT],
//           [32, 26],
//           Extrapolation.CLAMP
//         );

//         return {
//           color,
//           fontSize,
//         };
//       });

//     return (
//       <Animated.View
//         style={[
//           styles.wheelItem,
//           animatedContainerStyle,
//         ]}
//       >
//         <AnimatedText
//           style={[
//             styles.wheelItemText,
//             animatedTextStyle,
//           ]}
//         >
//           {item.label}
//         </AnimatedText>
//       </Animated.View>
//     );
//   }
// );

// /* -------------------------------------------------------------------------- */
// /* Infinite wheel                                                             */
// /* -------------------------------------------------------------------------- */

// const InfiniteWheel = ({
//   data,
//   selectedValue,
//   onValueChange,
//   colors,
//   infinite = true,
// }) => {
//   const originalLength = data.length;
//   const loops = infinite ? LOOPS : 1;

//   const flatListRef = useRef(null);

//   /*
//    * Store the initial index only once.
//    *
//    * The wheel is mounted again every time the picker opens,
//    * so it will use the newest selected value on reopen.
//    */
//   const initialIndexRef = useRef(null);

//   /*
//    * Prevent repeated state updates while the same row
//    * stays closest to the center.
//    */
//   const lastSelectedIndexRef = useRef(-1);

//   /*
//    * Repeat the original data many times for an infinite-wheel effect.
//    */
//   const renderData = useMemo(() => {
//     if (!infinite) {
//       return data;
//     }

//     const result = [];

//     for (
//       let loop = 0;
//       loop < loops;
//       loop += 1
//     ) {
//       for (
//         let index = 0;
//         index < originalLength;
//         index += 1
//       ) {
//         result.push({
//           ...data[index],
//           repeatedIndex: result.length,
//         });
//       }
//     }

//     return result;
//   }, [
//     data,
//     infinite,
//     loops,
//     originalLength,
//   ]);

//   /*
//    * Find the selected value and place it near the center
//    * of the repeated data.
//    */
//   if (initialIndexRef.current === null) {
//     let selectedIndex = data.findIndex(
//       (item) => item.value === selectedValue
//     );

//     if (selectedIndex < 0) {
//       selectedIndex = 0;
//     }

//     if (infinite && originalLength > 0) {
//       selectedIndex +=
//         Math.floor(loops / 2) *
//         originalLength;
//     }

//     initialIndexRef.current = selectedIndex;

//     lastSelectedIndexRef.current =
//       selectedIndex;
//   }

//   const initialIndex =
//     initialIndexRef.current ?? 0;

//   const initialOffset =
//     initialIndex * ITEM_HEIGHT;

//   const scrollY =
//     useSharedValue(initialOffset);

//   /*
//    * Position the wheel after the FlatList mounts.
//    *
//    * initialScrollIndex is not used because it can create
//    * incorrect alignment with vertical content padding.
//    */
//   useEffect(() => {
//     if (!renderData.length) {
//       return undefined;
//     }

//     const targetOffset =
//       initialIndex * ITEM_HEIGHT;

//     const frame = requestAnimationFrame(() => {
//       flatListRef.current?.scrollToOffset({
//         offset: targetOffset,
//         animated: false,
//       });

//       scrollY.value = targetOffset;
//     });

//     return () => {
//       cancelAnimationFrame(frame);
//     };
//   }, [
//     initialIndex,
//     renderData.length,
//     scrollY,
//   ]);

//   /*
//    * Keep an index inside the FlatList range.
//    */
//   const getSafeIndex = useCallback(
//     (index) => {
//       if (!renderData.length) {
//         return 0;
//       }

//       return Math.max(
//         0,
//         Math.min(
//           index,
//           renderData.length - 1
//         )
//       );
//     },
//     [renderData.length]
//   );

//   /*
//    * Convert a scroll offset into the nearest row index.
//    */
//   const getIndexFromOffset = useCallback(
//     (offsetY) => {
//       return getSafeIndex(
//         Math.round(offsetY / ITEM_HEIGHT)
//       );
//     },
//     [getSafeIndex]
//   );

//   /*
//    * Update the selected value only when a different row
//    * becomes centered.
//    */
//   const selectIndex = useCallback(
//     (index) => {
//       const safeIndex = getSafeIndex(index);

//       if (
//         safeIndex ===
//         lastSelectedIndexRef.current
//       ) {
//         return;
//       }

//       const selectedItem =
//         renderData[safeIndex];

//       if (!selectedItem) {
//         return;
//       }

//       lastSelectedIndexRef.current =
//         safeIndex;

//       onValueChange(selectedItem.value);
//     },
//     [
//       getSafeIndex,
//       renderData,
//       onValueChange,
//     ]
//   );
//     /*
//    * Native Android/iOS scroll animation stays on
//    * Reanimated's UI thread.
//    */
//   const nativeScrollHandler =
//     useAnimatedScrollHandler({
//       onScroll: (event) => {
//         scrollY.value =
//           event.contentOffset.y;
//       },
//     });

//   /*
//    * Web:
//    * - no timeout
//    * - no delayed correction
//    * - browser momentum stays active
//    * - selected value updates as the nearest row changes
//    */
//   const handleWebScroll = useCallback(
//     (event) => {
//       const offsetY =
//         event.nativeEvent.contentOffset.y;

//       scrollY.value = offsetY;

//       const index =
//         getIndexFromOffset(offsetY);

//       selectIndex(index);
//     },
//     [
//       getIndexFromOffset,
//       scrollY,
//       selectIndex,
//     ]
//   );

//   /*
//    * Native final correction.
//    *
//    * snapToInterval normally handles alignment.
//    * This only corrects a very slow drag that ends
//    * between two rows.
//    */
//   const finishNativeScroll = useCallback(
//     (offsetY) => {
//       const index =
//         getIndexFromOffset(offsetY);

//       const targetOffset =
//         index * ITEM_HEIGHT;

//       if (
//         Math.abs(offsetY - targetOffset) >
//         0.5
//       ) {
//         flatListRef.current?.scrollToOffset({
//           offset: targetOffset,
//           animated: true,
//         });
//       }

//       scrollY.value = targetOffset;
//       selectIndex(index);
//     },
//     [
//       getIndexFromOffset,
//       scrollY,
//       selectIndex,
//     ]
//   );

//   const handleNativeScrollEndDrag =
//     useCallback(
//       (event) => {
//         const velocityY =
//           event.nativeEvent.velocity?.y ??
//           0;

//         /*
//          * When velocity exists, momentum continues.
//          * onMomentumScrollEnd will finish selection.
//          *
//          * When velocity is almost zero, finish now.
//          */
//         if (Math.abs(velocityY) < 0.05) {
//           finishNativeScroll(
//             event.nativeEvent
//               .contentOffset.y
//           );
//         }
//       },
//       [finishNativeScroll]
//     );

//   const handleNativeMomentumEnd =
//     useCallback(
//       (event) => {
//         finishNativeScroll(
//           event.nativeEvent
//             .contentOffset.y
//         );
//       },
//       [finishNativeScroll]
//     );

//   const handleItemPress = useCallback(
//     (index, item) => {
//       const targetOffset =
//         index * ITEM_HEIGHT;

//       lastSelectedIndexRef.current = index;

//       flatListRef.current?.scrollToOffset({
//         offset: targetOffset,
//         animated: true,
//       });

//       scrollY.value = targetOffset;

//       onValueChange(item.value);
//     },
//     [
//       onValueChange,
//       scrollY,
//     ]
//   );

//   const renderItem = useCallback(
//     ({ item, index }) => (
//       <TouchableOpacity
//         activeOpacity={1}
//         style={
//           Platform.OS === 'web'
//             ? styles.webSnapItem
//             : undefined
//         }
//         onPress={() => {
//           handleItemPress(index, item);
//         }}
//       >
//         <WheelItem
//           index={index}
//           item={item}
//           scrollY={scrollY}
//           colors={colors}
//         />
//       </TouchableOpacity>
//     ),
//     [
//       colors,
//       handleItemPress,
//       scrollY,
//     ]
//   );

//   if (!renderData.length) {
//     return (
//       <View style={styles.wheelContainer} />
//     );
//   }

//   return (
//     <View style={styles.wheelContainer}>
//       <Animated.FlatList
//         ref={flatListRef}
//         data={renderData}
//         renderItem={renderItem}
//         keyExtractor={(_, index) =>
//           index.toString()
//         }
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={{
//           paddingVertical: CENTER_PADDING,
//         }}
//         snapToInterval={ITEM_HEIGHT}
//         snapToAlignment="start"

//         /*
//          * Higher decelerationRate keeps momentum longer.
//          *
//          * Strong swipe: around 20-25 rows.
//          * Small swipe: only a few rows.
//          */
//         decelerationRate={0.998}

//         onScroll={
//           Platform.OS === 'web'
//             ? handleWebScroll
//             : nativeScrollHandler
//         }

//         onScrollEndDrag={
//           Platform.OS === 'web'
//             ? undefined
//             : handleNativeScrollEndDrag
//         }

//         onMomentumScrollEnd={
//           Platform.OS === 'web'
//             ? undefined
//             : handleNativeMomentumEnd
//         }

//         scrollEventThrottle={16}

//         getItemLayout={(_, index) => ({
//           length: ITEM_HEIGHT,
//           offset:
//             ITEM_HEIGHT * index,
//           index,
//         })}

//         initialNumToRender={30}
//         maxToRenderPerBatch={30}
//         windowSize={9}

//         removeClippedSubviews={
//           Platform.OS === 'android'
//         }

//         style={
//           Platform.OS === 'web'
//             ? styles.webWheelScroll
//             : undefined
//         }

//         onScrollToIndexFailed={(info) => {
//           flatListRef.current?.scrollToOffset({
//             offset:
//               info.averageItemLength *
//               info.index,
//             animated: false,
//           });
//         }}
//       />
//     </View>
//   );
// };
// export default function CustomWheelTimePicker({
//   visible,
//   value,
//   onClose,
//   onSave,
//   colors,
//   isDark,
// }) {
//   const [hour, setHour] =
//     useState('12');

//   const [minute, setMinute] =
//     useState('00');

//   const [isPM, setIsPM] =
//     useState(false);

//   const [is24Hour, setIs24Hour] =
//     useState(false);

//   const [
//     internalVisible,
//     setInternalVisible,
//   ] = useState(false);

//   useEffect(() => {
//     const calendar =
//       Localization.getCalendars()[0];

//     setIs24Hour(
//       calendar?.uses24hourClock ??
//       false
//     );
//   }, []);

//   /*
//    * Initial time:
//    *
//    * 1. If the user already selected a valid time,
//    *    open at that saved time.
//    *
//    * 2. Otherwise, use the current local device time.
//    */
//   useEffect(() => {
//     if (!visible) {
//       setInternalVisible(false);
//       return undefined;
//     }

//     let selectedDate = null;

//     // if (
//     //   typeof value === 'string' &&
//     //   value !== '--:--' &&
//     //   /^\d{1,2}:\d{2}$/.test(value)
//     // ) {
//     //   const parsedDate = dayjs(
//     //     `2000-01-01T${value}`
//     //   );

//     //   if (parsedDate.isValid()) {
//     //     selectedDate = parsedDate;
//     //   }
//     // }

//     if (value && /^\d{2}:\d{2}$/.test(value)) {
//     selectedDate = dayjs(`2000-01-01 ${value}`);
// } else {
//     selectedDate = dayjs(); // current device time
// }
//     if (!selectedDate) {
//       selectedDate = dayjs();
//     }

//     let selectedHour =
//       selectedDate.hour();

//     const selectedMinute =
//       selectedDate.format('mm');

//     if (is24Hour) {
//       setHour(selectedHour.toString());
//     } else {
//       setIsPM(selectedHour >= 12);

//       selectedHour %= 12;

//       if (selectedHour === 0) {
//         selectedHour = 12;
//       }

//       setHour(selectedHour.toString());
//     }

//     setMinute(selectedMinute);

//     /*
//      * Mount the wheels only after hour, minute,
//      * and AM/PM state are prepared.
//      */
//     const frame = requestAnimationFrame(() => {
//       setInternalVisible(true);
//     });

//     return () => {
//       cancelAnimationFrame(frame);
//     };
//   }, [
//     visible,
//     // value,
//     // is24Hour,
//   ]);

//   const handleSave = () => {
//     let numericHour =
//       Number.parseInt(hour, 10);

//     let numericMinute =
//       Number.parseInt(minute, 10);

//     if (
//       Number.isNaN(numericHour)
//     ) {
//       numericHour = is24Hour
//         ? 0
//         : 12;
//     }

//     if (
//       Number.isNaN(numericMinute)
//     ) {
//       numericMinute = 0;
//     }

//     numericMinute = Math.max(
//       0,
//       Math.min(59, numericMinute)
//     );

//     if (!is24Hour) {
//       if (
//         numericHour < 1 ||
//         numericHour > 12
//       ) {
//         numericHour = 12;
//       }

//       if (
//         isPM &&
//         numericHour !== 12
//       ) {
//         numericHour += 12;
//       }

//       if (
//         !isPM &&
//         numericHour === 12
//       ) {
//         numericHour = 0;
//       }
//     } else {
//       numericHour = Math.max(
//         0,
//         Math.min(23, numericHour)
//       );
//     }

//     const formattedHour =
//       numericHour
//         .toString()
//         .padStart(2, '0');

//     const formattedMinute =
//       numericMinute
//         .toString()
//         .padStart(2, '0');

//     onSave(
//       `${formattedHour}:${formattedMinute}`
//     );
//   };

//   const hourData = useMemo(() => {
//     const result = [];

//     if (is24Hour) {
//       for (
//         let index = 0;
//         index < 24;
//         index += 1
//       ) {
//         result.push({
//           label: index
//             .toString()
//             .padStart(2, '0'),
//           value: index.toString(),
//         });
//       }
//     } else {
//       for (
//         let index = 1;
//         index <= 12;
//         index += 1
//       ) {
//         result.push({
//           label: index
//             .toString()
//             .padStart(2, '0'),
//           value: index.toString(),
//         });
//       }
//     }

//     return result;
//   }, [is24Hour]);

//   const minuteData = useMemo(() => {
//     const result = [];

//     for (
//       let index = 0;
//       index < 60;
//       index += 1
//     ) {
//       const formatted =
//         index
//           .toString()
//           .padStart(2, '0');

//       result.push({
//         label: formatted,
//         value: formatted,
//       });
//     }

//     return result;
//   }, []);

//   const amPmData = useMemo(
//     () => [
//       {
//         label: 'AM',
//         value: 'AM',
//       },
//       {
//         label: 'PM',
//         value: 'PM',
//       },
//     ],
//     []
//   );

//   const dividerColor = isDark
//     ? '#333333'
//     : '#e0e0e0';

//   return (
//     <Modal
//       visible={visible}
//       transparent
//       animationType="fade"
//       onRequestClose={onClose}
//     >
//       <View style={styles.modalRoot}>
//         <View style={styles.overlay}>
//           <KeyboardAvoidingView
//             behavior={
//               Platform.OS === 'ios'
//                 ? 'padding'
//                 : undefined
//             }
//             style={
//               styles.keyboardAvoidingView
//             }
//           >
//             <View
//               style={[
//                 styles.container,
//                 {
//                   backgroundColor:
//                     colors.bgCard,
//                 },
//               ]}
//             >
//               {internalVisible ? (
//                 <View
//                   style={
//                     styles.pickerContainer
//                   }
//                 >
//                   <View
//                     pointerEvents="none"
//                     style={[
//                       styles.highlightArea,
//                       {
//                         borderColor:
//                           colors.primary,
//                       },
//                     ]}
//                   />

//                   <InfiniteWheel
//                     // key={
//                     //   is24Hour
//                     //     ? 'hour-24'
//                     //     : 'hour-12'
//                     // }
//                     key="hour"
//                     data={hourData}
//                     selectedValue={hour}
//                     onValueChange={setHour}
//                     colors={colors}
//                     infinite
//                   />

//                   <Text
//                     style={[
//                       styles.separator,
//                       {
//                         color:
//                           colors.primary,
//                       },
//                     ]}
//                   >
//                     :
//                   </Text>

//                   <InfiniteWheel
//                     key="minute-wheel"
//                     data={minuteData}
//                     selectedValue={
//                       minute.padStart(
//                         2,
//                         '0'
//                       )
//                     }
//                     onValueChange={
//                       setMinute
//                     }
//                     colors={colors}
//                     infinite
//                   />

//                   {!is24Hour && (
//                     <>
//                       <View
//                         style={
//                           styles.amPmSpacer
//                         }
//                       />

//                       <InfiniteWheel
//                         key="ampm-wheel"
//                         data={amPmData}
//                         selectedValue={
//                           isPM
//                             ? 'PM'
//                             : 'AM'
//                         }
//                         onValueChange={(
//                           selectedPeriod
//                         ) => {
//                           setIsPM(
//                             selectedPeriod ===
//                               'PM'
//                           );
//                         }}
//                         colors={colors}
//                         infinite={false}
//                       />
//                     </>
//                   )}
//                 </View>
//               ) : (
//                 <View
//                   style={
//                     styles.pickerContainer
//                   }
//                 />
//               )}

//               <View
//                 style={[
//                   styles.divider,
//                   {
//                     backgroundColor:
//                       dividerColor,
//                   },
//                 ]}
//               />

//               <View style={styles.actions}>
//                 <TouchableOpacity
//                   onPress={onClose}
//                   style={[
//                     styles.actionButton,
//                     {
//                       borderRightWidth: 1,
//                       borderColor:
//                         dividerColor,
//                     },
//                   ]}
//                 >
//                   <Text
//                     style={[
//                       styles.actionText,
//                       {
//                         color:
//                           colors.textPrimary,
//                       },
//                     ]}
//                   >
//                     CANCEL
//                   </Text>
//                 </TouchableOpacity>

//                 <TouchableOpacity
//                   onPress={handleSave}
//                   style={styles.actionButton}
//                 >
//                   <Text
//                     style={[
//                       styles.actionText,
//                       {
//                         color:
//                           colors.primary,
//                       },
//                     ]}
//                   >
//                     SAVE
//                   </Text>
//                 </TouchableOpacity>
//               </View>
//             </View>
//           </KeyboardAvoidingView>
//         </View>
//       </View>
//     </Modal>
//   );
// }
// const styles = StyleSheet.create({
//   modalRoot: {
//     flex: 1,
//     width: '100%',
//   },

//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   keyboardAvoidingView: {
//     width: '100%',
//     alignItems: 'center',
//   },

//   container: {
//     width: 320,
//     borderRadius: 16,
//     paddingTop: 30,
//     overflow: 'hidden',
//   },

//   pickerContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     height: ITEM_HEIGHT * VISIBLE_ITEMS,
//     marginBottom: 20,
//     position: 'relative',
//   },

//   wheelContainer: {
//     height: ITEM_HEIGHT * VISIBLE_ITEMS,
//     width: 80,
//     overflow: 'hidden',
//   },

//   wheelItem: {
//     height: ITEM_HEIGHT,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   wheelItemText: {
//     fontWeight: '400',
//   },

//   separator: {
//     fontSize: 40,
//     marginHorizontal: 10,
//     fontWeight: '400',
//     paddingBottom: 4,
//   },

//   amPmSpacer: {
//     width: 10,
//   },

//   highlightArea: {
//     position: 'absolute',
//     top:
//       ITEM_HEIGHT *
//       Math.floor(VISIBLE_ITEMS / 2),
//     left: 20,
//     right: 20,
//     height: ITEM_HEIGHT,
//     borderTopWidth: 1,
//     borderBottomWidth: 1,
//   },

//   divider: {
//     height: 1,
//     width: '100%',
//   },

//   actions: {
//     flexDirection: 'row',
//     height: 55,
//   },

//   actionButton: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   actionText: {
//     fontSize: 16,
//     fontWeight: '600',
//     letterSpacing: 0.5,
//   },

//   webWheelScroll: {
//     scrollSnapType: 'y mandatory',
//     overscrollBehaviorY: 'contain',
//     WebkitOverflowScrolling: 'touch',
//   },

//   webSnapItem: {
//     scrollSnapAlign: 'center',
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
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import * as Localization from 'expo-localization';

import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

const ITEM_HEIGHT = 60;
const VISIBLE_ITEMS = 5;
const LOOPS = 20;

const CENTER_PADDING =
  ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

const AnimatedText =
  Animated.createAnimatedComponent(Text);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const getDeviceUses24HourClock = () => {
  try {
    const calendars =
      Localization.getCalendars?.() ?? [];

    return (
      calendars[0]?.uses24hourClock ??
      false
    );
  } catch (error) {
    console.warn(
      'Unable to read device clock format:',
      error
    );

    return false;
  }
};

const parseTimeValue = (value) => {
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return {
        hour: value.getHours(),
        minute: value.getMinutes(),
      };
    }
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value
    .trim()
    .toUpperCase();

  /*
   * Supports:
   * 06:29
   * 6:29
   * 18:29
   */
  const twentyFourHourMatch =
    normalizedValue.match(
      /^(\d{1,2}):(\d{2})$/
    );

  if (twentyFourHourMatch) {
    const parsedHour =
      Number.parseInt(
        twentyFourHourMatch[1],
        10
      );

    const parsedMinute =
      Number.parseInt(
        twentyFourHourMatch[2],
        10
      );

    if (
      parsedHour >= 0 &&
      parsedHour <= 23 &&
      parsedMinute >= 0 &&
      parsedMinute <= 59
    ) {
      return {
        hour: parsedHour,
        minute: parsedMinute,
      };
    }
  }

  /*
   * Supports:
   * 11:46 AM
   * 12:52 PM
   */
  const twelveHourMatch =
    normalizedValue.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)$/
    );

  if (twelveHourMatch) {
    let parsedHour =
      Number.parseInt(
        twelveHourMatch[1],
        10
      );

    const parsedMinute =
      Number.parseInt(
        twelveHourMatch[2],
        10
      );

    const period =
      twelveHourMatch[3];

    if (
      parsedHour < 1 ||
      parsedHour > 12 ||
      parsedMinute < 0 ||
      parsedMinute > 59
    ) {
      return null;
    }

    if (
      period === 'PM' &&
      parsedHour !== 12
    ) {
      parsedHour += 12;
    }

    if (
      period === 'AM' &&
      parsedHour === 12
    ) {
      parsedHour = 0;
    }

    return {
      hour: parsedHour,
      minute: parsedMinute,
    };
  }

  return null;
};

/* -------------------------------------------------------------------------- */
/* Wheel item                                                                 */
/* -------------------------------------------------------------------------- */

const WheelItem = React.memo(
  ({
    index,
    item,
    scrollY,
    colors,
  }) => {
    const animatedContainerStyle =
      useAnimatedStyle(() => {
        const itemOffset =
          index * ITEM_HEIGHT;

        const distanceFromCenter =
          Math.abs(
            scrollY.value - itemOffset
          );

        // Remove opacity fading for wheel items so they fully represent their color
        // const opacity = interpolate(
        //   distanceFromCenter,
        //   [
        //     0,
        //     ITEM_HEIGHT,
        //     ITEM_HEIGHT * 2,
        //   ],
        //   [1, 0.5, 0.2],
        //   Extrapolation.CLAMP
        // );

        return {
          opacity: 1,
        };
      });

    const animatedTextStyle =
      useAnimatedStyle(() => {
        const itemOffset =
          index * ITEM_HEIGHT;

        const distanceFromCenter =
          Math.abs(
            scrollY.value - itemOffset
          );

        const color =
          interpolateColor(
            distanceFromCenter,
            [
              0,
              ITEM_HEIGHT / 2,
              ITEM_HEIGHT,
            ],
            [
              colors.primary,
              colors.textSecondary,
              colors.textSecondary,
            ]
          );

        const fontSize =
          interpolate(
            distanceFromCenter,
            [0, ITEM_HEIGHT],
            [32, 26],
            Extrapolation.CLAMP
          );

        return {
          color,
          fontSize,
        };
      });

    return (
      <Animated.View
        style={[
          styles.wheelItem,
          animatedContainerStyle,
        ]}
      >
        <AnimatedText
          style={[
            styles.wheelItemText,
            animatedTextStyle,
          ]}
        >
          {item.label}
        </AnimatedText>
      </Animated.View>
    );
  }
);

/* -------------------------------------------------------------------------- */
/* Infinite wheel                                                             */
/* -------------------------------------------------------------------------- */

const InfiniteWheel = ({
  data,
  selectedValue,
  onValueChange,
  colors,
  infinite = true,
}) => {
  const flatListRef = useRef(null);
  const lastSelectedIndexRef = useRef(-1);

  const originalLength = data.length;
  const loops = infinite ? LOOPS : 1;

  const renderData = useMemo(() => {
    if (!infinite) {
      return data;
    }

    const result = [];

    for (let loop = 0; loop < loops; loop += 1) {
      for (let index = 0; index < originalLength; index += 1) {
        result.push({
          ...data[index],
          repeatedIndex: result.length,
        });
      }
    }

    return result;
  }, [data, infinite, loops, originalLength]);

  /*
   * Calculate only once for this mounted wheel.
   * Do not recalculate whenever selectedValue changes.
   */
  // We compute the initial index on every render to avoid the cache bug
  // where it stays stuck at the first opened time (e.g., 6:29 AM).
  let initialIndex = data.findIndex(
    (item) => String(item.value) === String(selectedValue)
  );

  if (initialIndex < 0) {
    initialIndex = 0;
  }

  if (infinite && originalLength > 0) {
    initialIndex += Math.floor(loops / 2) * originalLength;
  }

  const initialOffset = initialIndex * ITEM_HEIGHT;

  const scrollY = useSharedValue(initialOffset);

  useEffect(() => {
    if (!renderData.length) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: initialOffset,
        animated: false,
      });

      scrollY.value = initialOffset;
    });

    return () => cancelAnimationFrame(frame);
  }, [initialOffset, renderData.length, scrollY]);

  const getSafeIndex = useCallback(
    (index) => {
      if (!renderData.length) {
        return 0;
      }

      return Math.max(
        0,
        Math.min(index, renderData.length - 1)
      );
    },
    [renderData.length]
  );

  const selectOffset = useCallback(
    (offsetY, correctPosition = false) => {
      const index = getSafeIndex(
        Math.round(offsetY / ITEM_HEIGHT)
      );

      const targetOffset = index * ITEM_HEIGHT;
      const selectedItem = renderData[index];

      if (!selectedItem) {
        return;
      }

      if (correctPosition) {
        flatListRef.current?.scrollToOffset({
          offset: targetOffset,
          animated: true,
        });

        scrollY.value = targetOffset;
      }

      if (lastSelectedIndexRef.current !== index) {
        lastSelectedIndexRef.current = index;
        onValueChange(selectedItem.value);
      }
    },
    [
      getSafeIndex,
      renderData,
      onValueChange,
      scrollY,
    ]
  );

  const nativeScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

const handleWebScroll = useCallback(
  (event) => {
    const offsetY =
      event.nativeEvent.contentOffset.y;

    scrollY.value = offsetY;

    // Update hour/minute as the centered row changes.
    // This no longer causes blinking because initialIndexRef
    // is calculated only once per wheel mount.
    selectOffset(offsetY, false);
  },
  [scrollY, selectOffset]
);

const handleScrollEndDrag = useCallback(
  (event) => {
    const offsetY =
      event.nativeEvent.contentOffset.y;

    const velocityY =
      event.nativeEvent.velocity?.y ?? 0;

    if (Platform.OS === 'web') {
      // Store the nearest visible value immediately.
      selectOffset(offsetY, false);
      return;
    }

    if (Math.abs(velocityY) < 0.05) {
      selectOffset(offsetY, true);
    }
  },
  [selectOffset]
);

  const handleMomentumScrollEnd = useCallback(
    (event) => {
      selectOffset(
        event.nativeEvent.contentOffset.y,
        true
      );
    },
    [selectOffset]
  );

  const handleItemPress = useCallback(
    (index, item) => {
      const targetOffset = index * ITEM_HEIGHT;

      lastSelectedIndexRef.current = index;

      flatListRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: true,
      });

      scrollY.value = targetOffset;
      onValueChange(item.value);
    },
    [onValueChange, scrollY]
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <TouchableOpacity
        activeOpacity={1}
        style={
          Platform.OS === 'web'
            ? styles.webSnapItem
            : undefined
        }
        onPress={() => handleItemPress(index, item)}
      >
        <WheelItem
          index={index}
          item={item}
          scrollY={scrollY}
          colors={colors}
        />
      </TouchableOpacity>
    ),
    [colors, handleItemPress, scrollY]
  );

  return (
    <View style={styles.wheelContainer}>
      <Animated.FlatList
        ref={flatListRef}
        data={renderData}
        renderItem={renderItem}
        keyExtractor={(_, index) => String(index)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingVertical: CENTER_PADDING,
        }}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate={0.998}
        scrollEventThrottle={16}
        onScroll={
          Platform.OS === 'web'
            ? handleWebScroll
            : nativeScrollHandler
        }
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialNumToRender={30}
        maxToRenderPerBatch={30}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        style={
          Platform.OS === 'web'
            ? styles.webWheelScroll
            : undefined
        }
      />
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/* Time picker                                                                */
/* -------------------------------------------------------------------------- */

export default function CustomWheelTimePicker({
  visible,
  value,
  onClose,
  onSave,
  colors,
  isDark,
}) {
  const [is24Hour] =
    useState(
      getDeviceUses24HourClock
    );

  const [hour, setHour] =
    useState(
      is24Hour ? '0' : '12'
    );

  const [minute, setMinute] =
    useState('00');

  const [isPM, setIsPM] =
    useState(false);

  const [
    internalVisible,
    setInternalVisible,
  ] = useState(false);

  /*
   * Initialize each time the modal opens.
   *
   * Priority:
   * 1. Existing saved value
   * 2. Current device time
   */
 const [openSession, setOpenSession] = useState(0);

// useEffect(() => {
//   if (!visible) {
//     setInternalVisible(false);
//     return;
//   }

//   const parsedValue = parseTimeValue(value);
//   const now = new Date();

//   let selectedHour =
//     parsedValue?.hour ?? now.getHours();

//   const selectedMinute =
//     parsedValue?.minute ?? now.getMinutes();

//   if (is24Hour) {
//     setHour(String(selectedHour));
//   } else {
//     setIsPM(selectedHour >= 12);
//     selectedHour = selectedHour % 12 || 12;
//     setHour(String(selectedHour));
//   }

//   setMinute(
//     String(selectedMinute).padStart(2, '0')
//   );

//   setOpenSession((previous) => previous + 1);

//   const frame = requestAnimationFrame(() => {
//     setInternalVisible(true);
//   });

//   return () => cancelAnimationFrame(frame);
// }, [visible]);
useEffect(() => {
  if (!visible) {
    setInternalVisible(false);
    return undefined;
  }

  // Hide old wheels before preparing the new opening state.
  setInternalVisible(false);

  const now = new Date();
console.log('TIME PICKER DEBUG', {
  value,
  parsedValue: parseTimeValue(value),
  deviceHour: now.getHours(),
  deviceMinute: now.getMinutes(),
  deviceTime: now.toString(),
});
  /*
   * A saved time exists only when value is a valid user value.
   *
   * null, undefined, empty string and "--:--" mean:
   * use the current device time.
   */
  const hasSavedTime =
    typeof value === 'string' &&
    value.trim() !== '' &&
    value.trim() !== '--:--' &&
    parseTimeValue(value) !== null;

  const selectedTime = hasSavedTime
    ? parseTimeValue(value)
    : {
        hour: now.getHours(),
        minute: now.getMinutes(),
      };

  let selectedHour = selectedTime.hour;
  const selectedMinute = selectedTime.minute;

  if (is24Hour) {
    setHour(String(selectedHour));
  } else {
    setIsPM(selectedHour >= 12);

    selectedHour = selectedHour % 12 || 12;

    setHour(String(selectedHour));
  }

  setMinute(
    String(selectedMinute).padStart(2, '0')
  );

  setOpenSession((previous) => previous + 1);

  const frame = requestAnimationFrame(() => {
    setInternalVisible(true);
  });

  return () => {
    cancelAnimationFrame(frame);
  };
}, [visible, value, is24Hour]);
  const hourData =
    useMemo(() => {
      const result = [];

      if (is24Hour) {
        for (
          let index = 0;
          index < 24;
          index += 1
        ) {
          result.push({
            label: String(
              index
            ).padStart(2, '0'),
            value:
              String(index),
          });
        }
      } else {
        for (
          let index = 1;
          index <= 12;
          index += 1
        ) {
          result.push({
            label: String(
              index
            ).padStart(2, '0'),
            value:
              String(index),
          });
        }
      }

      return result;
    }, [is24Hour]);

  const minuteData =
    useMemo(() => {
      const result = [];

      for (
        let index = 0;
        index < 60;
        index += 1
      ) {
        const formattedMinute =
          String(index).padStart(
            2,
            '0'
          );

        result.push({
          label:
            formattedMinute,
          value:
            formattedMinute,
        });
      }

      return result;
    }, []);

  const amPmData =
    useMemo(
      () => [
        {
          label: 'AM',
          value: 'AM',
        },
        {
          label: 'PM',
          value: 'PM',
        },
      ],
      []
    );

  const handleSave =
    useCallback(() => {
      let numericHour =
        Number.parseInt(
          hour,
          10
        );

      let numericMinute =
        Number.parseInt(
          minute,
          10
        );

      if (
        Number.isNaN(
          numericHour
        )
      ) {
        numericHour =
          is24Hour ? 0 : 12;
      }

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
        numericHour =
          Math.max(
            0,
            Math.min(
              23,
              numericHour
            )
          );
      } else {
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
        ).padStart(2, '0');

      const formattedMinute =
        String(
          numericMinute
        ).padStart(2, '0');

      onSave(
        `${formattedHour}:${formattedMinute}`
      );
    }, [
      hour,
      minute,
      isPM,
      is24Hour,
      onSave,
    ]);

  const dividerColor =
    isDark
      ? '#333333'
      : '#e0e0e0';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={styles.modalRoot}
      >
        <View
          style={styles.overlay}
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
                    colors.bgCard,
                },
              ]}
            >
              {internalVisible ? (
                <View
                  style={
                    styles.pickerContainer
                  }
                >
                  <View
                    pointerEvents="none"
                    style={[
                      styles.highlightArea,
                      {
                        borderColor:
                          colors.primary,
                      },
                    ]}
                  />

                  <InfiniteWheel
  key={`hour-${openSession}`}
  data={hourData}
  selectedValue={hour}
  onValueChange={setHour}
  colors={colors}
  infinite
/>

                  <Text
                    style={[
                      styles.separator,
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    :
                  </Text>

<InfiniteWheel
  key={`minute-${openSession}`}
  data={minuteData}
  selectedValue={minute}
  onValueChange={setMinute}
  colors={colors}
  infinite
/>

{!is24Hour && (
  <InfiniteWheel
    key={`period-${openSession}`}
    data={amPmData}
    selectedValue={isPM ? 'PM' : 'AM'}
    onValueChange={(period) => {
      setIsPM(period === 'PM');
    }}
    colors={colors}
    infinite={false}
  />
)}
                </View>
              ) : (
                <View
                  style={
                    styles.pickerContainer
                  }
                />
              )}

              <View
                style={[
                  styles.divider,
                  {
                    backgroundColor:
                      dividerColor,
                  },
                ]}
              />

              <View
                style={
                  styles.actions
                }
              >
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.actionButton,
                    {
                      borderRightWidth:
                        1,
                      borderColor:
                        dividerColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.actionText,
                      {
                        color:
                          colors.textPrimary,
                      },
                    ]}
                  >
                    CANCEL
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
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    SAVE
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles =
  StyleSheet.create({
    modalRoot: {
      flex: 1,
      width: '100%',
    },

    overlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.5)',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    keyboardAvoidingView: {
      width: '100%',
      alignItems: 'center',
    },

    container: {
      width: 340,
      maxWidth: '94%',
      borderRadius: 16,
      paddingTop: 30,
      overflow: 'hidden',
    },

    pickerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      height:
        ITEM_HEIGHT *
        VISIBLE_ITEMS,
      marginBottom: 20,
      position: 'relative',
    },

    wheelContainer: {
      height:
        ITEM_HEIGHT *
        VISIBLE_ITEMS,
      width: 80,
      overflow: 'hidden',
    },

    wheelItem: {
      height: ITEM_HEIGHT,
      justifyContent:
        'center',
      alignItems: 'center',
    },

    wheelItemText: {
      fontWeight: '400',
    },

    separator: {
      fontSize: 40,
      marginHorizontal: 6,
      fontWeight: '400',
      paddingBottom: 4,
    },

    amPmSpacer: {
      width: 4,
    },

    highlightArea: {
      position: 'absolute',
      top:
        ITEM_HEIGHT *
        Math.floor(
          VISIBLE_ITEMS / 2
        ),
      left: 16,
      right: 16,
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

    actionButton: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
    },

    actionText: {
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
    },

    webWheelScroll: {
      scrollSnapType:
        'y mandatory',
      overscrollBehaviorY:
        'contain',
      WebkitOverflowScrolling:
        'touch',
    },

    webSnapItem: {
      scrollSnapAlign:
        'center',
    },
  });