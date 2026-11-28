package expo.modules.taskalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class TaskWidgetActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_WIDGET_TOGGLE_TASK = "expo.modules.taskalarm.ACTION_WIDGET_TOGGLE_TASK"
        const val ACTION_WIDGET_CYCLE_FILTER = "expo.modules.taskalarm.ACTION_WIDGET_CYCLE_FILTER"
        const val ACTION_WIDGET_MONTH_PREV = "expo.modules.taskalarm.ACTION_WIDGET_MONTH_PREV"
        const val ACTION_WIDGET_MONTH_NEXT = "expo.modules.taskalarm.ACTION_WIDGET_MONTH_NEXT"
        const val ACTION_WIDGET_MONTH_TODAY = "expo.modules.taskalarm.ACTION_WIDGET_MONTH_TODAY"
        const val ACTION_WIDGET_SELECT_DATE = "expo.modules.taskalarm.ACTION_WIDGET_SELECT_DATE"
        const val ACTION_WIDGET_LAUNCH_APP = "expo.modules.taskalarm.ACTION_WIDGET_LAUNCH_APP"

        const val EXTRA_WIDGET_ACTION = "extra_widget_action"
        const val EXTRA_LAUNCH_TYPE = "extra_launch_type"
        const val EXTRA_TASK_ID = "extra_task_id"
        const val EXTRA_BOARD_ID = "extra_board_id"
        const val EXTRA_DATE_KEY = "extra_date_key"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val effectiveAction = intent.getStringExtra(EXTRA_WIDGET_ACTION) ?: intent.action ?: return

        when (effectiveAction) {
            ACTION_WIDGET_TOGGLE_TASK -> {
                val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return
                TaskWidgetDataStore.toggleTaskFromWidget(context, taskId)
            }

            ACTION_WIDGET_CYCLE_FILTER -> {
                TaskWidgetDataStore.cycleScheduleFilter(context)
                TaskWidgetDataStore.refreshAllWidgets(context)
            }

            ACTION_WIDGET_MONTH_PREV -> {
                TaskWidgetDataStore.shiftMonthOffset(context, -1)
                TaskWidgetDataStore.refreshAllWidgets(context)
            }

            ACTION_WIDGET_MONTH_NEXT -> {
                TaskWidgetDataStore.shiftMonthOffset(context, 1)
                TaskWidgetDataStore.refreshAllWidgets(context)
            }

            ACTION_WIDGET_MONTH_TODAY -> {
                TaskWidgetDataStore.shiftMonthOffset(context, 0)
                TaskWidgetDataStore.refreshAllWidgets(context)
            }

            ACTION_WIDGET_SELECT_DATE -> {
                val dateKey = intent.getStringExtra(EXTRA_DATE_KEY) ?: return
                TaskWidgetDataStore.setSelectedDateKey(context, dateKey)
                TaskWidgetDataStore.refreshAllWidgets(context)
            }

            ACTION_WIDGET_LAUNCH_APP -> {
                val launchType = intent.getStringExtra(EXTRA_LAUNCH_TYPE) ?: "open_board"
                val taskId = intent.getStringExtra(EXTRA_TASK_ID)
                val boardId = intent.getStringExtra(EXTRA_BOARD_ID)
                val dateKey = intent.getStringExtra(EXTRA_DATE_KEY)

                TaskWidgetDataStore.recordLaunchAction(context, launchType, taskId, boardId, dateKey)

                try {
                    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                    if (launchIntent != null) {
                        launchIntent.addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK or
                                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                                Intent.FLAG_ACTIVITY_CLEAR_TOP
                        )
                        launchIntent.putExtra("widgetLaunchType", launchType)
                        if (!taskId.isNullOrBlank()) launchIntent.putExtra("widgetTaskId", taskId)
                        if (!boardId.isNullOrBlank()) launchIntent.putExtra("widgetBoardId", boardId)
                        if (!dateKey.isNullOrBlank()) launchIntent.putExtra("widgetDateKey", dateKey)
                        context.startActivity(launchIntent)
                    }
                } catch (_: Exception) {}
            }
        }
    }
}
