/**
 * Pure layout math for keeping screen content flush above the software keyboard
 * on Android across:
 *  - API <= 34 with adjustResize (native window already shrank -> returns 0, even if keyboard height later varies)
 *  - API 35+ edge-to-edge (native window did not shrink -> returns exact overlap)
 *  - Legacy adjustPan builds (accounts for native panDelta -> prevents double-shift)
 *  - keyboardDidHide (keyboardHeight <= 0 -> always returns 0, immune to RN Android screenY bug)
 */
export function computeAndroidKeyboardPadding({
  topInset = 0,
  containerHeight = 0,
  closedContainerHeight = 0,
  measuredY = null,
  baselineY = null,
  keyboardScreenY = 0,
  keyboardHeight = 0,
} = {}) {
  if (!keyboardHeight || keyboardHeight <= 0) return 0;
  if (!containerHeight || containerHeight <= 0) return 0;
  if (!keyboardScreenY || keyboardScreenY <= 0) return 0;

  // If Android's native adjustResize already shrank the Activity window substantially
  // compared to the keyboard-closed baseline height, native resize owns the inset.
  if (closedContainerHeight > 0 && containerHeight < closedContainerHeight - 100) {
    return 0;
  }

  const panDelta =
    typeof measuredY === 'number' &&
    typeof baselineY === 'number' &&
    !Number.isNaN(measuredY) &&
    !Number.isNaN(baselineY)
      ? measuredY - baselineY
      : 0;

  const boardBottomScreenY = (topInset || 0) + panDelta + containerHeight;
  return Math.max(0, Math.round(boardBottomScreenY - keyboardScreenY));
}
