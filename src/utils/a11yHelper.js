import { AccessibilityInfo, Platform, Text, TextInput } from 'react-native';

/**
 * Section 508 and WCAG 2.1 AA Accessibility Helper
 */
export const A11yHelper = {
  /**
   * Maximum recommended font scale multiplier for standard controls to prevent
   * vertical clipping while fully complying with WCAG 1.4.4.
   */
  MAX_FONT_SIZE_MULTIPLIER: 1.5,

  /**
   * Returns accessible text props with maxFontSizeMultiplier.
   * @param {number} [maxMultiplier=1.5]
   */
  getAccessibleTextProps: (maxMultiplier = 1.5) => ({
    maxFontSizeMultiplier: maxMultiplier,
    allowFontScaling: true,
  }),

  /**
   * Generates cross-platform focus-trap properties for views behind an active modal.
   * Complies with WCAG 2.1.2 (No Keyboard/Accessibility Trap) and WCAG 2.4.3 (Focus Order).
   *
   * @param {boolean} isModalActive Whether any modal or overlay is currently active
   * @returns {object} Accessibility properties for the background container
   */
  getModalFocusTrapProps: (isModalActive) => {
    const active = !!isModalActive;
    return {
      accessibilityElementsHidden: active,
      importantForAccessibility: active ? 'no-hide-descendants' : 'auto',
      pointerEvents: active ? 'none' : 'auto',
    };
  },

  /**
   * Convert fixed height styles into accessible minHeight styles to prevent
   * text clipping when Dynamic Type font scaling is increased.
   * @param {object} [style={}]
   */
  makeFlexibleHeight: (style = {}) => {
    if (!style || typeof style !== 'object') return style;
    const { height, ...rest } = style;
    if (typeof height === 'number') {
      return {
        ...rest,
        minHeight: Math.max(height, 44),
      };
    }
    return {
      ...rest,
      minHeight: 44,
    };
  },

  /**
   * Safely configure global dynamic type scaling limits across the app.
   * Sets defaultProps on Text and TextInput when available in the environment.
   */
  configureGlobalFontScaling: (maxMultiplier = 1.5) => {
    try {
      if (Text) {
        Text.defaultProps = Text.defaultProps || {};
        Text.defaultProps.maxFontSizeMultiplier = maxMultiplier;
      }
      if (TextInput) {
        TextInput.defaultProps = TextInput.defaultProps || {};
        TextInput.defaultProps.maxFontSizeMultiplier = maxMultiplier;
      }
    } catch (e) {
      console.warn('[A11yHelper] configureGlobalFontScaling failed:', e);
    }
  },

  /**
   * Announce message to assistive technologies (TalkBack / VoiceOver).
   * @param {string} message Text to announce
   */
  announce: (message) => {
    if (!message || typeof message !== 'string') return;
    try {
      if (Platform.OS === 'web') {
        // Fallback for web using an aria-live region if present
        const liveRegion = document.getElementById('a11y-live-region');
        if (liveRegion) {
          liveRegion.textContent = message;
        }
      } else {
        AccessibilityInfo.announceForAccessibility(message);
      }
    } catch (e) {
      console.warn('[A11yHelper] announce failed:', e);
    }
  },

  /**
   * Minimum touch target dimensions compliant with Section 508 / WCAG 2.5.5 (44x44 dp)
   */
  minTouchTarget: {
    minWidth: 44,
    minHeight: 44,
  },

  /**
   * Generate comprehensive Section 508 screen reader label for a task item.
   * Ensures color/icons are not the only medium conveying priority, repeat, or completion.
   */
  formatTaskAccessibilityLabel: (task, { t = (k) => k } = {}) => {
    if (!task) return '';
    const parts = [];

    // 1. Completion status
    parts.push(task.completed ? (t('Completed') || 'Completed') : (t('Incomplete') || 'Incomplete'));

    // 2. Task name
    parts.push(task.taskname || (t('Untitled task') || 'Untitled task'));

    // 3. Priority (textual announcement so color is not the only indicator - Section 508 §1194.21(i))
    if (task.priority) {
      const priorityLabel = task.priority === 'urgent' || task.priority === 'high'
        ? (t('High Priority') || 'High Priority')
        : task.priority === 'medium'
        ? (t('Medium Priority') || 'Medium Priority')
        : (t('Low Priority') || 'Low Priority');
      parts.push(priorityLabel);
    }

    // 4. Due Date & Time
    if (task.date || task.dueDate) {
      const dueStr = task.date || task.dueDate;
      const timeStr = task.time ? `, ${task.time}` : '';
      parts.push(`${t('Due') || 'Due'}: ${dueStr}${timeStr}`);
    }

    // 5. Recurrence
    if (task.recurringSeriesId || task.isRecurring || task.repeatConfig) {
      parts.push(t('Recurring task') || 'Recurring task');
    }

    // 6. Subtasks / Checklist progress
    if (task.subtasks && task.subtasks.length > 0) {
      const completedSubs = task.subtasks.filter(s => s.completed).length;
      parts.push(`${completedSubs} ${t('of') || 'of'} ${task.subtasks.length} ${t('subtasks completed') || 'subtasks completed'}`);
    }

    return parts.join(', ');
  }
};

