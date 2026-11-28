import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, ToastAndroid } from 'react-native';
import { scheduleExactAlarm, cancelAlarm, schedulePomodoroAlarm, cancelPomodoroAlarm, isCarConnected, setSavedAndroidAutoMute, duckAudioForNotification, setSavedAppLanguage } from '../../modules/expo-task-alarm';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { DevLogger } from './logger';

dayjs.extend(isSameOrBefore);

export const NOTIFICATION_TRANSLATIONS = {
  en: {
    'Complete': 'Complete',
    'Snooze': 'Snooze',
    'Stop': 'Stop',
    'Dismiss': 'Dismiss',
    'Task Reminder': 'Task Reminder',
    'Task Alarm': 'Task Alarm',
    'Task Snoozed': 'Task Snoozed',
    'URGENT': 'URGENT',
    'OVERDUE': 'OVERDUE',
    'overdue': 'overdue',
    '{{taskName}} is due now': '{{taskName}} is due now',
    "Snoozed '{{taskName}}' for {{count}} minute(s)": "Snoozed '{{taskName}}' for {{count}} minute(s)",
    '5 min before': '5 min before',
    '10 min before': '10 min before',
    '15 min before': '15 min before',
    '30 min before': '30 min before',
    '1 hr before': '1 hr before',
    '2 hr before': '2 hr before',
    '1 day before': '1 day before',
    '3 days before': '3 days before',
    '1 week before': '1 week before',
    'Calendar notifications': 'Calendar notifications',
    'Reminders and notifications for calendar events and scheduled tasks': 'Reminders and notifications for calendar events and scheduled tasks',
    'Task reminders': 'Task reminders',
    'Standard task reminder notifications': 'Standard task reminder notifications',
    'Car / Driving notifications': 'Car / Driving notifications',
    'Silent notifications when connected to Android Auto or Car mode': 'Silent notifications when connected to Android Auto or Car mode',
    'Task alarms': 'Task alarms',
    'Urgent task alarms with sound and vibration': 'Urgent task alarms with sound and vibration',
    'Silent all-day reminders': 'Silent all-day reminders',
    'Persistent reminders without sound': 'Persistent reminders without sound',
    'Pomodoro Work Alarm': 'Pomodoro Work Alarm',
    'Pomodoro Break Alarm': 'Pomodoro Break Alarm',
    'Pomodoro timer completion alarm': 'Pomodoro timer completion alarm',
    'Work session complete!': 'Work session complete!',
    'Take a short break.': 'Take a short break.',
    'Break time is over!': 'Break time is over!',
    'Time to get back to work.': 'Time to get back to work.',
    'Good Morning!': 'Good Morning!',
    'Daily Summary': 'Daily Summary',
    'Evening Review': 'Evening Review',
    'You have no tasks due today. Have a great day!': 'You have no tasks due today. Have a great day!',
    'You have {{count}} task(s) for today': 'You have {{count}} task(s) for today',
    'You have no tasks due today, but {{count}} overdue task(s) waiting.': 'You have no tasks due today, but {{count}} overdue task(s) waiting.',
    'All tasks are on track! You have no overdue tasks.': 'All tasks are on track! You have no overdue tasks.',
    'You have {{count}} overdue task(s) waiting.': 'You have {{count}} overdue task(s) waiting.',
    'All caught up for today! Have a relaxing evening.': 'All caught up for today! Have a relaxing evening.',
    'Wrap up {{count}} unfinished task(s) before the day ends.': 'Wrap up {{count}} unfinished task(s) before the day ends.',
    '...and {{count}} more': '...and {{count}} more',
  },
  ru: {
    'Complete': 'Завершить',
    'Snooze': 'Отложить',
    'Stop': 'Стоп',
    'Dismiss': 'Закрыть',
    'Task Reminder': 'Напоминание о задаче',
    'Task Alarm': 'Будильник задачи',
    'Task Snoozed': 'Задача отложена',
    'URGENT': 'СРОЧНО',
    'OVERDUE': 'ПРОСРОЧЕНО',
    'overdue': 'просрочено',
    '{{taskName}} is due now': 'Срок выполнения: {{taskName}}',
    "Snoozed '{{taskName}}' for {{count}} minute(s)": "Задача «{{taskName}}» отложена на {{count}} мин.",
    '5 min before': 'За 5 мин',
    '10 min before': 'За 10 мин',
    '15 min before': 'За 15 мин',
    '30 min before': 'За 30 мин',
    '1 hr before': 'За 1 час',
    '2 hr before': 'За 2 часа',
    '1 day before': 'За 1 день',
    '3 days before': 'За 3 дня',
    '1 week before': 'За 1 неделю',
    'Calendar notifications': 'Уведомления календаря',
    'Reminders and notifications for calendar events and scheduled tasks': 'Напоминания и уведомления о событиях календаря и запланированных задачах',
    'Task reminders': 'Напоминания о задачах',
    'Standard task reminder notifications': 'Стандартные уведомления-напоминания о задачах',
    'Car / Driving notifications': 'Уведомления в автомобиле',
    'Silent notifications when connected to Android Auto or Car mode': 'Тихие уведомления при подключении к Android Auto или автомобилю',
    'Task alarms': 'Будильники задач',
    'Urgent task alarms with sound and vibration': 'Важные будильники задач со звуком и вибрацией',
    'Silent all-day reminders': 'Тихие напоминания на весь день',
    'Persistent reminders without sound': 'Постоянные напоминания без звука',
    'Pomodoro Work Alarm': 'Таймер работы Помодоро',
    'Pomodoro Break Alarm': 'Таймер перерыва Помодоро',
    'Pomodoro timer completion alarm': 'Сигнал завершения таймера Помодоро',
    'Work session complete!': 'Рабочая сессия завершена!',
    'Take a short break.': 'Сделайте небольшой перерыв.',
    'Break time is over!': 'Перерыв окончен!',
    'Time to get back to work.': 'Пора возвращаться к работе.',
    'Good Morning!': 'Доброе утро!',
    'Daily Summary': 'Ежедневная сводка',
    'Evening Review': 'Вечерний обзор',
    'You have no tasks due today. Have a great day!': 'На сегодня задач нет. Отличного дня!',
    'You have {{count}} task(s) for today': 'Задач на сегодня: {{count}}',
    'You have no tasks due today, but {{count}} overdue task(s) waiting.': 'На сегодня задач нет, но ожидают просроченные задачи: {{count}}.',
    'All tasks are on track! You have no overdue tasks.': 'Все задачи идут по плану! Просроченных задач нет.',
    'You have {{count}} overdue task(s) waiting.': 'Ожидают просроченные задачи: {{count}}.',
    'All caught up for today! Have a relaxing evening.': 'Все дела на сегодня выполнены! Приятного вечера.',
    'Wrap up {{count}} unfinished task(s) before the day ends.': 'Завершите оставшиеся задачи ({{count}}) до конца дня.',
    '...and {{count}} more': '...и ещё {{count}}',
  },
  es: {
    'Complete': 'Completar',
    'Snooze': 'Posponer',
    'Stop': 'Detener',
    'Dismiss': 'Descartar',
    'Task Reminder': 'Recordatorio de tarea',
    'Task Alarm': 'Alarma de tarea',
    'Task Snoozed': 'Tarea pospuesta',
    'URGENT': 'URGENTE',
    'OVERDUE': 'VENCIDA',
    'overdue': 'vencidas',
    '{{taskName}} is due now': '{{taskName}} vence ahora',
    "Snoozed '{{taskName}}' for {{count}} minute(s)": "'{{taskName}}' pospuesta por {{count}} minuto(s)",
    '5 min before': '5 min antes',
    '10 min before': '10 min antes',
    '15 min before': '15 min antes',
    '30 min before': '30 min antes',
    '1 hr before': '1 h antes',
    '2 hr before': '2 h antes',
    '1 day before': '1 día antes',
    '3 days before': '3 días antes',
    '1 week before': '1 semana antes',
    'Calendar notifications': 'Notificaciones del calendario',
    'Reminders and notifications for calendar events and scheduled tasks': 'Recordatorios y notificaciones para eventos del calendario y tareas programadas',
    'Task reminders': 'Recordatorios de tareas',
    'Standard task reminder notifications': 'Notificaciones estándar de recordatorio de tareas',
    'Car / Driving notifications': 'Notificaciones en automóvil',
    'Silent notifications when connected to Android Auto or Car mode': 'Notificaciones silenciosas al conectarse a Android Auto o modo coche',
    'Task alarms': 'Alarmas de tareas',
    'Urgent task alarms with sound and vibration': 'Alarmas urgentes de tareas con sonido y vibración',
    'Silent all-day reminders': 'Recordatorios silenciosos todo el día',
    'Persistent reminders without sound': 'Recordatorios persistentes sin sonido',
    'Pomodoro Work Alarm': 'Alarma de trabajo Pomodoro',
    'Pomodoro Break Alarm': 'Alarma de descanso Pomodoro',
    'Pomodoro timer completion alarm': 'Alarma de finalización del temporizador Pomodoro',
    'Work session complete!': '¡Sesión de trabajo completada!',
    'Take a short break.': 'Tómate un breve descanso.',
    'Break time is over!': '¡Terminó el descanso!',
    'Time to get back to work.': 'Es hora de volver al trabajo.',
    'Good Morning!': '¡Buenos días!',
    'Daily Summary': 'Resumen diario',
    'Evening Review': 'Revisión nocturna',
    'You have no tasks due today. Have a great day!': 'No tienes tareas para hoy. ¡Que tengas un gran día!',
    'You have {{count}} task(s) for today': 'Tienes {{count}} tarea(s) para hoy',
    'You have no tasks due today, but {{count}} overdue task(s) waiting.': 'No tienes tareas para hoy, pero hay {{count}} tarea(s) vencida(s) pendiente(s).',
    'All tasks are on track! You have no overdue tasks.': '¡Todas las tareas están al día! No tienes tareas vencidas.',
    'You have {{count}} overdue task(s) waiting.': 'Tienes {{count}} tarea(s) vencida(s) pendiente(s).',
    'All caught up for today! Have a relaxing evening.': '¡Todo listo por hoy! Que tengas una noche relajante.',
    'Wrap up {{count}} unfinished task(s) before the day ends.': 'Completa {{count}} tarea(s) pendiente(s) antes de que termine el día.',
    '...and {{count}} more': '...y {{count}} más',
  },
  zh: {
    'Complete': '完成',
    'Snooze': '稍后提醒',
    'Stop': '停止',
    'Dismiss': '关闭',
    'Task Reminder': '任务提醒',
    'Task Alarm': '任务闹钟',
    'Task Snoozed': '任务已延后',
    'URGENT': '紧急',
    'OVERDUE': '已逾期',
    'overdue': '逾期',
    '{{taskName}} is due now': '{{taskName}} 现已到期',
    "Snoozed '{{taskName}}' for {{count}} minute(s)": '已将“{{taskName}}”延后 {{count}} 分钟',
    '5 min before': '提前 5 分钟',
    '10 min before': '提前 10 分钟',
    '15 min before': '提前 15 分钟',
    '30 min before': '提前 30 分钟',
    '1 hr before': '提前 1 小时',
    '2 hr before': '提前 2 小时',
    '1 day before': '提前 1 天',
    '3 days before': '提前 3 天',
    '1 week before': '提前 1 周',
    'Calendar notifications': '日历通知',
    'Reminders and notifications for calendar events and scheduled tasks': '日历事件与计划任务的提醒和通知',
    'Task reminders': '任务提醒',
    'Standard task reminder notifications': '标准任务提醒通知',
    'Car / Driving notifications': '车载 / 驾驶模式通知',
    'Silent notifications when connected to Android Auto or Car mode': '连接到 Android Auto 或车载模式时的静音通知',
    'Task alarms': '任务闹钟',
    'Urgent task alarms with sound and vibration': '带声音和振动的紧急任务闹钟',
    'Silent all-day reminders': '全天静音提醒',
    'Persistent reminders without sound': '无声常驻提醒',
    'Pomodoro Work Alarm': '番茄钟工作闹钟',
    'Pomodoro Break Alarm': '番茄钟休息闹钟',
    'Pomodoro timer completion alarm': '番茄钟计时结束闹钟',
    'Work session complete!': '工作时段已完成！',
    'Take a short break.': '休息一下吧。',
    'Break time is over!': '休息时间结束！',
    'Time to get back to work.': '该回到工作状态了。',
    'Good Morning!': '早上好！',
    'Daily Summary': '每日摘要',
    'Evening Review': '晚间回顾',
    'You have no tasks due today. Have a great day!': '今天没有到期任务，祝您度过愉快的一天！',
    'You have {{count}} task(s) for today': '您今天有 {{count}} 项任务',
    'You have no tasks due today, but {{count}} overdue task(s) waiting.': '今天没有到期任务，但有 {{count}} 项逾期任务待处理。',
    'All tasks are on track! You have no overdue tasks.': '所有任务均按计划进行！没有逾期任务。',
    'You have {{count}} overdue task(s) waiting.': '您有 {{count}} 项逾期任务待处理。',
    'All caught up for today! Have a relaxing evening.': '今天的任务全部完成！祝您度过轻松的夜晚。',
    'Wrap up {{count}} unfinished task(s) before the day ends.': '在今天结束前完成剩余的 {{count}} 项未完成任务。',
    '...and {{count}} more': '...以及另外 {{count}} 项',
  },
  ja: {
    'Complete': '完了',
    'Snooze': 'スヌーズ',
    'Stop': '停止',
    'Dismiss': '閉じる',
    'Task Reminder': 'タスクリマインダー',
    'Task Alarm': 'タスクアラーム',
    'Task Snoozed': 'タスクをスヌーズしました',
    'URGENT': '緊急',
    'OVERDUE': '期限切れ',
    'overdue': '期限切れ',
    '{{taskName}} is due now': '{{taskName}} の時間です',
    "Snoozed '{{taskName}}' for {{count}} minute(s)": '「{{taskName}}」を{{count}}分間スヌーズしました',
    '5 min before': '5分前',
    '10 min before': '10分前',
    '15 min before': '15分前',
    '30 min before': '30分前',
    '1 hr before': '1時間前',
    '2 hr before': '2時間前',
    '1 day before': '1日前',
    '3 days before': '3日前',
    '1 week before': '1週間前',
    'Calendar notifications': 'カレンダー通知',
    'Reminders and notifications for calendar events and scheduled tasks': 'カレンダーの予定とスケジュールされたタスクのリマインダーと通知',
    'Task reminders': 'タスクリマインダー',
    'Standard task reminder notifications': '標準のタスクリマインダー通知',
    'Car / Driving notifications': '車 / ドライブモード通知',
    'Silent notifications when connected to Android Auto or Car mode': 'Android Auto または車載モード接続時のサイレント通知',
    'Task alarms': 'タスクアラーム',
    'Urgent task alarms with sound and vibration': 'サウンドとバイブレーション付きの重要なタスクアラーム',
    'Silent all-day reminders': '終日サイレントリマインダー',
    'Persistent reminders without sound': '音なしの常駐リマインダー',
    'Pomodoro Work Alarm': 'ポモドーロ作業アラーム',
    'Pomodoro Break Alarm': 'ポモドーロ休憩アラーム',
    'Pomodoro timer completion alarm': 'ポモドーロタイマー完了アラーム',
    'Work session complete!': '作業セッションが完了しました！',
    'Take a short break.': '少し休憩しましょう。',
    'Break time is over!': '休憩時間が終了しました！',
    'Time to get back to work.': '作業に戻りましょう。',
    'Good Morning!': 'おはようございます！',
    'Daily Summary': '毎日のサマリー',
    'Evening Review': '夜の振り返り',
    'You have no tasks due today. Have a great day!': '今日期限のタスクはありません。良い一日を！',
    'You have {{count}} task(s) for today': '今日は {{count}} 件のタスクがあります',
    'You have no tasks due today, but {{count}} overdue task(s) waiting.': '今日期限のタスクはありませんが、{{count}} 件の期限切れタスクがあります。',
    'All tasks are on track! You have no overdue tasks.': 'すべてのタスクが順調です！期限切れのタスクはありません。',
    'You have {{count}} overdue task(s) waiting.': '{{count}} 件の期限切れタスクがあります。',
    'All caught up for today! Have a relaxing evening.': '今日のタスクはすべて完了しました！ゆっくりお過ごしください。',
    'Wrap up {{count}} unfinished task(s) before the day ends.': '今日が終わる前に未完了のタスク（{{count}} 件）を片付けましょう。',
    '...and {{count}} more': '...他 {{count}} 件',
  },
  fr: {
    'Complete': 'Terminer',
    'Snooze': 'Reporter',
    'Stop': 'Arrêter',
    'Dismiss': 'Fermer',
    'Task Reminder': 'Rappel de tâche',
    'Task Alarm': 'Alarme de tâche',
    'Task Snoozed': 'Tâche reportée',
    'URGENT': 'URGENT',
    'OVERDUE': 'EN RETARD',
    'overdue': 'en retard',
    '{{taskName}} is due now': '{{taskName}} arrive à échéance',
    "Snoozed '{{taskName}}' for {{count}} minute(s)": "'{{taskName}}' reportée de {{count}} minute(s)",
    '5 min before': '5 min avant',
    '10 min before': '10 min avant',
    '15 min before': '15 min avant',
    '30 min before': '30 min avant',
    '1 hr before': '1 h avant',
    '2 hr before': '2 h avant',
    '1 day before': '1 jour avant',
    '3 days before': '3 jours avant',
    '1 week before': '1 semaine avant',
    'Calendar notifications': "Notifications d'agenda",
    'Reminders and notifications for calendar events and scheduled tasks': "Rappels et notifications pour les événements d'agenda et les tâches planifiées",
    'Task reminders': 'Rappels de tâches',
    'Standard task reminder notifications': 'Notifications standard de rappel de tâches',
    'Car / Driving notifications': 'Notifications voiture / conduite',
    'Silent notifications when connected to Android Auto or Car mode': 'Notifications silencieuses lors de la connexion à Android Auto ou au mode voiture',
    'Task alarms': 'Alarmes de tâches',
    'Urgent task alarms with sound and vibration': 'Alarmes de tâches urgentes avec son et vibration',
    'Silent all-day reminders': 'Rappels silencieux toute la journée',
    'Persistent reminders without sound': 'Rappels persistants sans son',
    'Pomodoro Work Alarm': 'Alarme de travail Pomodoro',
    'Pomodoro Break Alarm': 'Alarme de pause Pomodoro',
    'Pomodoro timer completion alarm': 'Alarme de fin de minuteur Pomodoro',
    'Work session complete!': 'Session de travail terminée !',
    'Take a short break.': 'Prenez une courte pause.',
    'Break time is over!': 'La pause est terminée !',
    'Time to get back to work.': 'Il est temps de se remettre au travail.',
    'Good Morning!': 'Bonjour !',
    'Daily Summary': 'Résumé quotidien',
    'Evening Review': 'Bilan du soir',
    'You have no tasks due today. Have a great day!': "Aucune tâche prévue aujourd'hui. Passez une excellente journée !",
    'You have {{count}} task(s) for today': "Vous avez {{count}} tâche(s) pour aujourd'hui",
    'You have no tasks due today, but {{count}} overdue task(s) waiting.': "Aucune tâche pour aujourd'hui, mais {{count}} tâche(s) en retard en attente.",
    'All tasks are on track! You have no overdue tasks.': 'Toutes les tâches sont à jour ! Aucune tâche en retard.',
    'You have {{count}} overdue task(s) waiting.': 'Vous avez {{count}} tâche(s) en retard en attente.',
    'All caught up for today! Have a relaxing evening.': "Tout est terminé pour aujourd'hui ! Passez une bonne soirée.",
    'Wrap up {{count}} unfinished task(s) before the day ends.': 'Terminez {{count}} tâche(s) en attente avant la fin de la journée.',
    '...and {{count}} more': '...et {{count}} de plus',
  },
  de: {
    'Complete': 'Erledigen',
    'Snooze': 'Schlummern',
    'Stop': 'Stopp',
    'Dismiss': 'Schließen',
    'Task Reminder': 'Aufgaben-Erinnerung',
    'Task Alarm': 'Aufgaben-Alarm',
    'Task Snoozed': 'Aufgabe verschoben',
    'URGENT': 'DRINGEND',
    'OVERDUE': 'ÜBERFÄLLIG',
    'overdue': 'überfällig',
    '{{taskName}} is due now': '{{taskName}} ist jetzt fällig',
    "Snoozed '{{taskName}}' for {{count}} minute(s)": "'{{taskName}}' um {{count}} Minute(n) verschoben",
    '5 min before': '5 Min. vorher',
    '10 min before': '10 Min. vorher',
    '15 min before': '15 Min. vorher',
    '30 min before': '30 Min. vorher',
    '1 hr before': '1 Std. vorher',
    '2 hr before': '2 Std. vorher',
    '1 day before': '1 Tag vorher',
    '3 days before': '3 Tage vorher',
    '1 week before': '1 Woche vorher',
    'Calendar notifications': 'Kalender-Benachrichtigungen',
    'Reminders and notifications for calendar events and scheduled tasks': 'Erinnerungen und Benachrichtigungen für Kalendertermine und geplante Aufgaben',
    'Task reminders': 'Aufgaben-Erinnerungen',
    'Standard task reminder notifications': 'Standard-Benachrichtigungen für Aufgaben-Erinnerungen',
    'Car / Driving notifications': 'Auto- / Fahrmodus-Benachrichtigungen',
    'Silent notifications when connected to Android Auto or Car mode': 'Lautlose Benachrichtigungen bei Verbindung mit Android Auto oder im Fahrmodus',
    'Task alarms': 'Aufgaben-Alarme',
    'Urgent task alarms with sound and vibration': 'Dringende Aufgaben-Alarme mit Ton und Vibration',
    'Silent all-day reminders': 'Lautlose Ganztages-Erinnerungen',
    'Persistent reminders without sound': 'Dauerhafte Erinnerungen ohne Ton',
    'Pomodoro Work Alarm': 'Pomodoro-Arbeitsalarm',
    'Pomodoro Break Alarm': 'Pomodoro-Pausenalarm',
    'Pomodoro timer completion alarm': 'Alarm bei Ablauf des Pomodoro-Timers',
    'Work session complete!': 'Arbeitssitzung abgeschlossen!',
    'Take a short break.': 'Mach eine kurze Pause.',
    'Break time is over!': 'Die Pause ist vorbei!',
    'Time to get back to work.': 'Zeit, weiterzuarbeiten.',
    'Good Morning!': 'Guten Morgen!',
    'Daily Summary': 'Tägliche Übersicht',
    'Evening Review': 'Abendrückblick',
    'You have no tasks due today. Have a great day!': 'Heute sind keine Aufgaben fällig. Hab einen schönen Tag!',
    'You have {{count}} task(s) for today': 'Du hast heute {{count}} Aufgabe(n)',
    'You have no tasks due today, but {{count}} overdue task(s) waiting.': 'Heute keine Aufgaben fällig, aber {{count}} überfällige Aufgabe(n) warten.',
    'All tasks are on track! You have no overdue tasks.': 'Alle Aufgaben im Plan! Du hast keine überfälligen Aufgaben.',
    'You have {{count}} overdue task(s) waiting.': 'Du hast {{count}} überfällige Aufgabe(n).',
    'All caught up for today! Have a relaxing evening.': 'Alles erledigt für heute! Hab einen entspannten Abend.',
    'Wrap up {{count}} unfinished task(s) before the day ends.': 'Erledige noch {{count}} offene Aufgabe(n), bevor der Tag endet.',
    '...and {{count}} more': '...und {{count}} weitere',
  },
  it: {
    'Complete': 'Completa',
    'Snooze': 'Posponi',
    'Stop': 'Ferma',
    'Dismiss': 'Chiudi',
    'Task Reminder': 'Promemoria attività',
    'Task Alarm': 'Sveglia attività',
    'Task Snoozed': 'Attività posticipata',
    'URGENT': 'URGENTE',
    'OVERDUE': 'SCADUTA',
    'overdue': 'scadute',
    '{{taskName}} is due now': '{{taskName}} è in scadenza ora',
    "Snoozed '{{taskName}}' for {{count}} minute(s)": "'{{taskName}}' posticipata di {{count}} minuto/i",
    '5 min before': '5 min prima',
    '10 min before': '10 min prima',
    '15 min before': '15 min prima',
    '30 min before': '30 min prima',
    '1 hr before': '1 ora prima',
    '2 hr before': '2 ore prima',
    '1 day before': '1 giorno prima',
    '3 days before': '3 giorni prima',
    '1 week before': '1 settimana prima',
    'Calendar notifications': 'Notifiche calendario',
    'Reminders and notifications for calendar events and scheduled tasks': 'Promemoria e notifiche per eventi del calendario e attività pianificate',
    'Task reminders': 'Promemoria attività',
    'Standard task reminder notifications': 'Notifiche standard per i promemoria delle attività',
    'Car / Driving notifications': 'Notifiche auto / guida',
    'Silent notifications when connected to Android Auto or Car mode': 'Notifiche silenziose durante la connessione ad Android Auto o modalità auto',
    'Task alarms': 'Sveglie attività',
    'Urgent task alarms with sound and vibration': 'Sveglie urgenti per le attività con suono e vibrazione',
    'Silent all-day reminders': 'Promemoria silenziosi tutto il giorno',
    'Persistent reminders without sound': 'Promemoria persistenti senza suono',
    'Pomodoro Work Alarm': 'Sveglia lavoro Pomodoro',
    'Pomodoro Break Alarm': 'Sveglia pausa Pomodoro',
    'Pomodoro timer completion alarm': 'Sveglia di fine timer Pomodoro',
    'Work session complete!': 'Sessione di lavoro completata!',
    'Take a short break.': 'Fai una breve pausa.',
    'Break time is over!': 'La pausa è terminata!',
    'Time to get back to work.': 'È ora di tornare al lavoro.',
    'Good Morning!': 'Buongiorno!',
    'Daily Summary': 'Riepilogo giornaliero',
    'Evening Review': 'Riepilogo serale',
    'You have no tasks due today. Have a great day!': 'Non hai attività in scadenza oggi. Buona giornata!',
    'You have {{count}} task(s) for today': 'Hai {{count}} attività per oggi',
    'You have no tasks due today, but {{count}} overdue task(s) waiting.': 'Nessuna attività per oggi, ma {{count}} attività scaduta/e in attesa.',
    'All tasks are on track! You have no overdue tasks.': 'Tutte le attività sono in regola! Non hai attività scadute.',
    'You have {{count}} overdue task(s) waiting.': 'Hai {{count}} attività scaduta/e in attesa.',
    'All caught up for today! Have a relaxing evening.': 'Tutto completato per oggi! Buona serata.',
    'Wrap up {{count}} unfinished task(s) before the day ends.': 'Completa {{count}} attività in sospeso prima di fine giornata.',
    '...and {{count}} more': '...e altre {{count}}',
  },
  hi: {
    'Complete': 'पूर्ण करें',
    'Snooze': 'स्नूज़',
    'Stop': 'रोकें',
    'Dismiss': 'खारिज करें',
    'Task Reminder': 'कार्य रिमाइंडर',
    'Task Alarm': 'कार्य अलार्म',
    'Task Snoozed': 'कार्य स्नूज़ किया गया',
    'URGENT': 'अत्यावश्यक',
    'OVERDUE': 'अतिदेय',
    'overdue': 'अतिदेय',
    '{{taskName}} is due now': '{{taskName}} का समय हो गया है',
    "Snoozed '{{taskName}}' for {{count}} minute(s)": "'{{taskName}}' को {{count}} मिनट के लिए स्नूज़ किया गया",
    '5 min before': '5 मिनट पहले',
    '10 min before': '10 मिनट पहले',
    '15 min before': '15 मिनट पहले',
    '30 min before': '30 मिनट पहले',
    '1 hr before': '1 घंटा पहले',
    '2 hr before': '2 घंटे पहले',
    '1 day before': '1 दिन पहले',
    '3 days before': '3 दिन पहले',
    '1 week before': '1 सप्ताह पहले',
    'Calendar notifications': 'कैलेंडर सूचनाएं',
    'Reminders and notifications for calendar events and scheduled tasks': 'कैलेंडर ईवेंट और निर्धारित कार्यों के लिए रिमाइंडर और सूचनाएं',
    'Task reminders': 'कार्य रिमाइंडर',
    'Standard task reminder notifications': 'मानक कार्य रिमाइंडर सूचनाएं',
    'Car / Driving notifications': 'कार / ड्राइविंग सूचनाएं',
    'Silent notifications when connected to Android Auto or Car mode': 'Android Auto या कार मोड से जुड़े होने पर साइलेंट सूचनाएं',
    'Task alarms': 'कार्य अलार्म',
    'Urgent task alarms with sound and vibration': 'ध्वनि और कंपन के साथ अत्यावश्यक कार्य अलार्म',
    'Silent all-day reminders': 'पूरे दिन के साइलेंट रिमाइंडर',
    'Persistent reminders without sound': 'बिना ध्वनि के स्थायी रिमाइंडर',
    'Pomodoro Work Alarm': 'पोमोडोरो कार्य अलार्म',
    'Pomodoro Break Alarm': 'पोमोडोरो ब्रेक अलार्म',
    'Pomodoro timer completion alarm': 'पोमोडोरो टाइमर पूर्ण होने का अलार्म',
    'Work session complete!': 'कार्य सत्र पूरा हुआ!',
    'Take a short break.': 'थोड़ा विराम लें।',
    'Break time is over!': 'ब्रेक का समय समाप्त हुआ!',
    'Time to get back to work.': 'काम पर वापस लौटने का समय।',
    'Good Morning!': 'सुप्रभात!',
    'Daily Summary': 'दैनिक सारांश',
    'Evening Review': 'शाम की समीक्षा',
    'You have no tasks due today. Have a great day!': 'आज के लिए कोई कार्य शेष नहीं है। आपका दिन शुभ हो!',
    'You have {{count}} task(s) for today': 'आज के लिए आपके {{count}} कार्य हैं',
    'You have no tasks due today, but {{count}} overdue task(s) waiting.': 'आज कोई कार्य देय नहीं है, लेकिन {{count}} अतिदेय कार्य प्रतीक्षा में हैं।',
    'All tasks are on track! You have no overdue tasks.': 'सभी कार्य समय पर हैं! कोई अतिदेय कार्य नहीं है।',
    'You have {{count}} overdue task(s) waiting.': 'आपके {{count}} अतिदेय कार्य प्रतीक्षा में हैं।',
    'All caught up for today! Have a relaxing evening.': 'आज के सभी कार्य पूरे हुए! आपकी शाम सुखद रहे।',
    'Wrap up {{count}} unfinished task(s) before the day ends.': 'दिन समाप्त होने से पहले {{count}} अधूरे कार्य पूरे करें।',
    '...and {{count}} more': '...और {{count}} अन्य',
  },
  ko: {
    'Complete': '완료',
    'Snooze': '다시 알림',
    'Stop': '중지',
    'Dismiss': '닫기',
    'Task Reminder': '할 일 알림',
    'Task Alarm': '할 일 알람',
    'Task Snoozed': '할 일 다시 알림',
    'URGENT': '긴급',
    'OVERDUE': '기한 지남',
    'overdue': '기한 지남',
    '{{taskName}} is due now': '지금 {{taskName}} 할 시간입니다',
    "Snoozed '{{taskName}}' for {{count}} minute(s)": "'{{taskName}}' 알림을 {{count}}분 연기했습니다",
    '5 min before': '5분 전',
    '10 min before': '10분 전',
    '15 min before': '15분 전',
    '30 min before': '30분 전',
    '1 hr before': '1시간 전',
    '2 hr before': '2시간 전',
    '1 day before': '1일 전',
    '3 days before': '3일 전',
    '1 week before': '1주일 전',
    'Calendar notifications': '캘린더 알림',
    'Reminders and notifications for calendar events and scheduled tasks': '캘린더 일정 및 예약된 할 일에 대한 리마인더 및 알림',
    'Task reminders': '할 일 리마인더',
    'Standard task reminder notifications': '표준 할 일 리마인더 알림',
    'Car / Driving notifications': '차량 / 운전 모드 알림',
    'Silent notifications when connected to Android Auto or Car mode': 'Android Auto 또는 차량 모드 연결 시 무음 알림',
    'Task alarms': '할 일 알람',
    'Urgent task alarms with sound and vibration': '소리와 진동이 울리는 긴급 할 일 알람',
    'Silent all-day reminders': '종일 무음 알림',
    'Persistent reminders without sound': '소리 없는 상시 고정 알림',
    'Pomodoro Work Alarm': '뽀모도로 집중 알람',
    'Pomodoro Break Alarm': '뽀모도로 휴식 알람',
    'Pomodoro timer completion alarm': '뽀모도로 타이머 완료 알람',
    'Work session complete!': '집중 세션이 완료되었습니다!',
    'Take a short break.': '잠시 휴식을 취하세요.',
    'Break time is over!': '휴식 시간이 끝났습니다!',
    'Time to get back to work.': '다시 집중할 시간입니다.',
    'Good Morning!': '좋은 아침입니다!',
    'Daily Summary': '일일 요약',
    'Evening Review': '저녁 점검',
    'You have no tasks due today. Have a great day!': '오늘 마감인 할 일이 없습니다. 좋은 하루 보내세요!',
    'You have {{count}} task(s) for today': '오늘 할 일이 {{count}}개 있습니다',
    'You have no tasks due today, but {{count}} overdue task(s) waiting.': '오늘 마감인 할 일은 없지만 기한이 지난 할 일이 {{count}}개 있습니다.',
    'All tasks are on track! You have no overdue tasks.': '모든 할 일이 순조롭습니다! 기한이 지난 할 일이 없습니다.',
    'You have {{count}} overdue task(s) waiting.': '기한이 지난 할 일이 {{count}}개 있습니다.',
    'All caught up for today! Have a relaxing evening.': '오늘 할 일을 모두 마쳤습니다! 편안한 저녁 보내세요.',
    'Wrap up {{count}} unfinished task(s) before the day ends.': '오늘이 끝나기 전에 미완료 할 일 {{count}}개를 마무리하세요.',
    '...and {{count}} more': '...외 {{count}}개 더',
  },
};

