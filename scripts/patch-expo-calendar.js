#!/usr/bin/env node
/**
 * Idempotent native Android crash-fix patcher for expo-calendar (~14.0.6).
 *
 * Fixes critical upstream Android crashes in CalendarModule.kt & JsValuesMappers.kt:
 *  1. Unclosed Cursor leaks in serializeAlarms() and removeRemindersForEvent()
 *     (leaked 200-1000+ native CursorWindows -> CursorWindowAllocationException / OOM kill).
 *  2. Uncaught coroutine exceptions in moduleCoroutineScope (missing SupervisorJob + catch-all).
 *  3. Narrow catch block in saveEventAsync() letting RuntimeExceptions kill the Android process.
 *  4. Thread-unsafe, non-Locale.US shared SimpleDateFormat accessed across Dispatchers.Default.
 *  5. Null/missing DB column crash in stringFromCursor() and calendarAllowedAvailabilitiesFromDBString().
 *  6. Brittle RRULE split/indexing in serializeEvent() and null instanceStartDate in removeEvent().
 *
 * Automatically runs on `postinstall` and `preandroid`.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CALENDAR_MODULE_PATH = path.join(
  ROOT,
  'node_modules',
  'expo-calendar',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'calendar',
  'CalendarModule.kt'
);
const JS_VALUES_MAPPERS_PATH = path.join(
  ROOT,
  'node_modules',
  'expo-calendar',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'calendar',
  'JsValuesMappers.kt'
);
const RN_MODAL_PATH = path.join(
  ROOT,
  'node_modules',
  'react-native-modal',
  'dist',
  'modal.js'
);
const EXPO_PRESENTATION_DELEGATE_PATH = path.join(
  ROOT,
  'node_modules',
  'expo-notifications',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'notifications',
  'service',
  'delegates',
  'ExpoPresentationDelegate.kt'
);

function applyPatchList(filePath, patches) {
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-expo-calendar] Skipping missing file: ${path.relative(ROOT, filePath)}`);
    return { skipped: true, applied: 0, alreadyPatched: 0, missed: 0 };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const hadCrlf = raw.includes('\r\n');
  let content = raw.replace(/\r\n/g, '\n');

  let applied = 0;
  let alreadyPatched = 0;
  let missed = 0;

  for (const p of patches) {
    if (content.includes(p.marker)) {
      alreadyPatched++;
      continue;
    }
    if (content.includes(p.target)) {
      content = content.replace(p.target, p.replacement);
      applied++;
    } else {
      missed++;
      console.warn(`[patch-expo-calendar] Could not find target for "${p.name}" in ${path.basename(filePath)}`);
    }
  }

  if (applied > 0) {
    const out = hadCrlf ? content.replace(/\n/g, '\r\n') : content;
    fs.writeFileSync(filePath, out, 'utf8');
  }

  return { skipped: false, applied, alreadyPatched, missed };
}

const calendarModulePatches = [
  {
    name: 'import-supervisor-job',
    marker: 'import kotlinx.coroutines.SupervisorJob',
    target: 'import kotlinx.coroutines.Dispatchers',
    replacement: 'import kotlinx.coroutines.Dispatchers\nimport kotlinx.coroutines.SupervisorJob',
  },
  {
    name: 'supervisor-job-scope',
    marker: 'CoroutineScope(SupervisorJob() + Dispatchers.Default)',
    target: 'private val moduleCoroutineScope = CoroutineScope(Dispatchers.Default)',
    replacement: 'private val moduleCoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)',
  },
  {
    name: 'thread-local-sdf',
    marker: 'private val sdfThreadLocal = object : ThreadLocal<SimpleDateFormat>()',
    target: `  private val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").apply {
    timeZone = TimeZone.getTimeZone("GMT")
  }`,
    replacement: `  private val sdfThreadLocal = object : ThreadLocal<SimpleDateFormat>() {
    override fun initialValue(): SimpleDateFormat {
      return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("GMT")
      }
    }
  }
  private val sdf: SimpleDateFormat
    get() = sdfThreadLocal.get()!!`,
  },
  {
    name: 'save-event-broad-catch',
    marker: 'promise.reject("E_EVENT_NOT_SAVED", "Event could not be saved: ${e.message}", e)',
    target: `          } catch (e: InvalidArgumentException) {
            promise.reject("E_EVENT_NOT_SAVED", "Event could not be saved", e)
          }`,
    replacement: `          } catch (e: InvalidArgumentException) {
            promise.reject("E_EVENT_NOT_SAVED", "Event could not be saved", e)
          } catch (e: Exception) {
            promise.reject("E_EVENT_NOT_SAVED", "Event could not be saved: \${e.message}", e)
          }`,
  },
  {
    name: 'launch-async-catch-all',
    marker: 'promise.reject("E_CALENDAR_ERROR", e.message ?: "Calendar operation failed"',
    target: `  private inline fun launchAsyncWithModuleScope(promise: Promise, crossinline block: () -> Unit) {
    moduleCoroutineScope.launch {
      try {
        block()
      } catch (e: ModuleDestroyedException) {
        promise.reject("E_CALENDAR_MODULE_DESTROYED", "Module destroyed, promise canceled", null)
      }
    }
  }`,
    replacement: `  private inline fun launchAsyncWithModuleScope(promise: Promise, crossinline block: () -> Unit) {
    moduleCoroutineScope.launch {
      try {
        block()
      } catch (e: ModuleDestroyedException) {
        promise.reject("E_CALENDAR_MODULE_DESTROYED", "Module destroyed, promise canceled", null)
      } catch (e: Throwable) {
        Log.e(TAG, "Unhandled calendar error", e)
        try {
          promise.reject("E_CALENDAR_ERROR", e.message ?: "Calendar operation failed", if (e is Exception) e else RuntimeException(e))
        } catch (_: Throwable) {
          // Promise may already be settled
        }
      }
    }
  }`,
  },
  {
    name: 'remove-event-null-instance-date',
    marker: '!details.containsKey("instanceStartDate") || details["instanceStartDate"] == null',
    target: '    if (!details.containsKey("instanceStartDate")) {',
    replacement: '    if (!details.containsKey("instanceStartDate") || details["instanceStartDate"] == null) {',
  },
  {
    name: 'close-remove-reminders-cursor',
    marker: `    CalendarContract.Reminders.query(
      contentResolver,
      eventID.toLong(),
      arrayOf(
        CalendarContract.Reminders._ID
      )
    )?.use { cursor ->`,
    target: `    val cursor = CalendarContract.Reminders.query(
      contentResolver,
      eventID.toLong(),
      arrayOf(
        CalendarContract.Reminders._ID
      )
    )
    while (cursor.moveToNext()) {
      val reminderUri = ContentUris.withAppendedId(CalendarContract.Reminders.CONTENT_URI, cursor.getLong(0))
      contentResolver.delete(reminderUri, null, null)
    }`,
    replacement: `    CalendarContract.Reminders.query(
      contentResolver,
      eventID.toLong(),
      arrayOf(
        CalendarContract.Reminders._ID
      )
    )?.use { cursor ->
      while (cursor.moveToNext()) {
        val reminderUri = ContentUris.withAppendedId(CalendarContract.Reminders.CONTENT_URI, cursor.getLong(0))
        contentResolver.delete(reminderUri, null, null)
      }
    }`,
  },
  {
    name: 'safe-rrule-parsing',
    marker: 'val rruleBundle = if (!rrule.isNullOrBlank()) {',
    target: `    val rruleBundle = if (rrule != null) {
      val recurrenceRule = Bundle()
      val recurrenceRules = rrule.split(";").toTypedArray()
      recurrenceRule.putString("frequency", recurrenceRules[0].split("=").toTypedArray()[1].lowercase(Locale.getDefault()))
      if (recurrenceRules.size >= 2 && recurrenceRules[1].split("=").toTypedArray()[0] == "INTERVAL") {
        recurrenceRule.putInt("interval", recurrenceRules[1].split("=").toTypedArray()[1].toInt())
      }
      if (recurrenceRules.size >= 3) {
        val terminationRules = recurrenceRules[2].split("=").toTypedArray()
        if (terminationRules.size >= 2) {
          if (terminationRules[0] == "UNTIL") {
            try {
              recurrenceRule.putString("endDate", sdf.parse(terminationRules[1])?.toString())
            } catch (e: ParseException) {
              Log.e(TAG, "Couldn't parse the \`endDate\` property.", e)
            } catch (e: NullPointerException) {
              Log.e(TAG, "endDate is null", e)
            }
          } else if (terminationRules[0] == "COUNT") {
            recurrenceRule.putInt("occurrence", recurrenceRules[2].split("=").toTypedArray()[1].toInt())
          }
        }
        Log.e(TAG, "Couldn't parse termination rules: '\${recurrenceRules[2]}'.", null)
      }
      recurrenceRule
    } else {
      null
    }`,
    replacement: `    val rruleBundle = if (!rrule.isNullOrBlank()) {
      try {
        val recurrenceRule = Bundle()
        val recurrenceRules = rrule.split(";").toTypedArray()
        val freqParts = recurrenceRules.firstOrNull()?.split("=")
        if (freqParts != null && freqParts.size >= 2) {
          recurrenceRule.putString("frequency", freqParts[1].lowercase(Locale.US))
        }
        if (recurrenceRules.size >= 2) {
          val intervalParts = recurrenceRules[1].split("=")
          if (intervalParts.size >= 2 && intervalParts[0] == "INTERVAL") {
            intervalParts[1].toIntOrNull()?.let { recurrenceRule.putInt("interval", it) }
          }
        }
        if (recurrenceRules.size >= 3) {
          val terminationRules = recurrenceRules[2].split("=")
          if (terminationRules.size >= 2) {
            if (terminationRules[0] == "UNTIL") {
              try {
                recurrenceRule.putString("endDate", sdf.parse(terminationRules[1])?.toString())
              } catch (e: Exception) {
                Log.e(TAG, "Couldn't parse the \`endDate\` property.", e)
              }
            } else if (terminationRules[0] == "COUNT") {
              terminationRules[1].toIntOrNull()?.let { recurrenceRule.putInt("occurrence", it) }
            }
          }
        }
        if (recurrenceRule.isEmpty) null else recurrenceRule
      } catch (e: Exception) {
        Log.e(TAG, "Couldn't parse rrule: '$rrule'", e)
        null
      }
    } else {
      null
    }`,
  },
  {
    name: 'close-serialize-alarms-cursor',
    marker: `    CalendarContract.Reminders.query(
      contentResolver,
      eventID,
      arrayOf(
        CalendarContract.Reminders.MINUTES,
        CalendarContract.Reminders.METHOD
      )
    )?.use { cursor ->`,
    target: `    val cursor = CalendarContract.Reminders.query(
      contentResolver,
      eventID,
      arrayOf(
        CalendarContract.Reminders.MINUTES,
        CalendarContract.Reminders.METHOD
      )
    )
    while (cursor.moveToNext()) {
      val thisAlarm = Bundle()
      thisAlarm.putInt("relativeOffset", -cursor.getInt(0))
      val method = cursor.getInt(1)
      thisAlarm.putString("method", reminderStringMatchingConstant(method))
      alarms.add(thisAlarm)
    }`,
    replacement: `    CalendarContract.Reminders.query(
      contentResolver,
      eventID,
      arrayOf(
        CalendarContract.Reminders.MINUTES,
        CalendarContract.Reminders.METHOD
      )
    )?.use { cursor ->
      while (cursor.moveToNext()) {
        val thisAlarm = Bundle()
        thisAlarm.putInt("relativeOffset", -cursor.getInt(0))
        val method = cursor.getInt(1)
        thisAlarm.putString("method", reminderStringMatchingConstant(method))
        alarms.add(thisAlarm)
      }
    }`,
  },
  {
    name: 'find-events-overlap-bounds',
    marker: '(${CalendarContract.Instances.END} >= ${eStartDate.timeInMillis})',
    target: `    var selection =
      "((\${CalendarContract.Instances.BEGIN} >= \${eStartDate.timeInMillis}) " +
        "AND (\${CalendarContract.Instances.END} <= \${eEndDate.timeInMillis}) " +
        "AND (\${CalendarContract.Instances.VISIBLE} = 1) "`,
    replacement: `    var selection =
      "((\${CalendarContract.Instances.END} >= \${eStartDate.timeInMillis}) " +
        "AND (\${CalendarContract.Instances.BEGIN} <= \${eEndDate.timeInMillis}) " +
        "AND (\${CalendarContract.Instances.VISIBLE} = 1) "`,
  },
  {
    name: 'null-safe-string-from-cursor',
    marker: 'cursor.getString(index) ?: ""',
    target: `  private fun stringFromCursor(cursor: Cursor, columnName: String): String {
    val index = cursor.getColumnIndex(columnName)
    if (index == -1) {
      throw Exception("String not found")
    } else {
      return cursor.getString(index)
    }
  }`,
    replacement: `  private fun stringFromCursor(cursor: Cursor, columnName: String): String {
    val index = cursor.getColumnIndex(columnName)
    return if (index == -1) {
      ""
    } else {
      cursor.getString(index) ?: ""
    }
  }`,
  },
  {
    name: 'explicit-no-alarm-when-empty',
    marker: 'details.containsKey("alarms") && details.getList("alarms").isNotEmpty()',
    target: `    calendarEventBuilder
      .putEventBoolean(CalendarContract.Events.HAS_ALARM, "alarms", true)
      .putEventString(CalendarContract.Events.AVAILABILITY, "availability", ::availabilityConstantMatchingString)
      .putEventString(CalendarContract.Events.TITLE, "title")
      .putEventString(CalendarContract.Events.DESCRIPTION, "notes")
      .putEventString(CalendarContract.Events.EVENT_LOCATION, "location")
      .putEventString(CalendarContract.Events.ORGANIZER, "organizerEmail")
      .putEventBoolean(CalendarContract.Events.ALL_DAY, "allDay")
      .putEventBoolean(CalendarContract.Events.GUESTS_CAN_MODIFY, "guestsCanModify")
      .putEventBoolean(CalendarContract.Events.GUESTS_CAN_INVITE_OTHERS, "guestsCanInviteOthers")
      .putEventBoolean(CalendarContract.Events.GUESTS_CAN_SEE_GUESTS, "guestsCanSeeGuests")
      .putEventTimeZone(CalendarContract.Events.EVENT_TIMEZONE, "timeZone")
      .putEventTimeZone(CalendarContract.Events.EVENT_END_TIMEZONE, "endTimeZone")
      .putEventString(CalendarContract.Events.ACCESS_LEVEL, "accessLevel", ::accessConstantMatchingString)

    return if (details.containsKey("id")) {
      val eventID = details.getString("id").toInt()
      val updateUri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventID.toLong())
      contentResolver.update(updateUri, calendarEventBuilder.build(), null, null)
      removeRemindersForEvent(eventID)
      if (details.containsKey("alarms")) {
        createRemindersForEvent(eventID, details.getList("alarms"))
      }
      eventID
    } else {
      if (details.containsKey("calendarId")) {
        val calendar = findCalendarById(details.getString("calendarId"))
        if (calendar != null) {
          calendarEventBuilder.put(CalendarContract.Events.CALENDAR_ID, calendar.getString("id")!!.toInt())
        } else {
          throw InvalidArgumentException("Couldn't find calendar with given id: " + details.getString("calendarId"))
        }
      } else {
        throw InvalidArgumentException("CalendarId is required.")
      }
      val eventsUri = CalendarContract.Events.CONTENT_URI
      val eventUri = contentResolver.insert(eventsUri, calendarEventBuilder.build())
        ?: throw EventNotSavedException()
      val eventID = eventUri.lastPathSegment!!.toInt()
      if (details.containsKey("alarms")) {
        createRemindersForEvent(eventID, details.getList("alarms"))
      }
      eventID
    }`,
    replacement: `    val hasNonEmptyAlarms = details.containsKey("alarms") && details.getList("alarms").isNotEmpty()
    calendarEventBuilder
      .put(CalendarContract.Events.HAS_ALARM, if (hasNonEmptyAlarms) 1 else 0)
      .putEventString(CalendarContract.Events.AVAILABILITY, "availability", ::availabilityConstantMatchingString)
      .putEventString(CalendarContract.Events.TITLE, "title")
      .putEventString(CalendarContract.Events.DESCRIPTION, "notes")
      .putEventString(CalendarContract.Events.EVENT_LOCATION, "location")
      .putEventString(CalendarContract.Events.ORGANIZER, "organizerEmail")
      .putEventBoolean(CalendarContract.Events.ALL_DAY, "allDay")
      .putEventBoolean(CalendarContract.Events.GUESTS_CAN_MODIFY, "guestsCanModify")
      .putEventBoolean(CalendarContract.Events.GUESTS_CAN_INVITE_OTHERS, "guestsCanInviteOthers")
      .putEventBoolean(CalendarContract.Events.GUESTS_CAN_SEE_GUESTS, "guestsCanSeeGuests")
      .putEventTimeZone(CalendarContract.Events.EVENT_TIMEZONE, "timeZone")
      .putEventTimeZone(CalendarContract.Events.EVENT_END_TIMEZONE, "endTimeZone")
      .putEventString(CalendarContract.Events.ACCESS_LEVEL, "accessLevel", ::accessConstantMatchingString)

    return if (details.containsKey("id")) {
      val eventID = details.getString("id").toInt()
      val updateUri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventID.toLong())
      contentResolver.update(updateUri, calendarEventBuilder.build(), null, null)
      removeRemindersForEvent(eventID)
      if (hasNonEmptyAlarms) {
        createRemindersForEvent(eventID, details.getList("alarms"))
      }
      eventID
    } else {
      if (details.containsKey("calendarId")) {
        val calendar = findCalendarById(details.getString("calendarId"))
        if (calendar != null) {
          calendarEventBuilder.put(CalendarContract.Events.CALENDAR_ID, calendar.getString("id")!!.toInt())
        } else {
          throw InvalidArgumentException("Couldn't find calendar with given id: " + details.getString("calendarId"))
        }
      } else {
        throw InvalidArgumentException("CalendarId is required.")
      }
      val eventsUri = CalendarContract.Events.CONTENT_URI
      val eventUri = contentResolver.insert(eventsUri, calendarEventBuilder.build())
        ?: throw EventNotSavedException()
      val eventID = eventUri.lastPathSegment!!.toInt()
      removeRemindersForEvent(eventID)
      if (hasNonEmptyAlarms) {
        createRemindersForEvent(eventID, details.getList("alarms"))
      }
      eventID
    }`,
  },
];

const jsValuesMappersPatches = [
  {
    name: 'safe-allowed-availabilities',
    marker: 'when (availabilityId.trim().toIntOrNull())',
    target: `internal fun calendarAllowedAvailabilitiesFromDBString(dbString: String): ArrayList<String> {
  val availabilitiesStrings = ArrayList<String>()
  for (availabilityId in dbString.split(",").toTypedArray()) {
    when (availabilityId.toInt()) {
      CalendarContract.Events.AVAILABILITY_BUSY -> availabilitiesStrings.add("busy")
      CalendarContract.Events.AVAILABILITY_FREE -> availabilitiesStrings.add("free")
      CalendarContract.Events.AVAILABILITY_TENTATIVE -> availabilitiesStrings.add("tentative")
    }
  }
  return availabilitiesStrings
}`,
    replacement: `internal fun calendarAllowedAvailabilitiesFromDBString(dbString: String): ArrayList<String> {
  val availabilitiesStrings = ArrayList<String>()
  if (dbString.isBlank()) return availabilitiesStrings
  for (availabilityId in dbString.split(",").toTypedArray()) {
    when (availabilityId.trim().toIntOrNull()) {
      CalendarContract.Events.AVAILABILITY_BUSY -> availabilitiesStrings.add("busy")
      CalendarContract.Events.AVAILABILITY_FREE -> availabilitiesStrings.add("free")
      CalendarContract.Events.AVAILABILITY_TENTATIVE -> availabilitiesStrings.add("tentative")
    }
  }
  return availabilitiesStrings
}`,
  },
];

const rnModalPatches = [
  {
    name: 'atomic-close-set-state',
    marker: `                    this.setState({
                        showContent: false,
                        isVisible: false,
                    }, () => {
                        this.props.onModalHide();
                    });`,
    target: `                    this.setState({
                        showContent: false,
                    }, () => {
                        this.setState({
                            isVisible: false,
                        }, () => {
                            this.props.onModalHide();
                        });
                    });`,
    replacement: `                    this.setState({
                        showContent: false,
                        isVisible: false,
                    }, () => {
                        this.props.onModalHide();
                    });`,
  },
  {
    name: 'hide-children-when-show-content-false',
    marker: `const _children = !this.state.showContent ? (React.createElement(animatable.View, null)) : (children);`,
    target: `        const _children = this.props.hideModalContentWhileAnimating &&
            this.props.useNativeDriver &&
            !this.state.showContent ? (React.createElement(animatable.View, null)) : (children);`,
    replacement: `        const _children = !this.state.showContent ? (React.createElement(animatable.View, null)) : (children);`,
  },
  {
    name: 'allow-pull-down-swipe-when-scrolled-to-top',
    marker: `const isPullDownAtTop = (!this.props.scrollOffset || this.props.scrollOffset <= 2)`,
    target: `            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Use propagateSwipe to allow inner content to scroll. See PR:
                // https://github.com/react-native-community/react-native-modal/pull/246
                if (!this.shouldPropagateSwipe(evt, gestureState)) {`,
    replacement: `            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Use propagateSwipe to allow inner content to scroll. See PR:
                // https://github.com/react-native-community/react-native-modal/pull/246
                const isPullDownAtTop = (!this.props.scrollOffset || this.props.scrollOffset <= 2) &&
                    gestureState.dy > 8 &&
                    Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2 &&
                    this.isSwipeDirectionAllowed(gestureState);
                if (!this.shouldPropagateSwipe(evt, gestureState) || isPullDownAtTop) {`,
  },
];

const expoPresentationDelegatePatches = [
  {
    name: 'dismiss-superseded-before-task-notifications',
    marker: 'dismissSupersededTaskNotifications(notification)',
    target: `    CoroutineScope(Dispatchers.IO).launch {
      val androidNotification = createNotification(notification, behavior)

      NotificationManagerCompat.from(context).notify(
        notification.notificationRequest.identifier,
        getNotifyId(notification.notificationRequest),
        androidNotification
      )
    }
  }`,
    replacement: `    CoroutineScope(Dispatchers.IO).launch {
      val androidNotification = createNotification(notification, behavior)

      dismissSupersededTaskNotifications(notification)

      NotificationManagerCompat.from(context).notify(
        notification.notificationRequest.identifier,
        getNotifyId(notification.notificationRequest),
        androidNotification
      )
    }
  }

  private fun dismissSupersededTaskNotifications(incoming: Notification) {
    try {
      val req = incoming.notificationRequest ?: return
      val incomingId = req.identifier ?: ""
      if (incomingId.startsWith("task_persist_")) return

      val incomingTitle = req.content?.title?.trim() ?: ""
      val incomingText = req.content?.text?.trim() ?: ""
      val isTaskNotif = incomingId.startsWith("task_") || incomingTitle == "Task Reminder" || incomingTitle == "Task Alarm"
      if (!isTaskNotif) return

      val beforeSuffixRegex = Regex("""\\s*\\(\\d+\\s*(?:min|minute|mins|minutes|hr|hour|hrs|hours|day|days)\\s*before\\)\\s*$""", RegexOption.IGNORE_CASE)
      val prefixUrgentRegex = Regex("""^\\[(?:URGENT|OVERDUE)\\]\\s*""", RegexOption.IGNORE_CASE)
      val dueNowSuffixRegex = Regex("""\\s+is due now$""", RegexOption.IGNORE_CASE)

      fun normalizeBaseText(text: String): String {
        return text
          .replace(beforeSuffixRegex, "")
          .replace(prefixUrgentRegex, "")
          .replace(dueNowSuffixRegex, "")
          .trim()
      }

      fun extractTaskId(id: String): String? {
        if (id.startsWith("task_exact_")) return id.removePrefix("task_exact_").takeIf { it.isNotEmpty() }
        if (id.startsWith("task_offset_")) {
          return Regex("""^task_offset_[a-z0-9_]*?_before_(.+)$""", RegexOption.IGNORE_CASE).find(id)?.groupValues?.getOrNull(1)
        }
        if (id.startsWith("task_esc_")) {
          return Regex("""^task_esc_\\d+_(?:hour|minute|day)_(.+)$""", RegexOption.IGNORE_CASE).find(id)?.groupValues?.getOrNull(1)
        }
        if (id.startsWith("task_nag_")) {
          return Regex("""^task_nag_\\d+_(.+)$""", RegexOption.IGNORE_CASE).find(id)?.groupValues?.getOrNull(1)
        }
        return null
      }

      val incomingTaskId = extractTaskId(incomingId) ?: req.content?.body?.optString("taskId", "")?.takeIf { it.isNotEmpty() }
      val incomingBaseText = normalizeBaseText(incomingText)
      val incomingIsBefore = incomingId.startsWith("task_offset_") || incomingId.startsWith("task_esc_") || beforeSuffixRegex.containsMatchIn(incomingText)

      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
      for (sbn in nm.activeNotifications) {
        val activeTag = sbn.tag ?: ""
        if (activeTag == incomingId || activeTag.startsWith("task_persist_")) continue

        val activeTitle = NotificationCompat.getContentTitle(sbn.notification)?.toString()?.trim() ?: ""
        val activeText = NotificationCompat.getContentText(sbn.notification)?.toString()?.trim() ?: ""
        val activeIsBefore = activeTag.startsWith("task_offset_") || activeTag.startsWith("task_esc_") || beforeSuffixRegex.containsMatchIn(activeText)
        val activeTaskId = extractTaskId(activeTag)
        val activeBaseText = normalizeBaseText(activeText)

        val sameTaskById = !incomingTaskId.isNullOrEmpty() && !activeTaskId.isNullOrEmpty() && incomingTaskId == activeTaskId
        val sameTaskByText = incomingBaseText.isNotEmpty() &&
          activeBaseText.equals(incomingBaseText, ignoreCase = true) &&
          (activeTitle == "Task Reminder" || activeTitle == "Task Alarm" || activeTag.startsWith("task_"))

        if ((sameTaskById || sameTaskByText) && (activeIsBefore || !incomingIsBefore)) {
          NotificationManagerCompat.from(context).cancel(sbn.tag, sbn.id)
        }
      }
    } catch (e: Exception) {
      Log.w("expo-notifications", "Failed to dismiss superseded before-notification", e)
    }
  }`,
  },
];

function run() {
  const res1 = applyPatchList(CALENDAR_MODULE_PATH, calendarModulePatches);
  const res2 = applyPatchList(JS_VALUES_MAPPERS_PATH, jsValuesMappersPatches);
  const res3 = applyPatchList(RN_MODAL_PATH, rnModalPatches);
  const res4 = applyPatchList(EXPO_PRESENTATION_DELEGATE_PATH, expoPresentationDelegatePatches);

  const totalApplied = res1.applied + res2.applied + res3.applied + res4.applied;
  const totalAlready = res1.alreadyPatched + res2.alreadyPatched + res3.alreadyPatched + res4.alreadyPatched;
  const totalMissed = res1.missed + res2.missed + res3.missed + res4.missed;

  if (totalMissed > 0) {
    console.warn(`[patch-expo-calendar] Completed with ${totalMissed} unmatched patch(es) (applied=${totalApplied}, already=${totalAlready}).`);
  } else {
    console.log(`[patch-expo-calendar] OK (applied=${totalApplied}, alreadyPatched=${totalAlready}).`);
  }
}

run();
