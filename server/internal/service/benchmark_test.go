package service

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mcpany/jules/internal/ratelimit"
	pb "github.com/mcpany/jules/proto"
)

func setupBenchmarkDB(b *testing.B) *sql.DB {
	// Re-use existing setup logic if possible or copy it
	// Since setupTestDB is in the same package (in setup_test.go), we can use it directly.
	// Assuming setupTestDB is exported or in same package (it is).
	// But setupTestDB takes *testing.T, we might need a version for *testing.B or just modify it.
	// Since I can't modify setupTestDB easily without editing the file, I'll copy the logic here for simplicity.

	conn, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		b.Fatalf("failed to open db: %v", err)
	}

	// Create tables (copied from setup_test.go but minimal needed for chat)
	queries := []string{
		`CREATE TABLE chat_configs (
            job_id TEXT NOT NULL,
            api_key TEXT NOT NULL,
            agent_name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (job_id, agent_name)
        );`,
		`CREATE TABLE chat_messages (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_human BOOLEAN DEFAULT 0,
            recipient TEXT
        );`,
	}

	for _, q := range queries {
		_, err := conn.Exec(q)
		if err != nil {
			b.Fatalf("failed to create table: %v\nQuery: %s", err, q)
		}
	}

	return conn
}

func seedChatMessages(b *testing.B, db *sql.DB, numJobs int, msgsPerJob int) string {
	targetJobId := ""

	// Use transaction for speed
	tx, err := db.Begin()
	if err != nil {
		b.Fatalf("failed to begin tx: %v", err)
	}

	stmt, err := tx.Prepare("INSERT INTO chat_messages (id, job_id, sender_name, content, created_at, is_human, recipient) VALUES (?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		b.Fatalf("failed to prepare stmt: %v", err)
	}
	defer stmt.Close()

	for i := 0; i < numJobs; i++ {
		jobId := uuid.New().String()
		if i == 0 {
			targetJobId = jobId
		}

		for j := 0; j < msgsPerJob; j++ {
			id := uuid.New().String()
			createdAt := time.Now().Add(time.Duration(j) * time.Second).Format(time.RFC3339)
			_, err := stmt.Exec(id, jobId, "User", "Hello", createdAt, true, nil)
			if err != nil {
				b.Fatalf("failed to insert message: %v", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		b.Fatalf("failed to commit tx: %v", err)
	}

	return targetJobId
}

func runBenchmarkListChatMessages(b *testing.B, withIndex bool) {
	db := setupBenchmarkDB(b)
	defer db.Close()

	if withIndex {
		_, err := db.Exec("CREATE INDEX chat_messages_job_id_created_at_idx ON chat_messages (job_id, created_at);")
		if err != nil {
			b.Fatalf("failed to create index: %v", err)
		}
	}

	// Seed data: 100 jobs, 100 messages each = 10,000 rows
	// This should be enough to see difference but fast enough for benchmark
	targetJobId := seedChatMessages(b, db, 100, 100)

	svc := &ChatServer{DB: db, Limiter: ratelimit.New(1 * time.Nanosecond)}
	ctx := context.Background()
	req := &pb.ListChatMessagesRequest{
		JobId: targetJobId,
		Limit: 50, // Typical usage
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.ListChatMessages(ctx, req)
		if err != nil {
			b.Fatalf("ListChatMessages failed: %v", err)
		}
	}
}

func BenchmarkListChatMessages_NoIndex(b *testing.B) {
	runBenchmarkListChatMessages(b, false)
}

func BenchmarkListChatMessages_WithIndex(b *testing.B) {
	runBenchmarkListChatMessages(b, true)
}
