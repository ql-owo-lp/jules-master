package worker

import (
	"context"
	"testing"
	"time"

	pb "github.com/mcpany/jules/gen"
	"github.com/mcpany/jules/internal/service"
	"github.com/stretchr/testify/assert"
)

func TestSessionCacheWorker_RunCheck(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    
    settingsSvc := &service.SettingsServer{DB: db}
    sessionSvc := &service.SessionServer{DB: db}
    workerCtx := NewSessionCacheWorker(db, settingsSvc, sessionSvc)
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
    
    // Manually set state and last_updated
    // Note: last_updated in DB is INTEGER (ms?) or string?
    // In setups_test.go: "last_updated INTEGER"
    // In session_cache.go: "w.db.ExecContext(ctx, "UPDATE sessions SET last_updated = ? WHERE id = ?", now.UnixMilli(), id)"
    // So it is int64 millis.
    
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
    
    // 4. Verify LastUpdated bumped (since we stubbed the update logic to just update timestamp)
    var newLastUpdated int64
    err = db.QueryRow("SELECT last_updated FROM sessions WHERE id = ?", session.Id).Scan(&newLastUpdated)
    assert.NoError(t, err)
    
    assert.Greater(t, newLastUpdated, oldTime, "LastUpdated should be updated")
}
