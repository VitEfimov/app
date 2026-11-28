package expo.modules.taskalarm

import android.content.Context
import java.util.Locale

/**
 * Multi-language localization provider for native Android Home Screen Widgets,
 * WidgetQuickAddActivity, TaskAlarmReceiver, AlarmActivity, AlarmActionReceiver,
 * and PomodoroAlarmReceiver across all 10 supported languages:
 * en, ru, es, zh, ja, fr, de, it, hi, ko.
 */
object TaskTranslations {
    const val KEY_APP_LANGUAGE = "appLanguage"
    val SUPPORTED_LANGS = setOf("en", "ru", "es", "zh", "ja", "fr", "de", "it", "hi", "ko")

    fun normalizeLangCode(raw: String?): String {
        if (raw.isNullOrBlank()) return "en"
        val base = raw.trim().lowercase(Locale.US).split("-", "_").firstOrNull() ?: "en"
        return if (SUPPORTED_LANGS.contains(base)) base else "en"
    }

    fun getSavedLanguage(context: Context): String {
        return try {
            val widgetPrefs = context.getSharedPreferences(TaskWidgetDataStore.PREFS_NAME, Context.MODE_PRIVATE)
            val savedWidgetLang = widgetPrefs.getString(KEY_APP_LANGUAGE, null)
            if (!savedWidgetLang.isNullOrBlank()) {
                return normalizeLangCode(savedWidgetLang)
            }
            val themePrefs = context.getSharedPreferences("taskflow_theme", Context.MODE_PRIVATE)
            val savedThemeLang = themePrefs.getString(KEY_APP_LANGUAGE, null)
            if (!savedThemeLang.isNullOrBlank()) {
                return normalizeLangCode(savedThemeLang)
            }
            normalizeLangCode(Locale.getDefault().language)
        } catch (_: Exception) {
            "en"
        }
    }

    fun setSavedLanguage(context: Context, langCode: String) {
        val clean = normalizeLangCode(langCode)
        try {
            context.getSharedPreferences(TaskWidgetDataStore.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_APP_LANGUAGE, clean)
                .apply()
            context.getSharedPreferences("taskflow_theme", Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_APP_LANGUAGE, clean)
                .apply()
        } catch (_: Exception) {}
    }

    fun getLocale(langCode: String?): Locale {
        return when (normalizeLangCode(langCode)) {
            "ru" -> Locale("ru", "RU")
            "es" -> Locale("es", "ES")
            "zh" -> Locale.SIMPLIFIED_CHINESE
            "ja" -> Locale.JAPANESE
            "fr" -> Locale.FRENCH
            "de" -> Locale.GERMAN
            "it" -> Locale.ITALIAN
            "hi" -> Locale("hi", "IN")
            "ko" -> Locale.KOREAN
            else -> Locale.US
        }
    }

    fun getWeekdayLabels(langCode: String?, weekStartDay: Int): Array<String> {
        val sunFirst = when (normalizeLangCode(langCode)) {
            "ru" -> arrayOf("Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб")
            "es" -> arrayOf("D", "L", "M", "X", "J", "V", "S")
            "zh" -> arrayOf("日", "一", "二", "三", "四", "五", "六")
            "ja" -> arrayOf("日", "月", "火", "水", "木", "金", "土")
            "fr" -> arrayOf("D", "L", "M", "M", "J", "V", "S")
            "de" -> arrayOf("S", "M", "D", "M", "D", "F", "S")
            "it" -> arrayOf("D", "L", "M", "M", "G", "V", "S")
            "hi" -> arrayOf("र", "सो", "मं", "बु", "गु", "शु", "श")
            "ko" -> arrayOf("일", "월", "화", "수", "목", "금", "토")
            else -> arrayOf("S", "M", "T", "W", "T", "F", "S")
        }
        return if (weekStartDay == 1) {
            arrayOf(sunFirst[1], sunFirst[2], sunFirst[3], sunFirst[4], sunFirst[5], sunFirst[6], sunFirst[0])
        } else {
            sunFirst
        }
    }

    fun t(context: Context, key: String, langOverride: String? = null): String {
        val lang = if (!langOverride.isNullOrBlank()) normalizeLangCode(langOverride) else getSavedLanguage(context)
        return tLang(lang, key)
    }

    fun tLang(langCode: String, key: String): String {
        val lang = normalizeLangCode(langCode)
        val table = DICT[lang] ?: DICT["en"]!!
        return table[key] ?: DICT["en"]?.get(key) ?: key
    }

    /**
     * Regex matching both English and localized "(15 min before)" suffixes on task notifications
     * so native Android TaskAlarmReceiver can clean up prior "before" reminders when the exact alarm fires.
     */
    val BEFORE_SUFFIX_REGEX = Regex(
        """\s*\((?:\d+\s*(?:min|minute|mins|minutes|hr|hour|hrs|hours|h|std|stunde|stunden|ora|ore|мин|минут|минуты|час|часа|часов|дн|день|дня|дней|días|día|jours|jour|tag|tage|tagen|giorno|giorni|मिनट|घंटे|घंटा|दिन|분|시간|일|分|分間|時間|日|分钟|小时|天)\s*(?:before|antes|avant|vorher|prima|до|पहले|전|前)|(?:за|提前)\s*\d+\s*(?:мин|минут|минуты|ч|час|часа|часов|дн|день|дня|дней|分钟|小时|天))\)\s*$""",
        RegexOption.IGNORE_CASE
    )

