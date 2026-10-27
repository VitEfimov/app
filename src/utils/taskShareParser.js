import dayjs from 'dayjs';

/**
 * Parses a single block of text into a structured task object.
 */
export function parseSingleTaskBlock(blockText, options = {}) {
  const { defaultImg = '', defaultAttachments = [], themeReducer = {}, index = 0 } = options;
  let taskname = '';
  let notes = [];
  let subtasks = [];
  let completionDate = dayjs().format('YYYY-MM-DD');
  let taskTime = null;
  let priority = 'none';

  let textToParse = (blockText || '').trim();

  // 1. Check for explicit "Task: ..." or "Title: ..." header
  const taskHeaderMatch = textToParse.match(/^(?:Task|Title)\s*:\s*([^\n]+)/i);
  if (taskHeaderMatch) {
    taskname = taskHeaderMatch[1].trim();
    textToParse = textToParse.replace(taskHeaderMatch[0], '').trim();
  }

  // 2. Check for "Subtasks:" and "Notes:" sections
  let notesSection = '';
  let subtasksSection = '';

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

  if (notesSection) {
    notes.push(notesSection.trim());
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

  // 3. Parse remaining lines for Priority, Due date, Time, Subtasks, Notes
  const lines = textToParse.split('\n');
  let hasFoundSubtasks = false;
  let remainingLines = [];

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;

    const priorityMatch = trimmed.match(/Priority:\s*(low|medium|high)/i);
    if (priorityMatch) {
      priority = priorityMatch[1].toLowerCase();
      trimmed = trimmed.replace(priorityMatch[0], '').trim();
      if (!trimmed) continue;
    }

    const dRegex = /\b(today|tomorrow|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b/i;
    const tRegex = /\b(\d{1,2}:\d{2}(?:\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm))\b/i;
    const keywordRegex = /\b(due time|due|deadline at|deadline|date\(due\)|date)\b/i;

    if (keywordRegex.test(trimmed)) {
      let foundAny = false;

      const dMatch = trimmed.match(dRegex);
      if (dMatch) {
        const dateStr = dMatch[1];
        if (dateStr.toLowerCase() === 'today') {
          completionDate = dayjs().format('YYYY-MM-DD');
        } else if (dateStr.toLowerCase() === 'tomorrow') {
          completionDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
        } else {
          let cleanDateStr = dateStr.replace(/(\d+)(st|nd|rd|th)/, '$1');
          if (/[a-z]+\s+\d{1,2}$/i.test(cleanDateStr)) {
            cleanDateStr += `, ${dayjs().year()}`;
          }
          const parsedDate = dayjs(cleanDateStr);
          if (parsedDate.isValid()) {
            completionDate = parsedDate.format('YYYY-MM-DD');
          }
        }
        trimmed = trimmed.replace(dMatch[0], '');
        foundAny = true;
      }

      const tMatch = trimmed.match(tRegex);
      if (tMatch) {
        const timeStr = tMatch[1];
        let t = timeStr.trim();
        const pm = /pm/i.test(t);
        const am = /am/i.test(t);
        t = t.replace(/(?:am|pm)/i, '').trim();

        let [h, m] = t.split(':');
        h = parseInt(h, 10);
        m = m ? parseInt(m, 10) : 0;

        if (pm && h < 12) h += 12;
        if (am && h === 12) h = 0;

        taskTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        trimmed = trimmed.replace(tMatch[0], '');
        foundAny = true;
      }

      if (foundAny) {
        trimmed = trimmed.replace(keywordRegex, '').replace(/\bat\b/i, '').replace(/:\s*$/, '').replace(/^\s*:\s*/, '').trim();
      }

      if (!trimmed) continue;
    }

    if (!subtasksSection) {
      const subtaskMatch = trimmed.match(/^(\[ \]|\[x\]|-|\*|\d+\.)\s+(.+)/i);
      if (subtaskMatch) {
        hasFoundSubtasks = true;
        subtasks.push({
          id: `${Date.now()}_${index}_${subtasks.length}`,
          text: subtaskMatch[2].trim(),
          completed: subtaskMatch[1].toLowerCase() === '[x]'
        });
        continue;
      }
    }

    if (!hasFoundSubtasks) {
      remainingLines.push(trimmed);
    } else {
      notes.push(trimmed);
    }
  }

  if (!taskname) {
    let preText = remainingLines.join('\n');
    let extraNotes = [];

    if (preText) {
      const words = preText.split(/\s+/);
      if (words.length > 5) {
        taskname = words.slice(0, 5).join(' ') + '...';
        let wordCount = 0;
        let splitIndex = 0;
        let inWord = false;
        for (let i = 0; i < preText.length; i++) {
          if (/\s/.test(preText[i])) {
            inWord = false;
          } else {
            if (!inWord) {
              wordCount++;
              inWord = true;
            }
          }
          if (wordCount === 6) {
            splitIndex = i;
            break;
          }
        }
        if (splitIndex > 0) {
          extraNotes.push(preText.substring(splitIndex).trim());
        } else {
          extraNotes.push(words.slice(5).join(' '));
        }
      } else {
        taskname = preText;
      }
    }
    notes = [...extraNotes, ...notes];
  }

  if (!taskname && notes.length > 0) {
    taskname = notes.shift();
  }

  if (!taskname) {
    taskname = `Shared Task ${index + 1}`;
  }

  return {
    id: (Date.now() + index).toString(),
    taskname: taskname.slice(0, 100),
    description: { text: notes.join('\n'), img: defaultImg, attachments: defaultAttachments, url: '' },
    subtasks,
    completed: false,
    priority,
    completionDate: dayjs(completionDate).toISOString(),
    time: taskTime,
    isShared: true,
    doNotOverrideDate: true,
    reminder: themeReducer?.defaultReminderEnabled ? (themeReducer?.defaultReminderTime || '09:00') : null
  };
}

/**
 * Main parser that accepts shared text from any source (single task, Task Flow transfer, JSON, checklists, multi-task blocks)
 * and returns an array of valid task objects.
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
          const title = item.taskname || item.title || item.name || item.text || `Task ${idx + 1}`;
          const dueDate = item.completionDate || item.dueDate || item.due || item.date;
          const time = item.time || item.dueTime || null;
          const priority = (item.priority || 'none').toLowerCase();
          const completed = !!item.completed;
          const notes = typeof item.description === 'string' ? item.description : (item.description?.text || item.notes || '');
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
            reminder: themeReducer?.defaultReminderEnabled ? (themeReducer?.defaultReminderTime || '09:00') : null
          };
        });
      }
    } catch (e) {
      // Continue to text parsing
    }
  }

  // 2. Check for date-first tabular entries (e.g. "23.01.1988 Wife", "24/08 Grandma")
  const textLines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const lineRegex = /^(\d{1,2})[\s\t\.\/]+(\d{1,2})(?:[\s\t\.\/]+\.?(\d{2,4}))?[\s\t]+(.+)$/;
  const matchingDateLines = textLines.filter(l => lineRegex.test(l));

  if (matchingDateLines.length > 0 && matchingDateLines.length === textLines.length) {
    return textLines.map((l, i) => {
      const m = l.match(lineRegex);
      let p1 = parseInt(m[1], 10);
      let p2 = parseInt(m[2], 10);
      let yearStr = m[3];
      const title = m[4].trim();

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

      let year = dayjs().year();
      if (yearStr) {
        let y = parseInt(yearStr, 10);
        if (y < 100) y += y > 50 ? 1900 : 2000;
        year = y;
      }

      const dObj = dayjs(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      let dateFormatted = dObj.isValid() ? dObj.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

      return {
        id: (Date.now() + i).toString(),
        taskname: title.slice(0, 100),
        description: { text: '', img: i === 0 ? defaultImg : '', attachments: i === 0 ? defaultAttachments : [], url: '' },
        subtasks: [],
        completed: false,
        priority: 'none',
        completionDate: dayjs(dateFormatted).toISOString(),
        isShared: true,
        doNotOverrideDate: true,
        reminder: themeReducer?.defaultReminderEnabled ? (themeReducer?.defaultReminderTime || '09:00') : null
      };
    });
  }

  // 3. Multi-task blocks separated by divider line (e.g. "------------------------" or "---" or "===")
  // or explicitly repeating "Task: "
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

  // Check if multiple "Task: " patterns exist in text
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

  // 4. Checklist / Bullet / Numbered list transfer (e.g. copy-pasted 5 checklist items from Task Flow / Notes)
  if (textLines.length >= 2) {
    const isAllListItems = textLines.every(l => /^(?:[-*•]|\d+[\.)]|\[[ xX]\])/i.test(l));
    if (isAllListItems) {
      return textLines.map((line, idx) => {
        const match = line.match(/^(?:[-*•]|\d+[\.)])?\s*(?:\[([ xX])\])?\s*(.+)/i);
        const isCompleted = match && match[1] ? match[1].toLowerCase() === 'x' : false;
        const title = match && match[2] ? match[2].trim() : line;
        return {
          id: (Date.now() + idx).toString(),
          taskname: title.slice(0, 100),
          description: { text: '', img: idx === 0 ? defaultImg : '', attachments: idx === 0 ? defaultAttachments : [], url: '' },
          subtasks: [],
          completed: isCompleted,
          priority: 'none',
          completionDate: dayjs().toISOString(),
          time: null,
          isShared: true,
          doNotOverrideDate: true,
          reminder: themeReducer?.defaultReminderEnabled ? (themeReducer?.defaultReminderTime || '09:00') : null
        };
      });
    }
  }

  // 5. Fallback: Parse as a single rich task
  return [parseSingleTaskBlock(trimmed, {
    defaultImg,
    defaultAttachments,
    themeReducer,
    index: 0
  })];
}
