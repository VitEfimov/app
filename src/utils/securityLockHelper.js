/**
 * Helper to prevent PIN lock screen from popping up when the app is
 * temporarily backgrounded for system file pickers, cameras, or gallery.
 */

let isPickingAttachment = false;
let isAuthenticatingBiometric = false;
let pickingTimeout = null;
let biometricTimeout = null;
const lockListeners = new Set();

export const SecurityLockHelper = {
  subscribeLock: (listener) => {
    if (typeof listener === 'function') {
      lockListeners.add(listener);
      return () => {
        lockListeners.delete(listener);
      };
    }
    return () => {};
  },

  notifyAppLocked: () => {
    lockListeners.forEach(listener => {
      try {
        listener();
      } catch (e) {
        console.warn('[SecurityLockHelper] listener error:', e);
      }
    });
  },

  markPickingAttachment: (active = true) => {
    if (pickingTimeout) {
      clearTimeout(pickingTimeout);
      pickingTimeout = null;
    }

    if (active) {
      isPickingAttachment = true;
      // Safety auto-reset after 2.5 minutes in case OS aborted picker
      pickingTimeout = setTimeout(() => {
        isPickingAttachment = false;
      }, 150000);
    } else {
      // Keep a 4-second grace window upon returning so AppState 'active' transitions complete
      pickingTimeout = setTimeout(() => {
        isPickingAttachment = false;
      }, 4000);
    }
  },

  isAttachmentPickerActive: () => {
    return isPickingAttachment;
  },

  markAuthenticatingBiometric: (active = true) => {
    if (biometricTimeout) {
      clearTimeout(biometricTimeout);
      biometricTimeout = null;
    }

    if (active) {
      isAuthenticatingBiometric = true;
      biometricTimeout = setTimeout(() => {
        isAuthenticatingBiometric = false;
      }, 60000);
    } else {
      biometricTimeout = setTimeout(() => {
        isAuthenticatingBiometric = false;
      }, 3000);
    }
  },

  isAuthenticatingBiometric: () => {
    return isAuthenticatingBiometric;
  },

  _resetForTesting: () => {
    if (pickingTimeout) {
      clearTimeout(pickingTimeout);
      pickingTimeout = null;
    }
    if (biometricTimeout) {
      clearTimeout(biometricTimeout);
      biometricTimeout = null;
    }
    isPickingAttachment = false;
    isAuthenticatingBiometric = false;
    lockListeners.clear();
  }
};