    private val EN = mapOf(
        // Schedule Widget
        "schedule_and_tasks" to "Schedule & Tasks",
        "todays_focus" to "Today's Focus",
        "specialized_lists" to "Specialized Lists",
        "daily_habits" to "Daily Habits",
        "filter_all" to "All ▾",
        "filter_today" to "Today ▾",
        "filter_lists" to "Lists ▾",
        "filter_habits" to "Habits ▾",
        "all_caught_up" to "All caught up!",
        "empty_schedule_sub" to "Tap + to add a task or tap filter to switch views.",

        // Section Headers & Summaries
        "overdue_upper" to "OVERDUE",
        "today_upper" to "TODAY",
        "tomorrow_upper" to "TOMORROW",
        "completed_today_upper" to "COMPLETED TODAY",
        "daily_habits_upper" to "DAILY HABITS",
        "due_today" to "due today",
        "due" to "due",
        "overdue" to "overdue",
        "done" to "done",
        "all_done" to "All done",
        "scheduled" to "scheduled",
        "left" to "left",
        "packed" to "packed",
        "items" to "items",
        "today_lower" to "today",
        "day_short" to "d",
        "streak" to "streak",
        "list_default" to "List",
        "all_tasks" to "All Tasks",
        "tasks_default" to "Tasks",
        "untitled_task" to "Untitled Task",

        // Month Widget
        "today_btn" to "Today",
        "tasks_in_month" to "tasks in month",
        "tasks_count" to "tasks",
        "open_day" to "Open Day ›",
        "no_tasks_for_day" to "No tasks for this day • Tap + to schedule one",

        // Compact Widget
        "up_next_upper" to "UP NEXT",
        "done_upper" to "DONE",
        "due_upper" to "DUE",
        "all_caught_up_upper" to "ALL CAUGHT UP",
        "all_caught_up_today" to "All caught up for today!",
        "tap_plus_schedule" to "Tap + to schedule a new task",

        // Starter Example Tasks
        "example_task_1" to "Tap circle to complete task on widget",
        "example_task_2" to "Tap + to add a task without opening app",
        "example_meta_1" to "Example Task",
        "example_meta_2" to "Quick Add",

        // Floating Quick Add Dialog
        "quick_add_header" to "Quick Add to TaskCalendar",
        "quick_add_hint" to "Task name (or 'Milk ×2 $4.50')...",
        "add_time_chip" to "+ Time",
        "priority_normal" to "Normal",
        "priority_low" to "Low",
        "priority_medium" to "Medium",
        "priority_high" to "High",
        "priority_high_upper" to "HIGH",
        "board_main" to "Main",
        "board_groceries" to "Groceries",
        "board_habits" to "Habits",
        "cancel" to "Cancel",
        "add_task_btn" to "+ Add Task",
        "enter_task_name_error" to "Enter a task name",

        // Alarms & Notifications
        "task_alarm" to "Task Alarm",
        "task_reminder" to "Task Reminder",
        "snooze" to "Snooze",
        "stop" to "Stop",
        "dismiss" to "Dismiss",
        "complete" to "Complete",
        "channel_task_alarms" to "Task alarms",
        "channel_task_alarms_desc" to "Urgent task alarms with sound and vibration",
        "channel_car_silent" to "Car / Driving notifications",
        "channel_car_silent_desc" to "Silent notifications when connected to Car",
        "channel_persistent" to "Persistent Reminders",
        "channel_persistent_desc" to "Silent all-day reminders for tasks",
        "pomodoro" to "Pomodoro",
        "session_complete" to "Session Complete"
    )

