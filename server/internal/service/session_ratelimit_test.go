package service

import (
	"context"
	"strings"
	"testing"
	"time"

	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

func TestSessionService_RateLimit(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SessionServer{DB: db}
	ctx := context.Background()

	// Request 1: Should pass rate limit check.
	// We expect validation error (invalid session id) but NOT rate limit error.
	_, err := svc.SendMessage(ctx, &pb.SendMessageRequest{Id: "invalid-id"})
	assert.Error(t, err)
	assert.False(t, strings.Contains(err.Error(), "rate limit exceeded"), "First request should not be rate limited")

	// Request 2: Should fail immediately if sent within 100ms.
	_, err = svc.SendMessage(ctx, &pb.SendMessageRequest{Id: "invalid-id"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rate limit exceeded", "Second request within 100ms should be rate limited")

	// Wait > 100ms
	time.Sleep(150 * time.Millisecond)

	// Request 3: Should pass rate limit check again.
	_, err = svc.SendMessage(ctx, &pb.SendMessageRequest{Id: "invalid-id"})
	assert.Error(t, err)
	assert.False(t, strings.Contains(err.Error(), "rate limit exceeded"), "Request after delay should not be rate limited")
}

func TestSessionService_RateLimit_CreateSession(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SessionServer{DB: db}
	ctx := context.Background()

	// Request 1: Pass
	_, err := svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "Session 1"})
	// We don't assert error here because it depends on DB state etc, but we check message content if error
	if err != nil {
		assert.False(t, strings.Contains(err.Error(), "rate limit exceeded"))
	}

	// Request 2: Fail (Rate Limit)
	_, err = svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "Session 2"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rate limit exceeded")
}
