import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), tasksText: "[]")
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), tasksText: getTasks())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        var entries: [SimpleEntry] = []
        let entry = SimpleEntry(date: Date(), tasksText: getTasks())
        entries.append(entry)
        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }

    private func getTasks() -> String {
        // App Group defaults created by react-native-widget-extension or Async Storage
        // The default suite name for react-native-widget-extension is "group.<YOUR_BUNDLE_IDENTIFIER>.expowidgets"
        let defaults = UserDefaults(suiteName: "group.com.vitvalef.app.expowidgets")
        return defaults?.string(forKey: "widget_today_tasks") ?? "[]"
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let tasksText: String
}

// Minimal JSON decodable struct matching Redux task
struct TaskData: Decodable, Hashable {
    let id: String
    let taskname: String
    let completed: Bool
}

struct TodayTasksWidgetEntryView : View {
    var entry: Provider.Entry

    var parsedTasks: [TaskData] {
        guard let data = entry.tasksText.data(using: .utf8) else { return [] }
        do {
            let tasks = try JSONDecoder().decode([TaskData].self, from: data)
            return tasks
        } catch {
            return []
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Today's Tasks")
                .font(.headline)
                .foregroundColor(Color.white)
            
            if parsedTasks.isEmpty {
                Text("No tasks for today! 🎉")
                    .font(.subheadline)
                    .foregroundColor(Color.gray)
            } else {
                ForEach(parsedTasks.prefix(4), id: \.id) { task in
                    HStack {
                        Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(task.completed ? .green : .gray)
                        Text(task.taskname)
                            .font(.subheadline)
                            .foregroundColor(Color.white)
                            .lineLimit(1)
                        Spacer()
                    }
                }
                if parsedTasks.count > 4 {
                    Text("+ \(parsedTasks.count - 4) more")
                        .font(.caption)
                        .foregroundColor(Color.gray)
                }
            }
            Spacer()
        }
        .padding()
        .background(Color(red: 0.12, green: 0.11, blue: 0.10))
    }
}

struct TodayTasksWidget: Widget {
    let kind: String = "TodayTasksWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TodayTasksWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Today's Tasks")
        .description("View your tasks for today.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