    private val RU = mapOf(
        "schedule_and_tasks" to "Расписание и задачи",
        "todays_focus" to "Фокус на сегодня",
        "specialized_lists" to "Спец. списки",
        "daily_habits" to "Привычки",
        "filter_all" to "Все ▾",
        "filter_today" to "Сегодня ▾",
        "filter_lists" to "Списки ▾",
        "filter_habits" to "Привычки ▾",
        "all_caught_up" to "Всё выполнено!",
        "empty_schedule_sub" to "Нажмите +, чтобы добавить задачу, или фильтр для смены вида.",

        "overdue_upper" to "ПРОСРОЧЕНО",
        "today_upper" to "СЕГОДНЯ",
        "tomorrow_upper" to "ЗАВТРА",
        "completed_today_upper" to "ВЫПОЛНЕНО СЕГОДНЯ",
        "daily_habits_upper" to "ЕЖЕДНЕВНЫЕ ПРИВЫЧКИ",
        "due_today" to "на сегодня",
        "due" to "к выполнению",
        "overdue" to "просрочено",
        "done" to "готово",
        "all_done" to "Всё готово",
        "scheduled" to "запланировано",
        "left" to "осталось",
        "packed" to "собрано",
        "items" to "пунктов",
        "today_lower" to "сегодня",
        "day_short" to "дн",
        "streak" to "серия",
        "list_default" to "Список",
        "all_tasks" to "Все задачи",
        "tasks_default" to "Задачи",
        "untitled_task" to "Задача без названия",

        "today_btn" to "Сегодня",
        "tasks_in_month" to "задач в месяце",
        "tasks_count" to "задач",
        "open_day" to "Открыть день ›",
        "no_tasks_for_day" to "Нет задач на этот день • Нажмите +, чтобы добавить",

        "up_next_upper" to "ДАЛЕЕ",
        "done_upper" to "ГОТОВО",
        "due_upper" to "НА СЕГОДНЯ",
        "all_caught_up_upper" to "ВСЁ ВЫПОЛНЕНО",
        "all_caught_up_today" to "На сегодня всё выполнено!",
        "tap_plus_schedule" to "Нажмите +, чтобы добавить задачу",

        "example_task_1" to "Нажмите на кружок, чтобы завершить задачу",
        "example_task_2" to "Нажмите +, чтобы добавить задачу без входа",
        "example_meta_1" to "Пример задачи",
        "example_meta_2" to "Быстрое добавление",

        "quick_add_header" to "Быстрое добавление в TaskCalendar",
        "quick_add_hint" to "Название задачи (напр. «Молоко ×2 $4.50»)...",
        "add_time_chip" to "+ Время",
        "priority_normal" to "Обычный",
        "priority_low" to "Низкий",
        "priority_medium" to "Средний",
        "priority_high" to "Высокий",
        "priority_high_upper" to "ВЫСОКИЙ",
        "board_main" to "Главная",
        "board_groceries" to "Покупки",
        "board_habits" to "Привычки",
        "cancel" to "Отмена",
        "add_task_btn" to "+ Добавить",
        "enter_task_name_error" to "Введите название задачи",

        "task_alarm" to "Будильник задачи",
        "task_reminder" to "Напоминание о задаче",
        "snooze" to "Отложить",
        "stop" to "Стоп",
        "dismiss" to "Закрыть",
        "complete" to "Завершить",
        "channel_task_alarms" to "Будильники задач",
        "channel_task_alarms_desc" to "Важные будильники задач со звуком и вибрацией",
        "channel_car_silent" to "Уведомления в автомобиле",
        "channel_car_silent_desc" to "Тихие уведомления при подключении к автомобилю",
        "channel_persistent" to "Постоянные напоминания",
        "channel_persistent_desc" to "Тихие напоминания на весь день",
        "pomodoro" to "Помодоро",
        "session_complete" to "Сеанс завершен"
    )

    private val ES = mapOf(
        "schedule_and_tasks" to "Agenda y tareas",
        "todays_focus" to "Enfoque de hoy",
        "specialized_lists" to "Listas especiales",
        "daily_habits" to "Hábitos diarios",
        "filter_all" to "Todo ▾",
        "filter_today" to "Hoy ▾",
        "filter_lists" to "Listas ▾",
        "filter_habits" to "Hábitos ▾",
        "all_caught_up" to "¡Todo al día!",
        "empty_schedule_sub" to "Toca + para añadir una tarea o el filtro para cambiar de vista.",

        "overdue_upper" to "VENCIDAS",
        "today_upper" to "HOY",
        "tomorrow_upper" to "MAÑANA",
        "completed_today_upper" to "COMPLETADAS HOY",
        "daily_habits_upper" to "HÁBITOS DIARIOS",
        "due_today" to "para hoy",
        "due" to "pendientes",
        "overdue" to "vencidas",
        "done" to "hechas",
        "all_done" to "Todo listo",
        "scheduled" to "programadas",
        "left" to "restantes",
        "packed" to "empacados",
        "items" to "elementos",
        "today_lower" to "hoy",
        "day_short" to "d",
        "streak" to "racha",
        "list_default" to "Lista",
        "all_tasks" to "Todas las tareas",
        "tasks_default" to "Tareas",
        "untitled_task" to "Tarea sin título",

        "today_btn" to "Hoy",
        "tasks_in_month" to "tareas en el mes",
        "tasks_count" to "tareas",
        "open_day" to "Abrir día ›",
        "no_tasks_for_day" to "Sin tareas para este día • Toca + para programar",

        "up_next_upper" to "SIGUIENTE",
        "done_upper" to "HECHO",
        "due_upper" to "PENDIENTES",
        "all_caught_up_upper" to "TODO AL DÍA",
        "all_caught_up_today" to "¡Todo al día por hoy!",
        "tap_plus_schedule" to "Toca + para programar una nueva tarea",

        "example_task_1" to "Toca el círculo para completar la tarea",
        "example_task_2" to "Toca + para añadir tarea sin abrir la app",
        "example_meta_1" to "Tarea de ejemplo",
        "example_meta_2" to "Añadir rápido",

        "quick_add_header" to "Añadir rápido a TaskCalendar",
        "quick_add_hint" to "Nombre de la tarea (o 'Leche ×2 $4.50')...",
        "add_time_chip" to "+ Hora",
        "priority_normal" to "Normal",
        "priority_low" to "Baja",
        "priority_medium" to "Media",
        "priority_high" to "Alta",
        "priority_high_upper" to "ALTA",
        "board_main" to "Principal",
        "board_groceries" to "Compras",
        "board_habits" to "Hábitos",
        "cancel" to "Cancelar",
        "add_task_btn" to "+ Añadir tarea",
        "enter_task_name_error" to "Introduce un nombre de tarea",

        "task_alarm" to "Alarma de tarea",
        "task_reminder" to "Recordatorio de tarea",
        "snooze" to "Posponer",
        "stop" to "Detener",
        "dismiss" to "Descartar",
        "complete" to "Completar",
        "channel_task_alarms" to "Alarmas de tareas",
        "channel_task_alarms_desc" to "Alarmas urgentes de tareas con sonido y vibración",
        "channel_car_silent" to "Notificaciones en automóvil",
        "channel_car_silent_desc" to "Notificaciones silenciosas al conectarse al coche",
        "channel_persistent" to "Recordatorios persistentes",
        "channel_persistent_desc" to "Recordatorios silenciosos durante todo el día",
        "pomodoro" to "Pomodoro",
        "session_complete" to "Sesión completada"
    )

