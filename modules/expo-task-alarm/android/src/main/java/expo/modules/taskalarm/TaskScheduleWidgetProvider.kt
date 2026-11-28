package expo.modules.taskalarm

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews
import java.util.Locale

class TaskScheduleWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateScheduleWidget(context, appWidgetManager, appWidgetId)
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

        private fun mutableTemplateFlags(): Int {
            var flags = PendingIntent.FLAG_UPDATE_CURRENT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags = flags or PendingIntent.FLAG_MUTABLE
            }
            return flags
        }

        fun updateScheduleWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val snapshot = TaskWidgetDataStore.loadSnapshot(context)
            val palette = TaskWidgetDataStore.resolvePalette(context, snapshot)
            val filter = TaskWidgetDataStore.getScheduleFilter(context)

            val views = RemoteViews(context.packageName, R.layout.widget_schedule)

            // Apply dynamic app theme colors while preserving 24dp/16dp rounded corners
            views.setInt(R.id.widget_schedule_bg, "setColorFilter", palette.surfaceBg)
            views.setInt(R.id.widget_schedule_header_bg, "setColorFilter", palette.headerBg)
            views.setInt(R.id.widget_schedule_filter_bg, "setColorFilter", palette.pillBg)
            views.setInt(R.id.widget_schedule_add_bg, "setColorFilter", palette.accentColor)
            views.setInt(
                R.id.widget_schedule_empty_badge_bg,
                "setColorFilter",
                TaskWidgetDataStore.blendAlpha(palette.successColor, 0.18f)
            )

            // Header typography & summary
            val lang = snapshot.language
            val dayHeader = TaskWidgetDataStore.formatShortHeaderDate(snapshot.todayKey, lang)
            views.setTextViewText(R.id.widget_schedule_day_label, dayHeader)
            views.setTextColor(R.id.widget_schedule_day_label, palette.accentColor)

            val headerTitle = when (filter) {
                "TODAY" -> TaskTranslations.t(context, "todays_focus", lang)
                "LISTS" -> TaskTranslations.t(context, "specialized_lists", lang)
                "HABITS" -> TaskTranslations.t(context, "daily_habits", lang)
                else -> TaskTranslations.t(context, "schedule_and_tasks", lang)
            }
            views.setTextViewText(R.id.widget_schedule_title, headerTitle)
            views.setTextColor(R.id.widget_schedule_title, palette.textPrimary)

            val summaryParts = ArrayList<String>()
            summaryParts.add("${snapshot.dueTodayCount} ${TaskTranslations.t(context, "due_today", lang)}")
            if (snapshot.overdueCount > 0) {
                summaryParts.add("${snapshot.overdueCount} ${TaskTranslations.t(context, "overdue", lang)}")
            } else if (snapshot.completedTodayCount > 0) {
                summaryParts.add("${snapshot.completedTodayCount} ${TaskTranslations.t(context, "done", lang)}")
            }
            if (snapshot.bestHabitStreak > 0) {
                summaryParts.add("🔥 ${snapshot.bestHabitStreak}${TaskTranslations.t(context, "day_short", lang)}")
            }
            views.setTextViewText(R.id.widget_schedule_subtitle, summaryParts.joinToString(" • "))
            views.setTextColor(R.id.widget_schedule_subtitle, palette.textSecondary)

            val filterDisplay = when (filter) {
                "TODAY" -> TaskTranslations.t(context, "filter_today", lang)
                "LISTS" -> TaskTranslations.t(context, "filter_lists", lang)
                "HABITS" -> TaskTranslations.t(context, "filter_habits", lang)
                else -> TaskTranslations.t(context, "filter_all", lang)
            }
            views.setTextViewText(R.id.widget_schedule_filter_text, filterDisplay)
            views.setTextColor(R.id.widget_schedule_filter_text, palette.textPrimary)

            views.setTextViewText(R.id.widget_schedule_empty_title, TaskTranslations.t(context, "all_caught_up", lang))
            views.setTextViewText(R.id.widget_schedule_empty_subtitle, TaskTranslations.t(context, "empty_schedule_sub", lang))
            views.setTextColor(R.id.widget_schedule_empty_title, palette.textPrimary)
            views.setTextColor(R.id.widget_schedule_empty_subtitle, palette.textMuted)

            // 1. Header card, labels & empty state tap -> Open Board view in app
            val openBoardIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                action = TaskWidgetActionReceiver.ACTION_WIDGET_LAUNCH_APP
                putExtra(TaskWidgetActionReceiver.EXTRA_LAUNCH_TYPE, "open_board")
                putExtra(TaskWidgetActionReceiver.EXTRA_DATE_KEY, snapshot.todayKey)
            }
            val openBoardPending = PendingIntent.getBroadcast(context, 7101, openBoardIntent, immutableFlags())
            views.setOnClickPendingIntent(R.id.widget_schedule_header_bg, openBoardPending)
            views.setOnClickPendingIntent(R.id.widget_schedule_header_left, openBoardPending)
            views.setOnClickPendingIntent(R.id.widget_schedule_day_label, openBoardPending)
            views.setOnClickPendingIntent(R.id.widget_schedule_title, openBoardPending)
            views.setOnClickPendingIntent(R.id.widget_schedule_subtitle, openBoardPending)
            views.setOnClickPendingIntent(R.id.widget_schedule_empty, openBoardPending)

            // 2. Filter pill tap -> Cycle filter (All -> Today -> Lists -> Habits)
            val cycleFilterIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                action = TaskWidgetActionReceiver.ACTION_WIDGET_CYCLE_FILTER
            }
            views.setOnClickPendingIntent(
                R.id.widget_schedule_filter_btn,
                PendingIntent.getBroadcast(context, 7102, cycleFilterIntent, immutableFlags())
            )

            // 3. Quick Add + FAB tap -> Launch floating WidgetQuickAddActivity right over the Home Screen (without opening main app!)
            val addTaskIntent = Intent(context, WidgetQuickAddActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(TaskWidgetActionReceiver.EXTRA_DATE_KEY, snapshot.todayKey)
            }
            views.setOnClickPendingIntent(
                R.id.widget_schedule_add_btn,
                PendingIntent.getActivity(context, 7103 + appWidgetId, addTaskIntent, immutableFlags())
            )

            // 4. Bind Scrollable ListView Adapter & PendingIntent Template
            val serviceIntent = Intent(context, TaskWidgetRemoteViewsService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setRemoteAdapter(R.id.widget_schedule_list, serviceIntent)
            views.setEmptyView(R.id.widget_schedule_list, R.id.widget_schedule_empty)

            val listTemplateIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                action = TaskWidgetActionReceiver.ACTION_WIDGET_TOGGLE_TASK
            }
            val listPendingTemplate = PendingIntent.getBroadcast(
                context,
                7104 + appWidgetId,
                listTemplateIntent,
                mutableTemplateFlags()
            )
            views.setPendingIntentTemplate(R.id.widget_schedule_list, listPendingTemplate)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
