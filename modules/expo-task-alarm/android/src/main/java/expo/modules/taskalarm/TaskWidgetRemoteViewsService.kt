package expo.modules.taskalarm

import android.content.Context
import android.content.Intent
import android.graphics.Paint
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService

class TaskWidgetRemoteViewsService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return TaskScheduleRemoteViewsFactory(applicationContext)
    }
}

class TaskScheduleRemoteViewsFactory(
    private val context: Context
) : RemoteViewsService.RemoteViewsFactory {

    private var rows: List<WidgetListRow> = emptyList()
    private var snapshot: WidgetSnapshot = TaskWidgetDataStore.loadSnapshot(context)
    private var palette: WidgetThemePalette = TaskWidgetDataStore.resolvePalette(context, snapshot)

    override fun onCreate() {
        reloadRows()
    }

    override fun onDataSetChanged() {
        reloadRows()
    }

    private fun reloadRows() {
        snapshot = TaskWidgetDataStore.loadSnapshot(context)
        palette = TaskWidgetDataStore.resolvePalette(context, snapshot)
        rows = TaskWidgetDataStore.buildScheduleRows(context, snapshot, palette)
    }

    override fun onDestroy() {
        rows = emptyList()
    }

    override fun getCount(): Int = rows.size

    override fun getViewTypeCount(): Int = 2

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = false

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewAt(position: Int): RemoteViews? {
        if (position < 0 || position >= rows.size) return null
        val row = rows[position]

        return when (row) {
            is WidgetListRow.SectionHeader -> {
                val rv = RemoteViews(context.packageName, R.layout.widget_schedule_section_item)
                rv.setInt(R.id.widget_section_dot, "setColorFilter", row.dotColor)
                rv.setTextViewText(R.id.widget_section_title, row.title)
                rv.setTextColor(R.id.widget_section_title, row.textColor)
                rv.setTextViewText(R.id.widget_section_right, row.rightSummary)
                rv.setTextColor(R.id.widget_section_right, palette.textMuted)
                rv
            }

            is WidgetListRow.TaskCard -> {
                val task = row.task
                val rv = RemoteViews(context.packageName, R.layout.widget_schedule_task_item)
                val accentColor = TaskWidgetDataStore.resolveTaskAccentColor(task, palette, snapshot.todayKey)

                rv.setInt(R.id.widget_task_card_bg, "setColorFilter", palette.cardBg)
                rv.setInt(R.id.widget_task_accent_bar, "setColorFilter", accentColor)

                // Checkbox visual state
                if (task.completed) {
                    rv.setViewVisibility(R.id.widget_task_check_ring, View.GONE)
                    rv.setViewVisibility(R.id.widget_task_check_fill, View.VISIBLE)
                    rv.setViewVisibility(R.id.widget_task_check_mark, View.VISIBLE)
                    rv.setInt(R.id.widget_task_check_fill, "setColorFilter", palette.successColor)
                } else {
                    rv.setViewVisibility(R.id.widget_task_check_ring, View.VISIBLE)
                    rv.setViewVisibility(R.id.widget_task_check_fill, View.GONE)
                    rv.setViewVisibility(R.id.widget_task_check_mark, View.GONE)
                    rv.setInt(R.id.widget_task_check_ring, "setColorFilter", accentColor)
                }

                // Task title with strikethrough when completed
                rv.setTextViewText(R.id.widget_task_title, task.title)
                if (task.completed) {
                    rv.setTextColor(R.id.widget_task_title, palette.textMuted)
                    rv.setInt(
                        R.id.widget_task_title,
                        "setPaintFlags",
                        Paint.STRIKE_THRU_TEXT_FLAG or Paint.ANTI_ALIAS_FLAG
                    )
                } else {
                    rv.setTextColor(R.id.widget_task_title, palette.textPrimary)
                    rv.setInt(R.id.widget_task_title, "setPaintFlags", Paint.ANTI_ALIAS_FLAG)
                }

                // Right pill badge (Time, Price, Habit Streak, or Priority)
                val badge = task.badgeText.ifBlank { task.timeLabel }
                if (badge.isNotBlank()) {
                    rv.setViewVisibility(R.id.widget_task_badge_wrap, View.VISIBLE)
                    rv.setTextViewText(R.id.widget_task_badge_text, badge)
                    rv.setInt(
                        R.id.widget_task_badge_bg,
                        "setColorFilter",
                        TaskWidgetDataStore.blendAlpha(accentColor, 0.22f)
                    )
                    rv.setTextColor(R.id.widget_task_badge_text, accentColor)
                } else {
                    rv.setViewVisibility(R.id.widget_task_badge_wrap, View.GONE)
                }

                // Subtitle metadata
                val meta = task.metaText.ifBlank { task.boardName }
                rv.setTextViewText(R.id.widget_task_meta, meta)
                rv.setTextColor(R.id.widget_task_meta, palette.textSecondary)

                // Fill-in intent 1: Tapping the checkbox toggles completion directly on the widget without opening the app!
                val toggleFillIn = Intent().apply {
                    data = android.net.Uri.parse("taskcalendar://widget/toggle/${task.id}")
                    putExtra(TaskWidgetActionReceiver.EXTRA_WIDGET_ACTION, TaskWidgetActionReceiver.ACTION_WIDGET_TOGGLE_TASK)
                    putExtra(TaskWidgetActionReceiver.EXTRA_TASK_ID, task.id)
                }
                rv.setOnClickFillInIntent(R.id.widget_task_check_btn, toggleFillIn)

                // Fill-in intent 2: Tapping the task title/body opens the task in the app!
                val openFillIn = Intent().apply {
                    data = android.net.Uri.parse("taskcalendar://widget/open/${task.id}")
                    putExtra(TaskWidgetActionReceiver.EXTRA_WIDGET_ACTION, TaskWidgetActionReceiver.ACTION_WIDGET_LAUNCH_APP)
                    putExtra(TaskWidgetActionReceiver.EXTRA_LAUNCH_TYPE, "open_task")
                    putExtra(TaskWidgetActionReceiver.EXTRA_TASK_ID, task.id)
                    putExtra(TaskWidgetActionReceiver.EXTRA_BOARD_ID, task.boardId)
                    putExtra(TaskWidgetActionReceiver.EXTRA_DATE_KEY, task.dateKey)
                }
                rv.setOnClickFillInIntent(R.id.widget_task_body, openFillIn)

                rv
            }
        }
    }
}