    private val ZH = mapOf(
        "schedule_and_tasks" to "日程与任务",
        "todays_focus" to "今日重点",
        "specialized_lists" to "专属清单",
        "daily_habits" to "每日习惯",
        "filter_all" to "全部 ▾",
        "filter_today" to "今天 ▾",
        "filter_lists" to "清单 ▾",
        "filter_habits" to "习惯 ▾",
        "all_caught_up" to "全部完成！",
        "empty_schedule_sub" to "点击 + 添加任务，或点击筛选切换视图。",

        "overdue_upper" to "已逾期",
        "today_upper" to "今天",
        "tomorrow_upper" to "明天",
        "completed_today_upper" to "今日已完成",
        "daily_habits_upper" to "每日习惯",
        "due_today" to "今日待办",
        "due" to "待办",
        "overdue" to "已逾期",
        "done" to "已完成",
        "all_done" to "全部完成",
        "scheduled" to "已安排",
        "left" to "剩余",
        "packed" to "已打包",
        "items" to "项",
        "today_lower" to "今天",
        "day_short" to "天",
        "streak" to "连胜",
        "list_default" to "清单",
        "all_tasks" to "所有任务",
        "tasks_default" to "任务",
        "untitled_task" to "未命名任务",

        "today_btn" to "今天",
        "tasks_in_month" to "项本月任务",
        "tasks_count" to "项任务",
        "open_day" to "打开当天 ›",
        "no_tasks_for_day" to "当天暂无任务 • 点击 + 添加任务",

        "up_next_upper" to "接下来",
        "done_upper" to "已完成",
        "due_upper" to "待办",
        "all_caught_up_upper" to "全部完成",
        "all_caught_up_today" to "今天的任务已全部完成！",
        "tap_plus_schedule" to "点击 + 安排新任务",

        "example_task_1" to "点击圆圈在小组件上直接完成任务",
        "example_task_2" to "点击 + 无需打开应用即可添加任务",
        "example_meta_1" to "示例任务",
        "example_meta_2" to "快速添加",

        "quick_add_header" to "快速添加到 TaskCalendar",
        "quick_add_hint" to "任务名称（如“牛奶 ×2 $4.50”）...",
        "add_time_chip" to "+ 时间",
        "priority_normal" to "普通",
        "priority_low" to "低",
        "priority_medium" to "中",
        "priority_high" to "高",
        "priority_high_upper" to "高",
        "board_main" to "主看板",
        "board_groceries" to "采购",
        "board_habits" to "习惯",
        "cancel" to "取消",
        "add_task_btn" to "+ 添加任务",
        "enter_task_name_error" to "请输入任务名称",

        "task_alarm" to "任务闹钟",
        "task_reminder" to "任务提醒",
        "snooze" to "稍后提醒",
        "stop" to "停止",
        "dismiss" to "关闭",
        "complete" to "完成",
        "channel_task_alarms" to "任务闹钟",
        "channel_task_alarms_desc" to "带声音和振动的紧急任务闹钟",
        "channel_car_silent" to "车载 / 驾驶模式通知",
        "channel_car_silent_desc" to "连接到车载模式时的静音通知",
        "channel_persistent" to "全天常驻提醒",
        "channel_persistent_desc" to "无声全天任务常驻提醒",
        "pomodoro" to "番茄钟",
        "session_complete" to "专注时段结束"
    )

