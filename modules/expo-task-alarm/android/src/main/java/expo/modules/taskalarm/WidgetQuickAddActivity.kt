package expo.modules.taskalarm

import android.app.Activity
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Floating native Home-Screen Quick Add Dialog Activity.
 * Launches directly over the Android Home Screen launcher (taskAffinity="", excludeFromRecents=true)
 * so the user can create tasks with Date, Time, Priority, and Board/List without opening the full app.
 */
class WidgetQuickAddActivity : Activity() {

    private var selectedDateKey: String = TaskWidgetDataStore.getTodayDateKey()
    private var selectedTime24: String = ""
    private var selectedTimeLabel: String = ""
    private var selectedPriority: String = "none"
    private var selectedBoardId: String = "main"
    private var selectedBoardName: String = "Main"
    private var selectedBoardType: String = "standard"

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    private fun roundedBg(fillColor: Int, radiusDp: Int, strokeColor: Int = 0, strokeWidthDp: Int = 0): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(radiusDp).toFloat()
            setColor(fillColor)
            if (strokeWidthDp > 0) {
                setStroke(dp(strokeWidthDp), strokeColor)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)

        val snapshot = TaskWidgetDataStore.loadSnapshot(this)
        val palette = TaskWidgetDataStore.resolvePalette(this, snapshot)
        val lang = snapshot.language

        val incomingDate = intent?.getStringExtra(TaskWidgetActionReceiver.EXTRA_DATE_KEY)
        if (!incomingDate.isNullOrBlank() && incomingDate.matches(Regex("""^\d{4}-\d{2}-\d{2}$"""))) {
            selectedDateKey = incomingDate
        }

        val mainLabel = TaskTranslations.t(this, "board_main", lang)
        selectedBoardName = mainLabel

        // Discover available boards from current snapshot + standard defaults
        val boardOptions = LinkedHashMap<String, Triple<String, String, String>>()
        boardOptions["main"] = Triple("main", mainLabel, "standard")
        for (t in snapshot.tasks) {
            if (t.boardId.isNotBlank() && !boardOptions.containsKey(t.boardId)) {
                boardOptions[t.boardId] = Triple(
                    t.boardId,
                    t.boardName.ifBlank { TaskTranslations.t(this, "tasks_default", lang) },
                    t.boardType.ifBlank { "standard" }
                )
            }
        }
        if (!boardOptions.values.any { it.third == "grocery" }) {
            boardOptions["grocery_default"] = Triple("main", TaskTranslations.t(this, "board_groceries", lang), "grocery")
        }
        if (!boardOptions.values.any { it.third == "habits" }) {
            boardOptions["habits_default"] = Triple("main", TaskTranslations.t(this, "board_habits", lang), "habits")
        }

