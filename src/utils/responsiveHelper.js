/**
 * Android 12L+ Large Screen, Dual-Screen & Foldables Responsive Helper
 * 
 * Complies with Google Play Large Screen App Quality Guidelines & Material 3:
 * - Compact (< 600dp): Single-column portrait phone layout.
 * - Medium (600dp - 839dp): Foldable unfolded (e.g. Galaxy Z Fold, Pixel Fold), small tablet.
 * - Expanded (>= 840dp): Large tablet, desktop, or unfolded landscape foldable.
 */

export const WINDOW_SIZE_CLASSES = {
  COMPACT: 'compact',
  MEDIUM: 'medium',
  EXPANDED: 'expanded',
};

export const BREAKPOINTS = {
  COMPACT_MAX: 599,
  DUAL_PANE_MIN: 720,
  MEDIUM_MAX: 839,
  EXPANDED_MIN: 840,
};

export const ResponsiveHelper = {
  /**
   * Determine Material 3 / Android 12L+ Window Size Class from width in dp.
   * @param {number} width 
   * @returns {'compact'|'medium'|'expanded'}
   */
  getWindowSizeClass: (width) => {
    const w = typeof width === 'number' && width > 0 ? width : 360;
    if (w < 600) return WINDOW_SIZE_CLASSES.COMPACT;
    if (w < 840) return WINDOW_SIZE_CLASSES.MEDIUM;
    return WINDOW_SIZE_CLASSES.EXPANDED;
  },

  /**
   * Whether current viewport is wide enough for an adaptive Master-Detail dual pane
   * (e.g. Samsung Galaxy Z Fold unfolded, Pixel Fold, Surface Duo, Tablets).
   * @param {number} width 
   * @returns {boolean}
   */
  isDualPane: (width) => {
    return typeof width === 'number' && width >= BREAKPOINTS.DUAL_PANE_MIN;
  },

  /**
   * Calculate pane dimensions for split view on foldables/tablets.
   * @param {number} totalWidth
   * @returns {{ leftPaneWidth: number, isDualPane: boolean }}
   */
  getDualPaneLayout: (totalWidth) => {
    const isDual = ResponsiveHelper.isDualPane(totalWidth);
    if (!isDual) {
      return {
        isDualPane: false,
        leftPaneWidth: totalWidth,
      };
    }

    // Allocate ~40-42% to Master calendar/boards, capped between 340dp and 440dp
    const calculatedLeft = Math.round(totalWidth * 0.42);
    const leftPaneWidth = Math.max(340, Math.min(calculatedLeft, 440));

    return {
      isDualPane: true,
      leftPaneWidth,
    };
  },

  /**
   * Generates centering and max-width style for wide screens to avoid stretched UI
   * @param {number} width 
   * @param {number} [maxWidth=760]
   */
  getCenteredContainerStyle: (width, maxWidth = 760) => {
    if (typeof width === 'number' && width > maxWidth) {
      return {
        width: '100%',
        maxWidth,
        alignSelf: 'center',
      };
    }
    return {
      width: '100%',
    };
  }
};