    private val JA = mapOf(
        "schedule_and_tasks" to "予定とタスク",
        "todays_focus" to "今日のフォーカス",
        "specialized_lists" to "専用リスト",
        "daily_habits" to "毎日の習慣",
        "filter_all" to "すべて ▾",
        "filter_today" to "今日 ▾",
        "filter_lists" to "リスト ▾",
        "filter_habits" to "習慣 ▾",
        "all_caught_up" to "すべて完了！",
        "empty_schedule_sub" to "+ をタップしてタスクを追加、またはフィルターで表示を切替。",

        "overdue_upper" to "期限切れ",
        "today_upper" to "今日",
        "tomorrow_upper" to "明日",
        "completed_today_upper" to "今日完了",
        "daily_habits_upper" to "毎日の習慣",
        "due_today" to "今日期限",
        "due" to "未完了",
        "overdue" to "期限切れ",
        "done" to "完了",
        "all_done" to "すべて完了",
        "scheduled" to "予定",
        "left" to "残り",
        "packed" to "準備完了",
        "items" to "項目",
        "today_lower" to "今日",
        "day_short" to "日",
        "streak" to "連続",
        "list_default" to "リスト",
        "all_tasks" to "すべてのタスク",
        "tasks_default" to "タスク",
        "untitled_task" to "無題のタスク",

        "today_btn" to "今日",
        "tasks_in_month" to "件の月間タスク",
        "tasks_count" to "件のタスク",
        "open_day" to "日を開く ›",
        "no_tasks_for_day" to "この日の予定はありません • + で追加",

        "up_next_upper" to "次の予定",
        "done_upper" to "完了",
        "due_upper" to "未完了",
        "all_caught_up_upper" to "すべて完了",
        "all_caught_up_today" to "今日のタスクはすべて完了です！",
        "tap_plus_schedule" to "+ をタップして新しいタスクを追加",

        "example_task_1" to "丸をタップしてウィジェット上で完了",
        "example_task_2" to "+ をタップしてアプリを開かずに追加",
        "example_meta_1" to "サンプルタスク",
        "example_meta_2" to "クイック追加",

        "quick_add_header" to "TaskCalendar にクイック追加",
        "quick_add_hint" to "タスク名（例: 牛乳 ×2 $4.50）...",
        "add_time_chip" to "+ 時間",
        "priority_normal" to "通常",
        "priority_low" to "低",
        "priority_medium" to "中",
        "priority_high" to "高",
        "priority_high_upper" to "高",
        "board_main" to "メイン",
        "board_groceries" to "買い物",
        "board_habits" to "習慣",
        "cancel" to "キャンセル",
        "add_task_btn" to "+ タスク追加",
        "enter_task_name_error" to "タスク名を入力してください",

        "task_alarm" to "タスクアラーム",
        "task_reminder" to "タスクリマインダー",
        "snooze" to "スヌーズ",
        "stop" to "停止",
        "dismiss" to "閉じる",
        "complete" to "完了",
        "channel_task_alarms" to "タスクアラーム",
        "channel_task_alarms_desc" to "サウンドとバイブレーション付きの重要なタスクアラーム",
        "channel_car_silent" to "車 / ドライブモード通知",
        "channel_car_silent_desc" to "車載モード接続時のサイレント通知",
        "channel_persistent" to "常駐リマインダー",
        "channel_persistent_desc" to "終日表示されるサイレントリマインダー",
        "pomodoro" to "ポモドーロ",
        "session_complete" to "セッション完了"
    )

    private val FR = mapOf(
        "schedule_and_tasks" to "Planning et tâches",
        "todays_focus" to "Priorités du jour",
        "specialized_lists" to "Listes spécialisées",
        "daily_habits" to "Habitudes",
        "filter_all" to "Tout ▾",
        "filter_today" to "Auj. ▾",
        "filter_lists" to "Listes ▾",
        "filter_habits" to "Habitudes ▾",
        "all_caught_up" to "Tout est à jour !",
        "empty_schedule_sub" to "Appuyez sur + pour ajouter une tâche ou sur le filtre.",

        "overdue_upper" to "EN RETARD",
        "today_upper" to "AUJOURD'HUI",
        "tomorrow_upper" to "DEMAIN",
        "completed_today_upper" to "TERMINÉES AUJOURD'HUI",
        "daily_habits_upper" to "HABITUDES QUOTIDIENNES",
        "due_today" to "pour aujourd'hui",
        "due" to "à faire",
        "overdue" to "en retard",
        "done" to "terminées",
        "all_done" to "Tout est fait",
        "scheduled" to "prévues",
        "left" to "restants",
        "packed" to "emballés",
        "items" to "éléments",
        "today_lower" to "aujourd'hui",
        "day_short" to "j",
        "streak" to "série",
        "list_default" to "Liste",
        "all_tasks" to "Toutes les tâches",
        "tasks_default" to "Tâches",
        "untitled_task" to "Tâche sans titre",

        "today_btn" to "Auj.",
        "tasks_in_month" to "tâches ce mois",
        "tasks_count" to "tâches",
        "open_day" to "Ouvrir ›",
        "no_tasks_for_day" to "Aucune tâche ce jour • Appuyez sur + pour planifier",

        "up_next_upper" to "À SUIVRE",
        "done_upper" to "FAIT",
        "due_upper" to "À FAIRE",
        "all_caught_up_upper" to "TOUT EST FAIT",
        "all_caught_up_today" to "Tout est fait pour aujourd'hui !",
        "tap_plus_schedule" to "Appuyez sur + pour planifier une tâche",

        "example_task_1" to "Appuyez sur le cercle pour terminer la tâche",
        "example_task_2" to "Appuyez sur + pour ajouter sans ouvrir l'appli",
        "example_meta_1" to "Tâche exemple",
        "example_meta_2" to "Ajout rapide",

        "quick_add_header" to "Ajout rapide à TaskCalendar",
        "quick_add_hint" to "Nom de la tâche (ou 'Lait ×2 $4.50')...",
        "add_time_chip" to "+ Heure",
        "priority_normal" to "Normal",
        "priority_low" to "Basse",
        "priority_medium" to "Moyenne",
        "priority_high" to "Haute",
        "priority_high_upper" to "HAUTE",
        "board_main" to "Principal",
        "board_groceries" to "Courses",
        "board_habits" to "Habitudes",
        "cancel" to "Annuler",
        "add_task_btn" to "+ Ajouter",
        "enter_task_name_error" to "Entrez un nom de tâche",

        "task_alarm" to "Alarme de tâche",
        "task_reminder" to "Rappel de tâche",
        "snooze" to "Reporter",
        "stop" to "Arrêter",
        "dismiss" to "Fermer",
        "complete" to "Terminer",
        "channel_task_alarms" to "Alarmes de tâches",
        "channel_task_alarms_desc" to "Alarmes de tâches urgentes avec son et vibration",
        "channel_car_silent" to "Notifications voiture / conduite",
        "channel_car_silent_desc" to "Notifications silencieuses en mode voiture",
        "channel_persistent" to "Rappels persistants",
        "channel_persistent_desc" to "Rappels silencieux toute la journée",
        "pomodoro" to "Pomodoro",
        "session_complete" to "Session terminée"
    )

