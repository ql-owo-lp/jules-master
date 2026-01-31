package github

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

// helper to create a client with a mock server
func newTestClient(t *testing.T, handler http.Handler) (*Client, *httptest.Server) {
	server := httptest.NewServer(handler)
	c := NewClient("dummy-token")

	// Override BaseURL to point to mock server
	// u, err := url.Parse(server.URL + "/")
	// assert.NoError(t, err)
	// c.client.BaseURL = u
	// c.client.UploadURL = u
	err := c.SetBaseURL(server.URL + "/")
	assert.NoError(t, err)

	return c, server
}

func TestListBranches(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/repos/o/r/branches", r.URL.Path)
		fmt.Fprint(w, `[{"name":"main"}, {"name":"dev"}]`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	branches, err := c.ListBranches(context.Background(), "o", "r")
	assert.NoError(t, err)
	assert.Len(t, branches, 2)
	assert.Equal(t, "main", branches[0].GetName())
	assert.Equal(t, "dev", branches[1].GetName())
}

func TestGetPullRequest(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/repos/o/r/pulls/123", r.URL.Path)
		fmt.Fprint(w, `{"number":123, "title":"Test PR"}`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	pr, _, err := c.GetPullRequest(context.Background(), "o", "r", 123)
	assert.NoError(t, err)
	assert.Equal(t, 123, pr.GetNumber())
	assert.Equal(t, "Test PR", pr.GetTitle())
}

func TestCreateComment(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/repos/o/r/issues/123/comments", r.URL.Path)
		fmt.Fprint(w, `{"id":1, "body":"hello"}`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	err := c.CreateComment(context.Background(), "o", "r", 123, "hello")
	assert.NoError(t, err)
}

func TestMergePullRequest(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "PUT", r.Method)
		assert.Equal(t, "/repos/o/r/pulls/123/merge", r.URL.Path)
		fmt.Fprint(w, `{"sha":"merged-sha", "merged":true}`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	err := c.MergePullRequest(context.Background(), "o", "r", 123, "msg", "merge")
	assert.NoError(t, err)
}

func TestClosePullRequest(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "PATCH", r.Method)
		assert.Equal(t, "/repos/o/r/pulls/123", r.URL.Path)
		// Check that body contains state: closed
		// (simplified check)
		fmt.Fprint(w, `{"number":123, "state":"closed"}`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	pr, err := c.ClosePullRequest(context.Background(), "o", "r", 123)
	assert.NoError(t, err)
	assert.Equal(t, "closed", pr.GetState())
}

func TestListFiles(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/repos/o/r/pulls/123/files", r.URL.Path)
		fmt.Fprint(w, `[{"filename":"f1.go"}]`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	files, err := c.ListFiles(context.Background(), "o", "r", 123, nil)
	assert.NoError(t, err)
	assert.Len(t, files, 1)
	assert.Equal(t, "f1.go", files[0].GetFilename())
}

func TestUpdateBranch(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "PUT", r.Method)
		assert.Equal(t, "/repos/o/r/pulls/123/update-branch", r.URL.Path)
		fmt.Fprint(w, `{"message":"updated"}`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	err := c.UpdateBranch(context.Background(), "o", "r", 123)
	assert.NoError(t, err)
}

func TestGetUser(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		if r.URL.Path == "/user" {
			fmt.Fprint(w, `{"login":"me"}`)
		} else {
			assert.Equal(t, "/users/other", r.URL.Path)
			fmt.Fprint(w, `{"login":"other"}`)
		}
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	u, err := c.GetUser(context.Background(), "")
	assert.NoError(t, err)
	assert.Equal(t, "me", u.GetLogin())

	u2, err := c.GetUser(context.Background(), "other")
	assert.NoError(t, err)
	assert.Equal(t, "other", u2.GetLogin())
}

func TestDeleteBranch(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "DELETE", r.Method)
		assert.Equal(t, "/repos/o/r/git/refs/heads/b1", r.URL.Path)
		w.WriteHeader(http.StatusNoContent)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	err := c.DeleteBranch(context.Background(), "o", "r", "b1")
	assert.NoError(t, err)
}

func TestListPullRequests(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/repos/o/r/pulls", r.URL.Path)
		fmt.Fprint(w, `[{"number":1}, {"number":2}]`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	prs, _, err := c.ListPullRequests(context.Background(), "o", "r", nil)
	assert.NoError(t, err)
	assert.Len(t, prs, 2)
}

func TestListCheckRunsForRef(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/repos/o/r/commits/ref/check-runs", r.URL.Path)
		fmt.Fprint(w, `{"check_runs":[{"id":1}]}`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	runs, _, err := c.ListCheckRunsForRef(context.Background(), "o", "r", "ref", nil)
	assert.NoError(t, err)
	assert.Len(t, runs.CheckRuns, 1)
}

func TestGetCombinedStatus(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/repos/o/r/commits/ref/status", r.URL.Path)
		fmt.Fprint(w, `{"state":"success"}`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	s, err := c.GetCombinedStatus(context.Background(), "o", "r", "ref")
	assert.NoError(t, err)
	assert.Equal(t, "success", s.GetState())
}

func TestListComments(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/repos/o/r/issues/123/comments", r.URL.Path)
		fmt.Fprint(w, `[{"id":1, "body":"comment"}]`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	comments, err := c.ListComments(context.Background(), "o", "r", 123)
	assert.NoError(t, err)
	assert.Len(t, comments, 1)
}

func TestSearchIssues(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "GET", r.Method)
		assert.Equal(t, "/search/issues", r.URL.Path)
		assert.Contains(t, r.URL.Query().Get("q"), "is:pr")
		fmt.Fprint(w, `{"total_count":1, "items":[{"number":1}]}`)
	})
	c, server := newTestClient(t, handler)
	defer server.Close()

	res, _, err := c.SearchIssues(context.Background(), "is:pr", nil)
	assert.NoError(t, err)
	assert.Equal(t, 1, *res.Total)
}
