package worker

import (
	"context"
	"database/sql"
	"testing"
	"time"

	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/service"
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
            ProfileId: "default",
            SessionCacheInProgressInterval: 1, // 1 second for test
            SessionCacheMaxAgeDays: 7,
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