export function resolveNotificationLanguage(explicitLang = null) {
  let raw = explicitLang;
  if (!raw) {
    try {
      const i18nMod = require('../i18n');
      const i18nInst = i18nMod?.default || i18nMod;
      if (i18nInst && typeof i18nInst.language === 'string' && i18nInst.language) {
        raw = i18nInst.language;
      }
    } catch (e) {}
  }
  const base = String(raw || 'en').trim().toLowerCase().split(/[-_]/)[0] || 'en';
  return NOTIFICATION_TRANSLATIONS[base] ? base : 'en';
}

export function tNotif(key, options = {}) {
  const lang = resolveNotificationLanguage(options?.lng || options?.language);
  const dict = NOTIFICATION_TRANSLATIONS[lang] || NOTIFICATION_TRANSLATIONS.en;
  let template = dict[key];
  if (template === undefined) {
    try {
      const i18nMod = require('../i18n');
      const i18nInst = i18nMod?.default || i18nMod;
      if (i18nInst && typeof i18nInst.t === 'function') {
        const res = i18nInst.t(key, { ...options, lng: lang });
        if (res && res !== key) {
          template = res;
        }
      }
    } catch (e) {}
  }
  if (template === undefined) {
    template = NOTIFICATION_TRANSLATIONS.en[key] || key;
  }
  if (options && typeof template === 'string') {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
      options[k] !== undefined && options[k] !== null ? String(options[k]) : `{{${k}}}`
    );
  }
  return template;
}

