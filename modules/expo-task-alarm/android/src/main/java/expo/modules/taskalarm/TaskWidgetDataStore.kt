package expo.modules.taskalarm

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class WidgetTaskItem(
    val id: String,
    val title: String,
    val dateKey: String,          // YYYY-MM-DD
    val timeLabel: String,        // e.g. "11:30 AM" or ""
    val sortTimeMinutes: Int,     // 0..1439, or 9999 if no time
    val completed: Boolean,
    val priority: String,         // "high", "medium", "low", "none"
    val boardId: String,
    val boardName: String,
    val boardType: String,        // "standard", "grocery", "shopping", "expenses", "packing", "habits", "media", "simple_list", "birthdays"
    val isAlarm: Boolean,
    val isRecurring: Boolean,
    val subtaskSummary: String,   // e.g. "2/4" or ""
    val badgeText: String,        // e.g. "$9.00", "🔥 5d", "2/4", "HIGH", "11:30 AM"
    val metaText: String,         // e.g. "11:30 AM • Work" or "×2 • $4.50 ea • Grocery"
    val priceTotal: Double,
    val streakDays: Int,
    val accentHex: String
)

data class WidgetThemePalette(
    val themeMode: String,
    val surfaceBg: Int,
    val cardBg: Int,
    val headerBg: Int,
    val textPrimary: Int,
    val textSecondary: Int,
    val textMuted: Int,
    val accentColor: Int,
    val pillBg: Int,
    val dangerColor: Int,
    val warningColor: Int,
    val successColor: Int,
    val infoColor: Int
)

data class WidgetSnapshot(
    val todayKey: String,
    val themeMode: String,
    val accentHex: String,
    val weekStartDay: Int,        // 0 = Sunday, 1 = Monday
    val currencySymbol: String,
    val activeBoardName: String,
    val bestHabitStreak: Int,
    val dueTodayCount: Int,
    val completedTodayCount: Int,
    val overdueCount: Int,
    val tasks: List<WidgetTaskItem>,
    val language: String = "en"
)

sealed class WidgetListRow {
    data class SectionHeader(
        val title: String,
        val rightSummary: String,
        val dotColor: Int,
        val textColor: Int
    ) : WidgetListRow()

    data class TaskCard(
        val task: WidgetTaskItem
    ) : WidgetListRow()
}

data class MonthGridRenderResult(
    val bitmap: Bitmap,
    val cellDateKeys: List<String>,
    val monthTitle: String,
    val monthTaskCount: Int
)

object TaskWidgetDataStore {
    const val PREFS_NAME = "taskflow_widgets"
    const val KEY_SNAPSHOT_JSON = "widget_snapshot_json"
    const val KEY_FILTER_MODE = "widget_schedule_filter"
    const val KEY_MONTH_OFFSET = "widget_month_offset"
    const val KEY_SELECTED_DATE = "widget_selected_date"
    const val KEY_PENDING_ACTIONS = "pending_widget_actions"
    const val KEY_PENDING_LAUNCH = "pending_widget_launch_action"

    val FILTER_MODES = listOf("ALL", "TODAY", "LISTS", "HABITS")

    @Volatile
    var widgetActionBridgeListener: ((Map<String, Any?>) -> Unit)? = null

    fun parseColorSafe(hex: String?, fallback: Int): Int {
        if (hex.isNullOrBlank()) return fallback
        return try {
            val clean = if (hex.startsWith("#")) hex else "#$hex"
            Color.parseColor(clean)
        } catch (_: Exception) {
            fallback
        }
    }

    fun blendAlpha(color: Int, alphaFraction: Float): Int {
        val a = (255 * alphaFraction.coerceIn(0f, 1f)).toInt()
        return Color.argb(a, Color.red(color), Color.green(color), Color.blue(color))
    }

    fun getTodayDateKey(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        return sdf.format(Date())
    }