        val rootCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(16))
            background = roundedBg(
                fillColor = palette.surfaceBg,
                radiusDp = 22,
                strokeColor = TaskWidgetDataStore.blendAlpha(palette.accentColor, 0.45f),
                strokeWidthDp = 1
            )
        }

        // 1. Header Row
        val headerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val headerTitle = TextView(this).apply {
            text = TaskTranslations.t(this@WidgetQuickAddActivity, "quick_add_header", lang)
            setTextColor(palette.textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        val closeBtn = TextView(this).apply {
            text = "✕"
            setTextColor(palette.textSecondary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(4), dp(8), dp(4))
            setOnClickListener { finish() }
        }
        headerRow.addView(headerTitle)
        headerRow.addView(closeBtn)
        rootCard.addView(headerRow)

        // 2. Task Title Input
        val inputBox = EditText(this).apply {
            hint = TaskTranslations.t(this@WidgetQuickAddActivity, "quick_add_hint", lang)
            setHintTextColor(palette.textMuted)
            setTextColor(palette.textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            imeOptions = EditorInfo.IME_ACTION_DONE
            setSingleLine(true)
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = roundedBg(
                fillColor = palette.cardBg,
                radiusDp = 14,
                strokeColor = palette.pillBg,
                strokeWidthDp = 1
            )
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            lp.topMargin = dp(12)
            layoutParams = lp
        }
        rootCard.addView(inputBox)

        // 3. Date & Time Selector Row
        val dateTimeRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            lp.topMargin = dp(10)
            layoutParams = lp
        }

        val dateChip = TextView(this).apply {
            text = "📅 ${TaskWidgetDataStore.formatShortHeaderDate(selectedDateKey, lang)}"
            setTextColor(palette.textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(dp(12), dp(7), dp(12), dp(7))
            background = roundedBg(palette.pillBg, 999)
            setOnClickListener {
                val cal = Calendar.getInstance()
                try {
                    val parsed = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(selectedDateKey)
                    if (parsed != null) cal.time = parsed
                } catch (_: Exception) {}
                DatePickerDialog(
                    this@WidgetQuickAddActivity,
                    { _, y, m, d ->
                        selectedDateKey = String.format(Locale.US, "%04d-%02d-%02d", y, m + 1, d)
                        text = "📅 ${TaskWidgetDataStore.formatShortHeaderDate(selectedDateKey, lang)}"
                    },
                    cal.get(Calendar.YEAR),
                    cal.get(Calendar.MONTH),
                    cal.get(Calendar.DAY_OF_MONTH)
                ).show()
            }
        }

        val timeChip = TextView(this).apply {
            text = "🕒 ${TaskTranslations.t(this@WidgetQuickAddActivity, "add_time_chip", lang)}"
            setTextColor(palette.textSecondary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(dp(12), dp(7), dp(12), dp(7))
            background = roundedBg(palette.pillBg, 999)
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            lp.leftMargin = dp(8)
            layoutParams = lp
            setOnClickListener {
                val cal = Calendar.getInstance()
                TimePickerDialog(
                    this@WidgetQuickAddActivity,
                    { _, hourOfDay, minute ->
                        selectedTime24 = String.format(Locale.US, "%02d:%02d", hourOfDay, minute)
                        val period = if (hourOfDay >= 12) "PM" else "AM"
                        val h12 = if (hourOfDay % 12 == 0) 12 else hourOfDay % 12
                        selectedTimeLabel = String.format(Locale.US, "%d:%02d %s", h12, minute, period)
                        text = "🕒 $selectedTimeLabel"
                        setTextColor(palette.accentColor)
                    },
                    cal.get(Calendar.HOUR_OF_DAY),
                    cal.get(Calendar.MINUTE),
                    false
                ).show()
            }
        }

        dateTimeRow.addView(dateChip)
        dateTimeRow.addView(timeChip)
        rootCard.addView(dateTimeRow)

        // 4. Priority Chips Row
        val priorityRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            lp.topMargin = dp(10)
            layoutParams = lp
        }

        val priorities = listOf(
            Triple("none", TaskTranslations.t(this, "priority_normal", lang), palette.accentColor),
            Triple("low", TaskTranslations.t(this, "priority_low", lang), palette.infoColor),
            Triple("medium", TaskTranslations.t(this, "priority_medium", lang), palette.warningColor),
            Triple("high", TaskTranslations.t(this, "priority_high", lang), palette.dangerColor)
        )
        val priorityViews = ArrayList<Pair<String, TextView>>()

        fun refreshPriorityChips() {
            for ((pKey, tv) in priorityViews) {
                val pColor = priorities.first { it.first == pKey }.third
                val isSel = (selectedPriority == pKey)
                tv.background = roundedBg(
                    fillColor = if (isSel) TaskWidgetDataStore.blendAlpha(pColor, 0.25f) else palette.cardBg,
                    radiusDp = 999,
                    strokeColor = if (isSel) pColor else palette.pillBg,
                    strokeWidthDp = 1
                )
                tv.setTextColor(if (isSel) pColor else palette.textSecondary)
            }
        }

        for ((idx, pInfo) in priorities.withIndex()) {
            val (pKey, pLabel, _) = pInfo
            val chip = TextView(this).apply {
                text = pLabel
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                setPadding(dp(10), dp(5), dp(10), dp(5))
                val lp = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
                if (idx > 0) lp.leftMargin = dp(6)
                layoutParams = lp
                setOnClickListener {
                    selectedPriority = pKey
                    refreshPriorityChips()
                }
            }
            priorityViews.add(pKey to chip)
            priorityRow.addView(chip)
        }
        refreshPriorityChips()
        rootCard.addView(priorityRow)

        // 5. Board / List Selector Chips
        val boardScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            lp.topMargin = dp(10)
            layoutParams = lp
        }
        val boardRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        val boardChipViews = ArrayList<Pair<String, TextView>>()

        fun refreshBoardChips() {
            for ((bKey, tv) in boardChipViews) {
                val info = boardOptions[bKey] ?: continue
                val isSel = (selectedBoardName == info.second && selectedBoardType == info.third)
                tv.background = roundedBg(
                    fillColor = if (isSel) TaskWidgetDataStore.blendAlpha(palette.accentColor, 0.24f) else palette.cardBg,
                    radiusDp = 999,
                    strokeColor = if (isSel) palette.accentColor else palette.pillBg,
                    strokeWidthDp = 1
                )
                tv.setTextColor(if (isSel) palette.textPrimary else palette.textSecondary)
            }
        }

        for ((idx, entry) in boardOptions.entries.withIndex()) {
            val bKey = entry.key
            val (bId, bName, bType) = entry.value
            val chip = TextView(this).apply {
                text = bName
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                setPadding(dp(11), dp(5), dp(11), dp(5))
                val lp = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
                if (idx > 0) lp.leftMargin = dp(6)
                layoutParams = lp
                setOnClickListener {
                    selectedBoardId = bId
                    selectedBoardName = bName
                    selectedBoardType = bType
                    refreshBoardChips()
                }
            }
            boardChipViews.add(bKey to chip)
            boardRow.addView(chip)
        }
        refreshBoardChips()
        boardScroll.addView(boardRow)
        rootCard.addView(boardScroll)

        // 6. Action Buttons Row (Cancel / Add Task)
        val actionsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END or Gravity.CENTER_VERTICAL
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            lp.topMargin = dp(14)
            layoutParams = lp
        }

        val cancelBtn = TextView(this).apply {
            text = TaskTranslations.t(this@WidgetQuickAddActivity, "cancel", lang)
            setTextColor(palette.textSecondary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(dp(14), dp(9), dp(14), dp(9))
            setOnClickListener { finish() }
        }

        fun commitQuickAdd() {
            val rawTitle = inputBox.text?.toString()?.trim() ?: ""
            if (rawTitle.isEmpty()) {
                inputBox.error = TaskTranslations.t(this@WidgetQuickAddActivity, "enter_task_name_error", lang)
                return
            }
            TaskWidgetDataStore.addTaskFromWidget(
                context = this@WidgetQuickAddActivity,
                rawTitle = rawTitle,
                dateKey = selectedDateKey,
                time24 = selectedTime24,
                timeLabel = selectedTimeLabel,
                priority = selectedPriority,
                boardId = selectedBoardId,
                boardName = selectedBoardName,
                boardType = selectedBoardType
            )
            finish()
        }

        val saveBtn = TextView(this).apply {
            text = TaskTranslations.t(this@WidgetQuickAddActivity, "add_task_btn", lang)
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(dp(18), dp(9), dp(18), dp(9))
            background = roundedBg(palette.accentColor, 999)
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            lp.leftMargin = dp(8)
            layoutParams = lp
            setOnClickListener { commitQuickAdd() }
        }

        inputBox.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                commitQuickAdd()
                true
            } else {
                false
            }
        }

        actionsRow.addView(cancelBtn)
        actionsRow.addView(saveBtn)
        rootCard.addView(actionsRow)

        setContentView(rootCard)

        val screenWidth = resources.displayMetrics.widthPixels
        window?.setLayout((screenWidth * 0.92f).toInt(), WindowManager.LayoutParams.WRAP_CONTENT)
        window?.setBackgroundDrawableResource(android.R.color.transparent)
        window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
        inputBox.requestFocus()
    }
}
