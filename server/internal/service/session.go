package service

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	pb "github.com/mcpany/jules/proto"
	"google.golang.org/protobuf/types/known/emptypb"
)

type SessionServer struct {
	pb.UnimplementedSessionServiceServer
	DB *sql.DB
}

func (s *SessionServer) ListSessions(ctx context.Context, req *pb.ListSessionsRequest) (*pb.ListSessionsResponse, error) {
	query := "SELECT id, name, title, prompt, create_time, state, profile_id FROM sessions"
	var args []interface{}
	if req.ProfileId != "" && req.ProfileId != "default" {
		query += " WHERE profile_id = ?"
		args = append(args, req.ProfileId)
	}
	query += " ORDER BY create_time DESC"

	rows, err := s.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []*pb.Session
	for rows.Next() {
		var sess pb.Session
		var createTime sql.NullString
		// Handling NULLs might be needed if schema allows, assuming strictly string for now based on Proto
		if err := rows.Scan(&sess.Id, &sess.Name, &sess.Title, &sess.Prompt, &createTime, &sess.State, &sess.ProfileId); err != nil {
			return nil, err
		}
		if createTime.Valid {
			sess.CreateTime = createTime.String
		}
		sessions = append(sessions, &sess)
	}
	return &pb.ListSessionsResponse{Sessions: sessions}, nil
}

func (s *SessionServer) ApprovePlan(ctx context.Context, req *pb.ApprovePlanRequest) (*emptypb.Empty, error) {
	// Try remote approval first if key is present
	if err := s.approveRemotePlan(req.Id); err != nil {
		// Log error but maybe continue to update local state?
		// Or fail? Failing is safer if we want consistency.
		// For now, let's log and return error if remote fails.
		return nil, fmt.Errorf("remote approval failed: %w", err)
	}

	res, err := s.DB.Exec("UPDATE sessions SET state = 'IN_PROGRESS', update_time = datetime('now'), last_updated = ? WHERE id = ? AND state = 'AWAITING_PLAN_APPROVAL'", time.Now().UnixMilli(), req.Id)
	if err != nil {
		return nil, err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		// Maybe it wasn't in correct state or didn't exist.
		// For idling check, we might just ignore, but better to check.
	}

	return &emptypb.Empty{}, nil
}

func (s *SessionServer) GetSession(ctx context.Context, req *pb.GetSessionRequest) (*pb.Session, error) {
	var sess pb.Session
	var createTime sql.NullString
	err := s.DB.QueryRow("SELECT id, name, title, prompt, create_time, state, profile_id FROM sessions WHERE id = ?", req.Id).Scan(
		&sess.Id, &sess.Name, &sess.Title, &sess.Prompt, &createTime, &sess.State, &sess.ProfileId,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("session not found")
	} else if err != nil {
		return nil, err
	}
	if createTime.Valid {
		sess.CreateTime = createTime.String
	}
	return &sess, nil
}

func (s *SessionServer) CreateSession(ctx context.Context, req *pb.CreateSessionRequest) (*pb.Session, error) {
	// Validate input length
	if len(req.Name) > 255 {
		return nil, fmt.Errorf("name is too long (max 255 characters)")
	}
	if len(req.Prompt) > 50000 {
		return nil, fmt.Errorf("prompt is too long (max 50000 characters)")
	}

	// Try remote creation first
	remoteSess, err := s.createRemoteSession(req)
	if err != nil {
		return nil, err
	}

	id := uuid.New().String()
	createTime := time.Now().Format(time.RFC3339)
	name := req.Name
	state := "QUEUED"
	title := "New Session"

	// Use remote details if available
	if remoteSess != nil {
		id = remoteSess.Id
		name = remoteSess.Name
		createTime = remoteSess.CreateTime
		state = remoteSess.State
		// Title might be generated remotely or default
		if remoteSess.Title != "" {
			title = remoteSess.Title
		}
	}

	if name == "" {
		name = "sessions/" + id
	}

	if req.Name != "" {
		title = req.Name
	}

	if req.ProfileId == "" {
		req.ProfileId = "default"
	}
	lastUpdated := time.Now().UnixMilli()

	_, err = s.DB.Exec(`
        INSERT INTO sessions (id, name, title, create_time, state, update_time, prompt, profile_id, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, id, name, title, createTime, state, createTime, req.Prompt, req.ProfileId, lastUpdated)

	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	return &pb.Session{
		Id:         id,
		Name:       name,
		Title:      title,
		CreateTime: createTime,
		State:      state,
	}, nil
}

func (s *SessionServer) UpdateSession(ctx context.Context, req *pb.UpdateSessionRequest) (*emptypb.Empty, error) {
	return nil, fmt.Errorf("not implemented")
}

func (s *SessionServer) DeleteSession(ctx context.Context, req *pb.DeleteSessionRequest) (*emptypb.Empty, error) {
	_, err := s.DB.Exec("DELETE FROM sessions WHERE id = ?", req.Id)
	if err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

// Helper for Remote API calls
func (s *SessionServer) getAPIKey() string {
	return os.Getenv("JULES_API_KEY")
}

func (s *SessionServer) createRemoteSession(req *pb.CreateSessionRequest) (*pb.Session, error) {
	apiKey := s.getAPIKey()
	if apiKey == "" {
		return nil, nil
	}

	url := "https://jules.googleapis.com/v1alpha/sessions"

	// Map fields to JSON body
	body := map[string]interface{}{
		"prompt": req.Prompt,
		// "sourceContext": ... if needed, complicated mapping
	}

	if req.Repo != "" && req.Branch != "" {
		body["sourceContext"] = map[string]interface{}{
			"source": fmt.Sprintf("sources/github/%s", req.Repo),
			"githubRepoContext": map[string]interface{}{
				"startingBranch": req.Branch,
			},
		}
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 30 * time.Second}
	r, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, err
	}

	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("X-Goog-Api-Key", apiKey)

	resp, err := client.Do(r)
	if err != nil {
		return nil, fmt.Errorf("remote create failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("remote create error %d: %s", resp.StatusCode, string(respBytes))
	}

	var remoteSess struct {
		Name       string `json:"name"` // "sessions/{id}"
		Id         string `json:"id"`
		CreateTime string `json:"createTime"`
		State      string `json:"state"`
		Title      string `json:"title"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&remoteSess); err != nil {
		return nil, err
	}

	// Extract ID if missing (API usually returns full resource name)
	id := remoteSess.Id
	if id == "" && remoteSess.Name != "" {
		parts := strings.Split(remoteSess.Name, "/")
		if len(parts) > 1 {
			id = parts[len(parts)-1]
		}
	}

	return &pb.Session{
		Id:         id,
		Name:       remoteSess.Name,
		Title:      remoteSess.Title,
		CreateTime: remoteSess.CreateTime,
		State:      remoteSess.State,
	}, nil
}

func (s *SessionServer) approveRemotePlan(id string) error {
	apiKey := s.getAPIKey()
	if apiKey == "" {
		return nil
	}

	url := fmt.Sprintf("https://jules.googleapis.com/v1alpha/sessions/%s:approvePlan", id)
	client := &http.Client{Timeout: 30 * time.Second}
	r, err := http.NewRequest("POST", url, nil) // Empty body for approvePlan action?
	if err != nil {
		return err
	}

	r.Header.Set("X-Goog-Api-Key", apiKey)
	r.Header.Set("Content-Type", "application/json") // standard

	resp, err := client.Do(r)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("remote approve failed %d: %s", resp.StatusCode, string(b))
	}
	return nil
}
