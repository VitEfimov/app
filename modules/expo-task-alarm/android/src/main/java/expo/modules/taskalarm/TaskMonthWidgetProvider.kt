package expo.modules.taskalarm

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Paint
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews

class TaskMonthWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateMonthWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        updateMonthWidget(context, appWidgetManager, appWidgetId)
    }

    companion object {
        private val CELL_VIEW_IDS = intArrayOf(
            R.id.mcell_0, R.id.mcell_1, R.id.mcell_2, R.id.mcell_3, R.id.mcell_4, R.id.mcell_5, R.id.mcell_6,
            R.id.mcell_7, R.id.mcell_8, R.id.mcell_9, R.id.mcell_10, R.id.mcell_11, R.id.mcell_12, R.id.mcell_13,
            R.id.mcell_14, R.id.mcell_15, R.id.mcell_16, R.id.mcell_17, R.id.mcell_18, R.id.mcell_19, R.id.mcell_20,
            R.id.mcell_21, R.id.mcell_22, R.id.mcell_23, R.id.mcell_24, R.id.mcell_25, R.id.mcell_26, R.id.mcell_27,
            R.id.mcell_28, R.id.mcell_29, R.id.mcell_30, R.id.mcell_31, R.id.mcell_32, R.id.mcell_33, R.id.mcell_34,
            R.id.mcell_35, R.id.mcell_36, R.id.mcell_37, R.id.mcell_38, R.id.mcell_39, R.id.mcell_40, R.id.mcell_41
        )

        private fun immutableFlags(): Int {
            var flags = PendingIntent.FLAG_UPDATE_CURRENT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags = flags or PendingIntent.FLAG_IMMUTABLE
            }
            return flags
        }

        fun updateMonthWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val snapshot = TaskWidgetDataStore.loadSnapshot(context)
            val palette = TaskWidgetDataStore.resolvePalette(context, snapshot)
            val selectedDateKey = TaskWidgetDataStore.getSelectedDateKey(context)

            val views = RemoteViews(context.packageName, R.layout.widget_month)

            // Theme surfaces
            views.setInt(R.id.widget_month_bg, "setColorFilter", palette.surfaceBg)
            views.setInt(R.id.widget_month_prev_bg, "setColorFilter", palette.pillBg)
            views.setInt(R.id.widget_month_today_bg, "setColorFilter", palette.pillBg)
            views.setInt(R.id.widget_month_next_bg, "setColorFilter", palette.pillBg)
            views.setInt(R.id.widget_month_add_bg, "setColorFilter", palette.accentColor)
            views.setInt(R.id.widget_month_drawer_bg, "setColorFilter", palette.headerBg)

            views.setTextColor(R.id.widget_month_prev_text, palette.textPrimary)
            views.setTextColor(R.id.widget_month_today_text, palette.textPrimary)
            views.setTextColor(R.id.widget_month_next_text, palette.textPrimary)

            // Compute exact canvas aspect ratio from live widget dimensions so circles and numbers are never stretched
            val options = try { appWidgetManager.getAppWidgetOptions(appWidgetId) } catch (_: Exception) { null }
            val minWidthDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) ?: 0
            val maxHeightDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) ?: 0
            val gridWidthDp = if (minWidthDp > 80) (minWidthDp - 24).coerceAtLeast(180) else 300
            val gridHeightDp = if (maxHeightDp > 140) (maxHeightDp - 140).coerceAtLeast(180) else 265
            val canvasWidth = 700
            val canvasHeight = ((canvasWidth.toFloat() * gridHeightDp.toFloat()) / gridWidthDp.toFloat())
                .toInt()
                .coerceIn(500, 820)

            // Render anti-aliased Month Grid Canvas with 1:1 circular proportions
            val gridRender = TaskWidgetDataStore.renderMonthCalendarBitmap(
                context = context,
                snapshot = snapshot,
                palette = palette,
                canvasWidth = canvasWidth,
                canvasHeight = canvasHeight
            )
            views.setImageViewBitmap(R.id.widget_month_canvas, gridRender.bitmap)

            views.setTextViewText(R.id.widget_month_header_title, gridRender.monthTitle)
            views.setTextColor(R.id.widget_month_header_title, palette.textPrimary)

            val subtitleParts = ArrayList<String>()
            subtitleParts.add("${gridRender.monthTaskCount} tasks in month")
            if (snapshot.bestHabitStreak > 0) {
                subtitleParts.add("🔥 ${snapshot.bestHabitStreak}d streak")
            }
            views.setTextViewText(R.id.widget_month_subtitle, subtitleParts.joinToString(" • "))
            views.setTextColor(R.id.widget_month_subtitle, palette.textSecondary)

            // Month navigation button PendingIntents
            val prevIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                action = TaskWidgetActionReceiver.ACTION_WIDGET_MONTH_PREV
            }
            views.setOnClickPendingIntent(
                R.id.widget_month_prev_btn,
                PendingIntent.getBroadcast(context, 7201, prevIntent, immutableFlags())
            )

            val todayIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                action = TaskWidgetActionReceiver.ACTION_WIDGET_MONTH_TODAY
            }
            views.setOnClickPendingIntent(
                R.id.widget_month_today_btn,
                PendingIntent.getBroadcast(context, 7202, todayIntent, immutableFlags())
            )

            val nextIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                action = TaskWidgetActionReceiver.ACTION_WIDGET_MONTH_NEXT
            }
            views.setOnClickPendingIntent(
                R.id.widget_month_next_btn,
                PendingIntent.getBroadcast(context, 7203, nextIntent, immutableFlags())
            )

            // + Button -> Launch floating WidgetQuickAddActivity right over the Home Screen (without opening main app!)
            val addIntent = Intent(context, WidgetQuickAddActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(TaskWidgetActionReceiver.EXTRA_DATE_KEY, selectedDateKey)
            }
            views.setOnClickPendingIntent(
                R.id.widget_month_add_btn,
                PendingIntent.getActivity(context, 7204 + appWidgetId, addIntent, immutableFlags())
            )

            val openCalHeaderIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                action = TaskWidgetActionReceiver.ACTION_WIDGET_LAUNCH_APP
                putExtra(TaskWidgetActionReceiver.EXTRA_LAUNCH_TYPE, "open_calendar_date")
                putExtra(TaskWidgetActionReceiver.EXTRA_DATE_KEY, selectedDateKey)
            }
            val openCalHeaderPending = PendingIntent.getBroadcast(context, 7205, openCalHeaderIntent, immutableFlags())
            views.setOnClickPendingIntent(R.id.widget_month_header_click, openCalHeaderPending)
            views.setOnClickPendingIntent(R.id.widget_month_selected_header, openCalHeaderPending)

            // Wire each of the 42 day cells so tapping any date selects it immediately on the widget
            for (i in 0 until minOf(42, gridRender.cellDateKeys.size)) {
                val cellDate = gridRender.cellDateKeys[i]
                val selectDayIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                    action = TaskWidgetActionReceiver.ACTION_WIDGET_SELECT_DATE
                    putExtra(TaskWidgetActionReceiver.EXTRA_DATE_KEY, cellDate)
                }
                views.setOnClickPendingIntent(
                    CELL_VIEW_IDS[i],
                    PendingIntent.getBroadcast(context, 7300 + i, selectDayIntent, immutableFlags())
                )
            }

            // Populate Bottom Selected-Day Mini Agenda Drawer
            val dayTasks = snapshot.tasks
                .filter { it.dateKey == selectedDateKey }
                .sortedWith(compareBy<WidgetTaskItem> { it.completed }.thenBy { it.sortTimeMinutes })

            val dayLabelPrefix = if (selectedDateKey == snapshot.todayKey) {
                "TODAY • ${TaskWidgetDataStore.formatShortHeaderDate(selectedDateKey)}"
            } else {
                TaskWidgetDataStore.formatShortHeaderDate(selectedDateKey)
            }
            val dueOnDay = dayTasks.count { !it.completed }
            views.setTextViewText(
                R.id.widget_month_selected_title,
                "$dayLabelPrefix • ${if (dueOnDay > 0) "$dueOnDay due" else "${dayTasks.size} tasks"}"
            )
            views.setTextColor(R.id.widget_month_selected_title, palette.accentColor)
            views.setTextColor(R.id.widget_month_open_day_btn, palette.textSecondary)

            if (dayTasks.isEmpty()) {
                views.setViewVisibility(R.id.widget_month_row1, View.GONE)
                views.setViewVisibility(R.id.widget_month_row2, View.GONE)
                views.setViewVisibility(R.id.widget_month_empty_text, View.VISIBLE)
                views.setTextColor(R.id.widget_month_empty_text, palette.textMuted)
            } else {
                views.setViewVisibility(R.id.widget_month_empty_text, View.GONE)
                bindPreviewRow(
                    context = context,
                    views = views,
                    task = dayTasks[0],
                    palette = palette,
                    todayKey = snapshot.todayKey,
                    rowId = R.id.widget_month_row1,
                    dotId = R.id.widget_month_row1_dot,
                    checkId = R.id.widget_month_row1_check,
                    titleId = R.id.widget_month_row1_title,
                    metaId = R.id.widget_month_row1_meta,
                    reqBase = 7400
                )

                if (dayTasks.size >= 2) {
                    bindPreviewRow(
                        context = context,
                        views = views,
                        task = dayTasks[1],
                        palette = palette,
                        todayKey = snapshot.todayKey,
                        rowId = R.id.widget_month_row2,
                        dotId = R.id.widget_month_row2_dot,
                        checkId = R.id.widget_month_row2_check,
                        titleId = R.id.widget_month_row2_title,
                        metaId = R.id.widget_month_row2_meta,
                        reqBase = 7410
                    )
                } else {
                    views.setViewVisibility(R.id.widget_month_row2, View.GONE)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun bindPreviewRow(
            context: Context,
            views: RemoteViews,
            task: WidgetTaskItem,
            palette: WidgetThemePalette,
            todayKey: String,
            rowId: Int,
            dotId: Int,
            checkId: Int,
            titleId: Int,
            metaId: Int,
            reqBase: Int
        ) {
            views.setViewVisibility(rowId, View.VISIBLE)
            val accent = TaskWidgetDataStore.resolveTaskAccentColor(task, palette, todayKey)
            views.setInt(dotId, "setColorFilter", accent)
            views.setTextViewText(checkId, if (task.completed) "✓" else "◯")
            views.setTextColor(checkId, if (task.completed) palette.successColor else accent)

            views.setTextViewText(titleId, task.title)
            if (task.completed) {
                views.setTextColor(titleId, palette.textMuted)
                views.setInt(titleId, "setPaintFlags", Paint.STRIKE_THRU_TEXT_FLAG or Paint.ANTI_ALIAS_FLAG)
            } else {
                views.setTextColor(titleId, palette.textPrimary)
                views.setInt(titleId, "setPaintFlags", Paint.ANTI_ALIAS_FLAG)
            }

            val meta = task.badgeText.ifBlank { task.timeLabel.ifBlank { task.boardName } }
            views.setTextViewText(metaId, meta)
            views.setTextColor(metaId, palette.textSecondary)

            // 1. Tapping the checkbox (`◯` / `✓`) or left bar toggles completion directly on the widget without opening the app!
            val toggleIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                action = TaskWidgetActionReceiver.ACTION_WIDGET_TOGGLE_TASK
                putExtra(TaskWidgetActionReceiver.EXTRA_TASK_ID, task.id)
            }
            val togglePending = PendingIntent.getBroadcast(context, reqBase + 1, toggleIntent, immutableFlags())
            views.setOnClickPendingIntent(checkId, togglePending)
            views.setOnClickPendingIntent(dotId, togglePending)

            // 2. Tapping the task title or meta opens the app to that task / day!
            val openTaskIntent = Intent(context, TaskWidgetActionReceiver::class.java).apply {
                action = TaskWidgetActionReceiver.ACTION_WIDGET_LAUNCH_APP
                putExtra(TaskWidgetActionReceiver.EXTRA_LAUNCH_TYPE, "open_task")
                putExtra(TaskWidgetActionReceiver.EXTRA_TASK_ID, task.id)
                putExtra(TaskWidgetActionReceiver.EXTRA_BOARD_ID, task.boardId)
                putExtra(TaskWidgetActionReceiver.EXTRA_DATE_KEY, task.dateKey)
            }
            val openTaskPending = PendingIntent.getBroadcast(context, reqBase + 2, openTaskIntent, immutableFlags())
            views.setOnClickPendingIntent(titleId, openTaskPending)
            views.setOnClickPendingIntent(metaId, openTaskPending)
        }
    }
}
