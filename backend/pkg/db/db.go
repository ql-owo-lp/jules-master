package db

import (
	"log"
	"os"
	"path/filepath"

	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"
)

var DB *sqlx.DB

func InitDB() error {
	dbPath := os.Getenv("SQLITE_DB_PATH")
	if dbPath == "" {
		// Default to 'jules.db' in the current directory or relative location consistent with Node app
		// Node app usage was: 'sqlite.db' ? Check drizzle.config.ts or env.
		// Assuming 'sqlite.db' for now or 'jules.db'
		dbPath = "sqlite.db"
	}

	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	var err error
	DB, err = sqlx.Connect("sqlite", dbPath)
	if err != nil {
		return err
	}

	// Enable WAL mode for better concurrency
	if _, err := DB.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		return err
	}

	log.Printf("Connected to database at %s", dbPath)
	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}