export function translateReminderOffsetLabel(reminderValue, explicitLang = null) {
  if (!reminderValue || typeof reminderValue !== 'string') return '';
  const clean = reminderValue.trim();
  if (!clean) return '';
  const lang = resolveNotificationLanguage(explicitLang);
  if (lang === 'en') return clean;

  const dict = NOTIFICATION_TRANSLATIONS[lang] || NOTIFICATION_TRANSLATIONS.en;
  if (dict[clean]) return dict[clean];

  const match = clean.match(/^(\d+)\s*(min|minute|hr|hour|day)s?\s*before$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    const u = match[2].toLowerCase();
    const isMin = u.startsWith('min');
    const isHr = u.startsWith('hr') || u.startsWith('hour');
    switch (lang) {
      case 'ru':
        return isMin ? `За ${num} мин` : isHr ? `За ${num} ч` : `За ${num} дн`;
      case 'es':
        return isMin ? `${num} min antes` : isHr ? `${num} h antes` : `${num} d antes`;
      case 'zh':
        return isMin ? `提前 ${num} 分钟` : isHr ? `提前 ${num} 小时` : `提前 ${num} 天`;
      case 'ja':
        return isMin ? `${num}分前` : isHr ? `${num}時間前` : `${num}日前`;
      case 'fr':
        return isMin ? `${num} min avant` : isHr ? `${num} h avant` : `${num} j avant`;
      case 'de':
        return isMin ? `${num} Min. vorher` : isHr ? `${num} Std. vorher` : `${num} T. vorher`;
      case 'it':
        return isMin ? `${num} min prima` : isHr ? `${num} h prima` : `${num} g prima`;
      case 'hi':
        return isMin ? `${num} मिनट पहले` : isHr ? `${num} घंटे पहले` : `${num} दिन पहले`;
      case 'ko':
        return isMin ? `${num}분 전` : isHr ? `${num}시간 전` : `${num}일 전`;
      default:
        return clean;
    }
  }
  return tNotif(clean, { lng: lang });
}

// Set how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    try {
      await dismissPriorBeforeNotificationsForIncomingAsync(notification);
      setTimeout(() => {
        deduplicatePresentedNotificationsAsync(notification).catch(() => {});
      }, 350);
    } catch (e) {}
    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

const DATE_TRIGGER_TYPE = Notifications.SchedulableTriggerInputTypes?.DATE || 'date';
const TIME_INTERVAL_TRIGGER_TYPE = Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL || 'timeInterval';

export function buildDateTrigger(dateInput, channelId = null) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Platform.OS === 'android' && channelId) {
    return { type: DATE_TRIGGER_TYPE, date, channelId };
  }
  return { type: DATE_TRIGGER_TYPE, date };
}