    private val DE = mapOf(
        "schedule_and_tasks" to "Zeitplan & Aufgaben",
        "todays_focus" to "Fokus heute",
        "specialized_lists" to "Speziallisten",
        "daily_habits" to "Tägliche Gewohnheiten",
        "filter_all" to "Alle ▾",
        "filter_today" to "Heute ▾",
        "filter_lists" to "Listen ▾",
        "filter_habits" to "Gewohn. ▾",
        "all_caught_up" to "Alles erledigt!",
        "empty_schedule_sub" to "Tippe auf + für eine neue Aufgabe oder auf den Filter.",

        "overdue_upper" to "ÜBERFÄLLIG",
        "today_upper" to "HEUTE",
        "tomorrow_upper" to "MORGEN",
        "completed_today_upper" to "HEUTE ERLEDIGT",
        "daily_habits_upper" to "TÄGLICHE GEWOHNHEITEN",
        "due_today" to "heute fällig",
        "due" to "fällig",
        "overdue" to "überfällig",
        "done" to "erledigt",
        "all_done" to "Alles erledigt",
        "scheduled" to "geplant",
        "left" to "übrig",
        "packed" to "gepackt",
        "items" to "Einträge",
        "today_lower" to "heute",
        "day_short" to "T",
        "streak" to "Serie",
        "list_default" to "Liste",
        "all_tasks" to "Alle Aufgaben",
        "tasks_default" to "Aufgaben",
        "untitled_task" to "Unbenannte Aufgabe",

        "today_btn" to "Heute",
        "tasks_in_month" to "Aufgaben im Monat",
        "tasks_count" to "Aufgaben",
        "open_day" to "Tag öffnen ›",
        "no_tasks_for_day" to "Keine Aufgaben an diesem Tag • + zum Planen",

        "up_next_upper" to "ALS NÄCHSTES",
        "done_upper" to "ERLEDIGT",
        "due_upper" to "FÄLLIG",
        "all_caught_up_upper" to "ALLES ERLEDIGT",
        "all_caught_up_today" to "Für heute ist alles erledigt!",
        "tap_plus_schedule" to "Tippe auf +, um eine neue Aufgabe zu planen",

        "example_task_1" to "Tippe auf den Kreis, um die Aufgabe abzuhaken",
        "example_task_2" to "Tippe auf +, um direkt eine Aufgabe zu erstellen",
        "example_meta_1" to "Beispielaufgabe",
        "example_meta_2" to "Schnell hinzufügen",

        "quick_add_header" to "Schnell zu TaskCalendar hinzufügen",
        "quick_add_hint" to "Aufgabenname (oder 'Milch ×2 $4.50')...",
        "add_time_chip" to "+ Uhrzeit",
        "priority_normal" to "Normal",
        "priority_low" to "Niedrig",
        "priority_medium" to "Mittel",
        "priority_high" to "Hoch",
        "priority_high_upper" to "HOCH",
        "board_main" to "Hauptboard",
        "board_groceries" to "Einkäufe",
        "board_habits" to "Gewohnheiten",
        "cancel" to "Abbrechen",
        "add_task_btn" to "+ Aufgabe",
        "enter_task_name_error" to "Bitte Aufgabennamen eingeben",

        "task_alarm" to "Aufgaben-Alarm",
        "task_reminder" to "Aufgaben-Erinnerung",
        "snooze" to "Schlummern",
        "stop" to "Stopp",
        "dismiss" to "Schließen",
        "complete" to "Erledigen",
        "channel_task_alarms" to "Aufgaben-Alarme",
        "channel_task_alarms_desc" to "Dringende Aufgaben-Alarme mit Ton und Vibration",
        "channel_car_silent" to "Auto- / Fahrmodus-Benachrichtigungen",
        "channel_car_silent_desc" to "Lautlose Benachrichtigungen im Auto",
        "channel_persistent" to "Dauerhafte Erinnerungen",
        "channel_persistent_desc" to "Lautlose Ganztages-Erinnerungen",
        "pomodoro" to "Pomodoro",
        "session_complete" to "Sitzung abgeschlossen"
    )

