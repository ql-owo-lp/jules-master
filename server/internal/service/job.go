package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	pb "github.com/mcpany/jules/gen"
	"google.golang.org/protobuf/types/known/emptypb"
)

type JobServer struct {
	pb.UnimplementedJobServiceServer
	DB *sql.DB
}

func (s *JobServer) ListJobs(ctx context.Context, _ *emptypb.Empty) (*pb.ListJobsResponse, error) {
	rows, err := s.DB.Query(`
        SELECT id, name, session_ids, created_at, repo, branch, auto_approval, 
               background, prompt, session_count, status, automation_mode, 
               require_plan_approval, cron_job_id, profile_id
        FROM jobs 
        ORDER BY created_at DESC
    `)
	if err != nil {
		return nil, fmt.Errorf("failed to list jobs: %w", err)
	}
	defer rows.Close()

	var jobs []*pb.Job
	for rows.Next() {
		var j pb.Job
		var sessionIdsJSON string
		var automationMode sql.NullString
		var cronJobId, profileId sql.NullString

		var requirePlanApproval sql.NullBool
		if err := rows.Scan(
			&j.Id, &j.Name, &sessionIdsJSON, &j.CreatedAt, &j.Repo, &j.Branch, &j.AutoApproval,
			&j.Background, &j.Prompt, &j.SessionCount, &j.Status, &automationMode,
			&requirePlanApproval, &cronJobId, &profileId,
		); err != nil {
			return nil, fmt.Errorf("failed to scan job: %w", err)
		}
		if requirePlanApproval.Valid {
			j.RequirePlanApproval = requirePlanApproval.Bool
		}

		if err := json.Unmarshal([]byte(sessionIdsJSON), &j.SessionIds); err != nil {
			// If manual string or empty
			// Assuming sessionIds is always JSON array per code
			j.SessionIds = []string{}
		}

		if automationMode.Valid {
			if automationMode.String == "AUTO_CREATE_PR" {
				j.AutomationMode = pb.AutomationMode_AUTO_CREATE_PR
			} else {
				j.AutomationMode = pb.AutomationMode_AUTOMATION_MODE_UNSPECIFIED
			}
		}
		if cronJobId.Valid {
			j.CronJobId = cronJobId.String
		}
		if profileId.Valid {
			j.ProfileId = profileId.String
		}

		jobs = append(jobs, &j)
	}
	return &pb.ListJobsResponse{Jobs: jobs}, nil
}

func (s *JobServer) GetJob(ctx context.Context, req *pb.GetJobRequest) (*pb.Job, error) {
	if req.Id == "" {
		return nil, fmt.Errorf("id required")
	}

	var j pb.Job
	var sessionIdsJSON string
	var automationMode sql.NullString
	var cronJobId, profileId sql.NullString

	var requirePlanApproval sql.NullBool
	err := s.DB.QueryRow(`
        SELECT id, name, session_ids, created_at, repo, branch, auto_approval, 
        background, prompt, session_count, status, automation_mode, 
        require_plan_approval, cron_job_id, profile_id
        FROM jobs 
        WHERE id = ?
    `, req.Id).Scan(
		&j.Id, &j.Name, &sessionIdsJSON, &j.CreatedAt, &j.Repo, &j.Branch, &j.AutoApproval,
		&j.Background, &j.Prompt, &j.SessionCount, &j.Status, &automationMode,
		&requirePlanApproval, &cronJobId, &profileId,
	)
	if requirePlanApproval.Valid {
		j.RequirePlanApproval = requirePlanApproval.Bool
	}

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("job not found")
	} else if err != nil {
		return nil, fmt.Errorf("failed to get job: %w", err)
	}

	if err := json.Unmarshal([]byte(sessionIdsJSON), &j.SessionIds); err != nil {
		j.SessionIds = []string{}
	}
	if automationMode.Valid && automationMode.String == "AUTO_CREATE_PR" {
		j.AutomationMode = pb.AutomationMode_AUTO_CREATE_PR
	}
	if cronJobId.Valid {
		j.CronJobId = cronJobId.String
	}
	if profileId.Valid {
		j.ProfileId = profileId.String
	}

	return &j, nil
}

