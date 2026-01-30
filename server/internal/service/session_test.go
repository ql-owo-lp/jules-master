package service

import (
	"context"
	"strings"
	"testing"

	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

func TestSessionService_CreateSession(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SessionServer{DB: db}
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
}

func TestSessionService_Validation(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SessionServer{DB: db}
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