export function buildTimeIntervalTrigger(seconds, channelId = null, repeats = false) {
  const safeSeconds = Math.max(1, Number(seconds) || 1);
  if (Platform.OS === 'android' && channelId) {
    return { type: TIME_INTERVAL_TRIGGER_TYPE, seconds: safeSeconds, repeats: !!repeats, channelId };
  }
  return { type: TIME_INTERVAL_TRIGGER_TYPE, seconds: safeSeconds, repeats: !!repeats };
}

export const VIBRATION_PATTERNS = {
  notificationSoft: [0, 35, 45, 40],
  reminder: [0, 60, 70, 60, 120, 90],
  important: [0, 120, 80, 180],
  alarmGentle: [0, 250, 120, 250, 120, 400, 350],
  alarmUrgent: [0, 500, 180, 500, 180, 700, 180, 700],
};

export const VIBRATION_PRESETS = {
  taskCompleted: [],
  newTask: VIBRATION_PATTERNS.notificationSoft,
  reminder: VIBRATION_PATTERNS.reminder,
  importantReminder: VIBRATION_PATTERNS.important,
  morningReminder: VIBRATION_PATTERNS.notificationSoft,
  eveningReminder: VIBRATION_PATTERNS.notificationSoft,
  overdueTask: VIBRATION_PATTERNS.alarmGentle,
  alarm: VIBRATION_PATTERNS.alarmGentle,
  criticalAlarm: VIBRATION_PATTERNS.alarmUrgent,
};

export function getSoundBasename(sound, isAlarm = false) {
  let baseName = sound ? sound.replace(/\.(wav|mp3|ogg)$/i, '') : 'default';
  if (baseName === 'default' && isAlarm) {
    // Expo hardcodes 'default' to the OS's NOTIFICATION sound.
    // Since we can't trigger the OS default alarm sound, we map to a bundled alarm sound.
    baseName = 'alarm_02';
  }
  return baseName;
}

export function getChannelId(
  isAlarm,
  sound,
  vibrationEnabled
) {
  const base = isAlarm ? 'alarm' : 'default';
  const soundName = getSoundBasename(sound, isAlarm);
  const vib = vibrationEnabled ? 'vib1' : 'vib0';

  return `task_${base}_${soundName}_${vib}_v17`;
}

export function getCalendarChannelId(
  sound,
  vibrationEnabled
) {
  const soundName = getSoundBasename(sound, false);
  const vib = vibrationEnabled ? 'vib1' : 'vib0';

  return `calendar_task_${soundName}_${vib}_v1`;
}

const configuredChannels = new Set();

function serializeError(error) {
  if (!error) {
    return {
      message: 'Unknown error',
    };
  }

  return {
    name: error.name || 'Error',
    message: error.message || String(error),
    stack: error.stack || null,
    code: error.code || null,
  };
}

export function normalizeChannelForLog(channel) {
  if (!channel) {
    return null;
  }

  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,

    importance: channel.importance,
    sound: channel.sound,

    enableVibrate: channel.enableVibrate,
    vibrationPattern: channel.vibrationPattern,

    enableLights: channel.enableLights,
    lightColor: channel.lightColor,

    lockscreenVisibility:
      channel.lockscreenVisibility,

    bypassDnd: channel.bypassDnd,

    audioAttributes:
      channel.audioAttributes || null,
  };
}

export async function configureAndroidNotificationChannels(
  notificationSound,
  alarmSound,
  vibrationEnabled
) {
  if (Platform.OS !== 'android') {
    return;
  }

  const defaultChannelId = getChannelId(
    false,
    notificationSound,
    vibrationEnabled
  );

  const alarmChannelId = getChannelId(
    true,
    alarmSound,
    vibrationEnabled
  );

  const calendarChannelId = getCalendarChannelId(
    notificationSound,
    vibrationEnabled
  );

  const lang = resolveNotificationLanguage();
  const langDefaultKey = `${lang}:${defaultChannelId}`;
  const langAlarmKey = `${lang}:${alarmChannelId}`;
  const langCalendarKey = `${lang}:${calendarChannelId}`;

  if (
    configuredChannels.has(langDefaultKey) &&
    configuredChannels.has(langAlarmKey) &&
    configuredChannels.has(langCalendarKey)
  ) {
    return;
  }

  DevLogger.info(
    'Configuring Android notification channels',
    {
      notificationSound,
      alarmSound,
      vibrationEnabled,
      defaultChannelId,
      alarmChannelId,
      calendarChannelId,
      lang,
    }
  );

  try {
    await Notifications.setNotificationChannelAsync(
      calendarChannelId,
      {
        name: tNotif('Calendar notifications', { lng: lang }),
        description: tNotif('Reminders and notifications for calendar events and scheduled tasks', { lng: lang }),

        importance:
          Notifications.AndroidImportance.HIGH,

        sound: getSoundBasename(notificationSound, false),

        enableVibrate: vibrationEnabled,

        vibrationPattern: vibrationEnabled
          ? VIBRATION_PRESETS.reminder
          : null,

        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.NOTIFICATION,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },

        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      }
    );

    await Notifications.setNotificationChannelAsync(
      defaultChannelId,
      {
        name: tNotif('Task reminders', { lng: lang }),
        description: tNotif('Standard task reminder notifications', { lng: lang }),

        importance:
          Notifications.AndroidImportance.HIGH,

        sound: getSoundBasename(notificationSound, false),

        enableVibrate: vibrationEnabled,

        vibrationPattern: vibrationEnabled
          ? VIBRATION_PRESETS.reminder
          : null,

        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.NOTIFICATION,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },

        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      }
    );

    await Notifications.setNotificationChannelAsync(
      'task_car_silent_channel_v1',
      {
        name: tNotif('Car / Driving notifications', { lng: lang }),
        description: tNotif('Silent notifications when connected to Android Auto or Car mode', { lng: lang }),

        importance:
          Notifications.AndroidImportance.HIGH,

        sound: null,

        enableVibrate: false,

        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      }
    );

    await Notifications.setNotificationChannelAsync(
      alarmChannelId,
      {
        name: tNotif('Task alarms', { lng: lang }),
        description: tNotif('Urgent task alarms with sound and vibration', { lng: lang }),

        importance:
          Notifications.AndroidImportance.MAX,

        sound: getSoundBasename(alarmSound, true),

        enableVibrate: vibrationEnabled,

        vibrationPattern: vibrationEnabled
          ? VIBRATION_PRESETS.alarm
          : null,

        audioAttributes: {
          usage:
            Notifications.AndroidAudioUsage.ALARM,

          contentType:
            Notifications.AndroidAudioContentType
              .SONIFICATION,
        },

        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,

        bypassDnd: true,
      }
    );

    // Read both channels back from Android.
    const storedDefault =
      await Notifications.getNotificationChannelAsync(
        defaultChannelId
      );

    const storedAlarm =
      await Notifications.getNotificationChannelAsync(
        alarmChannelId
      );

    DevLogger.info(
      'Stored task-reminder channel',
      normalizeChannelForLog(storedDefault)
    );

    DevLogger.info(
      'Stored task-alarm channel',
      normalizeChannelForLog(storedAlarm)
    );

    const problems = [];

    if (!storedDefault) {
      problems.push(
        'Default notification channel was not found'
      );
    } else {
      if (!storedDefault.sound) {
        problems.push(
          'Default notification channel has no sound'
        );
      }

      if (
        storedDefault.importance ===
        Notifications.AndroidImportance.NONE
      ) {
        problems.push(
          'Default notification channel is blocked'
        );
      }
    }

    if (!storedAlarm) {
      problems.push(
        'Alarm notification channel was not found'
      );
    } else {
      if (!storedAlarm.sound) {
        problems.push(
          'Alarm notification channel has no sound'
        );
      }

      if (
        storedAlarm.importance ===
        Notifications.AndroidImportance.NONE
      ) {
        problems.push(
          'Alarm notification channel is blocked'
        );
      }
    }

    if (problems.length > 0) {
      DevLogger.error(
        'Android stored invalid or silent channel settings',
        {
          problems,
          defaultChannel:
            normalizeChannelForLog(storedDefault),
          alarmChannel:
            normalizeChannelForLog(storedAlarm),
        }
      );

      // Do not cache a channel that Android reports as bad.
      return;
    }

    configuredChannels.add(defaultChannelId);
    configuredChannels.add(alarmChannelId);
    configuredChannels.add(calendarChannelId);
    configuredChannels.add(langDefaultKey);
    configuredChannels.add(langAlarmKey);
    configuredChannels.add(langCalendarKey);

    DevLogger.success(
      'Android notification channels verified',
      {
        defaultChannelId,
        alarmChannelId,
        defaultSound: storedDefault.sound,
        alarmSound: storedAlarm.sound,
      }
    );
  } catch (error) {
    DevLogger.error(
      'Failed to configure Android notification channels',
      serializeError(error)
    );

    throw error;
  }
}

export async function configurePomodoroChannel(soundName, isBreak) {
  if (Platform.OS !== 'android') return null;
  const baseName = soundName === 'default' ? 'default' : getSoundBasename(soundName, true);
  const type = isBreak ? 'break' : 'work';
  const channelId = `pomodoro_${type}_${baseName}_v2`;
  const lang = resolveNotificationLanguage();
  if (typeof setSavedAppLanguage === 'function') {
    try { setSavedAppLanguage(lang); } catch (e) {}
  }

  try {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: tNotif(isBreak ? 'Pomodoro Break Alarm' : 'Pomodoro Work Alarm', { lng: lang }),
      description: tNotif('Pomodoro timer completion alarm', { lng: lang }),
      importance: Notifications.AndroidImportance.MAX,
      sound: baseName === 'none' ? null : baseName,
      enableVibrate: true,
      vibrationPattern: VIBRATION_PRESETS.alarm,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
    return channelId;
  } catch (error) {
    console.error('Failed to configure pomodoro channel', error);
    return null;
  }
}

export async function deleteObsoleteNotificationChannels(
  notificationSound,
  alarmSound,
  vibrationEnabled
) {
  if (Platform.OS !== 'android') {
    return;
  }

  const activeDefaultId = getChannelId(
    false,
    notificationSound,
    vibrationEnabled
  );

  const activeAlarmId = getChannelId(
    true,
    alarmSound,
    vibrationEnabled
  );

  const activeCalendarId = getCalendarChannelId(
    notificationSound,
    vibrationEnabled
  );

  const keepIds = new Set([
    activeDefaultId,
    activeAlarmId,
    activeCalendarId,
    'debug_system_sound_v16',
  ]);

  try {
    const channels =
      await Notifications.getNotificationChannelsAsync();

    for (const channel of channels) {
      const isManagedByYourApp =
        channel.id.startsWith('task_default_') ||
        channel.id.startsWith('task_alarm_') ||
        channel.id.startsWith('calendar_task_') ||
        channel.id.startsWith('debug_system_sound_') ||
        channel.id.startsWith('task_default_system_sound_') ||
        channel.id.startsWith('default_sound_');

      if (
        isManagedByYourApp &&
        !keepIds.has(channel.id)
      ) {
        await Notifications.deleteNotificationChannelAsync(
          channel.id
        );

        DevLogger.info(
          'Deleted old notification channel',
          {
            id: channel.id,
            name: channel.name,
          }
        );
      }
    }
  } catch (error) {
    DevLogger.error(
      'Notification channel cleanup failed',
      {
        message: error?.message,
        stack: error?.stack,
      }
    );
  }
}

export async function configureNotificationCategoriesAsync(explicitLang = null) {
  if (Platform.OS === 'web') return;
  const lang = resolveNotificationLanguage(explicitLang);
  if (Platform.OS === 'android' && typeof setSavedAppLanguage === 'function') {
    try {
      setSavedAppLanguage(lang);
    } catch (e) {}
  }
  const completeTitle = tNotif('Complete', { lng: lang });
  const snoozeTitle = tNotif('Snooze', { lng: lang });

  await Notifications.setNotificationCategoryAsync(
    'task_reminder',
    [
      {
        identifier: 'complete_task',
        buttonTitle: completeTitle,
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'snooze',
        buttonTitle: snoozeTitle,
        options: {
          opensAppToForeground: false,
        },
      },
    ]
  );

  await Notifications.setNotificationCategoryAsync(
    'task_regular',
    [
      {
        identifier: 'complete_task',
        buttonTitle: completeTitle,
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'snooze',
        buttonTitle: snoozeTitle,
        options: {
          opensAppToForeground: false,
        },
      },
    ]
  );

  await Notifications.setNotificationCategoryAsync(
    'task_persistent',
    [
      {
        identifier: 'complete_task',
        buttonTitle: completeTitle,
        options: {
          opensAppToForeground: false,
        },
      },
    ]
  );
}

