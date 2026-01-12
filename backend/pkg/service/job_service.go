package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"connectrpc.com/connect"
	"github.com/jules-org/jules/backend/pkg/db"
	"github.com/jules-org/jules/backend/pkg/proto/jules"
)

type JobService struct{}

func NewJobService() *JobService {
	return &JobService{}
}

func (s *JobService) CreateJob(ctx context.Context, req *connect.Request[jules.CreateJobRequest]) (*connect.Response[jules.Job], error) {
	job := req.Msg.Job
	if job == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("job is required"))
	}

	// Set defaults
	if job.Id == "" {
		// Generate ID? Or let DB do it? SQLite doesn't autogen text IDs. 
		// Node app used some ID generation. We should use UUID.
		// For now assume client provides it or we generate.
		// TODO: Add UUID generation if missing
	}
	if job.CreatedAt == "" {
		job.CreatedAt = db.NowString()
	}
	if job.ProfileId == "" {
		job.ProfileId = "default"
	}

	// Insert into DB
	query := `
		INSERT INTO jobs (
			id, name, session_ids, created_at, repo, branch, 
			auto_approval, background, prompt, session_count, 
			status, automation_mode, require_plan_approval, cron_job_id, profile_id
		) VALUES (
			:id, :name, :session_ids, :created_at, :repo, :branch, 
			:auto_approval, :background, :prompt, :session_count, 
			:status, :automation_mode, :require_plan_approval, :cron_job_id, :profile_id
		)
	`
	
	sessionIdsJSON, _ := json.Marshal(job.SessionIds)

	dbJob := db.Job{
		ID:                  job.Id,
		Name:                job.Name,
		SessionIDs:          string(sessionIdsJSON),
		CreatedAt:           job.CreatedAt,
		Repo:                job.Repo,
		Branch:              job.Branch,
		AutoApproval:        job.AutoApproval,
		Background:          job.Background,
		Prompt:              sql.NullString{String: job.Prompt, Valid: job.Prompt != ""},
		SessionCount:        sql.NullInt64{Int64: int64(job.SessionCount), Valid: true},
		Status:              sql.NullString{String: job.Status, Valid: job.Status != ""},
		AutomationMode:      sql.NullString{String: job.AutomationMode, Valid: job.AutomationMode != ""},
		RequirePlanApproval: sql.NullBool{Bool: job.RequirePlanApproval, Valid: true},
		CronJobID:           sql.NullString{String: job.CronJobId, Valid: job.CronJobId != ""},
		ProfileID:           job.ProfileId,
	}

	_, err := db.DB.NamedExecContext(ctx, query, dbJob)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(job), nil
}

func (s *JobService) ListJobs(ctx context.Context, req *connect.Request[jules.ListJobsRequest]) (*connect.Response[jules.ListJobsResponse], error) {
	profileID := req.Msg.ProfileId
	if profileID == "" {
		profileID = "default"
	}

	var dbJobs []db.Job
	err := db.DB.SelectContext(ctx, &dbJobs, "SELECT * FROM jobs WHERE profile_id = ? ORDER BY created_at DESC", profileID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var jobsList []*jules.Job
	for _, dj := range dbJobs {
		var sessionIds []string
		_ = json.Unmarshal([]byte(dj.SessionIDs), &sessionIds)

		jobsList = append(jobsList, &jules.Job{
			Id:                  dj.ID,
			Name:                dj.Name,
			SessionIds:          sessionIds,
			CreatedAt:           dj.CreatedAt,
			Repo:                dj.Repo,
			Branch:              dj.Branch,
			AutoApproval:        dj.AutoApproval,
			Background:          dj.Background,
			Prompt:              dj.Prompt.String,
			SessionCount:        int32(dj.SessionCount.Int64),
			Status:              dj.Status.String,
			AutomationMode:      dj.AutomationMode.String,
			RequirePlanApproval: dj.RequirePlanApproval.Bool,
			CronJobId:           dj.CronJobID.String,
			ProfileId:           dj.ProfileID,
		})
	}

	return connect.NewResponse(&jules.ListJobsResponse{
		Jobs: jobsList,
	}), nil
}

func (s *JobService) GetJob(ctx context.Context, req *connect.Request[jules.GetJobRequest]) (*connect.Response[jules.Job], error) {
	id := req.Msg.Id
	var dj db.Job
	err := db.DB.GetContext(ctx, &dj, "SELECT * FROM jobs WHERE id = ?", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("job not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	var sessionIds []string
	_ = json.Unmarshal([]byte(dj.SessionIDs), &sessionIds)

	return connect.NewResponse(&jules.Job{
		Id:                  dj.ID,
		Name:                dj.Name,
		SessionIds:          sessionIds,
		CreatedAt:           dj.CreatedAt,
		Repo:                dj.Repo,
		Branch:              dj.Branch,
		AutoApproval:        dj.AutoApproval,
		Background:          dj.Background,
		Prompt:              dj.Prompt.String,
		SessionCount:        int32(dj.SessionCount.Int64),
		Status:              dj.Status.String,
		AutomationMode:      dj.AutomationMode.String,
		RequirePlanApproval: dj.RequirePlanApproval.Bool,
		CronJobId:           dj.CronJobID.String,
		ProfileId:           dj.ProfileID,
	}), nil
}