    private val IT = mapOf(
        "schedule_and_tasks" to "Programma e attività",
        "todays_focus" to "Focus di oggi",
        "specialized_lists" to "Liste speciali",
        "daily_habits" to "Abitudini giornaliere",
        "filter_all" to "Tutto ▾",
        "filter_today" to "Oggi ▾",
        "filter_lists" to "Liste ▾",
        "filter_habits" to "Abitudini ▾",
        "all_caught_up" to "Tutto completato!",
        "empty_schedule_sub" to "Tocca + per aggiungere un'attività o il filtro per cambiare vista.",

        "overdue_upper" to "SCADUTE",
        "today_upper" to "OGGI",
        "tomorrow_upper" to "DOMANI",
        "completed_today_upper" to "COMPLETATE OGGI",
        "daily_habits_upper" to "ABITUDINI GIORNALIERE",
        "due_today" to "per oggi",
        "due" to "in scadenza",
        "overdue" to "scadute",
        "done" to "fatte",
        "all_done" to "Tutto fatto",
        "scheduled" to "in programma",
        "left" to "rimasti",
        "packed" to "in valigia",
        "items" to "elementi",
        "today_lower" to "oggi",
        "day_short" to "g",
        "streak" to "serie",
        "list_default" to "Lista",
        "all_tasks" to "Tutte le attività",
        "tasks_default" to "Attività",
        "untitled_task" to "Attività senza titolo",

        "today_btn" to "Oggi",
        "tasks_in_month" to "attività nel mese",
        "tasks_count" to "attività",
        "open_day" to "Apri giorno ›",
        "no_tasks_for_day" to "Nessuna attività per oggi • Tocca + per pianificare",

        "up_next_upper" to "PROSSIMA",
        "done_upper" to "FATTE",
        "due_upper" to "DA FARE",
        "all_caught_up_upper" to "TUTTO FATTO",
        "all_caught_up_today" to "Tutto fatto per oggi!",
        "tap_plus_schedule" to "Tocca + per pianificare una nuova attività",

        "example_task_1" to "Tocca il cerchio per completare l'attività",
        "example_task_2" to "Tocca + per aggiungere senza aprire l'app",
        "example_meta_1" to "Attività di esempio",
        "example_meta_2" to "Aggiunta rapida",

        "quick_add_header" to "Aggiunta rapida a TaskCalendar",
        "quick_add_hint" to "Nome attività (o 'Latte ×2 $4.50')...",
        "add_time_chip" to "+ Ora",
        "priority_normal" to "Normale",
        "priority_low" to "Bassa",
        "priority_medium" to "Media",
        "priority_high" to "Alta",
        "priority_high_upper" to "ALTA",
        "board_main" to "Principale",
        "board_groceries" to "Spesa",
        "board_habits" to "Abitudini",
        "cancel" to "Annulla",
        "add_task_btn" to "+ Aggiungi",
        "enter_task_name_error" to "Inserisci il nome dell'attività",

        "task_alarm" to "Sveglia attività",
        "task_reminder" to "Promemoria attività",
        "snooze" to "Posponi",
        "stop" to "Ferma",
        "dismiss" to "Chiudi",
        "complete" to "Completa",
        "channel_task_alarms" to "Sveglie attività",
        "channel_task_alarms_desc" to "Sveglie urgenti per le attività con suono e vibrazione",
        "channel_car_silent" to "Notifiche auto / guida",
        "channel_car_silent_desc" to "Notifiche silenziose in modalità auto",
        "channel_persistent" to "Promemoria persistenti",
        "channel_persistent_desc" to "Promemoria silenziosi per tutto il giorno",
        "pomodoro" to "Pomodoro",
        "session_complete" to "Sessione completata"
    )

    private val HI = mapOf(
        "schedule_and_tasks" to "शेड्यूल और कार्य",
        "todays_focus" to "आज का फ़ोकस",
        "specialized_lists" to "विशेष सूचियाँ",
        "daily_habits" to "दैनिक आदतें",
        "filter_all" to "सभी ▾",
        "filter_today" to "आज ▾",
        "filter_lists" to "सूचियाँ ▾",
        "filter_habits" to "आदतें ▾",
        "all_caught_up" to "सब पूरा हो गया!",
        "empty_schedule_sub" to "नया कार्य जोड़ने के लिए + टैप करें या फ़िल्टर बदलें।",

        "overdue_upper" to "अतिदेय",
        "today_upper" to "आज",
        "tomorrow_upper" to "कल",
        "completed_today_upper" to "आज पूर्ण",
        "daily_habits_upper" to "दैनिक आदतें",
        "due_today" to "आज देय",
        "due" to "देय",
        "overdue" to "अतिदेय",
        "done" to "पूर्ण",
        "all_done" to "सब पूरा",
        "scheduled" to "निर्धारित",
        "left" to "शेष",
        "packed" to "पैक",
        "items" to "आइटम",
        "today_lower" to "आज",
        "day_short" to "दि",
        "streak" to "लगातार",
        "list_default" to "सूची",
        "all_tasks" to "सभी कार्य",
        "tasks_default" to "कार्य",
        "untitled_task" to "शीर्षकहीन कार्य",

        "today_btn" to "आज",
        "tasks_in_month" to "महीने में कार्य",
        "tasks_count" to "कार्य",
        "open_day" to "दिन खोलें ›",
        "no_tasks_for_day" to "इस दिन कोई कार्य नहीं • + दबाकर जोड़ें",

        "up_next_upper" to "अगला",
        "done_upper" to "पूर्ण",
        "due_upper" to "देय",
        "all_caught_up_upper" to "सब पूरा",
        "all_caught_up_today" to "आज के सभी कार्य पूरे हो गए!",
        "tap_plus_schedule" to "नया कार्य जोड़ने के लिए + टैप करें",

        "example_task_1" to "विजेट पर कार्य पूरा करने के लिए गोले पर टैप करें",
        "example_task_2" to "ऐप खोले बिना कार्य जोड़ने के लिए + टैप करें",
        "example_meta_1" to "उदाहरण कार्य",
        "example_meta_2" to "त्वरित जोड़ें",

        "quick_add_header" to "TaskCalendar में त्वरित जोड़ें",
        "quick_add_hint" to "कार्य का नाम (जैसे 'दूध ×2 $4.50')...",
        "add_time_chip" to "+ समय",
        "priority_normal" to "सामान्य",
        "priority_low" to "कम",
        "priority_medium" to "मध्यम",
        "priority_high" to "उच्च",
        "priority_high_upper" to "उच्च",
        "board_main" to "मुख्य",
        "board_groceries" to "खरीदारी",
        "board_habits" to "आदतें",
        "cancel" to "रद्द करें",
        "add_task_btn" to "+ कार्य जोड़ें",
        "enter_task_name_error" to "कार्य का नाम दर्ज करें",

        "task_alarm" to "कार्य अलार्म",
        "task_reminder" to "कार्य रिमाइंडर",
        "snooze" to "स्नूज़",
        "stop" to "रोकें",
        "dismiss" to "खारिज करें",
        "complete" to "पूर्ण करें",
        "channel_task_alarms" to "कार्य अलार्म",
        "channel_task_alarms_desc" to "ध्वनि और कंपन के साथ अत्यावश्यक कार्य अलार्म",
        "channel_car_silent" to "कार / ड्राइविंग सूचनाएं",
        "channel_car_silent_desc" to "कार से जुड़े होने पर साइलेंट सूचनाएं",
        "channel_persistent" to "स्थायी रिमाइंडर",
        "channel_persistent_desc" to "पूरे दिन के लिए साइलेंट रिमाइंडर",
        "pomodoro" to "पोमोडोरो",
        "session_complete" to "सत्र पूर्ण"
    )