export async function registerForPushNotificationsAsync(themeState = {}) {
  if (Platform.OS === 'web') {
    return null;
  }

  const notifSound = themeState.notificationSound || 'default';
  const alrmSound = themeState.alarmSound || 'default';
  const vibEnabled = themeState.vibrationEnabled !== false;

  await deleteObsoleteNotificationChannels(
    notifSound,
    alrmSound,
    vibEnabled
  );

  await configureAndroidNotificationChannels(notifSound, alrmSound, vibEnabled);

  const permission =
    await Notifications.getPermissionsAsync();

  let finalStatus = permission.status;

  if (finalStatus !== 'granted') {
    const requested =
      await Notifications.requestPermissionsAsync();

    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    console.warn(
      'Notification permission was not granted.'
    );
    DevLogger.warn('Notification permission was not granted.');
  } else {
    DevLogger.success('Notification permission granted.');
  }

  await configureNotificationCategoriesAsync();

  /*
   * You do not need a push token for local notifications.
   * Obtain one only when you intend to receive remote push messages.
   */
  if (!Device.isDevice) {
    return null;
  }

  return null;
}

import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);
export async function scheduleTaskReminder(taskName, reminderValue, completionDateStr, timeStr, taskId = null, isAlarm = false, themeState = {}, advancedOptions = {}) {
  if (Platform.OS === 'web') return [];
  DevLogger.info(`scheduleTaskReminder called for task: ${taskName}`, { reminderValue, completionDateStr, timeStr, isAlarm, advancedOptions });
  if (!completionDateStr) {
    DevLogger.warn(`scheduleTaskReminder: No completionDateStr provided, aborting`);
    return [];
  }
  
  if (taskId) {
    await cancelNotification(null, taskId);
  }

  const ids = [];

  let targetDate = dayjs(completionDateStr);
  if (!targetDate.isValid()) return [];

  const hasReminder = reminderValue && reminderValue !== 'None';
  const isKeepAllDay = !!advancedOptions.keepNotificationAllDay;
  
  // If reminder is 'None' and isAlarm is false, do not schedule any reminder unless explicitly asked
  if (!hasReminder && !isAlarm && !advancedOptions.isNagMode && advancedOptions.escalationLevel !== 'active' && !isKeepAllDay) {
    return [];
  }

  // Schedule persistent all-day notification if requested (silently in background)
  if (isKeepAllDay) {
    const now = dayjs();
    const isTodayOrPast = targetDate.isSameOrBefore(now, 'day');
    
    let triggerDate;
    if (isTodayOrPast) {
      triggerDate = now.add(2, 'second');
    } else {
      let futureMorning = targetDate.startOf('day').hour(8).minute(0).second(0);
      if (timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m) && (h < 8 || (h === 8 && m === 0))) {
          futureMorning = targetDate.startOf('day').hour(h).minute(m).second(0);
        }
      }
      triggerDate = futureMorning;
    }

    const persistentId = await schedulePersistentTaskNotification(
      taskName,
      triggerDate.toDate(),
      taskId,
      timeStr,
      themeState
    );
    if (persistentId) ids.push(persistentId);
  }

  let dateOnly;
  if (
    advancedOptions?.dateString &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(advancedOptions.dateString).trim())
  ) {
    dateOnly = String(advancedOptions.dateString).trim();
  } else if (
    typeof completionDateStr === 'string' &&
    (/^\d{4}-\d{2}-\d{2}$/.test(completionDateStr.trim()) ||
      /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/i.test(completionDateStr.trim()))
  ) {
    dateOnly = completionDateStr.trim().slice(0, 10);
  } else {
    dateOnly = dayjs(completionDateStr).format('YYYY-MM-DD');
  }

  if (timeStr) {
    const parsedTime = dayjs(
      `${dateOnly} ${timeStr}`,
      [
        'YYYY-MM-DD HH:mm',
        'YYYY-MM-DD H:mm',
        'YYYY-MM-DD h:mm A',
        'YYYY-MM-DD hh:mm A',
      ],
      true
    );

    if (parsedTime.isValid()) {
      targetDate = parsedTime;
    } else {
      console.warn('Invalid task time:', timeStr, 'for date:', dateOnly);
      DevLogger.warn(`Invalid task time format. Expected HH:mm. Got: ${timeStr} for date ${dateOnly}`);
      return [];
    }

    // Schedule exact time notification if reminder or alarm is set
    if (hasReminder || isAlarm) {
      const timeId = await scheduleExactTaskReminder(
        taskName,
        targetDate.toDate(),
        taskId,
        isAlarm,
        isAlarm ? 'task_reminder' : 'task_regular',
        themeState,
        advancedOptions
      );
      if (timeId) ids.push(timeId);
    }
  } else {
    targetDate = dayjs(`${dateOnly} 09:00`, 'YYYY-MM-DD HH:mm', true);
    if (!targetDate.isValid()) {
      targetDate = dayjs(completionDateStr).hour(9).minute(0).second(0);
    }
    if (reminderValue === 'Day of' || reminderValue === 'At time of task' || reminderValue === '0 min before' || isAlarm) {
      const dayOfId = await scheduleExactTaskReminder(
        taskName,
        targetDate.toDate(),
        taskId,
        isAlarm,
        isAlarm ? 'task_reminder' : 'task_regular',
        themeState,
        advancedOptions
      );
      if (dayOfId) ids.push(dayOfId);
    }
  }

  if (reminderValue && reminderValue !== 'None' && reminderValue !== 'At time of task' && reminderValue !== '0 min before') {
    const offsets = {
      "5 min before": { amount: 5, unit: "minute" },
      "10 min before": { amount: 10, unit: "minute" },
      "15 min before": { amount: 15, unit: "minute" },
      "30 min before": { amount: 30, unit: "minute" },
      "1 hr before": { amount: 1, unit: "hour" },
      "2 hr before": { amount: 2, unit: "hour" },
      "1 day before": { amount: 1, unit: "day" }
    };

    let offset = offsets[reminderValue];
    if (!offset) {
      const match = String(reminderValue).match(/^(\d+)\s*(min|minute|hr|hour|day)s?\s*before$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const u = match[2].toLowerCase();
        const unit = u.startsWith('min') ? 'minute' : (u.startsWith('hr') || u.startsWith('hour')) ? 'hour' : 'day';
        offset = { amount: num, unit };
      }
    }

    if (offset) {
      let reminderDate = targetDate.subtract(offset.amount, offset.unit);
      const remId = await scheduleExactTaskReminder(
        taskName,
        reminderDate.toDate(),
        taskId,
        isAlarm,
        'task_reminder',
        themeState,
        { ...advancedOptions, reminderOffsetLabel: reminderValue }
      );
      if (remId) ids.push(remId);
    }
  }

  if (advancedOptions.escalationLevel === 'active') {
    const escOffsets = [
      { amount: 1, unit: 'hour' },
      { amount: 30, unit: 'minute' },
      { amount: 15, unit: 'minute' },
      { amount: 5, unit: 'minute' },
      { amount: 1, unit: 'minute' }
    ];
    const urgentTag = tNotif('URGENT');
    for (const escOffset of escOffsets) {
      let remDate = targetDate.subtract(escOffset.amount, escOffset.unit);
      if (remDate.isAfter(dayjs())) {
        const remId = await scheduleExactTaskReminder(
          `[${urgentTag}] ${taskName}`,
          remDate.toDate(),
          taskId,
          true,
          'task_alarm',
          themeState,
          { ...advancedOptions, deterministicSlot: `esc_${escOffset.amount}_${escOffset.unit}`, baseTaskName: taskName }
        );
        if (remId) ids.push(remId);
      }
    }
  }

  if (advancedOptions.isNagMode === true) {
    const overdueTag = tNotif('OVERDUE');
    for (let i = 1; i <= 12; i++) {
      let nagDate = targetDate.add(i * 10, 'minute');
      if (nagDate.isAfter(dayjs())) {
        const nagId = await scheduleExactTaskReminder(
          `[${overdueTag}] ${taskName}`,
          nagDate.toDate(),
          taskId,
          true,
          'task_alarm',
          themeState,
          { ...advancedOptions, deterministicSlot: `nag_${i}`, baseTaskName: taskName }
        );
        if (nagId) ids.push(nagId);
      }
    }
  }

  return ids;
}

export async function schedulePersistentTaskNotification(
  taskName,
  triggerDateObj,
  taskId = null,
  timeStr = null,
  themeState = {}
) {
  if (Platform.OS === 'web') return null;
  const targetDate = dayjs(triggerDateObj);
  DevLogger.info(`schedulePersistentTaskNotification for: ${taskName}`, { targetDate: targetDate.format(), taskId });

  const channelId = 'task_silent_notification_v2';
  const sound = null;
  const lang = resolveNotificationLanguage(themeState?.language || themeState?.appLanguage);

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(channelId, {
        name: tNotif('Silent all-day reminders', { lng: lang }),
        description: tNotif('Persistent reminders without sound', { lng: lang }),
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
        enableVibrate: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const persistentIdentifier = taskId ? `task_persist_${taskId}` : undefined;
    const scheduledId = await Notifications.scheduleNotificationAsync({
      ...(persistentIdentifier ? { identifier: persistentIdentifier } : {}),
      content: {
        title: tNotif('Task Reminder', { lng: lang }),
        body: timeStr ? `${taskName} (${timeStr})` : taskName,
        sound: null,
        priority: Notifications.AndroidNotificationPriority.LOW,
        categoryIdentifier: 'task_persistent',
        data: {
          taskId,
          isAlarm: false,
          keepNotificationAllDay: true,
        },
        sticky: true,
        autoDismiss: false,
      },
      trigger: buildDateTrigger(targetDate.toDate(), channelId),
    });

    DevLogger.success(`Successfully scheduled persistent notification`, { scheduledId, channelId, taskName });
    return scheduledId;
  } catch (error) {
    DevLogger.error(`Error scheduling persistent notification`, error.message);
    return null;
  }
}

export async function scheduleExactTaskReminder(
  taskName,
  targetDateObj,
  taskId = null,
  isAlarm = false,
  category = 'task_reminder',
  themeState = {},
  advancedOptions = {}
) {
  if (Platform.OS === 'web') return null;
  const targetDate = dayjs(targetDateObj);
  DevLogger.info(`scheduleExactTaskReminder for: ${taskName}`, { targetDate: targetDate.format(), isAlarm, category });

  if (
    !targetDate.isValid() ||
    !targetDate.isAfter(dayjs())
  ) {
    console.warn(
      'Cannot schedule notification in the past.'
    );
    DevLogger.warn(`Cannot schedule notification in the past. Date: ${targetDate.format()}`);

    return null;
  }

  const notificationSound = themeState.notificationSound || 'default';
  const alarmSound = themeState.alarmSound || 'default';
  const vibrationEnabled = themeState.vibrationEnabled !== false;
  const alarmPresentationStyle = themeState.alarmPresentationStyle || 'adaptive';

  const isCalendar = !!(advancedOptions?.isCalendar || advancedOptions?.channelType === 'calendar' || advancedOptions?.syncedFromCalendar);
  const channelId = isCalendar
    ? getCalendarChannelId(notificationSound, vibrationEnabled)
    : getChannelId(isAlarm, isAlarm ? alarmSound : notificationSound, vibrationEnabled);

  const sound = isAlarm
    ? alarmSound
    : notificationSound;

  try {
    const lang = resolveNotificationLanguage(themeState?.language || themeState?.appLanguage);
    if (Platform.OS === 'android' && typeof setSavedAppLanguage === 'function') {
      try {
        setSavedAppLanguage(lang);
      } catch (e) {}
    }

    // Ensure channels exist before scheduling
    await configureAndroidNotificationChannels(notificationSound, alarmSound, vibrationEnabled);

    // Sync "Mute on Android Auto" preference to native SharedPreferences so TaskAlarmReceiver respects it
    if (Platform.OS === 'android' && typeof setSavedAndroidAutoMute === 'function') {
      setSavedAndroidAutoMute(themeState.androidAutoEnabled !== false);
    }

    const isCar = (Platform.OS === 'android' && themeState.androidAutoEnabled !== false)
      ? await isCarConnected()
      : false;

    const activeChannelId = isCar ? 'task_car_silent_channel_v1' : channelId;
    const activeSound = isCar ? null : sound;

    if (Platform.OS === 'android' && isAlarm) {
      const success = await scheduleExactAlarm(
        taskId,
        taskName,
        targetDate.valueOf(),
        sound,
        alarmPresentationStyle,
        advancedOptions?.keepNotificationAllDay,
        channelId
      );
      if (success) {
        DevLogger.success(`Successfully scheduled exact native ALARM`, { taskId, channelId, sound, taskName, alarmPresentationStyle, isCar });
        return `native_alarm_${taskId}`;
      }
    }

    const localizedOffset = advancedOptions?.reminderOffsetLabel
      ? translateReminderOffsetLabel(advancedOptions.reminderOffsetLabel, lang)
      : '';
    const offsetSuffix = localizedOffset ? ` (${localizedOffset})` : '';
    const isBeforeReminder = Boolean(
      advancedOptions?.reminderOffsetLabel ||
      (typeof advancedOptions?.deterministicSlot === 'string' && advancedOptions.deterministicSlot.startsWith('esc_'))
    );
    const reminderType = isBeforeReminder
      ? 'before'
      : (advancedOptions?.deterministicSlot ? String(advancedOptions.deterministicSlot) : 'exact');
    const baseTaskName = advancedOptions?.baseTaskName
      ? String(advancedOptions.baseTaskName).trim()
      : normalizeTaskNotificationBaseName(String(taskName || ''));

    let deterministicId;
    if (taskId) {
      if (advancedOptions?.deterministicSlot) {
        deterministicId = `task_${advancedOptions.deterministicSlot}_${taskId}`;
      } else if (advancedOptions?.reminderOffsetLabel) {
        const safeOffset = String(advancedOptions.reminderOffsetLabel)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        deterministicId = `task_offset_${safeOffset}_${taskId}`;
      } else {
        deterministicId = `task_exact_${taskId}`;
      }
    }

    const scheduledId = await Notifications.scheduleNotificationAsync({
      ...(deterministicId ? { identifier: deterministicId } : {}),
      content: {
        title: isAlarm
          ? tNotif('Task Alarm', { lng: lang })
          : tNotif('Task Reminder', { lng: lang }),

        body: isAlarm
          ? tNotif('{{taskName}} is due now', { lng: lang, taskName })
          : `${taskName}${offsetSuffix}`,

        sound: isCar ? null : (activeSound || 'default'),

        priority:
          Notifications.AndroidNotificationPriority.MAX,

        categoryIdentifier: category,

        data: {
          taskId,
          isAlarm,
          reminderType,
          reminderOffsetLabel: advancedOptions?.reminderOffsetLabel || null,
          baseTaskName,
        },

        /*
         * Makes the Android notification harder to dismiss,
         * but it still does not create a real alarm screen.
         */
        sticky: isAlarm,
        autoDismiss: !isAlarm,
      },

      trigger: buildDateTrigger(targetDate.toDate(), activeChannelId),
    });
    
    DevLogger.success(`Successfully scheduled exact notification`, { scheduledId, channelId, sound, taskName });
    return scheduledId;
  } catch (error) {
    DevLogger.error(`Error scheduling task reminder`, error.message);
    console.error(
      'Error scheduling task reminder:',
      error
    );
    if (Platform.OS === 'android') {
      ToastAndroid.show(`Error scheduling: ${error.message}`, ToastAndroid.LONG);
    }

    return null;
  }
}

export async function scheduleLocalNotification(
  title,
  body,
  seconds = 3,
  isSilent = false
) {
  if (Platform.OS === 'web') return null;
  try {
    if (Platform.OS === 'android') {
      // Use v2 to force Android to create a fresh channel with these settings
      const channelId = isSilent ? 'task_silent_notification_v2' : 'task_default_system_sound_v11';

      await Notifications.setNotificationChannelAsync(channelId, {
        name: isSilent ? 'Silent notifications' : 'Task notifications',
        description: isSilent ? 'Notifications without sound' : 'Task notifications with system sound',
        // LOW importance (2) shows visually but guarantees NO sound and NO vibration on Android
        importance: isSilent ? Notifications.AndroidImportance.LOW : Notifications.AndroidImportance.MAX,
        sound: isSilent ? null : 'default',
        enableVibrate: !isSilent,
        vibrationPattern: isSilent ? null : VIBRATION_PRESETS.newTask,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      return await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: isSilent ? null : 'default',
          // Use LOW priority to match channel importance
          priority: isSilent ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidNotificationPriority.MAX,
        },

        trigger: buildTimeIntervalTrigger(seconds, channelId, false),
      });
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: isSilent ? null : 'default',
      },

      trigger: buildTimeIntervalTrigger(seconds, null, false),
    });
  } catch (error) {
    console.error(
      'Error scheduling local notification:',
      error
    );

    if (Platform.OS === 'android') {
      ToastAndroid.show(
        `Notification error: ${error.message}`,
        ToastAndroid.LONG
      );
    }

    return null;
  }
}

