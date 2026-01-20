package service

import (
	"context"
	"strings"
	"testing"

	pb "github.com/mcpany/jules/gen"
	"github.com/stretchr/testify/assert"
)

func TestProfileService_CreateProfile(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &ProfileServer{DB: db}
	ctx := context.Background()

	// Valid creation
	p, err := svc.CreateProfile(ctx, &pb.CreateProfileRequest{Name: "Valid Profile"})
	assert.NoError(t, err)
	assert.Equal(t, "Valid Profile", p.Name)

	// Validation
	longName := strings.Repeat("a", 256)
	_, err = svc.CreateProfile(ctx, &pb.CreateProfileRequest{Name: longName})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "name is too long")

	_, err = svc.CreateProfile(ctx, &pb.CreateProfileRequest{Name: ""})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "name is required")
}
