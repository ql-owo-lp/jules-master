package github

import (
	"context"

	"github.com/google/go-github/v69/github"
	"golang.org/x/oauth2"
)

type Client struct {
	client *github.Client
}

func NewClient(token string) *Client {
	ctx := context.Background()
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: token},
	)
	tc := oauth2.NewClient(ctx, ts)
	return &Client{
		client: github.NewClient(tc),
	}
}

func (c *Client) ListBranches(ctx context.Context, owner, repo string) ([]*github.Branch, error) {
	opts := &github.BranchListOptions{
		ListOptions: github.ListOptions{PerPage: 100},
	}

	var allBranches []*github.Branch
	for {
		branches, resp, err := c.client.Repositories.ListBranches(ctx, owner, repo, opts)
		if err != nil {
			return nil, err
		}
		allBranches = append(allBranches, branches...)
		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}
	return allBranches, nil
}

func (c *Client) DeleteBranch(ctx context.Context, owner, repo, branch string) error {
	_, err := c.client.Git.DeleteRef(ctx, owner, repo, "heads/"+branch)
	return err
}

func (c *Client) GetBranch(ctx context.Context, owner, repo, branch string) (*github.Branch, error) {
	b, _, err := c.client.Repositories.GetBranch(ctx, owner, repo, branch, 0)
	return b, err
}

func (c *Client) ListPullRequests(ctx context.Context, owner, repo string, opts *github.PullRequestListOptions) ([]*github.PullRequest, error) {
	prs, _, err := c.client.PullRequests.List(ctx, owner, repo, opts)
	return prs, err
}

func (c *Client) GetPullRequest(ctx context.Context, owner, repo string, number int) (*github.PullRequest, *github.Response, error) {
	return c.client.PullRequests.Get(ctx, owner, repo, number)
}

func (c *Client) ListCheckRunsForRef(ctx context.Context, owner, repo, ref string, opts *github.ListCheckRunsOptions) (*github.ListCheckRunsResults, *github.Response, error) {
	return c.client.Checks.ListCheckRunsForRef(ctx, owner, repo, ref, opts)
}

func (c *Client) GetCombinedStatus(ctx context.Context, owner, repo, ref string) (*github.CombinedStatus, error) {
	s, _, err := c.client.Repositories.GetCombinedStatus(ctx, owner, repo, ref, nil)
	return s, err
}

func (c *Client) CreateComment(ctx context.Context, owner, repo string, number int, body string) error {
	comment := &github.IssueComment{Body: &body}
	_, _, err := c.client.Issues.CreateComment(ctx, owner, repo, number, comment)
	return err
}

func (c *Client) ListComments(ctx context.Context, owner, repo string, number int) ([]*github.IssueComment, error) {
	comments, _, err := c.client.Issues.ListComments(ctx, owner, repo, number, nil)
	return comments, err
}

func (c *Client) GetUser(ctx context.Context, username string) (*github.User, error) {
	// If username is empty, get authenticated user
	user, _, err := c.client.Users.Get(ctx, username)
	return user, err
}

func (c *Client) ClosePullRequest(ctx context.Context, owner, repo string, number int) (*github.PullRequest, error) {
	// Edit PR state to "closed"
	pr := &github.PullRequest{State: github.String("closed")}
	ret, _, err := c.client.PullRequests.Edit(ctx, owner, repo, number, pr)
	return ret, err
}
func (c *Client) UpdateBranch(ctx context.Context, owner, repo string, number int) error {
	_, _, err := c.client.PullRequests.UpdateBranch(ctx, owner, repo, number, nil)
	return err
}

func (c *Client) MarkPullRequestReadyForReview(ctx context.Context, owner, repo string, number int) (*github.PullRequest, error) {
	pr := &github.PullRequest{Draft: github.Bool(false)}
	ret, _, err := c.client.PullRequests.Edit(ctx, owner, repo, number, pr)
	return ret, err
}

func (c *Client) ListFiles(ctx context.Context, owner, repo string, number int, opts *github.ListOptions) ([]*github.CommitFile, error) {
	files, _, err := c.client.PullRequests.ListFiles(ctx, owner, repo, number, opts)
	return files, err
}
