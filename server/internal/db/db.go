package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

func Connect() (*sql.DB, error) {
	// Default to a relative path for development, similar to Node.js backend
	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		dbUrl = "data/sqlite.db"
	}

	var dbPath string
	if dbUrl == ":memory:" {
		dbPath = ":memory:"
	} else {
		if filepath.IsAbs(dbUrl) {
			dbPath = dbUrl
		} else {
			cwd, err := os.Getwd()
			if err != nil {
				return nil, fmt.Errorf("failed to get current working directory: %w", err)
			}
			// Assuming we run from server/ or project root involved.
			// If running from server/ root, data/ is ../data/
			// But let's assume the user runs from project root via make server-run or similar,
			// or sets CWD appropriately.
			// Adjusting logic: if we are in server/ subdir, we might need to go up.
			// But standard practice: configure path relative to CWD.
			dbPath = filepath.Join(cwd, dbUrl)

			// Hack for dev: if file not found, try going up one level if we are in server subdir
			if _, err := os.Stat(dbPath); os.IsNotExist(err) {
				parentPath := filepath.Join(cwd, "..", dbUrl)
				if _, err := os.Stat(parentPath); err == nil {
					dbPath = parentPath
				}
			}
		}
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}
