import dayjs from 'dayjs';

const RU_MONTHS = {
  янв: 1, января: 1, 'янв.': 1,
  фев: 2, февраля: 2, 'фев.': 2,
  мар: 3, марта: 3, 'мар.': 3,
  апр: 4, апреля: 4, 'апр.': 4,
  май: 5, мая: 5,
  июн: 6, июня: 6, 'июн.': 6,
  июл: 7, июля: 7, 'июл.': 7,
  авг: 8, августа: 8, 'авг.': 8,
  сен: 9, сентября: 9, 'сен.': 9, сент: 9,
  окт: 10, октября: 10, 'окт.': 10,
  ноя: 11, ноября: 11, 'ноя.': 11,
  дек: 12, декабря: 12, 'дек.': 12
};

const EN_MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

/**
 * Extracts date, time, priority, reminder, notes, and clean title from any task string.
 */
export function extractTaskAttributes(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      cleanTitle: '',
      completionDate: null,
      hasExplicitDate: false,
      taskTime: null,
      priority: 'none',
      notes: '',
      reminder: null,
    };
  }

  let text = rawText.trim();
  let hasExplicitDate = false;
  let completionDate = null;
  let taskTime = null;
  let priority = 'none';
  let reminder = null;
  let notes = '';

  // 1. Extract explicit Notes: / Description: / Заметки:
  const notesMatch = text.match(/\b(?:Notes|Note|Description|Заметки|Описание)\s*:\s*([\s\S]+)/i);
  if (notesMatch) {
    notes = notesMatch[1].trim();
    text = text.replace(notesMatch[0], '').trim();
  }

  // 2. Extract Priority: "Priority: High", "!high", "высокий приоритет", "!!!", "[high]", "[P1]"
  const priorityMatch = text.match(/(?:^|[,\s\(\[])(?:Priority:\s*|Приоритет:\s*|!|p:)?(high|medium|low|высокий|средний|низкий)(?:[,\s\)\]]|$)/i) ||
                        text.match(/(?:^|\s)(!{1,3})(?:$|\s)/);
  if (priorityMatch) {
    const pStr = (priorityMatch[1] || '').toLowerCase();
    if (pStr === 'high' || pStr === 'высокий' || pStr === '!!!') priority = 'high';
    else if (pStr === 'medium' || pStr === 'средний' || pStr === '!!') priority = 'medium';
    else if (pStr === 'low' || pStr === 'низкий' || pStr === '!') priority = 'low';
    text = text.replace(priorityMatch[0], ' ').trim();
  }

  // 3. Extract Reminder: "Reminder: 09:00", "Напомнить в 09:00"
  const reminderMatch = text.match(/\b(?:Reminder|Напомнить|Напоминание)\s*(?:at|в|:)?\s*(\d{1,2}:\d{2})\b/i);
  if (reminderMatch) {
    reminder = reminderMatch[1];
    text = text.replace(reminderMatch[0], ' ').trim();
  }

  // 4. Extract Time: "at 14:00", "14:00", "2:30pm", "3pm", "время: 15:30"
  const timeMatch = text.match(/(?:(?:due\s+time|at|в|time:\s*|время:\s*)\s*)?\b(\d{1,2}:\d{2}(?:\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm))\b/i);
  if (timeMatch) {
    const rawTime = timeMatch[1].trim();
    let t = rawTime;
    const pm = /pm/i.test(t);
    const am = /am/i.test(t);
    t = t.replace(/(?:am|pm)/i, '').trim();
    let [hStr, mStr] = t.split(':');
    let h = parseInt(hStr, 10);
    let m = mStr ? parseInt(mStr, 10) : 0;
    if (!isNaN(h) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      if (pm && h < 12) h += 12;
      if (am && h === 12) h = 0;
      taskTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      text = text.replace(timeMatch[0], ' ').trim();
    }
  }

  // 5. Extract Date
  // A) Relative words (today, tomorrow, yesterday, сегодня, завтра, вчера)
  const relMatch = text.match(/\b(today|tomorrow|yesterday|сегодня|завтра|вчера)\b/i);
  if (relMatch) {
    const relStr = relMatch[1].toLowerCase();
    if (relStr === 'today' || relStr === 'сегодня') {
      completionDate = dayjs().format('YYYY-MM-DD');
    } else if (relStr === 'tomorrow' || relStr === 'завтра') {
      completionDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
    } else if (relStr === 'yesterday' || relStr === 'вчера') {
      completionDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    }
    hasExplicitDate = true;
    text = text.replace(relMatch[0], ' ').trim();
  }

  // B) ISO: YYYY-MM-DD
  if (!hasExplicitDate) {
    const isoMatch = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      const dObj = dayjs(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      if (dObj.isValid()) {
        completionDate = dObj.format('YYYY-MM-DD');
        hasExplicitDate = true;
        text = text.replace(isoMatch[0], ' ').trim();
      }
    }
  }

  // C) Named months (English and Russian) e.g. "Oct 28, 2026", "28 Oct 2026", "21 авг 1957", "Aug 21"
  if (!hasExplicitDate) {
    const namedMonthRegex = /\b(?:(?:due|date|deadline|on)\s*:?\s*)?(?:(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Zа-яА-ЯёЁ]+)|([a-zA-Zа-яА-ЯёЁ]+)\s+(\d{1,2})(?:st|nd|rd|th)?)(?:,?\s+(\d{2,4}))?\b/i;
    const nmMatch = text.match(namedMonthRegex);
    if (nmMatch) {
      const dayRaw = nmMatch[1] || nmMatch[4];
      const monthRaw = (nmMatch[2] || nmMatch[3] || '').toLowerCase().replace(/\.$/, '');
      const yearRaw = nmMatch[5];

      const mNum = EN_MONTHS[monthRaw] || RU_MONTHS[monthRaw] || RU_MONTHS[monthRaw.slice(0, 3)] || EN_MONTHS[monthRaw.slice(0, 3)];
      const dNum = parseInt(dayRaw, 10);

      if (mNum && dNum >= 1 && dNum <= 31) {
        let y = dayjs().year();
        if (yearRaw) {
          let yr = parseInt(yearRaw, 10);
          if (yr < 100) yr += yr > 50 ? 1900 : 2000;
          y = yr;
        }
        const dObj = dayjs(`${y}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`);
        if (dObj.isValid()) {
          completionDate = dObj.format('YYYY-MM-DD');
          hasExplicitDate = true;
          text = text.replace(nmMatch[0], ' ').trim();
        }
      }
    }
  }

  // D) Numeric dates: DD.MM.YYYY, DD/MM/YYYY, DD.MM, DD/MM (with optional birth year nearby, e.g. "Мама 1957 21.08")
  if (!hasExplicitDate) {
    const numDateRegex = /(?:(?:due|date|deadline)\s*:?\s*)?\(?\b(\d{1,2})[\.\/-](\d{1,2})(?:[\.\/-](\d{2,4}))?\b\)?/i;
    const ndMatch = text.match(numDateRegex);
    if (ndMatch) {
      let p1 = parseInt(ndMatch[1], 10);
      let p2 = parseInt(ndMatch[2], 10);
      let yearStr = ndMatch[3];

      let day, month;
      if (p1 > 12 && p2 <= 12) {
        day = p1;
        month = p2;
      } else if (p2 > 12 && p1 <= 12) {
        day = p2;
        month = p1;
      } else {
        day = p1;
        month = p2;
      }

      // Check if a 4-digit birth year exists in remaining text (e.g. "Мама 1957")
      if (!yearStr) {
        const nearbyYearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
        if (nearbyYearMatch) {
          yearStr = nearbyYearMatch[1];
          text = text.replace(nearbyYearMatch[0], ' ');
        }
      }

      let y = dayjs().year();
      if (yearStr) {
        let yr = parseInt(yearStr, 10);
        if (yr < 100) yr += yr > 50 ? 1900 : 2000;
        y = yr;
      }

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const dObj = dayjs(`${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        if (dObj.isValid()) {
          completionDate = dObj.format('YYYY-MM-DD');
          hasExplicitDate = true;
          text = text.replace(ndMatch[0], ' ').trim();
        }
      }
    }
  }

  // Clean title: remove empty brackets, parenthesis, leading/trailing punctuation
  let cleanTitle = text
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\b(?:due|date|deadline)\s*:?/gi, '')
    .replace(/^\s*[-–—:]+\s*/, '')
    .replace(/\s*[-–—:]+\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    cleanTitle,
    completionDate: hasExplicitDate ? completionDate : null,
    hasExplicitDate,
    taskTime,
    priority,
    reminder,
    notes,
  };
}

/**
 * Parses a single block of text into a structured task object.
 */
export function parseSingleTaskBlock(blockText, options = {}) {
  const { defaultImg = '', defaultAttachments = [], themeReducer = {}, index = 0 } = options;
  let textToParse = (blockText || '').trim();

  // 1. Explicit Task / Title header
  let explicitTaskName = '';
  const taskHeaderMatch = textToParse.match(/^(?:Task|Title)\s*:\s*([^\n]+)/i);
  if (taskHeaderMatch) {
    explicitTaskName = taskHeaderMatch[1].trim();
    textToParse = textToParse.replace(taskHeaderMatch[0], '').trim();
  }

  // 2. Subtasks & Notes sections
  let notesSection = '';
  let subtasksSection = '';
  let subtasks = [];

  const subtasksSplit = textToParse.split(/\n\s*Subtasks\s*:\s*\n?/i);
  if (subtasksSplit.length > 1) {
    textToParse = subtasksSplit[0];
    subtasksSection = subtasksSplit.slice(1).join('\n');
  }

  const notesSplit = textToParse.split(/\n\s*Notes\s*:\s*\n?/i);
  if (notesSplit.length > 1) {
    textToParse = notesSplit[0];
    notesSection = notesSplit.slice(1).join('\n');
  }

  if (subtasksSection) {
    const subLines = subtasksSection.split('\n');
    for (const sLine of subLines) {
      const sTrim = sLine.trim();
      if (!sTrim) continue;
      const m = sTrim.match(/^(?:\[([ xX])\]|[-*•]|\d+[\.)]|☑️|🔲)\s*(.+)/);
      if (m) {
        const isDone = m[1] ? m[1].toLowerCase() === 'x' : sTrim.startsWith('☑️');
        subtasks.push({
          id: `${Date.now()}_${index}_${subtasks.length}`,
          text: (m[2] || sTrim).trim(),
          completed: isDone
        });
      } else {
        subtasks.push({
          id: `${Date.now()}_${index}_${subtasks.length}`,
          text: sTrim,
          completed: false
        });
      }
    }
  }

  // 3. Extract attributes from lines of textToParse
  const lines = textToParse.split('\n').map(l => l.trim()).filter(Boolean);
  let taskname = explicitTaskName;
  let completionDate = dayjs().format('YYYY-MM-DD');
  let taskTime = null;
  let priority = 'none';
  let reminder = null;
  let notesList = notesSection ? [notesSection.trim()] : [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const attrs = extractTaskAttributes(line);

    if (attrs.hasExplicitDate) {
      completionDate = attrs.completionDate;
    }
    if (attrs.taskTime) {
      taskTime = attrs.taskTime;
    }
    if (attrs.priority !== 'none') {
      priority = attrs.priority;
    }
    if (attrs.reminder) {
      reminder = attrs.reminder;
    }
    if (attrs.notes) {
      notesList.push(attrs.notes);
    }

    if (!taskname) {
      if (attrs.cleanTitle) {
        taskname = attrs.cleanTitle;
      }
    } else {
      if (attrs.cleanTitle && attrs.cleanTitle !== taskname) {
        notesList.push(attrs.cleanTitle);
      }
    }
  }

  if (!taskname) {
    taskname = `Shared Task ${index + 1}`;
  }

  return {
    id: (Date.now() + index).toString(),
    taskname: taskname.slice(0, 100),
    description: { text: notesList.join('\n'), img: defaultImg, attachments: defaultAttachments, url: '' },
    subtasks,
    completed: false,
    priority,
    completionDate: dayjs(completionDate).toISOString(),
    time: taskTime,
    isShared: true,
    doNotOverrideDate: true,
    reminder: reminder || (themeReducer?.defaultReminderEnabled ? (themeReducer?.defaultReminderTime || '09:00') : null)
  };
}

/**
 * Main parser that accepts shared text from any source (single task, Task Flow transfer, JSON, checklists, multi-task blocks)
 * and returns an array of valid task objects with extracted dates, times, priorities, reminders, and notes.
 */
export function parseSharedTasks(text, options = {}) {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  const { defaultImg = '', defaultAttachments = [], themeReducer = {} } = options;

  // 1. Check if input is JSON (e.g. exported from Task Flow or another task manager)
  if (trimmed.startsWith('[') || (trimmed.startsWith('{') && (trimmed.includes('"tasks"') || trimmed.includes('"title"') || trimmed.includes('"taskname"')))) {
    try {
      const parsed = JSON.parse(trimmed);
      const rawArray = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.tasks) ? parsed.tasks : null);
      if (Array.isArray(rawArray) && rawArray.length > 0) {
        return rawArray.map((item, idx) => {
          const rawTitle = item.taskname || item.title || item.name || item.text || `Task ${idx + 1}`;
          const attrs = extractTaskAttributes(String(rawTitle));
          const title = attrs.cleanTitle || String(rawTitle);

          let dueDate = item.completionDate || item.dueDate || item.due || item.date;
          if (!dueDate && attrs.hasExplicitDate) {
            dueDate = attrs.completionDate;
          }

          const time = item.time || item.dueTime || attrs.taskTime || null;
          const priority = (item.priority || (attrs.priority !== 'none' ? attrs.priority : 'none')).toLowerCase();
          const completed = !!item.completed;
          const rawNotes = typeof item.description === 'string' ? item.description : (item.description?.text || item.notes || '');
          const notes = [rawNotes, attrs.notes].filter(Boolean).join('\n');
          const subtasks = Array.isArray(item.subtasks) ? item.subtasks.map((s, sIdx) => ({
            id: `${Date.now()}_${idx}_${sIdx}`,
            text: typeof s === 'string' ? s : (s.text || s.title || ''),
            completed: !!s.completed
          })) : [];

          return {
            id: (Date.now() + idx).toString(),
            taskname: String(title).slice(0, 100),
            description: { text: notes, img: idx === 0 ? defaultImg : '', attachments: idx === 0 ? defaultAttachments : [], url: '' },
            subtasks,
            completed,
            priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'none',
            completionDate: dueDate && dayjs(dueDate).isValid() ? dayjs(dueDate).toISOString() : dayjs().toISOString(),
            time,
            isShared: true,
            doNotOverrideDate: true,
            reminder: attrs.reminder || (themeReducer?.defaultReminderEnabled ? (themeReducer?.defaultReminderTime || '09:00') : null)
          };
        });
      }
    } catch (e) {
      // Continue to text parsing
    }
  }

  // 2. Multi-task blocks separated by divider line (---, ===, ___, ***)
  let cleanText = trimmed.replace(/^Tasks\s*:\s*\n+/i, '');
  const dividerRegex = /\n\s*(?:-{3,}|={3,}|_{3,}|\*{3,})\s*\n/;
  if (dividerRegex.test(cleanText)) {
    const rawBlocks = cleanText.split(dividerRegex).map(b => b.trim()).filter(Boolean);
    if (rawBlocks.length > 1) {
      return rawBlocks.map((block, idx) => parseSingleTaskBlock(block, {
        defaultImg: idx === 0 ? defaultImg : '',
        defaultAttachments: idx === 0 ? defaultAttachments : [],
        themeReducer,
        index: idx
      }));
    }
  }

  // 3. Repeating "Task: ..." headers
  const taskHeaderMatches = cleanText.match(/(?:^|\n)\s*Task\s*:\s*/gi);
  if (taskHeaderMatches && taskHeaderMatches.length > 1) {
    const rawBlocks = cleanText.split(/(?=(?:^|\n)\s*Task\s*:\s*)/i).map(b => b.trim()).filter(Boolean);
    if (rawBlocks.length > 1) {
      return rawBlocks.map((block, idx) => parseSingleTaskBlock(block, {
        defaultImg: idx === 0 ? defaultImg : '',
        defaultAttachments: idx === 0 ? defaultAttachments : [],
        themeReducer,
        index: idx
      }));
    }
  }

  // 4. Multiple lines check (checklist items OR one task per line, e.g. birthdays list!)
  const textLines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (textLines.length >= 2) {
    // Check if every line is a checklist/bullet item
    const isAllListItems = textLines.every(l => /^(?:[-*•]|\d+[\.)]|\[[ xX]\]|☑️|🔲)/i.test(l));
    if (isAllListItems) {
      return textLines.map((line, idx) => {
        const match = line.match(/^(?:[-*•]|\d+[\.)]|☑️|🔲)?\s*(?:\[([ xX])\])?\s*(.+)/i);
        const isCompleted = match && match[1] ? match[1].toLowerCase() === 'x' : line.startsWith('☑️');
        const rawContent = match && match[2] ? match[2].trim() : line;
        const attrs = extractTaskAttributes(rawContent);

        return {
          id: (Date.now() + idx).toString(),
          taskname: (attrs.cleanTitle || rawContent).slice(0, 100),
          description: { text: attrs.notes, img: idx === 0 ? defaultImg : '', attachments: idx === 0 ? defaultAttachments : [], url: '' },
          subtasks: [],
          completed: isCompleted,
          priority: attrs.priority,
          completionDate: attrs.completionDate ? dayjs(attrs.completionDate).toISOString() : dayjs().toISOString(),
          time: attrs.taskTime,
          isShared: true,
          doNotOverrideDate: true,
          reminder: attrs.reminder || (themeReducer?.defaultReminderEnabled ? (themeReducer?.defaultReminderTime || '09:00') : null)
        };
      });
    }

    // Check if multiple lines have explicit dates (like birthdays list in Image 5!)
    const linesWithAttrs = textLines.map(l => ({ line: l, attrs: extractTaskAttributes(l) }));
    const linesWithDateCount = linesWithAttrs.filter(item => item.attrs.hasExplicitDate).length;

    // If at least 2 lines (and at least 40% of lines) have explicit dates, it is a multi-task list!
    if (linesWithDateCount >= 2 && linesWithDateCount >= textLines.length * 0.4) {
      return linesWithAttrs.map((item, idx) => {
        const { line, attrs } = item;
        return {
          id: (Date.now() + idx).toString(),
          taskname: (attrs.cleanTitle || line).slice(0, 100),
          description: { text: attrs.notes, img: idx === 0 ? defaultImg : '', attachments: idx === 0 ? defaultAttachments : [], url: '' },
          subtasks: [],
          completed: false,
          priority: attrs.priority,
          completionDate: attrs.completionDate ? dayjs(attrs.completionDate).toISOString() : dayjs().toISOString(),
          time: attrs.taskTime,
          isShared: true,
          doNotOverrideDate: true,
          reminder: attrs.reminder || (themeReducer?.defaultReminderEnabled ? (themeReducer?.defaultReminderTime || '09:00') : null)
        };
      });
    }
  }

  // 5. Fallback: Parse as a single rich task block
  return [parseSingleTaskBlock(trimmed, {
    defaultImg,
    defaultAttachments,
    themeReducer,
    index: 0
  })];
}
