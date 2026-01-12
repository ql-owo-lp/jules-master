package db

import (
	"database/sql"
	"time"
)

type Profile struct {
	ID        string `db:"id"`
	Name      string `db:"name"`
	CreatedAt string `db:"created_at"`
}

type Job struct {
	ID                  string         `db:"id"`
	Name                string         `db:"name"`
	SessionIDs          string         `db:"session_ids"` // JSON string
	CreatedAt           string         `db:"created_at"`
	Repo                string         `db:"repo"`
	Branch              string         `db:"branch"`
	AutoApproval        bool           `db:"auto_approval"`
	Background          bool           `db:"background"`
	Prompt              sql.NullString `db:"prompt"`
	SessionCount        sql.NullInt64  `db:"session_count"`
	Status              sql.NullString `db:"status"`
	AutomationMode      sql.NullString `db:"automation_mode"`
	RequirePlanApproval sql.NullBool   `db:"require_plan_approval"`
	CronJobID           sql.NullString `db:"cron_job_id"`
	ProfileID           string         `db:"profile_id"`
}

type Session struct {
	ID                  string         `db:"id"`
	Name                string         `db:"name"`
	Title               string         `db:"title"`
	Prompt              string         `db:"prompt"`
	SourceContext       sql.NullString `db:"source_context"` // JSON
	CreateTime          sql.NullString `db:"create_time"`
	UpdateTime          sql.NullString `db:"update_time"`
	State               string         `db:"state"`
	URL                 sql.NullString `db:"url"`
	Outputs             sql.NullString `db:"outputs"` // JSON
	RequirePlanApproval sql.NullBool   `db:"require_plan_approval"`
	AutomationMode      sql.NullString `db:"automation_mode"`
	LastUpdated         int64          `db:"last_updated"`
	RetryCount          int            `db:"retry_count"`
	LastError           sql.NullString `db:"last_error"`
	LastInteractionAt   sql.NullInt64  `db:"last_interaction_at"`
	ProfileID           string         `db:"profile_id"`
}

type Settings struct {
	ID                                  int            `db:"id"`
	IdlePollInterval                    int            `db:"idle_poll_interval"`
	ActivePollInterval                  int            `db:"active_poll_interval"`
	TitleTruncateLength                 int            `db:"title_truncate_length"`
	LineClamp                           int            `db:"line_clamp"`
	SessionItemsPerPage                 int            `db:"session_items_per_page"`
	JobsPerPage                         int            `db:"jobs_per_page"`
	DefaultSessionCount                 int            `db:"default_session_count"`
	PrStatusPollInterval                int            `db:"pr_status_poll_interval"`
	Theme                               string         `db:"theme"`
	HistoryPromptsCount                 int            `db:"history_prompts_count"`
	AutoApprovalEnabled                 bool           `db:"auto_approval_enabled"`
	AutoApprovalInterval                int            `db:"auto_approval_interval"`
	AutoRetryEnabled                    bool           `db:"auto_retry_enabled"`
	AutoRetryMessage                    string         `db:"auto_retry_message"`
	AutoContinueEnabled                 bool           `db:"auto_continue_enabled"`
	AutoContinueMessage                 string         `db:"auto_continue_message"`
	SessionCacheInProgressInterval      int            `db:"session_cache_in_progress_interval"`
	SessionCacheCompletedNoPRInterval   int            `db:"session_cache_completed_no_pr_interval"`
	SessionCachePendingApprovalInterval int            `db:"session_cache_pending_approval_interval"`
	SessionCacheMaxAgeDays              int            `db:"session_cache_max_age_days"`
	AutoDeleteStaleBranches             bool           `db:"auto_delete_stale_branches"`
	AutoDeleteStaleBranchesAfterDays    int            `db:"auto_delete_stale_branches_after_days"`
	AutoDeleteStaleBranchesInterval     int            `db:"auto_delete_stale_branches_interval"`
	CheckFailingActionsEnabled          bool           `db:"check_failing_actions_enabled"`
	CheckFailingActionsInterval         int            `db:"check_failing_actions_interval"`
	CheckFailingActionsThreshold        int            `db:"check_failing_actions_threshold"`
	ClosePROnConflictEnabled            bool           `db:"close_pr_on_conflict_enabled"`
	AutoCloseStaleConflictedPRs         bool           `db:"auto_close_stale_conflicted_prs"`
	StaleConflictedPRsDurationDays      int            `db:"stale_conflicted_prs_duration_days"`
	MinSessionInteractionInterval       int            `db:"min_session_interaction_interval"`
	RetryTimeout                        int            `db:"retry_timeout"`
	ProfileID                           string         `db:"profile_id"`
}

type Lock struct {
	ID        string `db:"id"`
	ExpiresAt int64  `db:"expires_at"`
}

// Helper to get current time string (ISO 8601)
func NowString() string {
	return time.Now().UTC().Format(time.RFC3339)
}
