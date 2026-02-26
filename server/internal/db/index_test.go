package db

import (
	"database/sql"
	"os"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestChatMessagesIndexExists(t *testing.T) {
	// Set up environment for db.Connect
	os.Setenv("DATABASE_URL", ":memory:")
	defer os.Unsetenv("DATABASE_URL")

	conn, err := Connect()
	if err != nil {
		t.Fatalf("failed to connect to db: %v", err)
	}
	defer conn.Close()

	// Connect() only runs lazy migrations if the table exists.
	// We need to simulate the table creation first to ensure the index migration logic is triggered.
	// Since we are using :memory:, each connection is a separate DB unless shared cache is used.
	// To test persistence and migration across connections, we use a temporary file.

	conn.Close()

	tmpFile, err := os.CreateTemp("", "testdb-*.sqlite")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	dbPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(dbPath)

	os.Setenv("DATABASE_URL", dbPath)

	// 1. Create table manually (simulating existing schema before migration)
	db1, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("failed to open db1: %v", err)
	}
	_, err = db1.Exec(`CREATE TABLE chat_messages (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_human BOOLEAN DEFAULT 0,
            recipient TEXT
        );`)
	if err != nil {
		t.Fatalf("failed to create table: %v", err)
	}
	db1.Close()

	// 2. Call db.Connect(), which should apply the lazy migration (create index)
	db2, err := Connect()
	if err != nil {
		t.Fatalf("failed to connect via db.Connect: %v", err)
	}
	defer db2.Close()

	// 3. Verify index exists
	var indexName string
	err = db2.QueryRow("SELECT name FROM sqlite_master WHERE type='index' AND name='chat_messages_job_id_created_at_idx'").Scan(&indexName)
	if err == sql.ErrNoRows {
		t.Fatalf("Index chat_messages_job_id_created_at_idx does not exist")
	} else if err != nil {
		t.Fatalf("Failed to query index: %v", err)
	}

	if indexName != "chat_messages_job_id_created_at_idx" {
		t.Errorf("Expected index name 'chat_messages_job_id_created_at_idx', got '%s'", indexName)
	}
}
