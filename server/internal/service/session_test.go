package service

import (
	"context"
	"strings"
	"testing"

	pb "github.com/mcpany/jules/gen"
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
