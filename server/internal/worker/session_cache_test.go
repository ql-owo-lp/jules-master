package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

type MockSessionSyncer struct {
	DB *sql.DB
}

func (m *MockSessionSyncer) SyncSession(ctx context.Context, id string) error {
	// Mock sync by just updating last_updated to now
	now := time.Now().UnixMilli()
	_, err := m.DB.Exec("UPDATE sessions SET last_updated = ? WHERE id = ?", now, id)
	return err
}

func TestSessionCacheWorker_RunCheck(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	settingsSvc := &service.SettingsServer{DB: db}
	sessionSvc := &service.SessionServer{DB: db}
	workerCtx := NewSessionCacheWorker(db, settingsSvc, sessionSvc)

	// Inject Mock Syncer
	workerCtx.SetSyncer(&MockSessionSyncer{DB: db})

	ctx := context.Background()

	// 1. Setup Settings
	_, err := settingsSvc.UpdateSettings(ctx, &pb.UpdateSettingsRequest{
		Settings: &pb.Settings{
			ProfileId:                      "default",
			SessionCacheInProgressInterval: 1, // 1 second for test
			SessionCacheMaxAgeDays:         7,
			Theme:                          "system",
			AutoMergeMethod:                "squash",
		},
	})
	assert.NoError(t, err)

	// 2. Create a session in IN_PROGRESS state, last updated long ago
	session, err := sessionSvc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "test-cache"})
	assert.NoError(t, err)

	oldTime := time.Now().Add(-1 * time.Minute).UnixMilli()
	_, err = db.Exec("UPDATE sessions SET state = 'IN_PROGRESS', last_updated = ? WHERE id = ?", oldTime, session.Id)
	assert.NoError(t, err)

	// Verify Pre-Condition
	var checkTime int64
	err = db.QueryRow("SELECT last_updated FROM sessions WHERE id = ?", session.Id).Scan(&checkTime)
	assert.NoError(t, err)
	t.Logf("Pre-condition LastUpdated: %d", checkTime)

	// 3. Run Check
	err = workerCtx.runCheck(ctx)
	assert.NoError(t, err)

	// 4. Verify LastUpdated bumped
	var newLastUpdated int64
	err = db.QueryRow("SELECT last_updated FROM sessions WHERE id = ?", session.Id).Scan(&newLastUpdated)
	assert.NoError(t, err)

	assert.Greater(t, newLastUpdated, oldTime, "LastUpdated should be updated")
}

func TestSessionCacheWorker_SyncSession_MultiKey(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	// 1. Setup Keys
	t.Setenv("JULES_API_KEY", "bad-key")
	t.Setenv("JULES_API_KEY_1", "good-key")

	// 2. Insert dummy session
	_, err := db.Exec("INSERT INTO sessions (id, name, state, update_time, profile_id) VALUES (?, ?, ?, ?, ?)",
		"session-123", "sessions/session-123", "IN_PROGRESS", "old-time", "default")
	assert.NoError(t, err)

	// 3. Setup Mock Server
	var attempts int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		apiKey := r.Header.Get("X-Goog-Api-Key")

		if apiKey == "bad-key" {
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte("Forbidden"))
			return
		}

		if apiKey == "good-key" {
			w.WriteHeader(http.StatusOK)
			resp := map[string]string{
				"state":      "COMPLETED",
				"updateTime": "2024-01-01T12:00:00Z",
			}
			json.NewEncoder(w).Encode(resp)
			return
		}

		w.WriteHeader(http.StatusBadRequest)
	}))
	defer server.Close()

	// 4. Test Sync
	syncer := &HTTPSessionSyncer{
		DB:      db,
		BaseURL: server.URL,
	}

	err = syncer.SyncSession(context.Background(), "session-123")
	assert.NoError(t, err)
	assert.Equal(t, 2, attempts, "Should try both keys")

	// 5. Verify DB update
	var state string
	err = db.QueryRow("SELECT state FROM sessions WHERE id = ?", "session-123").Scan(&state)
	assert.NoError(t, err)
	assert.Equal(t, "COMPLETED", state)
}
