package service

import (
	"context"
	"strings"
	"testing"

	pb "github.com/mcpany/jules/proto"
	"github.com/stretchr/testify/assert"
	"google.golang.org/protobuf/types/known/emptypb"
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

func TestProfileService_ListAndDelete(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	svc := &ProfileServer{DB: db}
	ctx := context.Background()
	
	// Create P1
	p1, err := svc.CreateProfile(ctx, &pb.CreateProfileRequest{Name: "P1"})
	assert.NoError(t, err)

	// List
	list, err := svc.ListProfiles(ctx, &emptypb.Empty{})
	assert.NoError(t, err)
	
	found := false
	for _, p := range list.Profiles {
		if p.Id == p1.Id {
			found = true
			break
		}
	}
	assert.True(t, found)

	// Delete
	_, err = svc.DeleteProfile(ctx, &pb.DeleteProfileRequest{Id: p1.Id})
	assert.NoError(t, err)

	// Verify Delete
	listAfter, _ := svc.ListProfiles(ctx, &emptypb.Empty{})
	foundAfter := false
	for _, p := range listAfter.Profiles {
		if p.Id == p1.Id {
			foundAfter = true
			break
		}
	}
	assert.False(t, foundAfter)

	// Delete Default - Should Fail
	_, err = svc.DeleteProfile(ctx, &pb.DeleteProfileRequest{Id: "default"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cannot delete default profile")
}
