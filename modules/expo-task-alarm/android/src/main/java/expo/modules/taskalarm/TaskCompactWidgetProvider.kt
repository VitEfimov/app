package expo.modules.taskalarm

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class TaskCompactWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateCompactWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        private fun immutableFlags(): Int {
            var flags = PendingIntent.FLAG_UPDATE_CURRENT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags = flags or PendingIntent.FLAG_IMMUTABLE
            }
            return flags
        }

        fun updateCompactWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val snapshot = TaskWidgetDataStore.loadSnapshot(context)
            val palette = TaskWidgetDataStore.resolvePalette(context, snapshot)
            val todayKey = snapshot.todayKey

            val views = RemoteViews(context.packageName, R.layout.widget_compact)

            views.setInt(R.id.widget_compact_bg, "setColorFilter", palette.surfaceBg)
            views.setInt(R.id.widget_compact_date_bg, "setColorFilter", palette.accentColor)
            views.setInt(R.id.widget_compact_add_bg, "setColorFilter", palette.accentColor)

            val lang = snapshot.language
            val locale = TaskTranslations.getLocale(lang)
            val now = Date()
            val dowStr = SimpleDateFormat("EEE", locale).format(now).uppercase(locale)
            val dayNumStr = SimpleDateFormat("d", Locale.US).format(now)
            views.setTextViewText(R.id.widget_compact_dow, dowStr)
            views.setTextViewText(R.id.widget_compact_day_num, dayNumStr)

            // Find the single most urgent / next upcoming uncompleted task
            val nextTask = snapshot.tasks
                .filter { !it.completed }
                .sortedWith(
                    compareBy<WidgetTaskItem> {
                        when {
                            it.dateKey.isNotEmpty() && it.dateKey < todayKey -> 0 // Overdue first
                            it.dateKey == todayKey -> 1                           // Today second
                            else -> 2                                             // Future third
                        }
                    }.thenBy { it.dateKey }
                        .thenBy { it.sortTimeMinutes }
                )
                .firstOrNull()

            val totalToday = snapshot.dueTodayCount + snapshot.completedTodayCount
            val progressTag = if (totalToday > 0) {
                "${snapshot.completedTodayCount}/$totalToday ${TaskTranslations.t(context, "done_upper", lang)}"
            } else {
                "0 ${TaskTranslations.t(context, "due_upper", lang)}"
            }
            val streakTag = if (snapshot.bestHabitStreak > 0) {
                " • 🔥 ${snapshot.bestHabitStreak}${TaskTranslations.t(context, "day_short", lang)}"
            } else {
                ""
            }

            if (nextTask != null) {
                val isOverdue = nextTask.dateKey.isNotEmpty() && nextTask.dateKey < todayKey
                val statusPrefix = if (isOverdue) {
                    TaskTranslations.t(context, "overdue_upper", lang)
                } else {
                    TaskTranslations.t(context, "up_next_upper", lang)
                }
                views.setTextViewText(R.id.widget_compact_status_text, "$statusPrefix • $progressTag$streakTag")
                views.setTextColor(
                    R.id.widget_compact_status_text,
                    if (isOverdue) palette.dangerColor else palette.accentColor
                )

                views.setTextViewText(R.id.widget_compact_task_title, nextTask.title)
                views.setTextColor(R.id.widget_compact_task_title, palette.textPrimary)

                val meta = nextTask.metaText.ifBlank {
                    listOfNotNull(
                        nextTask.timeLabel.takeIf { it.isNotBlank() },
                        nextTask.boardName.takeIf { it.isNotBlank() },
                        nextTask.badgeText.takeIf { it.isNotBlank() }
                    ).joinToString(" • ")
                }
                views.setTextViewText(R.id.widget_compact_task_meta, meta)
                views.setTextColor(R.id.widget_compact_task_meta, palette.textSecondary)

                // Show one-tap complete button for the Up Next task
                views.setViewVisibility(R.id.widget_compact_check_btn, View.VISIBLE)
                views.setInt(
                    R.id.widget_compact_check_bg,
                    "setColorFilter",
                    TaskWidgetDataStore.blendAlpha(palette.successColor, 0.24f)
                )
                views.setTextColor(R.id.widget_compact_check_icon, palette.successColor)

                val toggleIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                    action = TaskWidgetActionReceiver.ACTION_WIDGET_TOGGLE_TASK
                    putExtra(TaskWidgetActionReceiver.EXTRA_TASK_ID, nextTask.id)
                }
                views.setOnClickPendingIntent(
                    R.id.widget_compact_check_btn,
                    PendingIntent.getBroadcast(context, 7501, toggleIntent, immutableFlags())
                )

                val openTaskIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                    action = TaskWidgetActionReceiver.ACTION_WIDGET_LAUNCH_APP
                    putExtra(TaskWidgetActionReceiver.EXTRA_LAUNCH_TYPE, "open_task")
                    putExtra(TaskWidgetActionReceiver.EXTRA_TASK_ID, nextTask.id)
                    putExtra(TaskWidgetActionReceiver.EXTRA_BOARD_ID, nextTask.boardId)
                }
                views.setOnClickPendingIntent(
                    R.id.widget_compact_center,
                    PendingIntent.getBroadcast(context, 7502, openTaskIntent, immutableFlags())
                )
            } else {
                views.setTextViewText(
                    R.id.widget_compact_status_text,
                    "${TaskTranslations.t(context, "all_caught_up_upper", lang)} • $progressTag$streakTag"
                )
                views.setTextColor(R.id.widget_compact_status_text, palette.successColor)
                views.setTextViewText(R.id.widget_compact_task_title, TaskTranslations.t(context, "all_caught_up_today", lang))
                views.setTextColor(R.id.widget_compact_task_title, palette.textPrimary)
                views.setTextViewText(R.id.widget_compact_task_meta, TaskTranslations.t(context, "tap_plus_schedule", lang))
                views.setTextColor(R.id.widget_compact_task_meta, palette.textSecondary)
                views.setViewVisibility(R.id.widget_compact_check_btn, View.GONE)

                val openBoardIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                    action = TaskWidgetActionReceiver.ACTION_WIDGET_LAUNCH_APP
                    putExtra(TaskWidgetActionReceiver.EXTRA_LAUNCH_TYPE, "open_board")
                }
                views.setOnClickPendingIntent(
                    R.id.widget_compact_center,
                    PendingIntent.getBroadcast(context, 7502, openBoardIntent, immutableFlags())
                )
            }

            // Left Date Tile -> Open Calendar
            val openCalIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                action = TaskWidgetActionReceiver.ACTION_WIDGET_LAUNCH_APP
                putExtra(TaskWidgetActionReceiver.EXTRA_LAUNCH_TYPE, "open_calendar_date")
                putExtra(TaskWidgetActionReceiver.EXTRA_DATE_KEY, todayKey)
            }
            views.setOnClickPendingIntent(
                R.id.widget_compact_date_tile,
                PendingIntent.getBroadcast(context, 7503, openCalIntent, immutableFlags())
            )

            // Right + Button -> Launch floating WidgetQuickAddActivity right over the Home Screen (without opening main app!)
            val addIntent = Intent(context, WidgetQuickAddActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(TaskWidgetActionReceiver.EXTRA_DATE_KEY, todayKey)
            }
            views.setOnClickPendingIntent(
                R.id.widget_compact_add_btn,
                PendingIntent.getActivity(context, 7504 + appWidgetId, addIntent, immutableFlags())
            )

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
