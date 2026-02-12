package service

import (
	"context"
	"strings"
	"testing"
	"time"

	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

func TestSessionService_CreateSession(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SessionServer{DB: db, RateLimitDuration: 1 * time.Nanosecond}
	ctx := context.Background()

	// Valid creation
	s, err := svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "Valid Session", Prompt: "Short prompt"})
	assert.NoError(t, err)
	assert.Equal(t, "Valid Session", s.Name)

	// Validation
	longPrompt := strings.Repeat("a", 50001)
	longName := strings.Repeat("a", 256)

	_, err = svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "Valid", Prompt: longPrompt})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "prompt is too long")

	_, err = svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: longName, Prompt: "Valid"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "name is too long")

	// Invalid Repo/Branch
	_, err = svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "Valid", Prompt: "Valid", Repo: "invalid repo"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid repo format")

	_, err = svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "Valid", Prompt: "Valid", Branch: "invalid branch!"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid branch format")
}

func TestSessionService_Validation(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SessionServer{DB: db, RateLimitDuration: 1 * time.Nanosecond}
	ctx := context.Background()

	// Invalid IDs
	invalidIDs := []string{
		"invalid/id",
		"id with spaces",
		"../traversal",
		"",
	}

	for _, id := range invalidIDs {
		_, err := svc.SendMessage(ctx, &pb.SendMessageRequest{Id: id, Message: "test"})
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid session id", "SendMessage should reject id: "+id)

		_, err = svc.ApprovePlan(ctx, &pb.ApprovePlanRequest{Id: id})
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid session id", "ApprovePlan should reject id: "+id)
	}

	// Valid ID (mocking API key missing error to ensure validation passed)
	// We expect "JULES_API_KEY not set" or network error, but NOT "invalid session id"
	// However, ApprovePlan might not check API key immediately if it's optional?
	// In ApprovePlan: if err := s.approveRemotePlan(req.Id); err != nil ...
	// approveRemotePlan returns nil if key is empty.
	// So ApprovePlan will proceed to DB update.
	// Since DB is empty, UPDATE will affect 0 rows and return nil (success).

	validID := "valid-id-123"

	// Ensure JULES_API_KEY is unset for this test
	t.Setenv("JULES_API_KEY", "")

	_, err := svc.ApprovePlan(ctx, &pb.ApprovePlanRequest{Id: validID})
	assert.NoError(t, err)

	// For SendMessage, it checks API key
	_, err = svc.SendMessage(ctx, &pb.SendMessageRequest{Id: validID, Message: "test"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "JULES_API_KEY not set")
}

func TestSessionService_CRUD(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SessionServer{DB: db, RateLimitDuration: 1 * time.Nanosecond}
	ctx := context.Background()

	// Create
	s1, err := svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "Session 1", ProfileId: "p1"})
	assert.NoError(t, err)
	s2, err := svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "Session 2", ProfileId: "default"})
	assert.NoError(t, err)

	// Manually actuate s1 to be older to ensure sort order (RFC3339 has 1s precision)
	_, err = db.Exec("UPDATE sessions SET create_time = ? WHERE id = ?", time.Now().Add(-1*time.Hour).Format(time.RFC3339), s1.Id)
	assert.NoError(t, err)

	// Get
	got, err := svc.GetSession(ctx, &pb.GetSessionRequest{Id: s1.Id})
	assert.NoError(t, err)
	assert.Equal(t, s1.Name, got.Name)
	assert.Equal(t, "p1", got.ProfileId)

	// List All
	list, err := svc.ListSessions(ctx, &pb.ListSessionsRequest{})
	assert.NoError(t, err)
	// Order is DESC create_time
	assert.Len(t, list.Sessions, 2)
	assert.Equal(t, s2.Id, list.Sessions[0].Id)

	// List by Profile
	listP1, err := svc.ListSessions(ctx, &pb.ListSessionsRequest{ProfileId: "p1"})
	assert.NoError(t, err)
	assert.Len(t, listP1.Sessions, 1)
	assert.Equal(t, s1.Id, listP1.Sessions[0].Id)

	// Delete
	_, err = svc.DeleteSession(ctx, &pb.DeleteSessionRequest{Id: s1.Id})
	assert.NoError(t, err)

	// Verify Delete
	_, err = svc.GetSession(ctx, &pb.GetSessionRequest{Id: s1.Id})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "session not found")
}

func TestSessionService_ApprovePlan_DB(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SessionServer{DB: db}
	ctx := context.Background()

	// Create session
	s, err := svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "To Approve"})
	assert.NoError(t, err)

	// Manually set state to AWAITING_PLAN_APPROVAL
	_, err = db.Exec("UPDATE sessions SET state = 'AWAITING_PLAN_APPROVAL' WHERE id = ?", s.Id)
	assert.NoError(t, err)

	// Approve
	t.Setenv("JULES_API_KEY", "") // Ensure local only path
	_, err = svc.ApprovePlan(ctx, &pb.ApprovePlanRequest{Id: s.Id})
	assert.NoError(t, err)

	// Verify State
	got, err := svc.GetSession(ctx, &pb.GetSessionRequest{Id: s.Id})
	assert.NoError(t, err)
	assert.Equal(t, "IN_PROGRESS", got.State)
}