func (s *JobServer) CreateJob(ctx context.Context, req *pb.CreateJobRequest) (*pb.Job, error) {
	id := req.Id
	if id == "" {
		id = uuid.New().String()
	}

	createdAt := req.CreatedAt
	if createdAt == "" {
		createdAt = time.Now().Format(time.RFC3339)
	}

	sessionIdsJSON, _ := json.Marshal(req.SessionIds)
	if req.SessionIds == nil {
		sessionIdsJSON = []byte("[]")
	}

	automationModeStr := "AUTOMATION_MODE_UNSPECIFIED"
	if req.AutomationMode == pb.AutomationMode_AUTO_CREATE_PR {
		automationModeStr = "AUTO_CREATE_PR"
	}

	_, err := s.DB.Exec(`INSERT INTO jobs (
        id, name, session_ids, created_at, repo, branch, 
        auto_approval, background, prompt, session_count, 
        status, automation_mode, require_plan_approval, cron_job_id, profile_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.Name, string(sessionIdsJSON), createdAt, req.Repo, req.Branch,
		req.AutoApproval, req.Background, req.Prompt, req.SessionCount,
		req.Status, automationModeStr, req.RequirePlanApproval, req.CronJobId, req.ProfileId)

	if err != nil {
		return nil, fmt.Errorf("failed to create job: %w", err)
	}

	// Return constructed job (ideally fetch back but lets construct)
	return &pb.Job{
		Id:                  id,
		Name:                req.Name,
		SessionIds:          req.SessionIds,
		CreatedAt:           createdAt,
		Repo:                req.Repo,
		Branch:              req.Branch,
		AutoApproval:        req.AutoApproval,
		Background:          req.Background,
		Prompt:              req.Prompt,
		SessionCount:        req.SessionCount,
		Status:              req.Status,
		AutomationMode:      req.AutomationMode,
		RequirePlanApproval: req.RequirePlanApproval,
		CronJobId:           req.CronJobId,
		ProfileId:           req.ProfileId,
	}, nil
}

func (s *JobServer) CreateManyJobs(ctx context.Context, req *pb.CreateManyJobsRequest) (*emptypb.Empty, error) {
	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO jobs (
			id, name, session_ids, created_at, repo, branch, auto_approval, 
			background, prompt, session_count, status, automation_mode, 
			require_plan_approval, cron_job_id, profile_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	for _, j := range req.Jobs {
		sessionIdsJSON, _ := json.Marshal(j.SessionIds)
		if j.SessionIds == nil {
			sessionIdsJSON = []byte("[]")
		}

		automationModeStr := "AUTOMATION_MODE_UNSPECIFIED"
		if j.AutomationMode == pb.AutomationMode_AUTO_CREATE_PR {
			automationModeStr = "AUTO_CREATE_PR"
		}

		id := j.Id
		if id == "" {
			id = uuid.New().String()
		}
		createdAt := j.CreatedAt
		if createdAt == "" {
			createdAt = time.Now().Format(time.RFC3339)
		}

		if _, err := stmt.Exec(id, j.Name, string(sessionIdsJSON), createdAt, j.Repo, j.Branch, j.AutoApproval,
			j.Background, j.Prompt, j.SessionCount, j.Status, automationModeStr,
			j.RequirePlanApproval, j.CronJobId, j.ProfileId); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &emptypb.Empty{}, nil
}

func (s *JobServer) UpdateJob(ctx context.Context, req *pb.UpdateJobRequest) (*emptypb.Empty, error) {
	query := "UPDATE jobs SET "
	var args []interface{}
	updates := false

	if req.Name != nil {
		query += "name = ?, "
		args = append(args, *req.Name)
		updates = true
	}
	if req.Status != nil {
		query += "status = ?, "
		args = append(args, *req.Status)
		updates = true
	}
	// ... handle other fields

	if !updates {
		return &emptypb.Empty{}, nil
	}

	query = query[:len(query)-2] // remove trailing comma
	query += " WHERE id = ?"
	args = append(args, req.Id)

	_, err := s.DB.Exec(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update job: %w", err)
	}

	return &emptypb.Empty{}, nil
}

func (s *JobServer) DeleteJob(ctx context.Context, req *pb.DeleteJobRequest) (*emptypb.Empty, error) {
	_, err := s.DB.Exec("DELETE FROM jobs WHERE id = ?", req.Id)
	if err != nil {
		return nil, fmt.Errorf("failed to delete job: %w", err)
	}
	return &emptypb.Empty{}, nil
}
