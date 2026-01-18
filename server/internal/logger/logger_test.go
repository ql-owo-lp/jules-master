package logger

import (
	"fmt"
	"testing"
	"time"
)

func BenchmarkGetLogs(b *testing.B) {
	// Setup: fill buffer
	// Note: Buffer is global, so this might affect other tests if running in parallel, but here we run sequentially.
	for i := 0; i < BufferSize; i++ {
		Info("Log message %d", i)
	}

	// Use a time that is likely to be "recently" but we want to filter some.
	// Since we just filled the buffer, all logs are "now".
	// If we filter by 1 second ago, we should get all of them.
	// If we filter by 1 second in future, we get none.
	// Let's filter by a time slightly before now to simulate filtering.
	since := time.Now().Add(-time.Second * 10).Format(time.RFC3339)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = Get(since)
	}
}

func TestGetLogs(t *testing.T) {
	msg := fmt.Sprintf("Unique msg %d", time.Now().UnixNano())
	Info("%s", msg)

	// Test getting all
	logs, err := Get("")
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	found := false
	for _, l := range logs {
		if l.Message == msg {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("Log message not found in Get(\"\")")
	}

	// Test filtering
	// Since we just added a log, querying with a very old time should return it
	since := time.Now().Add(-time.Hour).Format(time.RFC3339)
	logs, err = Get(since)
	if err != nil {
		t.Fatalf("Get(since) failed: %v", err)
	}
	found = false
	for _, l := range logs {
		if l.Message == msg {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("Log message not found in Get(since)")
	}
}
