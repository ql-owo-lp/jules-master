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

func (c *Client) GetCombinedStatus(ctx context.Context, owner, repo, ref string) (*github.CombinedStatus, error) {
    s, _, err := c.client.Repositories.GetCombinedStatus(ctx, owner, repo, ref, nil)
    return s, err
}
