package worker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/mcpany/jules/internal/service"
	pb "github.com/mcpany/jules/proto"
)

func TestAutoContinueWorker_LoopPrevention(t *testing.T) {
	db := setupTestDB(t)
	t.Setenv("JULES_API_KEY", "dummy-key")
	settingsService := &service.SettingsServer{DB: db}

	sendMessageCount := 0
	// Mock Remote Server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Logf("Mock Server received request: %s %s", r.Method, r.URL.Path)
		if r.Method == "POST" && strings.Contains(r.URL.Path, "sessions") {
			if strings.Contains(r.URL.Path, ":sendMessage") {
				sendMessageCount++
				t.Log("Counted sendMessage call")
				w.WriteHeader(http.StatusOK)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			// Return minimal valid session JSON with RECENT createTime
			createTime := time.Now().Format(time.RFC3339)
			w.Write([]byte(`{"name":"sessions/mock-id", "id":"mock-id", "state":"QUEUED", "createTime":"` + createTime + `"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	sessionService := &service.SessionServer{
		DB:         db,
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	}

	// 1. Create session and job
	sess, err := sessionService.CreateSession(context.Background(), &pb.CreateSessionRequest{
		Name: "test-session-loop",
	})
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	t.Logf("Created session %s", sess.Id)

	// Mark as COMPLETED
	db.Exec("UPDATE sessions SET state = 'COMPLETED' WHERE id = ?", sess.Id)
	db.Exec("INSERT INTO jobs (id, repo, name, created_at, session_ids, prompt) VALUES (?, ?, ?, ?, ?, ?)",
		"job-loop", "owner/repo", "test-job", time.Now(), "[\""+sess.Id+"\"]", "test prompt")

	// 2. Enable Auto Continue
	db.Exec(`INSERT INTO settings (profile_id, auto_continue_enabled, auto_approval_interval, theme, auto_retry_message, auto_continue_message, auto_continue_all_sessions)
		VALUES ('default', 1, 60, 'system', '', '', 1)`)

	cannedResponse := "you are independent principal software engineer, you are doing good, I trust your judgement, please continue. If you do it correctly in the first run, I will offer you a great peer bonus"

	// 3. Mock Fetcher - Returns No PR, but MANY previous auto-replies
	mockFetcher := &MockSessionFetcher{
		Session: &RemoteSession{
			Id:    sess.Id,
			State: "COMPLETED",
			Outputs: []struct {
				PullRequest *struct {
					Url string `json:"url"`
				} `json:"pullRequest"`
			}{
				// No PR
			},
			Messages: []struct {
				Text string `json:"text"`
				Type string `json:"type"`
			}{
				{Text: "Some previous message", Type: "AI"},
				{Text: cannedResponse, Type: "HUMAN"},
				{Text: "I am done", Type: "AI"},
				{Text: cannedResponse, Type: "HUMAN"},
				{Text: "I am done again", Type: "AI"},
				{Text: cannedResponse, Type: "HUMAN"},
				{Text: "Still done", Type: "AI"},
				{Text: cannedResponse, Type: "HUMAN"},
				{Text: "Done done", Type: "AI"},
				{Text: cannedResponse, Type: "HUMAN"}, // 5th time
				{Text: "Really done", Type: "AI"},
			},
		},
	}

	// 4. Run Worker
	worker := NewAutoContinueWorker(db, settingsService, sessionService, mockFetcher, "test-api-key")

	err = worker.runCheck(context.Background())
	if err != nil {
		t.Errorf("runCheck failed: %v", err)
	}

	// 5. Verify message count
	if sendMessageCount == 0 {
		t.Log("Pass: Did not send message (Loop prevented)")
	} else {
		t.Errorf("Fail: Sent message despite 5 previous attempts. Count: %d", sendMessageCount)
	}
}
