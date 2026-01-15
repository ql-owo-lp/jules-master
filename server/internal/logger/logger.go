package logger

import (
	"fmt"
	"sync"
	"time"

	pb "github.com/mcpany/jules/gen"
)

const BufferSize = 1000

var (
	buffer []pb.LogEntry
	mu     sync.Mutex
)

func init() {
	buffer = make([]pb.LogEntry, 0, BufferSize)
}

func Add(level, message string) {
	mu.Lock()
	defer mu.Unlock()

	entry := pb.LogEntry{
		Timestamp: time.Now().Format(time.RFC3339),
		Level:     level,
		Message:   message,
	}

	buffer = append(buffer, entry)
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
		// Copy iteration variable
		entry := buffer[i] 
		
		if since != "" {
			t, err := time.Parse(time.RFC3339, entry.Timestamp)
			if err == nil && t.After(sinceTime) {
				result = append(result, &entry)
			}
		} else {
			result = append(result, &entry)
		}
	}
	return result, nil
}
