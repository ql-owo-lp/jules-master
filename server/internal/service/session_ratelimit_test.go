package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/mcpany/jules/internal/ratelimit"
	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
)

func TestSessionService_RateLimit(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SessionServer{DB: db, Limiter: ratelimit.New(100 * time.Millisecond)}
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
	svc := &SessionServer{DB: db, Limiter: ratelimit.New(100 * time.Millisecond)}
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

func TestSessionService_RateLimit_Isolation(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &SessionServer{DB: db, Limiter: ratelimit.New(100 * time.Millisecond)}
	ctx := context.Background()

	// 1. Send Message - Session A
	_, err := svc.SendMessage(ctx, &pb.SendMessageRequest{Id: "session-a"})
	if err != nil {
		assert.False(t, strings.Contains(err.Error(), "rate limit exceeded"))
	}

	// 2. Send Message - Session B (Should NOT be blocked)
	_, err = svc.SendMessage(ctx, &pb.SendMessageRequest{Id: "session-b"})
	if err != nil {
		assert.False(t, strings.Contains(err.Error(), "rate limit exceeded"), "Different session should not be blocked")
	}

	// 3. Send Message - Session A again (Should be blocked)
	_, err = svc.SendMessage(ctx, &pb.SendMessageRequest{Id: "session-a"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rate limit exceeded")

	// 4. Create Session - Profile A
	_, err = svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "S1", ProfileId: "profile-a"})
	if err != nil {
		assert.False(t, strings.Contains(err.Error(), "rate limit exceeded"))
	}

	// 5. Create Session - Profile B (Should NOT be blocked)
	_, err = svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "S2", ProfileId: "profile-b"})
	if err != nil {
		assert.False(t, strings.Contains(err.Error(), "rate limit exceeded"), "Different profile should not be blocked")
	}

	// 6. Create Session - Profile A again (Should be blocked)
	_, err = svc.CreateSession(ctx, &pb.CreateSessionRequest{Name: "S3", ProfileId: "profile-a"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rate limit exceeded")
}