    private val KO = mapOf(
        "schedule_and_tasks" to "일정 및 할 일",
        "todays_focus" to "오늘의 집중",
        "specialized_lists" to "전용 목록",
        "daily_habits" to "매일 습관",
        "filter_all" to "전체 ▾",
        "filter_today" to "오늘 ▾",
        "filter_lists" to "목록 ▾",
        "filter_habits" to "습관 ▾",
        "all_caught_up" to "모두 완료!",
        "empty_schedule_sub" to "+를 눌러 할 일을 추가하거나 필터를 눌러 보기를 전환하세요.",

        "overdue_upper" to "기한 지남",
        "today_upper" to "오늘",
        "tomorrow_upper" to "내일",
        "completed_today_upper" to "오늘 완료됨",
        "daily_habits_upper" to "매일 습관",
        "due_today" to "오늘 마감",
        "due" to "남음",
        "overdue" to "기한 지남",
        "done" to "완료",
        "all_done" to "모두 완료",
        "scheduled" to "예정됨",
        "left" to "남음",
        "packed" to "챙김",
        "items" to "항목",
        "today_lower" to "오늘",
        "day_short" to "일",
        "streak" to "연속",
        "list_default" to "목록",
        "all_tasks" to "모든 할 일",
        "tasks_default" to "할 일",
        "untitled_task" to "제목 없는 할 일",

        "today_btn" to "오늘",
        "tasks_in_month" to "개 월간 할 일",
        "tasks_count" to "개 할 일",
        "open_day" to "날짜 열기 ›",
        "no_tasks_for_day" to "이 날의 할 일이 없습니다 • +를 눌러 추가",

        "up_next_upper" to "다음 할 일",
        "done_upper" to "완료",
        "due_upper" to "남음",
        "all_caught_up_upper" to "모두 완료",
        "all_caught_up_today" to "오늘 할 일을 모두 마쳤습니다!",
        "tap_plus_schedule" to "+를 눌러 새 할 일을 추가하세요",

        "example_task_1" to "원을 눌러 위젯에서 바로 완료 체크",
        "example_task_2" to "+를 눌러 앱을 열지 않고 할 일 추가",
        "example_meta_1" to "예시 할 일",
        "example_meta_2" to "빠른 추가",

        "quick_add_header" to "TaskCalendar에 빠른 추가",
        "quick_add_hint" to "할 일 이름 (예: '우유 ×2 $4.50')...",
        "add_time_chip" to "+ 시간",
        "priority_normal" to "보통",
        "priority_low" to "낮음",
        "priority_medium" to "중간",
        "priority_high" to "높음",
        "priority_high_upper" to "높음",
        "board_main" to "메인",
        "board_groceries" to "장보기",
        "board_habits" to "습관",
        "cancel" to "취소",
        "add_task_btn" to "+ 할 일 추가",
        "enter_task_name_error" to "할 일 이름을 입력하세요",

        "task_alarm" to "할 일 알람",
        "task_reminder" to "할 일 알림",
        "snooze" to "다시 알림",
        "stop" to "중지",
        "dismiss" to "닫기",
        "complete" to "완료",
        "channel_task_alarms" to "할 일 알람",
        "channel_task_alarms_desc" to "소리와 진동이 울리는 긴급 할 일 알람",
        "channel_car_silent" to "차량 / 운전 모드 알림",
        "channel_car_silent_desc" to "차량 연결 시 무음 알림",
        "channel_persistent" to "상시 고정 알림",
        "channel_persistent_desc" to "하루 종일 표시되는 무음 알림",
        "pomodoro" to "뽀모도로",
        "session_complete" to "세션 완료"
    )

    private val DICT: Map<String, Map<String, String>> = mapOf(
        "en" to EN,
        "ru" to RU,
        "es" to ES,
        "zh" to ZH,
        "ja" to JA,
        "fr" to FR,
        "de" to DE,
        "it" to IT,
        "hi" to HI,
        "ko" to KO
    )
}
