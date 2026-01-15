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
    if err != nil { return nil, err }
    defer rows.Close()
    
    var sessions []*pb.Session
    for rows.Next() {
        var sess pb.Session
        // Handling NULLs might be needed if schema allows, assuming strictly string for now based on Proto
        if err := rows.Scan(&sess.Id, &sess.Name, &sess.Title, &sess.Prompt, &sess.CreateTime, &sess.State, &sess.ProfileId); err != nil {
            return nil, err
        }
        sessions = append(sessions, &sess)
    }
    return &pb.ListSessionsResponse{Sessions: sessions}, nil
}

func (s *SessionServer) ApprovePlan(ctx context.Context, req *pb.ApprovePlanRequest) (*emptypb.Empty, error) {
    // Logic: Update state to 'IN_PROGRESS' (or whatever approval means)
    // Assuming approval means moving from AWAITING_PLAN_APPROVAL to IN_PROGRESS so execution continues
    // Or maybe QUEUED?
    // Let's assume IN_PROGRESS for now matching typical flow.
    
    // Also need to check if session exists.
    res, err := s.DB.Exec("UPDATE sessions SET state = 'IN_PROGRESS', update_time = datetime('now') WHERE id = ? AND state = 'AWAITING_PLAN_APPROVAL'", req.Id)
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
    err := s.DB.QueryRow("SELECT id, name, title, prompt, create_time, state, profile_id FROM sessions WHERE id = ?", req.Id).Scan(
        &sess.Id, &sess.Name, &sess.Title, &sess.Prompt, &sess.CreateTime, &sess.State, &sess.ProfileId,
    )
    if err == sql.ErrNoRows {
        return nil, fmt.Errorf("session not found")
    } else if err != nil {
        return nil, err
    }
    return &sess, nil
}

func (s *SessionServer) CreateSession(ctx context.Context, req *pb.CreateSessionRequest) (*pb.Session, error) {
    id := uuid.New().String()
    createTime := time.Now().Format(time.RFC3339)
    name := req.Name
    if name == "" {
        name = "sessions/" + id
    }
    
    // Default values
    state := "QUEUED" // Or whatever initial state
    title := "New Session"
    if req.Name != "" { title = req.Name } 
    
    _, err := s.DB.Exec(`
        INSERT INTO sessions (id, name, title, create_time, state, update_time)
        VALUES (?, ?, ?, ?, ?, ?)
    `, id, name, title, createTime, state, createTime)
    
    if err != nil {
        return nil, fmt.Errorf("failed to create session: %w", err)
    }
    
    return &pb.Session{
        Id: id,
        Name: name,
        Title: title,
        CreateTime: createTime,
        State: state,
    }, nil
}

func (s *SessionServer) UpdateSession(ctx context.Context, req *pb.UpdateSessionRequest) (*emptypb.Empty, error) {
    return nil, fmt.Errorf("not implemented")
}

func (s *SessionServer) DeleteSession(ctx context.Context, req *pb.DeleteSessionRequest) (*emptypb.Empty, error) {
    _, err := s.DB.Exec("DELETE FROM sessions WHERE id = ?", req.Id)
    if err != nil { return nil, err }
    return &emptypb.Empty{}, nil
}
