package service

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func setupTestDB(t *testing.T) *sql.DB {
	// Determine path to schema
	// Assuming running from server/internal/service
	// Schema is at ../../../src/lib/db/schema.ts (Drizzle)
	// Wait, Drizzle schema is TS. I need to apply SQL schema.
	// I don't have a SQL schema file. SQLite creates file on connect but empty tables.
	// I need to create tables.

	// I will use a helper to create tables equivalent to Drizzle schema.
	conn, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}

	createTables(t, conn)

	return conn
}

func createTables(t *testing.T, conn *sql.DB) {
	queries := []string{
		`CREATE TABLE settings (
            id INTEGER PRIMARY KEY,
            idle_poll_interval INTEGER DEFAULT 120,
            active_poll_interval INTEGER DEFAULT 30,
            title_truncate_length INTEGER DEFAULT 50,
            line_clamp INTEGER DEFAULT 1,
            session_items_per_page INTEGER DEFAULT 10,
            jobs_per_page INTEGER DEFAULT 5,
            default_session_count INTEGER DEFAULT 10,
            pr_status_poll_interval INTEGER DEFAULT 60,
            theme TEXT,
            auto_approval_interval INTEGER DEFAULT 60,
            auto_approval_enabled BOOLEAN DEFAULT 0,
            auto_retry_enabled BOOLEAN DEFAULT 1,
            auto_retry_message TEXT,
            auto_continue_enabled BOOLEAN DEFAULT 1,
            auto_continue_message TEXT,
            session_cache_in_progress_interval INTEGER DEFAULT 60,
            session_cache_completed_no_pr_interval INTEGER DEFAULT 1800,
            session_cache_pending_approval_interval INTEGER DEFAULT 300,
            session_cache_max_age_days INTEGER DEFAULT 3,
            auto_delete_stale_branches BOOLEAN DEFAULT 0,
            auto_delete_stale_branches_after_days INTEGER DEFAULT 3,
            check_failing_actions_enabled BOOLEAN DEFAULT 1,
            check_failing_actions_interval INTEGER DEFAULT 600,
            check_failing_actions_threshold INTEGER DEFAULT 10,
            auto_close_stale_conflicted_prs BOOLEAN DEFAULT 0,
            stale_conflicted_prs_duration_days INTEGER DEFAULT 3,
            history_prompts_count INTEGER DEFAULT 10,
            min_session_interaction_interval INTEGER DEFAULT 60,
            retry_timeout INTEGER DEFAULT 1200,
            profile_id TEXT DEFAULT 'default',
            max_concurrent_background_workers INTEGER DEFAULT 5,
            auto_approval_all_sessions BOOLEAN DEFAULT 1,
            auto_continue_all_sessions BOOLEAN DEFAULT 1
        );`,
		`CREATE TABLE profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );`,
		`CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            session_ids TEXT, -- JSON array
            created_at TEXT NOT NULL,
            repo TEXT NOT NULL,
            branch TEXT NOT NULL,
            auto_approval BOOLEAN DEFAULT 0,
            background BOOLEAN DEFAULT 0,
            prompt TEXT NOT NULL,
            session_count INTEGER DEFAULT 1,
            status TEXT,
            automation_mode TEXT,
            require_plan_approval BOOLEAN,
            cron_job_id TEXT,
            profile_id TEXT NOT NULL DEFAULT 'default'
        );`,
		`CREATE TABLE cron_jobs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            schedule TEXT NOT NULL,
            prompt TEXT NOT NULL,
            repo TEXT NOT NULL,
            branch TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            last_run_at TEXT,
            enabled BOOLEAN DEFAULT 1,
            auto_approval BOOLEAN DEFAULT 0,
            automation_mode TEXT,
            require_plan_approval BOOLEAN,
            session_count INTEGER DEFAULT 1,
            profile_id TEXT NOT NULL DEFAULT 'default'
        );`,
		`CREATE TABLE predefined_prompts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            prompt TEXT NOT NULL,
            profile_id TEXT NOT NULL DEFAULT 'default'
        );`,
		`CREATE TABLE quick_replies (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            prompt TEXT NOT NULL,
            profile_id TEXT NOT NULL DEFAULT 'default'
        );`,
		`CREATE TABLE global_prompt (
            id INTEGER PRIMARY KEY,
            prompt TEXT NOT NULL
        );`,
		`CREATE TABLE history_prompts (
            id TEXT PRIMARY KEY,
            prompt TEXT NOT NULL,
            last_used_at TEXT NOT NULL,
            profile_id TEXT NOT NULL DEFAULT 'default'
        );`,
		`CREATE TABLE repo_prompts (
            repo TEXT PRIMARY KEY,
            prompt TEXT NOT NULL,
            profile_id TEXT NOT NULL DEFAULT 'default'
        );`,
		`CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            title TEXT,
            prompt TEXT,
            create_time TEXT,
            update_time TEXT,
            state TEXT,
            url TEXT,
            require_plan_approval BOOLEAN,
            automation_mode TEXT,
            last_updated INTEGER,
            retry_count INTEGER,
            last_error TEXT,
            last_interaction_at INTEGER,
            profile_id TEXT NOT NULL DEFAULT 'default'
        );`,
	}

	for _, q := range queries {
		_, err := conn.Exec(q)
		if err != nil {
			t.Fatalf("failed to create table: %v\nQuery: %s", err, q)
		}
	}
}
