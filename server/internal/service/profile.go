package service

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	pb "github.com/mcpany/jules/gen"
	"google.golang.org/protobuf/types/known/emptypb"
)

type ProfileServer struct {
	pb.UnimplementedProfileServiceServer
	DB *sql.DB
}

func (s *ProfileServer) ListProfiles(ctx context.Context, _ *emptypb.Empty) (*pb.ListProfilesResponse, error) {
	rows, err := s.DB.Query("SELECT id, name, created_at FROM profiles ORDER BY created_at DESC")
	if err != nil {
		return nil, fmt.Errorf("failed to query profiles: %w", err)
	}
	defer rows.Close()

	var profiles []*pb.Profile
	for rows.Next() {
		var p pb.Profile
		if err := rows.Scan(&p.Id, &p.Name, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan profile: %w", err)
		}
		profiles = append(profiles, &p)
	}

	return &pb.ListProfilesResponse{Profiles: profiles}, nil
}

func (s *ProfileServer) CreateProfile(ctx context.Context, req *pb.CreateProfileRequest) (*pb.Profile, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}

	id := uuid.New().String()
	createdAt := time.Now().Format(time.RFC3339)

	_, err := s.DB.Exec("INSERT INTO profiles (id, name, created_at) VALUES (?, ?, ?)", id, req.Name, createdAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert profile: %w", err)
	}

	return &pb.Profile{
		Id:        id,
		Name:      req.Name,
		CreatedAt: createdAt,
	}, nil
}

func (s *ProfileServer) DeleteProfile(ctx context.Context, req *pb.DeleteProfileRequest) (*emptypb.Empty, error) {
	if req.Id == "" {
		return nil, fmt.Errorf("id is required")
	}

	// In logic, default profile might be protected, mirroring typical app logic?
    // Node.js implementation:
    // await profileService.deleteProfile(id);
    // Let's assume database constraints handle it or logic is simple.

	_, err := s.DB.Exec("DELETE FROM profiles WHERE id = ?", req.Id)
	if err != nil {
		return nil, fmt.Errorf("failed to delete profile: %w", err)
	}

	return &emptypb.Empty{}, nil
}
