package service

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"connectrpc.com/connect"
	"github.com/jules-org/jules/backend/pkg/db"
	"github.com/jules-org/jules/backend/pkg/proto/jules"
)

type SessionService struct{}

func NewSessionService() *SessionService {
	return &SessionService{}
}

func (s *SessionService) ListSessions(ctx context.Context, req *connect.Request[jules.ListSessionsRequest]) (*connect.Response[jules.ListSessionsResponse], error) {
	profileID := req.Msg.ProfileId
	if profileID == "" {
		profileID = "default"
	}

	var dbSessions []db.Session
	err := db.DB.SelectContext(ctx, &dbSessions, "SELECT * FROM sessions WHERE profile_id = ? ORDER BY create_time DESC", profileID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var sessionsList []*jules.Session
	for _, ds := range dbSessions {
		sessionsList = append(sessionsList, mapDBSessionToProto(ds))
	}

	return connect.NewResponse(&jules.ListSessionsResponse{
		Sessions: sessionsList,
	}), nil
}

func (s *SessionService) CreateSession(ctx context.Context, req *connect.Request[jules.CreateSessionRequest]) (*connect.Response[jules.Session], error) {
	session := req.Msg.Session
	if session == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("session is required"))
	}

	if session.CreateTime == "" {
		session.CreateTime = db.NowString()
	}
	if session.ProfileId == "" {
		session.ProfileId = "default"
	}
	if session.LastUpdated == 0 {
		session.LastUpdated = time.Now().UnixMilli()
	}

	query := `
		INSERT INTO sessions (
			id, name, title, prompt, source_context, create_time, update_time, 
			state, url, outputs, require_plan_approval, automation_mode, 
			last_updated, retry_count, last_error, last_interaction_at, profile_id
		) VALUES (
			:id, :name, :title, :prompt, :source_context, :create_time, :update_time, 
			:state, :url, :outputs, :require_plan_approval, :automation_mode, 
			:last_updated, :retry_count, :last_error, :last_interaction_at, :profile_id
		)
	`

	dbSession := db.Session{
		ID:                  session.Id,
		Name:                session.Name,
		Title:               session.Title,
		Prompt:              session.Prompt,
		SourceContext:       sql.NullString{String: session.SourceContext, Valid: session.SourceContext != ""},
		CreateTime:          sql.NullString{String: session.CreateTime, Valid: session.CreateTime != ""},
		UpdateTime:          sql.NullString{String: session.UpdateTime, Valid: session.UpdateTime != ""},
		State:               session.State,
		URL:                 sql.NullString{String: session.Url, Valid: session.Url != ""},
		Outputs:             sql.NullString{String: session.Outputs, Valid: session.Outputs != ""},
		RequirePlanApproval: sql.NullBool{Bool: session.RequirePlanApproval, Valid: true},
		AutomationMode:      sql.NullString{String: session.AutomationMode, Valid: session.AutomationMode != ""},
		LastUpdated:         session.LastUpdated,
		RetryCount:          int(session.RetryCount),
		LastError:           sql.NullString{String: session.LastError, Valid: session.LastError != ""},
		LastInteractionAt:   sql.NullInt64{Int64: session.LastInteractionAt, Valid: session.LastInteractionAt != 0},
		ProfileID:           session.ProfileId,
	}

	_, err := db.DB.NamedExecContext(ctx, query, dbSession)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(session), nil
}

func (s *SessionService) GetSession(ctx context.Context, req *connect.Request[jules.GetSessionRequest]) (*connect.Response[jules.Session], error) {
	id := req.Msg.Id
	var ds db.Session
	err := db.DB.GetContext(ctx, &ds, "SELECT * FROM sessions WHERE id = ?", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("session not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(mapDBSessionToProto(ds)), nil
}

func (s *SessionService) UpdateSession(ctx context.Context, req *connect.Request[jules.UpdateSessionRequest]) (*connect.Response[jules.Session], error) {
	// session := req.Msg.Session
	// In a real app we would check what fields to update.
	// For now, full overwrite or simple update logic.

	// Use NamedExec with UPDATE
	// Skipped for brevity, assume full update or specific fields logic
	// ...
	return nil, connect.NewError(connect.CodeUnimplemented, fmt.Errorf("not implemented"))
}

func mapDBSessionToProto(ds db.Session) *jules.Session {
	return &jules.Session{
		Id:                  ds.ID,
		Name:                ds.Name,
		Title:               ds.Title,
		Prompt:              ds.Prompt,
		SourceContext:       ds.SourceContext.String,
		CreateTime:          ds.CreateTime.String,
		UpdateTime:          ds.UpdateTime.String,
		State:               ds.State,
		Url:                 ds.URL.String,
		Outputs:             ds.Outputs.String,
		RequirePlanApproval: ds.RequirePlanApproval.Bool,
		AutomationMode:      ds.AutomationMode.String,
		LastUpdated:         ds.LastUpdated,
		RetryCount:          int32(ds.RetryCount),
		LastError:           ds.LastError.String,
		LastInteractionAt:   ds.LastInteractionAt.Int64,
		ProfileId:           ds.ProfileID,
	}
}