export async function scheduleCalendarNotification(
  title,
  body,
  date,
  data = {},
  themeState = {}
) {
  if (Platform.OS === 'web') return null;
  const notificationSound = themeState?.notificationSound || 'default';
  const vibrationEnabled = themeState?.vibrationEnabled !== false;
  const channelId = getCalendarChannelId(notificationSound, vibrationEnabled);

  if (Platform.OS === 'android') {
    await configureAndroidNotificationChannels(notificationSound, themeState?.alarmSound || 'default', vibrationEnabled);
  }

  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: notificationSound,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data,
    },
    trigger: buildDateTrigger(date instanceof Date ? date : new Date(date), channelId),
  });
}

export async function cancelNotification(notificationIds, taskId = null) {
  if (Platform.OS === 'web') return;
  if (notificationIds) {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
    for (const id of ids) {
      if (id) {
        if (typeof id === 'string' && id.startsWith('native_alarm_')) {
          if (Platform.OS === 'android') {
            await cancelAlarm(id.replace('native_alarm_', ''));
          }
        } else if (typeof id === 'string' && id.startsWith('pomodoro_alarm_')) {
          if (Platform.OS === 'android') {
            await cancelPomodoroAlarm(id.replace('pomodoro_alarm_', ''));
          }
        } else {
          try {
            await Notifications.cancelScheduledNotificationAsync(id);
            await Notifications.dismissNotificationAsync(id);
          } catch (e) {}
        }
      }
    }
  }

  const targetId = taskId || (typeof notificationIds === 'string' && !notificationIds.startsWith('native_') && !notificationIds.startsWith('pomodoro_') ? notificationIds : null);
  if (targetId) {
    try {
      if (Platform.OS === 'android') {
        await cancelAlarm(String(targetId));
      }
      const suffix = `_${targetId}`;
      for (const prefix of ['task_exact', 'task_persist']) {
        try {
          await Notifications.cancelScheduledNotificationAsync(`${prefix}_${targetId}`);
          await Notifications.dismissNotificationAsync(`${prefix}_${targetId}`);
        } catch (e) {}
      }
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const item of scheduled) {
        const itemTaskId = item.content?.data?.taskId;
        const itemId = String(item.identifier || '');
        if (
          (itemTaskId !== undefined && itemTaskId !== null && String(itemTaskId) === String(targetId)) ||
          (itemId.startsWith('task_') && itemId.endsWith(suffix))
        ) {
          await Notifications.cancelScheduledNotificationAsync(item.identifier);
          await Notifications.dismissNotificationAsync(item.identifier);
        }
      }

      const presented = await Notifications.getPresentedNotificationsAsync();
      for (const item of presented) {
        const req = item?.request || item;
        const itemTaskId = req?.content?.data?.taskId;
        const itemId = String(req?.identifier || '');
        if (
          (itemTaskId !== undefined && itemTaskId !== null && String(itemTaskId) === String(targetId)) ||
          (itemId.startsWith('task_') && itemId.endsWith(suffix))
        ) {
          await Notifications.dismissNotificationAsync(itemId);
        }
      }
    } catch (err) {
      // Silently catch errors during notification cleanup
    }
  }
}

export { schedulePomodoroAlarm, cancelPomodoroAlarm };

export async function rescheduleAllActiveTasks(tasks, themeState, dispatch, updateTaskAction) {
  for (const task of tasks) {
    if (task.completed) continue;
    await cancelNotification(task.notificationId, task.id);
    
    const hasReminder = task.reminder && task.reminder !== 'None';
    const isKeepAllDay = !!task.keepNotificationAllDay;
    if (hasReminder || isKeepAllDay) {
      const notifIds = await scheduleTaskReminder(
        task.taskname,
        task.reminder,
        task.completionDate,
        task.time,
        task.id,
        task.isAlarm || false,
        themeState,
        {
          isNagMode: task.isNagMode,
          escalationLevel: task.escalationLevel,
          keepNotificationAllDay: task.keepNotificationAllDay
        }
      );
      
      if (notifIds && notifIds.length > 0) {
        dispatch(updateTaskAction({ taskId: task.id, notificationId: notifIds }));
      } else {
        dispatch(updateTaskAction({ taskId: task.id, notificationId: [] }));
      }
    } else {
      dispatch(updateTaskAction({ taskId: task.id, notificationId: [] }));
    }
  }
}

