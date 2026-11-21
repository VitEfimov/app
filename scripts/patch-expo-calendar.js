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

function run() {
  const res1 = applyPatchList(CALENDAR_MODULE_PATH, calendarModulePatches);
  const res2 = applyPatchList(JS_VALUES_MAPPERS_PATH, jsValuesMappersPatches);

  const totalApplied = res1.applied + res2.applied;
  const totalAlready = res1.alreadyPatched + res2.alreadyPatched;
  const totalMissed = res1.missed + res2.missed;

  if (totalMissed > 0) {
    console.warn(`[patch-expo-calendar] Completed with ${totalMissed} unmatched patch(es) (applied=${totalApplied}, already=${totalAlready}).`);
  } else {
    console.log(`[patch-expo-calendar] OK (applied=${totalApplied}, alreadyPatched=${totalAlready}).`);
  }
}

run();
