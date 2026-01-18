package logger

import (
	"fmt"
	"sync"
	"time"

	pb "github.com/mcpany/jules/gen"
)

const BufferSize = 1000

type LogItem struct {
	Entry *pb.LogEntry
	Time  time.Time
}

var (
	buffer []LogItem
	mu     sync.Mutex
)

func init() {
	buffer = make([]LogItem, 0, BufferSize)
}

func Add(level, message string) {
	mu.Lock()
	defer mu.Unlock()

	now := time.Now()
	entry := &pb.LogEntry{
		Timestamp: now.Format(time.RFC3339),
		Level:     level,
		Message:   message,
	}

	item := LogItem{
		Entry: entry,
		Time:  now,
	}

	buffer = append(buffer, item)
	if len(buffer) > BufferSize {
		// Remove oldest
		buffer = buffer[1:]
	}

	// Also print to stdout
	fmt.Printf("[%s] %s: %s\n", entry.Timestamp, level, message)
}

func Info(format string, args ...interface{}) {
	Add("info", fmt.Sprintf(format, args...))
}

func Error(format string, args ...interface{}) {
	Add("error", fmt.Sprintf(format, args...))
}

func Warn(format string, args ...interface{}) {
	Add("warn", fmt.Sprintf(format, args...))
}

func Get(since string) ([]*pb.LogEntry, error) {
	mu.Lock()
	defer mu.Unlock()

	var result []*pb.LogEntry
	var sinceTime time.Time
	var err error

	if since != "" {
		sinceTime, err = time.Parse(time.RFC3339, since)
		if err != nil {
			return nil, err
		}
	}

	for i := range buffer {
		item := buffer[i]

		if since != "" {
			// Compare stored high-precision time with requested time
			if item.Time.After(sinceTime) {
				result = append(result, item.Entry)
			}
		} else {
			result = append(result, item.Entry)
		}
	}
	return result, nil
}