export function parseAutomationTimeString(timeStr, defaultHour = 8, defaultMinute = 0) {
  if (!timeStr || typeof timeStr !== 'string') {
    return { hour: defaultHour, minute: defaultMinute };
  }
  const str = timeStr.trim();
  const isPm = /pm/i.test(str);
  const isAm = /am/i.test(str);
  const clean = str.replace(/(am|pm)/i, '').trim();
  const parts = clean.split(':').map((n) => parseInt(n, 10));
  let hour = !isNaN(parts[0]) ? parts[0] : defaultHour;
  let minute = !isNaN(parts[1]) ? parts[1] : defaultMinute;
  if (isPm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;
  hour = Math.max(0, Math.min(23, hour));
  minute = Math.max(0, Math.min(59, minute));
  return { hour, minute };
}

const AUTOMATION_TITLES = new Set(
  Object.values(NOTIFICATION_TRANSLATIONS).flatMap((dict) => [
    dict['Good Morning!'],
    dict['Daily Summary'],
    dict['Evening Review'],
  ]).filter(Boolean)
);
const TASK_REMINDER_TITLES = new Set(
  Object.values(NOTIFICATION_TRANSLATIONS).flatMap((dict) => [
    dict['Task Reminder'],
    dict['Task Alarm'],
  ]).filter(Boolean)
);
const AUTOMATION_TYPES = ['morning', 'summary', 'evening'];
const AUTOMATION_DAYS_AHEAD = 7;

let automationSyncLock = Promise.resolve();
let lastAutomationFingerprint = null;

export function isAutomationNotificationObject(notifOrReq) {
  if (!notifOrReq) return false;
  const req = notifOrReq.request || notifOrReq;
  const id = String(req?.identifier || notifOrReq?.identifier || '');
  const content = req?.content || notifOrReq?.content || {};
  const data = content?.data || {};
  const title = String(content?.title || '').trim();
  return (
    id.startsWith('automation_') ||
    Boolean(data?.isAutomation) ||
    Boolean(data?.automationType) ||
    AUTOMATION_TITLES.has(title)
  );
}

export const BEFORE_REMINDER_SUFFIX_REGEX = /\s*\(((?:\d+\s*(?:min|minute|mins|minutes|hr|hour|hrs|hours|h|std|stunde|stunden|ora|ore|мин|минут|минуты|час|часа|часов|дн|день|дня|дней|días|día|jours|jour|tag|tage|tagen|giorno|giorni|मिनट|घंटे|घंटा|दिन|분|시간|일|分|分間|時間|日|分钟|小时|天)\s*(?:before|antes|avant|vorher|prima|до|पहले|전|前)|(?:за|提前)\s*\d+\s*(?:мин|минут|минуты|ч|час|часа|часов|дн|день|дня|дней|分钟|小时|天)))\)\s*$/i;

const KNOWN_BEFORE_OFFSET_SLOTS = [
  '5_min_before',
  '10_min_before',
  '15_min_before',
  '30_min_before',
  '1_hr_before',
  '2_hr_before',
  '1_day_before',
];

const KNOWN_ESCALATION_SLOTS = [
  'esc_1_hour',
  'esc_30_minute',
  'esc_15_minute',
  'esc_5_minute',
  'esc_1_minute',
];

export function normalizeTaskNotificationBaseName(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(BEFORE_REMINDER_SUFFIX_REGEX, '')
    .replace(/^\[(?:URGENT|OVERDUE|СРОЧНО|ПРОСРОЧЕНО|URGENTE|VENCIDA|紧急|已逾期|緊急|期限切れ|EN RETARD|DRINGEND|ÜBERFÄLLIG|SCADUTA|अत्यावश्यक|अतिदेय|긴급|기한 지남)\]\s*/i, '')
    .replace(/^Срок выполнения:\s*/i, '')
    .replace(/^지금\s+(.+)\s+할 시간입니다$/i, '$1')
    .replace(/(?:\s+is due now|\s+vence ahora|\s+arrive à échéance|\s+ist jetzt fällig|\s+è in scadenza ora|\s+现已到期|\s+の時間です|\s+का समय हो गया है)$/i, '')
    .trim();
}

export function extractTaskNotificationMeta(notifOrReq) {
  if (!notifOrReq) return null;
  const req = notifOrReq.request || notifOrReq;
  const rawId = String(req?.identifier || notifOrReq?.identifier || '');
  let tag = rawId;
  if (rawId.startsWith('expo-notifications://foreign_notifications')) {
    const tagMatch = rawId.match(/[?&]tag=([^&]+)/);
    if (tagMatch && tagMatch[1]) {
      try {
        tag = decodeURIComponent(tagMatch[1]);
      } catch (e) {
        tag = tagMatch[1];
      }
    }
  }

  const content = req?.content || notifOrReq?.content || {};
  let data = content?.data || {};
  if ((!data || Object.keys(data).length === 0) && typeof content?.dataString === 'string' && content.dataString.trim().startsWith('{')) {
    try {
      data = JSON.parse(content.dataString);
    } catch (e) {
      data = {};
    }
  }

  const title = String(content?.title || '').trim();
  const body = String(content?.body || content?.text || '').trim();

  let taskId = data?.taskId !== undefined && data?.taskId !== null && String(data.taskId) !== ''
    ? String(data.taskId)
    : null;

  let slotType = null;
  if (tag.startsWith('task_exact_')) {
    slotType = 'exact';
    if (!taskId) taskId = tag.slice('task_exact_'.length) || null;
  } else if (tag.startsWith('task_persist_')) {
    slotType = 'persist';
    if (!taskId) taskId = tag.slice('task_persist_'.length) || null;
  } else if (tag.startsWith('task_offset_')) {
    slotType = 'before';
    if (!taskId) {
      const m = tag.match(/^task_offset_[a-z0-9_]*?_before_(.+)$/i);
      if (m && m[1]) taskId = m[1];
    }
  } else if (tag.startsWith('task_esc_')) {
    slotType = 'before';
    if (!taskId) {
      const m = tag.match(/^task_esc_\d+_(?:hour|minute|day)_(.+)$/i);
      if (m && m[1]) taskId = m[1];
    }
  } else if (tag.startsWith('task_nag_')) {
    slotType = 'nag';
    if (!taskId) {
      const m = tag.match(/^task_nag_\d+_(.+)$/i);
      if (m && m[1]) taskId = m[1];
    }
  }

  const isPersistent = Boolean(
    slotType === 'persist' ||
    data?.keepNotificationAllDay ||
    content?.categoryIdentifier === 'task_persistent'
  );

  const hasBeforeSuffix = BEFORE_REMINDER_SUFFIX_REGEX.test(body);
  const isBefore = Boolean(
    !isPersistent &&
    (slotType === 'before' ||
      data?.reminderType === 'before' ||
      Boolean(data?.reminderOffsetLabel) ||
      hasBeforeSuffix ||
      /^\[(?:URGENT|СРОЧНО|URGENTE|紧急|緊急|DRINGEND|अत्यावश्यक|긴급)\]\s*/i.test(body))
  );

  const isTaskNotification = Boolean(
    !isAutomationNotificationObject(notifOrReq) &&
    (taskId !== null ||
      tag.startsWith('task_') ||
      TASK_REMINDER_TITLES.has(title) ||
      content?.categoryIdentifier === 'task_reminder' ||
      content?.categoryIdentifier === 'task_regular' ||
      content?.categoryIdentifier === 'task_alarm')
  );

  const isExact = Boolean(isTaskNotification && !isPersistent && !isBefore);
  const baseTaskName = normalizeTaskNotificationBaseName(data?.baseTaskName || body);

  return {
    id: rawId,
    tag,
    title,
    body,
    data,
    taskId,
    isTaskNotification,
    isPersistent,
    isBefore,
    isExact,
    baseTaskName,
  };
}

export async function dismissPriorBeforeNotificationsForTaskAsync(
  taskId = null,
  baseTaskName = null,
  excludeIdentifier = null
) {
  if (Platform.OS === 'web') return 0;
  let dismissedCount = 0;
  const cleanTaskId = taskId !== undefined && taskId !== null && String(taskId) !== '' ? String(taskId) : null;
  const cleanBaseName = normalizeTaskNotificationBaseName(baseTaskName).toLowerCase();

  // 1. Directly dismiss deterministic 'before' and escalation notification IDs for this taskId
  if (cleanTaskId && typeof Notifications.dismissNotificationAsync === 'function') {
    for (const slot of KNOWN_BEFORE_OFFSET_SLOTS) {
      const candidateId = `task_offset_${slot}_${cleanTaskId}`;
      if (candidateId !== excludeIdentifier) {
        try {
          await Notifications.dismissNotificationAsync(candidateId);
        } catch (e) {}
      }
    }
    for (const escSlot of KNOWN_ESCALATION_SLOTS) {
      const candidateId = `task_${escSlot}_${cleanTaskId}`;
      if (candidateId !== excludeIdentifier) {
        try {
          await Notifications.dismissNotificationAsync(candidateId);
        } catch (e) {}
      }
    }
  }

  // 2. Scan currently presented notifications in the tray and dismiss any matching 'before' notifications
  if (typeof Notifications.getPresentedNotificationsAsync === 'function') {
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      if (Array.isArray(presented)) {
        for (const item of presented) {
          const meta = extractTaskNotificationMeta(item);
          if (!meta || !meta.id || meta.isPersistent) continue;
          if (excludeIdentifier && (meta.id === excludeIdentifier || meta.tag === excludeIdentifier)) {
            continue;
          }
          const matchesTaskId = Boolean(cleanTaskId && meta.taskId && String(meta.taskId) === cleanTaskId);
          const matchesBaseName = Boolean(
            cleanBaseName &&
            meta.isTaskNotification &&
            meta.baseTaskName &&
            meta.baseTaskName.toLowerCase() === cleanBaseName
          );
          if ((matchesTaskId || matchesBaseName) && meta.isBefore) {
            try {
              await Notifications.dismissNotificationAsync(meta.id);
              dismissedCount++;
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }

  return dismissedCount;
}

export async function dismissPriorBeforeNotificationsForIncomingAsync(incomingNotification) {
  if (!incomingNotification || Platform.OS === 'web') return 0;
  const meta = extractTaskNotificationMeta(incomingNotification);
  if (!meta || !meta.isTaskNotification || meta.isPersistent) return 0;
  // When an exact-time notification (or nag notification) fires, dismiss all prior 'before' notifications for this task
  if (!meta.isBefore && (meta.taskId || meta.baseTaskName)) {
    return await dismissPriorBeforeNotificationsForTaskAsync(meta.taskId, meta.baseTaskName, meta.id);
  }
  return 0;
}

export async function deduplicatePresentedNotificationsAsync(incomingNotification = null) {
  if (Platform.OS === 'web') return 0;
  let dismissedCount = 0;
  try {
    if (incomingNotification) {
      dismissedCount += await dismissPriorBeforeNotificationsForIncomingAsync(incomingNotification);
    }
    if (typeof Notifications.getPresentedNotificationsAsync !== 'function') {
      return dismissedCount;
    }
    const presented = await Notifications.getPresentedNotificationsAsync();
    if (!Array.isArray(presented) || presented.length <= 1) {
      return dismissedCount;
    }

    // Sort so that exact-time notifications ALWAYS take priority over "before" notifications,
    // and then newest date first so the latest notification wins and older/before ones are dismissed.
    const sorted = [...presented].sort((a, b) => {
      const metaA = extractTaskNotificationMeta(a);
      const metaB = extractTaskNotificationMeta(b);
      if (metaA?.isTaskNotification && metaB?.isTaskNotification) {
        if (metaA.isBefore !== metaB.isBefore) {
          return metaA.isBefore ? 1 : -1;
        }
      }
      return (Number(b?.date) || 0) - (Number(a?.date) || 0);
    });

    const seenKeys = new Set();

    for (const item of sorted) {
      const req = item?.request || item;
      const id = req?.identifier || item?.identifier;
      if (!id) continue;

      const content = req?.content || item?.content || {};
      const data = content?.data || {};
      const title = String(content?.title || '').trim();
      const body = String(content?.body || '').trim();
      const meta = extractTaskNotificationMeta(item);

      const candidateKeys = [];
      if (isAutomationNotificationObject(item)) {
        candidateKeys.push(`automation:${data?.automationType || title}`);
      } else if (meta?.isPersistent) {
        candidateKeys.push(`persist:${meta.taskId || meta.baseTaskName || body}`);
      } else if (meta?.isTaskNotification) {
        if (meta.taskId) {
          candidateKeys.push(`task:${meta.taskId}:${title.toLowerCase()}`);
        }
        if (meta.baseTaskName) {
          candidateKeys.push(`taskBase:${title.toLowerCase()}:${meta.baseTaskName.toLowerCase()}`);
        }
      } else if (title || body) {
        candidateKeys.push(`generic:${title}:${body}`);
      }

      if (candidateKeys.length === 0) continue;

      const isDuplicateOrSuperseded = candidateKeys.some((k) => seenKeys.has(k));
      if (isDuplicateOrSuperseded) {
        try {
          await Notifications.dismissNotificationAsync(id);
          dismissedCount++;
        } catch (e) {}
      } else {
        for (const k of candidateKeys) {
          seenKeys.add(k);
        }
      }
    }
  } catch (error) {
    DevLogger.error('Failed to deduplicate presented notifications', error);
  }
  return dismissedCount;
}

export async function cancelExistingAutomationsAsync() {
  if (Platform.OS === 'web') return;

  // 1. Explicitly cancel all deterministic slot IDs so native Android AlarmManager PendingIntents are cleared
  for (const type of AUTOMATION_TYPES) {
    for (let i = 0; i < AUTOMATION_DAYS_AHEAD; i++) {
      try {
        await Notifications.cancelScheduledNotificationAsync(`automation_${type}_${i}`);
      } catch (e) {}
    }
  }

  // 2. Also sweep any legacy random-UUID scheduled automation notifications (even if Android stripped data.isAutomation)
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (Array.isArray(scheduled)) {
      for (const notif of scheduled) {
        if (isAutomationNotificationObject(notif)) {
          try {
            await Notifications.cancelScheduledNotificationAsync(notif.identifier);
          } catch (e) {}
        }
      }
    }
  } catch (error) {
    DevLogger.error('Failed to cancel existing automations', error);
  }
}

export function resetAutomationScheduleCacheForTests() {
  lastAutomationFingerprint = null;
}

export async function updateRecurringAutomations(themeState, tasks = [], isPremium = true, options = {}) {
  if (Platform.OS === 'web') return;

  const runSerialized = async () => {
    // Always deduplicate any duplicate notifications currently sitting in the Android shade
    await deduplicatePresentedNotificationsAsync();

    const {
      morningReminder, morningReminderTime,
      eveningReminder, eveningReminderTime,
      summaryReminder, summaryReminderTime
    } = themeState || {};

    const boardAutomations = themeState?.boardAutomations || {};
    const anyBoardOverride = Object.values(boardAutomations).find(
      (b) => b && b.overrideGlobal && (b.morningReminder || b.eveningReminder || b.summaryReminder)
    );

    const effMorning = Boolean(morningReminder || anyBoardOverride?.morningReminder);
    const effMorningTime = (morningReminder ? morningReminderTime : anyBoardOverride?.morningReminderTime) || '08:00';
    const effEvening = Boolean(eveningReminder || anyBoardOverride?.eveningReminder);
    const effEveningTime = (eveningReminder ? eveningReminderTime : anyBoardOverride?.eveningReminderTime) || '20:00';
    const effSummary = Boolean(summaryReminder || anyBoardOverride?.summaryReminder);
    const effSummaryTime = (summaryReminder ? summaryReminderTime : anyBoardOverride?.summaryReminderTime) || '09:00';

    if (!effMorning && !effEvening && !effSummary) {
      await cancelExistingAutomationsAsync();
      lastAutomationFingerprint = 'disabled';
      return;
    }

    const notificationSound = themeState?.notificationSound || 'default';
    const alarmSound = themeState?.alarmSound || 'default';
    const vibrationEnabled = themeState?.vibrationEnabled !== false;
    const channelId = getChannelId(false, notificationSound, vibrationEnabled);
    const lang = resolveNotificationLanguage(options?.language || themeState?.language || themeState?.appLanguage);

    const now = dayjs();
    const isSameMinuteTest = [
      effMorning ? parseAutomationTimeString(effMorningTime, 8, 0) : null,
      effSummary ? parseAutomationTimeString(effSummaryTime, 9, 0) : null,
      effEvening ? parseAutomationTimeString(effEveningTime, 20, 0) : null,
    ].some((parsed) => parsed && parsed.hour === now.hour() && parsed.minute === now.minute());

    const activeTasksSig = (tasks || [])
      .filter((t) => t && !t.completed)
      .map((t) => `${t.id || t._id || ''}:${t.taskname || ''}:${t.completionDate || ''}:${t.time || ''}`)
      .join('|');

    const fingerprint = [
      lang,
      now.format('YYYY-MM-DD:HH'),
      effMorning ? `M:${effMorningTime}` : 'M:off',
      effSummary ? `S:${effSummaryTime}` : 'S:off',
      effEvening ? `E:${effEveningTime}` : 'E:off',
      channelId,
      activeTasksSig,
    ].join('::');

    if (!options?.force && !isSameMinuteTest && fingerprint === lastAutomationFingerprint) {
      return;
    }

    await cancelExistingAutomationsAsync();

    // Ensure channel exists
    await configureAndroidNotificationChannels(notificationSound, alarmSound, vibrationEnabled);

    // Helper to find the absolute next occurrence of a time, with an optional day offset
    const getNextOccurrence = (hour, minute, daysOffset = 0) => {
      const refNow = dayjs();
      let next = dayjs().hour(hour).minute(minute).second(0).millisecond(0);
      // If user sets reminder for the current minute, fire in 5 seconds for immediate feedback
      if (daysOffset === 0 && next.isSame(refNow, 'minute')) {
        return refNow.add(5, 'second');
      }
      // If the time has already passed today, start from tomorrow
      if (next.isSameOrBefore(refNow)) {
        next = next.add(1, 'day');
      }
      return next.add(daysOffset, 'day');
    };

    // Helper to determine if a task is overdue relative to a reference trigger date/time
    const isTaskOverdueAt = (task, refDateTime) => {
      if (!task || task.completed || !task.completionDate) return false;
      const taskDate = dayjs(task.completionDate);
      if (taskDate.isBefore(refDateTime, 'day')) return true;
      if (taskDate.isSame(refDateTime, 'day') && task.time) {
        const { hour: h, minute: m } = parseAutomationTimeString(task.time, -1, -1);
        if (h >= 0 && m >= 0) {
          const taskDateTime = dayjs(task.completionDate).hour(h).minute(m).second(0).millisecond(0);
          if (taskDateTime.isBefore(refDateTime)) return true;
        }
      }
      return false;
    };

    // Morning Reminder: Upcoming tasks (Schedule for next 7 days)
    if (effMorning && effMorningTime) {
      const { hour, minute } = parseAutomationTimeString(effMorningTime, 8, 0);

      for (let i = 0; i < AUTOMATION_DAYS_AHEAD; i++) {
        const triggerDate = getNextOccurrence(hour, minute, i);

        const dueToday = (tasks || []).filter(t => t && !t.completed && t.completionDate && dayjs(t.completionDate).isSame(triggerDate, 'day'));
        const overdue = (tasks || []).filter(t => isTaskOverdueAt(t, triggerDate));

        let bodyText = tNotif('You have no tasks due today. Have a great day!', { lng: lang });
        if (dueToday.length > 0) {
          if (lang === 'en') {
            bodyText = `You have ${dueToday.length} task${dueToday.length === 1 ? '' : 's'} for today`;
          } else {
            bodyText = tNotif('You have {{count}} task(s) for today', { lng: lang, count: dueToday.length });
          }
          if (overdue.length > 0) {
            bodyText += ` (${overdue.length} ${tNotif('overdue', { lng: lang })})`;
          }
          bodyText += '.\n';
          const top5 = [...dueToday, ...overdue].slice(0, 5);
          bodyText += top5.map(t => `• ${t.taskname}`).join('\n');
          if (dueToday.length + overdue.length > 5) {
            bodyText += `\n${tNotif('...and {{count}} more', { lng: lang, count: dueToday.length + overdue.length - 5 })}`;
          }
        } else if (overdue.length > 0) {
          if (lang === 'en') {
            bodyText = `You have no tasks due today, but ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'} waiting.\n`;
          } else {
            bodyText = `${tNotif('You have no tasks due today, but {{count}} overdue task(s) waiting.', { lng: lang, count: overdue.length })}\n`;
          }
          const top5 = overdue.slice(0, 5);
          bodyText += top5.map(t => `• ${t.taskname}`).join('\n');
          if (overdue.length > 5) {
            bodyText += `\n${tNotif('...and {{count}} more', { lng: lang, count: overdue.length - 5 })}`;
          }
        }

        try {
          await Notifications.scheduleNotificationAsync({
            identifier: `automation_morning_${i}`,
            content: {
              title: tNotif('Good Morning!', { lng: lang }),
              body: bodyText,
              sound: notificationSound || 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              categoryIdentifier: 'task_regular',
              data: { isAutomation: true, automationType: 'morning', daySlot: i },
            },
            trigger: buildDateTrigger(triggerDate.toDate(), channelId),
          });
        } catch (error) {
          DevLogger.error('Failed to schedule morning reminder', error);
        }
      }
    }

    // Summary Reminder: Overdue tasks (Schedule for next 7 days)
    if (effSummary && effSummaryTime) {
      const { hour, minute } = parseAutomationTimeString(effSummaryTime, 9, 0);

      for (let i = 0; i < AUTOMATION_DAYS_AHEAD; i++) {
        const triggerDate = getNextOccurrence(hour, minute, i);

        const overdueTasks = (tasks || []).filter(t => isTaskOverdueAt(t, triggerDate));

        let bodyText = tNotif('All tasks are on track! You have no overdue tasks.', { lng: lang });
        if (overdueTasks.length > 0) {
          if (lang === 'en') {
            bodyText = `You have ${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'} waiting.\n`;
          } else {
            bodyText = `${tNotif('You have {{count}} overdue task(s) waiting.', { lng: lang, count: overdueTasks.length })}\n`;
          }
          const top5 = overdueTasks.slice(0, 5);
          bodyText += top5.map(t => `• ${t.taskname}`).join('\n');
          if (overdueTasks.length > 5) {
            bodyText += `\n${tNotif('...and {{count}} more', { lng: lang, count: overdueTasks.length - 5 })}`;
          }
        }

        try {
          await Notifications.scheduleNotificationAsync({
            identifier: `automation_summary_${i}`,
            content: {
              title: tNotif('Daily Summary', { lng: lang }),
              body: bodyText,
              sound: notificationSound || 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              categoryIdentifier: 'task_regular',
              data: { isAutomation: true, automationType: 'summary', daySlot: i },
            },
            trigger: buildDateTrigger(triggerDate.toDate(), channelId),
          });
        } catch (error) {
          DevLogger.error('Failed to schedule summary reminder', error);
        }
      }
    }

    // Evening Reminder: Unfinished tasks (Schedule for next 7 days)
    if (effEvening && effEveningTime) {
      const { hour, minute } = parseAutomationTimeString(effEveningTime, 20, 0);

      for (let i = 0; i < AUTOMATION_DAYS_AHEAD; i++) {
        const triggerDate = getNextOccurrence(hour, minute, i);

        const unfinishedTasks = (tasks || []).filter(t => t && !t.completed && t.completionDate && dayjs(t.completionDate).isSameOrBefore(triggerDate, 'day'));

        let bodyText = tNotif('All caught up for today! Have a relaxing evening.', { lng: lang });
        if (unfinishedTasks.length > 0) {
          if (lang === 'en') {
            bodyText = `Wrap up ${unfinishedTasks.length} unfinished task${unfinishedTasks.length === 1 ? '' : 's'} before the day ends.\n`;
          } else {
            bodyText = `${tNotif('Wrap up {{count}} unfinished task(s) before the day ends.', { lng: lang, count: unfinishedTasks.length })}\n`;
          }
          const top5 = unfinishedTasks.slice(0, 5);
          bodyText += top5.map(t => `• ${t.taskname}`).join('\n');
          if (unfinishedTasks.length > 5) {
            bodyText += `\n${tNotif('...and {{count}} more', { lng: lang, count: unfinishedTasks.length - 5 })}`;
          }
        }

        try {
          await Notifications.scheduleNotificationAsync({
            identifier: `automation_evening_${i}`,
            content: {
              title: tNotif('Evening Review', { lng: lang }),
              body: bodyText,
              sound: notificationSound || 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              categoryIdentifier: 'task_regular',
              data: { isAutomation: true, automationType: 'evening', daySlot: i },
            },
            trigger: buildDateTrigger(triggerDate.toDate(), channelId),
          });
        } catch (error) {
          DevLogger.error('Failed to schedule evening reminder', error);
        }
      }
    }

    lastAutomationFingerprint = fingerprint;
  };

  automationSyncLock = automationSyncLock.then(runSerialized, runSerialized);
  return automationSyncLock;
}

export async function testAndroidDefaultNotification() {
  if (Platform.OS !== 'android') {
    DevLogger.warn('System notification test is Android-only');
    return null;
  }

  // Use a new ID for this diagnostic test.
  // Increment this manually if you test a changed configuration later.
  const channelId = 'debug_system_sound_v16';

  DevLogger.info('Starting Android default-sound diagnostic', {
    platform: Platform.OS,
    channelId,
    time: new Date().toISOString(),
  });

  try {
    // 1. Read notification permission.
    const permissions =
      await Notifications.getPermissionsAsync();

    DevLogger.info('Notification permissions', permissions);

    if (permissions.status !== 'granted') {
      const requested =
        await Notifications.requestPermissionsAsync();

      DevLogger.info(
        'Notification permissions after request',
        requested
      );

      if (requested.status !== 'granted') {
        DevLogger.error(
          'Notification permission is not granted',
          requested
        );
        return null;
      }
    }

    // 2. Remove this exact diagnostic channel first.
    // This helps during development, provided Android does not restore it.
    try {
      await Notifications.deleteNotificationChannelAsync(
        channelId
      );

      DevLogger.info(
        'Deleted previous diagnostic channel',
        { channelId }
      );
    } catch (deleteError) {
      DevLogger.warn(
        'Could not delete previous diagnostic channel',
        serializeError(deleteError)
      );
    }

    // 3. Create a channel using only Android's system sound.
    const createdChannel =
      await Notifications.setNotificationChannelAsync(
        channelId,
        {
          name: 'Sound diagnostic',
          description:
            'Temporary channel for notification sound diagnostics',

          importance:
            Notifications.AndroidImportance.MAX,

          sound: 'default',

          enableVibrate: true,

          vibrationPattern: [0, 300, 150, 300],

          lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
        }
      );

    DevLogger.info(
      'setNotificationChannelAsync result',
      createdChannel
    );

    // 4. Read back what Android actually stored.
    const storedChannel =
      await Notifications.getNotificationChannelAsync(
        channelId
      );

    DevLogger.info(
      'Stored Android diagnostic channel',
      normalizeChannelForLog(storedChannel)
    );

    if (!storedChannel) {
      DevLogger.error(
        'Android did not return the diagnostic channel',
        { channelId }
      );
      return null;
    }

    if (
      storedChannel.importance ===
      Notifications.AndroidImportance.NONE
    ) {
      DevLogger.error(
        'Diagnostic channel is blocked',
        normalizeChannelForLog(storedChannel)
      );
    }

    if (!storedChannel.sound) {
      DevLogger.error(
        'Diagnostic channel is silent: Android returned no sound',
        normalizeChannelForLog(storedChannel)
      );
    }

    // 5. Schedule the notification.
    const notificationId =
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Android Sound Test',
          body: 'This notification should use the system sound.',

          // Channel controls Android 8+ sound, but keeping this
          // makes the intended behavior explicit.
          sound: 'default',

          priority:
            Notifications.AndroidNotificationPriority.MAX,

          data: {
            diagnostic: true,
            expectedSound: 'default',
            channelId,
          },
        },

        trigger: buildTimeIntervalTrigger(3, channelId, false),
      });

    DevLogger.success(
      'Diagnostic notification scheduled',
      {
        notificationId,
        channelId,
        expectedSound: 'default',
        firesInSeconds: 3,
      }
    );

    // 6. Confirm it exists in Expo's scheduled list.
    const scheduled =
      await Notifications.getAllScheduledNotificationsAsync();

    const matchingNotification = scheduled.find(
      item => item.identifier === notificationId
    );

    DevLogger.info(
      'Scheduled notification verification',
      matchingNotification
        ? {
            found: true,
            identifier: matchingNotification.identifier,
            content: matchingNotification.content,
            trigger: matchingNotification.trigger,
          }
        : {
            found: false,
            notificationId,
          }
    );

    return notificationId;
  } catch (error) {
    DevLogger.error(
      'Android default-sound diagnostic failed',
      serializeError(error)
    );

    return null;
  }
}

export function attachNotificationDiagnostics() {
  // Clean up any duplicate notifications already sitting in the tray on startup
  deduplicatePresentedNotificationsAsync().catch(() => {});

  const receivedSubscription =
    Notifications.addNotificationReceivedListener(
      notification => {
        // Immediately dismiss any prior "before" reminder when the exact-time reminder fires,
        // and re-check shortly after presentation completes on Android
        deduplicatePresentedNotificationsAsync(notification).catch(() => {});
        setTimeout(() => {
          deduplicatePresentedNotificationsAsync(notification).catch(() => {});
        }, 400);
        if (Platform.OS === 'android' && typeof duckAudioForNotification === 'function') {
          const isPersistentSilent = !!(notification?.request?.content?.data?.keepNotificationAllDay);
          if (!isPersistentSilent) {
            try { duckAudioForNotification(); } catch (e) {}
          }
        }
        DevLogger.success(
          'Notification received by application',
          {
            identifier:
              notification.request.identifier,

            content:
              notification.request.content,

            trigger:
              notification.request.trigger,

            receivedAt:
              new Date().toISOString(),
          }
        );
      }
    );

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener(
      response => {
        DevLogger.info(
          'User interacted with notification',
          {
            actionIdentifier:
              response.actionIdentifier,

            identifier:
              response.notification.request.identifier,

            content:
              response.notification.request.content,

            trigger:
              response.notification.request.trigger,
          }
        );
      }
    );

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