    fun getTomorrowDateKey(): String {
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_YEAR, 1)
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        return sdf.format(cal.time)
    }

    fun formatShortHeaderDate(dateKey: String, langCode: String = "en"): String {
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val parsed = parser.parse(dateKey) ?: Date()
            val locale = TaskTranslations.getLocale(langCode)
            val fmt = SimpleDateFormat("EEE, MMM d", locale)
            fmt.format(parsed).uppercase(locale)
        } catch (_: Exception) {
            dateKey
        }
    }

    fun getScheduleFilter(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_FILTER_MODE, "ALL") ?: "ALL"
        return if (FILTER_MODES.contains(raw)) raw else "ALL"
    }

    fun cycleScheduleFilter(context: Context): String {
        val current = getScheduleFilter(context)
        val idx = FILTER_MODES.indexOf(current).let { if (it < 0) 0 else it }
        val next = FILTER_MODES[(idx + 1) % FILTER_MODES.size]
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_FILTER_MODE, next)
            .apply()
        return next
    }

    fun getMonthOffset(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getInt(KEY_MONTH_OFFSET, 0).coerceIn(-36, 36)
    }

    fun shiftMonthOffset(context: Context, delta: Int): Int {
        val next = if (delta == 0) 0 else (getMonthOffset(context) + delta).coerceIn(-36, 36)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit().putInt(KEY_MONTH_OFFSET, next)
        if (delta == 0) {
            editor.putString(KEY_SELECTED_DATE, getTodayDateKey())
        }
        editor.apply()
        return next
    }

    fun getSelectedDateKey(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_SELECTED_DATE, null)
        return if (!saved.isNullOrBlank() && saved.matches(Regex("""^\d{4}-\d{2}-\d{2}$"""))) {
            saved
        } else {
            getTodayDateKey()
        }
    }

    fun setSelectedDateKey(context: Context, dateKey: String) {
        if (!dateKey.matches(Regex("""^\d{4}-\d{2}-\d{2}$"""))) return
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SELECTED_DATE, dateKey)
            .apply()
    }

    fun resolvePalette(context: Context, snapshot: WidgetSnapshot): WidgetThemePalette {
        val themePrefs = context.getSharedPreferences("taskflow_theme", Context.MODE_PRIVATE)
        val effectiveMode = (snapshot.themeMode.takeIf { it.isNotBlank() }
            ?: themePrefs.getString("themeMode", "dark")
            ?: "dark").lowercase(Locale.US)

        val accent = parseColorSafe(snapshot.accentHex, Color.parseColor("#6C5CE7"))
        val danger = Color.parseColor("#EF4444")
        val warning = Color.parseColor("#F59E0B")
        val success = Color.parseColor("#10B981")
        val info = Color.parseColor("#3B82F6")

        return when (effectiveMode) {
            "light" -> WidgetThemePalette(
                themeMode = "light",
                surfaceBg = Color.parseColor("#FAF9F6"),
                cardBg = Color.parseColor("#FFFFFF"),
                headerBg = Color.parseColor("#F1EFEA"),
                textPrimary = Color.parseColor("#18181F"),
                textSecondary = Color.parseColor("#5A5A6E"),
                textMuted = Color.parseColor("#8A8A9E"),
                accentColor = accent,
                pillBg = Color.parseColor("#E6E3DC"),
                dangerColor = danger,
                warningColor = warning,
                successColor = success,
                infoColor = info
            )
            "contrast" -> WidgetThemePalette(
                themeMode = "contrast",
                surfaceBg = Color.parseColor("#000000"),
                cardBg = Color.parseColor("#111116"),
                headerBg = Color.parseColor("#16161F"),
                textPrimary = Color.parseColor("#FFFFFF"),
                textSecondary = Color.parseColor("#D4D4E4"),
                textMuted = Color.parseColor("#9A9AB0"),
                accentColor = accent,
                pillBg = Color.parseColor("#252533"),
                dangerColor = danger,
                warningColor = warning,
                successColor = success,
                infoColor = info
            )
            else -> WidgetThemePalette(
                themeMode = "dark",
                surfaceBg = Color.parseColor("#141419"),
                cardBg = Color.parseColor("#1E1E26"),
                headerBg = Color.parseColor("#22222C"),
                textPrimary = Color.parseColor("#F5F5FA"),
                textSecondary = Color.parseColor("#A5A5B8"),
                textMuted = Color.parseColor("#7E7E94"),
                accentColor = accent,
                pillBg = Color.parseColor("#2E2E3C"),
                dangerColor = danger,
                warningColor = warning,
                successColor = success,
                infoColor = info
            )
        }
    }

    fun loadSnapshot(context: Context): WidgetSnapshot {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_SNAPSHOT_JSON, null)
        val todayKey = getTodayDateKey()
        val themePrefs = context.getSharedPreferences("taskflow_theme", Context.MODE_PRIVATE)
        val fallbackThemeMode = themePrefs.getString("themeMode", "dark") ?: "dark"
        val savedLang = TaskTranslations.getSavedLanguage(context)

        if (raw.isNullOrBlank()) {
            val bMain = TaskTranslations.t(context, "board_main", savedLang)
            val exMeta1 = TaskTranslations.t(context, "example_meta_1", savedLang)
            val exMeta2 = TaskTranslations.t(context, "example_meta_2", savedLang)
            val exampleTasks = listOf(
                WidgetTaskItem(
                    id = "widget_example_1",
                    title = TaskTranslations.t(context, "example_task_1", savedLang),
                    dateKey = todayKey,
                    timeLabel = "09:00 AM",
                    sortTimeMinutes = 540,
                    completed = false,
                    priority = "high",
                    boardId = "main",
                    boardName = bMain,
                    boardType = "standard",
                    isAlarm = false,
                    isRecurring = false,
                    subtaskSummary = "",
                    badgeText = "09:00 AM",
                    metaText = "09:00 AM • $exMeta1 • $bMain",
                    priceTotal = 0.0,
                    streakDays = 0,
                    accentHex = "#6C5CE7"
                ),
                WidgetTaskItem(
                    id = "widget_example_2",
                    title = TaskTranslations.t(context, "example_task_2", savedLang),
                    dateKey = todayKey,
                    timeLabel = "11:30 AM",
                    sortTimeMinutes = 690,
                    completed = false,
                    priority = "medium",
                    boardId = "main",
                    boardName = bMain,
                    boardType = "standard",
                    isAlarm = false,
                    isRecurring = false,
                    subtaskSummary = "",
                    badgeText = "11:30 AM",
                    metaText = "11:30 AM • $exMeta2 • $bMain",
                    priceTotal = 0.0,
                    streakDays = 0,
                    accentHex = "#6C5CE7"
                )
            )
            return WidgetSnapshot(
                todayKey = todayKey,
                themeMode = fallbackThemeMode,
                accentHex = "#6C5CE7",
                weekStartDay = 0,
                currencySymbol = "$",
                activeBoardName = TaskTranslations.t(context, "all_tasks", savedLang),
                bestHabitStreak = 0,
                dueTodayCount = 2,
                completedTodayCount = 0,
                overdueCount = 0,
                tasks = exampleTasks,
                language = savedLang
            )
        }

        return try {
            val root = JSONObject(raw)
            val lang = TaskTranslations.normalizeLangCode(root.optString("language", savedLang))
            TaskTranslations.setSavedLanguage(context, lang)
            val themeMode = root.optString("themeMode", fallbackThemeMode)
            val accentHex = root.optString("accentHex", "#6C5CE7")
            val weekStartDay = root.optInt("weekStartDay", 0)
            val currencySymbol = root.optString("currencySymbol", "$")
            val activeBoardName = root.optString("activeBoardName", TaskTranslations.t(context, "all_tasks", lang))
            val bestHabitStreak = root.optInt("bestHabitStreak", 0)

            val arr = root.optJSONArray("tasks") ?: JSONArray()
            val items = ArrayList<WidgetTaskItem>(arr.length())
            var dueToday = 0
            var completedToday = 0
            var overdue = 0

            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val id = obj.optString("id", "").takeIf { it.isNotEmpty() } ?: continue
                val title = obj.optString("title", TaskTranslations.t(context, "untitled_task", lang))
                val dateKey = obj.optString("dateKey", todayKey)
                val completed = obj.optBoolean("completed", false)
                val boardType = obj.optString("boardType", "standard")

                if (dateKey == todayKey) {
                    if (completed) completedToday++ else dueToday++
                } else if (!completed && dateKey.isNotEmpty() && dateKey < todayKey && boardType != "grocery" && boardType != "shopping" && boardType != "packing" && boardType != "media" && boardType != "simple_list") {
                    overdue++
                }

                items.add(
                    WidgetTaskItem(
                        id = id,
                        title = title,
                        dateKey = dateKey,
                        timeLabel = obj.optString("timeLabel", ""),
                        sortTimeMinutes = obj.optInt("sortTimeMinutes", 9999),
                        completed = completed,
                        priority = obj.optString("priority", "none"),
                        boardId = obj.optString("boardId", "main"),
                        boardName = obj.optString("boardName", TaskTranslations.t(context, "tasks_default", lang)),
                        boardType = boardType,
                        isAlarm = obj.optBoolean("isAlarm", false),
                        isRecurring = obj.optBoolean("isRecurring", false),
                        subtaskSummary = obj.optString("subtaskSummary", ""),
                        badgeText = obj.optString("badgeText", ""),
                        metaText = obj.optString("metaText", ""),
                        priceTotal = obj.optDouble("priceTotal", 0.0),
                        streakDays = obj.optInt("streakDays", 0),
                        accentHex = obj.optString("accentHex", accentHex)
                    )
                )
            }

            WidgetSnapshot(
                todayKey = todayKey,
                themeMode = themeMode,
                accentHex = accentHex,
                weekStartDay = weekStartDay,
                currencySymbol = currencySymbol,
                activeBoardName = activeBoardName,
                bestHabitStreak = bestHabitStreak,
                dueTodayCount = dueToday,
                completedTodayCount = completedToday,
                overdueCount = overdue,
                tasks = items,
                language = lang
            )
        } catch (_: Exception) {
            WidgetSnapshot(
                todayKey = todayKey,
                themeMode = fallbackThemeMode,
                accentHex = "#6C5CE7",
                weekStartDay = 0,
                currencySymbol = "$",
                activeBoardName = TaskTranslations.t(context, "all_tasks", savedLang),
                bestHabitStreak = 0,
                dueTodayCount = 0,
                completedTodayCount = 0,
                overdueCount = 0,
                tasks = emptyList(),
                language = savedLang
            )
        }
    }

    fun resolveTaskAccentColor(task: WidgetTaskItem, palette: WidgetThemePalette, todayKey: String): Int {
        if (task.completed) return palette.successColor
        val isOverdue = task.dateKey.isNotEmpty() && task.dateKey < todayKey &&
            task.boardType != "grocery" && task.boardType != "shopping" && task.boardType != "packing" && task.boardType != "media"
        if (isOverdue) return palette.dangerColor
        return when (task.priority.lowercase(Locale.US)) {
            "high", "urgent" -> palette.dangerColor
            "medium" -> palette.warningColor
            "low" -> palette.infoColor
            else -> when (task.boardType) {
                "grocery", "shopping" -> palette.successColor
                "expenses" -> palette.warningColor
                "habits" -> Color.parseColor("#FF7043")
                "packing" -> palette.infoColor
                else -> parseColorSafe(task.accentHex, palette.accentColor)
            }
        }
    }

    fun buildScheduleRows(context: Context, snapshot: WidgetSnapshot, palette: WidgetThemePalette): List<WidgetListRow> {
        val filter = getScheduleFilter(context)
        val lang = snapshot.language
        val locale = TaskTranslations.getLocale(lang)
        val todayKey = snapshot.todayKey
        val tomorrowKey = getTomorrowDateKey()
        val rows = ArrayList<WidgetListRow>()

        val comparator = Comparator<WidgetTaskItem> { a, b ->
            if (a.completed != b.completed) {
                if (a.completed) 1 else -1
            } else if (a.dateKey != b.dateKey) {
                a.dateKey.compareTo(b.dateKey)
            } else if (a.sortTimeMinutes != b.sortTimeMinutes) {
                a.sortTimeMinutes.compareTo(b.sortTimeMinutes)
            } else {
                val pRank = mapOf("high" to 0, "urgent" to 0, "medium" to 1, "low" to 2, "none" to 3)
                val pa = pRank[a.priority.lowercase(Locale.US)] ?: 3
                val pb = pRank[b.priority.lowercase(Locale.US)] ?: 3
                pa.compareTo(pb)
            }
        }

        when (filter) {
            "TODAY" -> {
                val overdueList = snapshot.tasks.filter {
                    !it.completed && it.dateKey.isNotEmpty() && it.dateKey < todayKey &&
                        it.boardType != "grocery" && it.boardType != "shopping" && it.boardType != "packing"
                }.sortedWith(comparator)

                if (overdueList.isNotEmpty()) {
                    rows.add(
                        WidgetListRow.SectionHeader(
                            title = TaskTranslations.t(context, "overdue_upper", lang),
                            rightSummary = "${overdueList.size} ${TaskTranslations.t(context, "overdue", lang)}",
                            dotColor = palette.dangerColor,
                            textColor = palette.dangerColor
                        )
                    )
                    overdueList.forEach { rows.add(WidgetListRow.TaskCard(it)) }
                }

                val todayActive = snapshot.tasks.filter { !it.completed && it.dateKey == todayKey }.sortedWith(comparator)
                if (todayActive.isNotEmpty()) {
                    rows.add(
                        WidgetListRow.SectionHeader(
                            title = "${TaskTranslations.t(context, "today_upper", lang)} • ${formatShortHeaderDate(todayKey, lang)}",
                            rightSummary = "${todayActive.size} ${TaskTranslations.t(context, "due", lang)}",
                            dotColor = palette.accentColor,
                            textColor = palette.textSecondary
                        )
                    )
                    todayActive.forEach { rows.add(WidgetListRow.TaskCard(it)) }
                }

                val todayDone = snapshot.tasks.filter { it.completed && it.dateKey == todayKey }.sortedWith(comparator)
                if (todayDone.isNotEmpty()) {
                    rows.add(
                        WidgetListRow.SectionHeader(
                            title = TaskTranslations.t(context, "completed_today_upper", lang),
                            rightSummary = "${todayDone.size} ${TaskTranslations.t(context, "done", lang)}",
                            dotColor = palette.successColor,
                            textColor = palette.textMuted
                        )
                    )
                    todayDone.take(5).forEach { rows.add(WidgetListRow.TaskCard(it)) }
                }
            }

            "LISTS" -> {
                val listTypes = setOf("grocery", "shopping", "expenses", "packing", "media", "simple_list", "birthdays")
                val listTasks = snapshot.tasks.filter { listTypes.contains(it.boardType) }
                val grouped = listTasks.groupBy { "${it.boardType}::${it.boardName}" }

                for ((key, groupItems) in grouped) {
                    val bType = key.substringBefore("::")
                    val bName = key.substringAfter("::").ifBlank { TaskTranslations.t(context, "list_default", lang) }
                    val sorted = groupItems.sortedWith(comparator)
                    val activeCount = sorted.count { !it.completed }
                    val leftWord = TaskTranslations.t(context, "left", lang)

                    val rightSummary = when (bType) {
                        "grocery", "shopping", "expenses" -> {
                            val sum = sorted.filter { !it.completed }.sumOf { it.priceTotal }
                            if (sum > 0.0) {
                                String.format(Locale.US, "%s%.2f • %d %s", snapshot.currencySymbol, sum, activeCount, leftWord)
                            } else {
                                "$activeCount $leftWord"
                            }
                        }
                        "packing" -> "${sorted.count { it.completed }}/${sorted.size} ${TaskTranslations.t(context, "packed", lang)}"
                        else -> "$activeCount ${TaskTranslations.t(context, "items", lang)}"
                    }

                    val dotColor = when (bType) {
                        "grocery", "shopping" -> palette.successColor
                        "expenses" -> palette.warningColor
                        "packing" -> palette.infoColor
                        else -> palette.accentColor
                    }

                    rows.add(
                        WidgetListRow.SectionHeader(
                            title = bName.uppercase(locale),
                            rightSummary = rightSummary,
                            dotColor = dotColor,
                            textColor = palette.textSecondary
                        )
                    )
                    sorted.take(12).forEach { rows.add(WidgetListRow.TaskCard(it)) }
                }
            }

            "HABITS" -> {
                val habits = snapshot.tasks.filter { it.boardType == "habits" || it.streakDays > 0 }.sortedWith(comparator)
                if (habits.isNotEmpty()) {
                    val doneCount = habits.count { it.completed }
                    rows.add(
                        WidgetListRow.SectionHeader(
                            title = TaskTranslations.t(context, "daily_habits_upper", lang),
                            rightSummary = "$doneCount/${habits.size} ${TaskTranslations.t(context, "today_lower", lang)}",
                            dotColor = Color.parseColor("#FF7043"),
                            textColor = palette.textSecondary
                        )
                    )
                    habits.forEach { rows.add(WidgetListRow.TaskCard(it)) }
                }
            }

            else -> {
                // "ALL" — Google Calendar Schedule View (Overdue -> Today -> Tomorrow -> Upcoming -> Lists)
                val overdueList = snapshot.tasks.filter {
                    !it.completed && it.dateKey.isNotEmpty() && it.dateKey < todayKey &&
                        it.boardType != "grocery" && it.boardType != "shopping" && it.boardType != "packing"
                }.sortedWith(comparator)

                if (overdueList.isNotEmpty()) {
                    rows.add(
                        WidgetListRow.SectionHeader(
                            title = TaskTranslations.t(context, "overdue_upper", lang),
                            rightSummary = "${overdueList.size} ${TaskTranslations.t(context, "overdue", lang)}",
                            dotColor = palette.dangerColor,
                            textColor = palette.dangerColor
                        )
                    )
                    overdueList.take(8).forEach { rows.add(WidgetListRow.TaskCard(it)) }
                }

                val todayTasks = snapshot.tasks.filter { it.dateKey == todayKey }.sortedWith(comparator)
                if (todayTasks.isNotEmpty()) {
                    val activeToday = todayTasks.count { !it.completed }
                    rows.add(
                        WidgetListRow.SectionHeader(
                            title = "${TaskTranslations.t(context, "today_upper", lang)} • ${formatShortHeaderDate(todayKey, lang)}",
                            rightSummary = if (activeToday > 0) "$activeToday ${TaskTranslations.t(context, "due", lang)}" else TaskTranslations.t(context, "all_done", lang),
                            dotColor = palette.accentColor,
                            textColor = palette.textSecondary
                        )
                    )
                    todayTasks.take(12).forEach { rows.add(WidgetListRow.TaskCard(it)) }
                }

                val tomorrowTasks = snapshot.tasks.filter { it.dateKey == tomorrowKey }.sortedWith(comparator)
                if (tomorrowTasks.isNotEmpty()) {
                    val activeTomorrow = tomorrowTasks.count { !it.completed }
                    rows.add(
                        WidgetListRow.SectionHeader(
                            title = "${TaskTranslations.t(context, "tomorrow_upper", lang)} • ${formatShortHeaderDate(tomorrowKey, lang)}",
                            rightSummary = if (activeTomorrow > 0) "$activeTomorrow ${TaskTranslations.t(context, "scheduled", lang)}" else TaskTranslations.t(context, "all_done", lang),
                            dotColor = palette.infoColor,
                            textColor = palette.textSecondary
                        )
                    )
                    tomorrowTasks.take(10).forEach { rows.add(WidgetListRow.TaskCard(it)) }
                }

                val upcomingByDate = snapshot.tasks
                    .filter { it.dateKey > tomorrowKey }
                    .sortedWith(comparator)
                    .groupBy { it.dateKey }

                var upcomingCount = 0
                for ((dKey, dateItems) in upcomingByDate) {
                    if (upcomingCount >= 12) break
                    rows.add(
                        WidgetListRow.SectionHeader(
                            title = formatShortHeaderDate(dKey, lang),
                            rightSummary = "${dateItems.size}",
                            dotColor = palette.textMuted,
                            textColor = palette.textSecondary
                        )
                    )
                    for (item in dateItems) {
                        if (upcomingCount >= 12) break
                        rows.add(WidgetListRow.TaskCard(item))
                        upcomingCount++
                    }
                }
            }
        }

        return rows
    }

    /**
     * Toggles a task's completed state directly inside the widget snapshot in SharedPreferences
     * for instant <16ms Home Screen feedback, and queues the action for Redux synchronization.
     */
    fun toggleTaskFromWidget(context: Context, taskId: String): Boolean {
        if (taskId.isBlank()) return false
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_SNAPSHOT_JSON, null)

        return try {
            val root = if (!raw.isNullOrBlank()) {
                JSONObject(raw)
            } else {
                val snap = loadSnapshot(context)
                val tasksJson = JSONArray()
                for (t in snap.tasks) {
                    tasksJson.put(JSONObject().apply {
                        put("id", t.id)
                        put("title", t.title)
                        put("dateKey", t.dateKey)
                        put("timeLabel", t.timeLabel)
                        put("sortTimeMinutes", t.sortTimeMinutes)
                        put("completed", t.completed)
                        put("priority", t.priority)
                        put("boardId", t.boardId)
                        put("boardName", t.boardName)
                        put("boardType", t.boardType)
                        put("badgeText", t.badgeText)
                        put("metaText", t.metaText)
                        put("priceTotal", t.priceTotal)
                        put("streakDays", t.streakDays)
                        put("accentHex", t.accentHex)
                    })
                }
                JSONObject().apply {
                    put("themeMode", snap.themeMode)
                    put("accentHex", snap.accentHex)
                    put("weekStartDay", snap.weekStartDay)
                    put("currencySymbol", snap.currencySymbol)
                    put("tasks", tasksJson)
                }
            }

            val arr = root.optJSONArray("tasks") ?: return false
            var newCompletedState: Boolean? = null

            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                if (obj.optString("id") == taskId) {
                    val toggled = !obj.optBoolean("completed", false)
                    obj.put("completed", toggled)
                    newCompletedState = toggled
                    break
                }
            }

            val finalState = newCompletedState ?: return false

            if (!taskId.startsWith("widget_example_")) {
                val pendingRaw = prefs.getString(KEY_PENDING_ACTIONS, "[]") ?: "[]"
                val pendingArr = try { JSONArray(pendingRaw) } catch (_: Exception) { JSONArray() }
                val actionObj = JSONObject().apply {
                    put("type", "TOGGLE_TASK")
                    put("taskId", taskId)
                    put("completed", finalState)
                    put("timestamp", System.currentTimeMillis())
                }
                pendingArr.put(actionObj)
                prefs.edit()
                    .putString(KEY_SNAPSHOT_JSON, root.toString())
                    .putString(KEY_PENDING_ACTIONS, pendingArr.toString())
                    .apply()

                try {
                    widgetActionBridgeListener?.invoke(
                        mapOf(
                            "type" to "TOGGLE_TASK",
                            "taskId" to taskId,
                            "completed" to finalState
                        )
                    )
                } catch (_: Exception) {}
            } else {
                prefs.edit().putString(KEY_SNAPSHOT_JSON, root.toString()).apply()
            }

            refreshAllWidgets(context)
            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Creates a brand-new task directly from the Home Screen WidgetQuickAddActivity
     * without opening the main React Native app, updates all widgets immediately,
     * and queues CREATE_TASK for Redux persistence.
     */
    fun addTaskFromWidget(
        context: Context,
        rawTitle: String,
        dateKey: String,
        time24: String,
        timeLabel: String,
        priority: String,
        boardId: String,
        boardName: String,
        boardType: String
    ): Boolean {
        val cleanTitle = rawTitle.trim()
        if (cleanTitle.isEmpty()) return false

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val snap = loadSnapshot(context)
        val existingRaw = prefs.getString(KEY_SNAPSHOT_JSON, null)
        val root = try {
            if (!existingRaw.isNullOrBlank()) JSONObject(existingRaw) else JSONObject()
        } catch (_: Exception) {
            JSONObject()
        }

        val tasksArr = root.optJSONArray("tasks") ?: JSONArray()
        val newId = "wtask_${System.currentTimeMillis()}"

        // Smart parse quantity (e.g. "Milk x2" or "Milk ×2") and price (e.g. "$4.50")
        var qty = 1
        val qtyMatch = Regex("""(?:×|\bx)\s*(\d+)\b""", RegexOption.IGNORE_CASE).find(cleanTitle)
        if (qtyMatch != null) {
            qty = (qtyMatch.groupValues[1].toIntOrNull() ?: 1).coerceAtLeast(1)
        }
        var unitPrice = 0.0
        val priceMatch = Regex("""[$€£¥₽]\s*(\d+(?:\.\d{1,2})?)""").find(cleanTitle)
        if (priceMatch != null) {
            unitPrice = priceMatch.groupValues[1].toDoubleOrNull() ?: 0.0
        }
        val priceTotal = if (boardType == "grocery" || boardType == "shopping") unitPrice * qty else unitPrice

        val sortTimeMinutes = if (time24.contains(":")) {
            val parts = time24.split(":")
            val h = parts.getOrNull(0)?.toIntOrNull() ?: 0
            val m = parts.getOrNull(1)?.toIntOrNull() ?: 0
            h * 60 + m
        } else {
            9999
        }

        val badgeText = when {
            priceTotal > 0.0 -> String.format(Locale.US, "%s%.2f", snap.currencySymbol, priceTotal)
            timeLabel.isNotBlank() -> timeLabel
            priority == "high" -> TaskTranslations.t(context, "priority_high_upper", snap.language)
            else -> ""
        }

        val metaParts = ArrayList<String>()
        if (timeLabel.isNotBlank()) metaParts.add(timeLabel)
        metaParts.add(boardName.ifBlank { TaskTranslations.t(context, "board_main", snap.language) })
        val metaText = metaParts.joinToString(" • ")

        val newTaskJson = JSONObject().apply {
            put("id", newId)
            put("title", cleanTitle)
            put("dateKey", dateKey)
            put("timeLabel", timeLabel)
            put("sortTimeMinutes", sortTimeMinutes)
            put("completed", false)
            put("priority", priority)
            put("boardId", boardId)
            put("boardName", boardName)
            put("boardType", boardType)
            put("isAlarm", false)
            put("isRecurring", false)
            put("subtaskSummary", "")
            put("badgeText", badgeText)
            put("metaText", metaText)
            put("priceTotal", priceTotal)
            put("streakDays", 0)
            put("accentHex", snap.accentHex)
        }
        tasksArr.put(newTaskJson)
        root.put("tasks", tasksArr)

        val pendingRaw = prefs.getString(KEY_PENDING_ACTIONS, "[]") ?: "[]"
        val pendingArr = try { JSONArray(pendingRaw) } catch (_: Exception) { JSONArray() }
        val createAction = JSONObject().apply {
            put("type", "CREATE_TASK")
            put("taskId", newId)
            put("title", cleanTitle)
            put("dateKey", dateKey)
            put("time", time24.ifBlank { null })
            put("priority", priority)
            put("boardId", boardId)
            put("boardName", boardName)
            put("boardType", boardType)
            put("itemQuantity", qty)
            put("itemPrice", unitPrice)
            put("timestamp", System.currentTimeMillis())
        }
        pendingArr.put(createAction)

        prefs.edit()
            .putString(KEY_SNAPSHOT_JSON, root.toString())
            .putString(KEY_PENDING_ACTIONS, pendingArr.toString())
            .putString(KEY_SELECTED_DATE, dateKey)
            .apply()

        try {
            widgetActionBridgeListener?.invoke(
                mapOf(
                    "type" to "CREATE_TASK",
                    "taskId" to newId
                )
            )
        } catch (_: Exception) {}

        refreshAllWidgets(context)
        return true
    }

    fun recordLaunchAction(context: Context, actionType: String, taskId: String? = null, boardId: String? = null, dateKey: String? = null) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val obj = JSONObject().apply {
            put("actionType", actionType)
            if (!taskId.isNullOrBlank()) put("taskId", taskId)
            if (!boardId.isNullOrBlank()) put("boardId", boardId)
            if (!dateKey.isNullOrBlank()) put("dateKey", dateKey)
            put("timestamp", System.currentTimeMillis())
        }
        prefs.edit().putString(KEY_PENDING_LAUNCH, obj.toString()).apply()

        try {
            widgetActionBridgeListener?.invoke(
                mapOf(
                    "type" to "LAUNCH_ACTION",
                    "actionType" to actionType,
                    "taskId" to taskId,
                    "boardId" to boardId,
                    "dateKey" to dateKey
                )
            )
        } catch (_: Exception) {}
    }

    /**
     * Saves a snapshot received from JS while preserving any unconsumed pending widget actions
     * (CREATE_TASK or TOGGLE_TASK) so an asynchronous JS store sync can never overwrite
     * a task created or toggled on the widget before Redux has ingested it.
     */
    fun saveSnapshotFromJs(context: Context, jsonPayload: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        try {
            val incomingLang = JSONObject(jsonPayload).optString("language", "")
            if (incomingLang.isNotBlank()) {
                TaskTranslations.setSavedLanguage(context, incomingLang)
            }
        } catch (_: Exception) {}

        val pendingRaw = prefs.getString(KEY_PENDING_ACTIONS, "[]") ?: "[]"
        val pendingArr = try { JSONArray(pendingRaw) } catch (_: Exception) { JSONArray() }

        if (pendingArr.length() == 0) {
            prefs.edit().putString(KEY_SNAPSHOT_JSON, jsonPayload).apply()
            return
        }

        try {
            val root = JSONObject(jsonPayload)
            val tasksArr = root.optJSONArray("tasks") ?: JSONArray()
            val existingById = HashMap<String, JSONObject>()
            for (i in 0 until tasksArr.length()) {
                val obj = tasksArr.optJSONObject(i) ?: continue
                val id = obj.optString("id", "")
                if (id.isNotEmpty()) existingById[id] = obj
            }

            // Also inspect current local snapshot for full widget task fields of any pending CREATE_TASK
            val localRaw = prefs.getString(KEY_SNAPSHOT_JSON, null)
            val localById = HashMap<String, JSONObject>()
            if (!localRaw.isNullOrBlank()) {
                try {
                    val localRoot = JSONObject(localRaw)
                    val localArr = localRoot.optJSONArray("tasks") ?: JSONArray()
                    for (i in 0 until localArr.length()) {
                        val obj = localArr.optJSONObject(i) ?: continue
                        val id = obj.optString("id", "")
                        if (id.isNotEmpty()) localById[id] = obj
                    }
                } catch (_: Exception) {}
            }

            for (i in 0 until pendingArr.length()) {
                val act = pendingArr.optJSONObject(i) ?: continue
                val type = act.optString("type", "")
                val tId = act.optString("taskId", "")
                if (tId.isEmpty()) continue

                if (type == "CREATE_TASK") {
                    if (!existingById.containsKey(tId)) {
                        val localTaskObj = localById[tId] ?: JSONObject().apply {
                            put("id", tId)
                            put("title", act.optString("title", "New Task"))
                            put("dateKey", act.optString("dateKey", getTodayDateKey()))
                            put("timeLabel", "")
                            put("sortTimeMinutes", 9999)
                            put("completed", false)
                            put("priority", act.optString("priority", "none"))
                            put("boardId", act.optString("boardId", "main"))
                            put("boardName", act.optString("boardName", "Main"))
                            put("boardType", act.optString("boardType", "standard"))
                            put("badgeText", "")
                            put("metaText", act.optString("boardName", "Main"))
                            put("priceTotal", act.optDouble("itemPrice", 0.0))
                            put("streakDays", 0)
                            put("accentHex", root.optString("accentHex", "#6C5CE7"))
                        }
                        tasksArr.put(localTaskObj)
                        existingById[tId] = localTaskObj
                    }
                } else if (type == "TOGGLE_TASK") {
                    existingById[tId]?.put("completed", act.optBoolean("completed", false))
                }
            }

            // Remove CREATE_TASK / TOGGLE_TASK from pendingArr ONLY once the incoming JS payload
            // has confirmed the task exists (or matches the toggled state) in Redux!
            val remainingPending = JSONArray()
            for (i in 0 until pendingArr.length()) {
                val act = pendingArr.optJSONObject(i) ?: continue
                val type = act.optString("type", "")
                val tId = act.optString("taskId", "")
                if (type == "CREATE_TASK") {
                    // Check if the raw incoming jsonPayload from Redux already had this task
                    val incomingHadTask = try {
                        val rawTasks = JSONObject(jsonPayload).optJSONArray("tasks") ?: JSONArray()
                        var found = false
                        for (j in 0 until rawTasks.length()) {
                            if (rawTasks.optJSONObject(j)?.optString("id") == tId) {
                                found = true
                                break
                            }
                        }
                        found
                    } catch (_: Exception) { false }
                    if (!incomingHadTask) {
                        remainingPending.put(act)
                    }
                } else if (type == "TOGGLE_TASK") {
                    val expectedCompleted = act.optBoolean("completed", false)
                    val incomingMatched = try {
                        val rawTasks = JSONObject(jsonPayload).optJSONArray("tasks") ?: JSONArray()
                        var matched = false
                        for (j in 0 until rawTasks.length()) {
                            val obj = rawTasks.optJSONObject(j)
                            if (obj?.optString("id") == tId && obj.optBoolean("completed") == expectedCompleted) {
                                matched = true
                                break
                            }
                        }
                        matched
                    } catch (_: Exception) { false }
                    if (!incomingMatched) {
                        remainingPending.put(act)
                    }
                }
            }

            root.put("tasks", tasksArr)
            prefs.edit()
                .putString(KEY_SNAPSHOT_JSON, root.toString())
                .putString(KEY_PENDING_ACTIONS, remainingPending.toString())
                .apply()
        } catch (_: Exception) {
            prefs.edit().putString(KEY_SNAPSHOT_JSON, jsonPayload).apply()
        }
    }

    /**
     * Non-destructively reads pending widget actions so they are never lost if JS timers pause
     * or if a background sync races with app hydration. Actions are automatically pruned by
     * saveSnapshotFromJs once Redux confirms the created/toggled task in syncWidgetData,
     * or explicitly via clearPendingWidgetActions().
     */
    fun getAndClearPendingWidgetActions(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_PENDING_ACTIONS, "[]") ?: "[]"
    }

    fun clearPendingWidgetActions(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_PENDING_ACTIONS).apply()
    }

    fun getAndClearPendingLaunchAction(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_PENDING_LAUNCH, null)
        if (raw != null) {
            prefs.edit().remove(KEY_PENDING_LAUNCH).apply()
        }
        return raw
    }

    /**
     * Renders a high-DPI anti-aliased Google Calendar-style Month Grid bitmap
     * with weekday headers, Today accent circle, Selected day outline ring,
     * and multi-color priority/habit indicator dots under each date.
     */
    fun renderMonthCalendarBitmap(
        context: Context,
        snapshot: WidgetSnapshot,
        palette: WidgetThemePalette,
        canvasWidth: Int = 700,
        canvasHeight: Int = 610
    ): MonthGridRenderResult {
        val monthOffset = getMonthOffset(context)
        val selectedDateKey = getSelectedDateKey(context)
        val todayKey = snapshot.todayKey

        val cal = Calendar.getInstance()
        cal.set(Calendar.DAY_OF_MONTH, 1)
        cal.add(Calendar.MONTH, monthOffset)

        val displayYear = cal.get(Calendar.YEAR)
        val displayMonth = cal.get(Calendar.MONTH) // 0..11
        val locale = TaskTranslations.getLocale(snapshot.language)
        val monthFmt = SimpleDateFormat("MMMM yyyy", locale)
        val rawMonthTitle = monthFmt.format(cal.time)
        val monthTitle = rawMonthTitle.replaceFirstChar {
            if (it.isLowerCase()) it.titlecase(locale) else it.toString()
        }
        val monthPrefix = SimpleDateFormat("yyyy-MM", Locale.US).format(cal.time)

        val weekStart = if (snapshot.weekStartDay == 1) Calendar.MONDAY else Calendar.SUNDAY
        val firstDayOfWeek = cal.get(Calendar.DAY_OF_WEEK)
        val leadingOffset = ((firstDayOfWeek - weekStart) + 7) % 7

        val gridCal = cal.clone() as Calendar
        gridCal.add(Calendar.DAY_OF_MONTH, -leadingOffset)

        val dateFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val cellDates = ArrayList<String>(42)
        val cellDays = IntArray(42)
        val cellInMonth = BooleanArray(42)

        for (i in 0 until 42) {
            cellDates.add(dateFmt.format(gridCal.time))
            cellDays[i] = gridCal.get(Calendar.DAY_OF_MONTH)
            cellInMonth[i] = (gridCal.get(Calendar.MONTH) == displayMonth && gridCal.get(Calendar.YEAR) == displayYear)
            gridCal.add(Calendar.DAY_OF_MONTH, 1)
        }

        val tasksByDate = snapshot.tasks.groupBy { it.dateKey }
        val monthTaskCount = snapshot.tasks.count { !it.completed && it.dateKey.startsWith(monthPrefix) }

        val width = canvasWidth.coerceIn(480, 1200)
        val height = canvasHeight.coerceIn(460, 1200)
        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)

        val headerHeight = height * 0.13f
        val gridHeight = height - headerHeight
        val colWidth = width / 7f
        val rowHeight = gridHeight / 6f
        val cellMinSide = minOf(colWidth, rowHeight)
        val circleRadius = (cellMinSide * 0.30f).coerceIn(18f, 28f)

        val dowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.textMuted
            textSize = (cellMinSide * 0.25f).coerceIn(18f, 24f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }

        val dowLabels = TaskTranslations.getWeekdayLabels(snapshot.language, snapshot.weekStartDay)

        for (c in 0 until 7) {
            val cx = c * colWidth + colWidth / 2f
            val cy = headerHeight * 0.66f
            canvas.drawText(dowLabels[c], cx, cy, dowPaint)
        }

        val dayTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = (cellMinSide * 0.29f).coerceIn(20f, 27f)
            textAlign = Paint.Align.CENTER
        }
        val circlePaint = Paint(Paint.ANTI_ALIAS_FLAG)
        val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 3.2f
        }
        val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
        }

        for (i in 0 until 42) {
            val r = i / 7
            val c = i % 7
            val cx = c * colWidth + colWidth / 2f
            val cy = headerHeight + r * rowHeight + rowHeight * 0.42f
            val dKey = cellDates[i]
            val isToday = (dKey == todayKey)
            val isSelected = (dKey == selectedDateKey)
            val inMonth = cellInMonth[i]

            if (isToday) {
                circlePaint.color = palette.accentColor
                canvas.drawCircle(cx, cy, circleRadius, circlePaint)
            } else if (isSelected) {
                circlePaint.color = blendAlpha(palette.accentColor, 0.18f)
                canvas.drawCircle(cx, cy, circleRadius, circlePaint)
                ringPaint.color = palette.accentColor
                canvas.drawCircle(cx, cy, circleRadius, ringPaint)
            }

            if (isToday && isSelected) {
                ringPaint.color = palette.textPrimary
                canvas.drawCircle(cx, cy, circleRadius + 3.5f, ringPaint)
            }

            dayTextPaint.typeface = if (isToday || isSelected) {
                Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            } else {
                Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
            }
            dayTextPaint.color = when {
                isToday -> Color.WHITE
                isSelected -> palette.textPrimary
                inMonth -> palette.textPrimary
                else -> blendAlpha(palette.textMuted, 0.45f)
            }

            val textOffsetY = (dayTextPaint.descent() + dayTextPaint.ascent()) / 2f
            canvas.drawText(cellDays[i].toString(), cx, cy - textOffsetY, dayTextPaint)

            // Draw up to 4 colored task priority/board dots under the day number
            val dayTasks = tasksByDate[dKey]
            if (!dayTasks.isNullOrEmpty()) {
                val sortedDayTasks = dayTasks.sortedBy { it.completed }
                val dotsToShow = sortedDayTasks.take(4)
                val dotRadius = (cellMinSide * 0.045f).coerceIn(3.5f, 4.8f)
                val dotSpacing = dotRadius * 2.8f
                val totalDotsWidth = (dotsToShow.size - 1) * dotSpacing
                val startX = cx - totalDotsWidth / 2f
                val dotY = cy + circleRadius + (rowHeight * 0.16f).coerceIn(10f, 16f)

                for ((dIdx, tItem) in dotsToShow.withIndex()) {
                    dotPaint.color = resolveTaskAccentColor(tItem, palette, todayKey)
                    canvas.drawCircle(startX + dIdx * dotSpacing, dotY, dotRadius, dotPaint)
                }
            }
        }

        return MonthGridRenderResult(
            bitmap = bmp,
            cellDateKeys = cellDates,
            monthTitle = monthTitle,
            monthTaskCount = monthTaskCount
        )
    }

    fun refreshAllWidgets(context: Context) {
        try {
            val mgr = AppWidgetManager.getInstance(context)

            val scheduleComp = ComponentName(context, TaskScheduleWidgetProvider::class.java)
            val scheduleIds = mgr.getAppWidgetIds(scheduleComp)
            if (scheduleIds != null && scheduleIds.isNotEmpty()) {
                mgr.notifyAppWidgetViewDataChanged(scheduleIds, R.id.widget_schedule_list)
                for (id in scheduleIds) {
                    TaskScheduleWidgetProvider.updateScheduleWidget(context, mgr, id)
                }
            }

            val monthComp = ComponentName(context, TaskMonthWidgetProvider::class.java)
            val monthIds = mgr.getAppWidgetIds(monthComp)
            if (monthIds != null && monthIds.isNotEmpty()) {
                for (id in monthIds) {
                    TaskMonthWidgetProvider.updateMonthWidget(context, mgr, id)
                }
            }

            val compactComp = ComponentName(context, TaskCompactWidgetProvider::class.java)
            val compactIds = mgr.getAppWidgetIds(compactComp)
            if (compactIds != null && compactIds.isNotEmpty()) {
                for (id in compactIds) {
                    TaskCompactWidgetProvider.updateCompactWidget(context, mgr, id)
                }
            }
        } catch (_: Exception) {}
    }
}
