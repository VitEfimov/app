import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export function TodayTasksWidget({ tasks }) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#1E1B1A',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'column',
      }}
    >
      <TextWidget
        text="Today's Tasks"
        style={{
          fontSize: 18,
          fontFamily: 'sans-serif-medium',
          color: '#EDE0DC',
          marginBottom: 8,
        }}
      />
      {tasks.length === 0 ? (
        <TextWidget
          text="No tasks for today! 🎉"
          style={{
            fontSize: 14,
            color: '#D0C4C0',
          }}
        />
      ) : (
        tasks.slice(0, 4).map((task, index) => (
          <FlexWidget
            key={index}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <TextWidget
              text={task.completed ? "✓ " : "○ "}
              style={{
                fontSize: 16,
                color: task.completed ? '#4caf50' : '#D0C4C0',
              }}
            />
            <TextWidget
              text={task.name}
              style={{
                fontSize: 14,
                color: '#EDE0DC',
                maxLines: 1,
              }}
            />
          </FlexWidget>
        ))
      )}
      {tasks.length > 4 && (
        <TextWidget
          text={`+ ${tasks.length - 4} more`}
          style={{
            fontSize: 12,
            color: '#D0C4C0',
            marginTop: 4,
          }}
        />
      )}
    </FlexWidget>
  );
}
