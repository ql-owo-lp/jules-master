import React from 'react';
"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Button } from "./ui/button";
import { GitPullRequest, GitMerge, CheckCircle, XCircle, Clock, AlertTriangle, GitPullRequestClosed, CircleDotDashed } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import type { PullRequestStatus } from "@/lib/types";
import { getPullRequestStatus } from "@/app/github/actions";
import { useEffect, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useEnv } from "@/components/env-provider";


type PrStatusProps = {
  prUrl: string | null;
};

type CachedStatus = {
  status: PullRequestStatus | null;
  timestamp: number;
};

export function PrStatus({ prUrl }: PrStatusProps) {
  // We store the cached status object (with timestamp) in local storage
  // Key includes the PR URL to be unique
  const storageKey = prUrl ? `pr-status-${prUrl}` : "pr-status-null";
  const [cachedData, setCachedData] = useLocalStorage<CachedStatus | null>(storageKey, null);
  const [pollInterval] = useLocalStorage<number>("jules-pr-status-poll-interval", 60);
  const [debugMode] = useLocalStorage<boolean>("jules-debug-mode", false);

  // Displayed status is derived from cached data
  const status = cachedData?.status;

  const [isLoading, setIsLoading] = useState(false);
  const { githubToken: envGithubToken } = useEnv();
  const [githubToken] = useLocalStorage<string | null>("jules-github-token", null);
  
  useEffect(() => {
    async function fetchStatus() {
      if (!prUrl) return;

      const now = Date.now();
      const minUpdateIntervalMs = pollInterval * 1000;
      const isStale = !cachedData || (now - cachedData.timestamp > minUpdateIntervalMs);

      // If we don't have data, show loading state (or if we want to show loading indicator while refreshing background)
      // But user said "display the status icon immediately", so we rely on 'status' derived from 'cachedData'
      // We only set isLoading if we strictly have NO data to show.
      if (!status) {
         setIsLoading(true);
      }

      if (isStale) {
        // Background update
        if (debugMode) {
            console.log(`Refreshing PR status cache for ${prUrl}`);
        }
        try {
             const prStatus = await getPullRequestStatus(prUrl, githubToken || envGithubToken || "");
             setCachedData({
                 status: prStatus,
                 timestamp: Date.now(),
             });
             if (debugMode) {
                 console.log(`PR status updated for ${prUrl}:`, prStatus);
             }
        } catch (error) {
            console.error("Failed to fetch PR status", error);
            // If failed, maybe update timestamp so we don't retry immediately?
            // Or just leave it to retry next mount.
            // For now, let's assume temporary failure and not update cache to error state unless valid error returned.
        } finally {
            setIsLoading(false);
        }
      } else {
          setIsLoading(false);
      }
    }
    fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prUrl, githubToken]); // Removing cachedData from dependency to avoid loop if we update it.
  // Note: We should be careful not to loop.
  // fetchStatus depends on `cachedData` logic inside.
  // If we add `cachedData` to dependency, `setCachedData` will trigger effect again.
  // `cachedData` is stable enough? No, it changes when we update it.
  // So we should NOT include `cachedData` in dependency array.
  // But we need the latest `cachedData` inside the effect.
  // The effect runs on mount (and when prUrl/token changes).
  // This is what we want: Check on mount if stale.

  if (!prUrl) {
    return <div className="w-10 h-10" />;
  }

  // If no token is provided (inferred from status), just show a simple link icon
  if (status?.state === 'NO_TOKEN') {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <a href={prUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" aria-label="View Pull Request on GitHub">
                            <GitPullRequest className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </a>
                </TooltipTrigger>
                <TooltipContent>
                    <p>View on GitHub (status unavailable without token)</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
  }

  if (isLoading && status === undefined) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }
  
  if (!status && !isLoading) {
      // Loaded but no status (maybe null returned or initial state before fetch finishes and no cache)
      // If isLoading is true, we show skeleton above.
      // If isLoading is false and no status, means fetch completed with null or error?
      // Or it means we have no cache and fetch hasn't started/finished yet (but isLoading logic handles start).

       return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <a href={prUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" aria-label="View Pull Request on GitHub">
                            <GitPullRequest className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </a>
                </TooltipTrigger>
                <TooltipContent>
                    <p>View on GitHub (status unavailable)</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
  }
  
  if (!status) {
      // Fallback for safety
       return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  let Icon;
  let tooltipContent;
  let iconColor;
  let subIcon = null;

  switch (status.state) {
    case 'MERGED':
      Icon = GitMerge;
      tooltipContent = 'Pull Request Merged';
      iconColor = 'text-purple-500';
      break;
    case 'OPEN':
      Icon = GitPullRequest;
      tooltipContent = `PR Open: ${status.checks.passed}/${status.checks.total} checks passed`;
      if (status.checks.status === 'success') {
          iconColor = 'text-green-500';
          subIcon = <CheckCircle className="h-3 w-3 absolute -bottom-1 -right-1 bg-background rounded-full text-green-500" />;
      }
      else if (status.checks.status === 'failure') {
          iconColor = 'text-red-500';
          subIcon = <XCircle className="h-3 w-3 absolute -bottom-1 -right-1 bg-background rounded-full text-red-500" />;
      }
      else if (status.checks.status === 'pending') {
          iconColor = 'text-yellow-500';
          subIcon = <Clock className="h-3 w-3 absolute -bottom-1 -right-1 bg-background rounded-full text-yellow-500" />;
      }
      else {
          iconColor = 'text-muted-foreground';
      }
      break;
    case 'CLOSED':
        Icon = GitPullRequestClosed;
        tooltipContent = 'Pull Request Closed (Not Merged)';
        iconColor = 'text-red-500';
        break;
    case 'UNAUTHORIZED':
        Icon = AlertTriangle;
        tooltipContent = 'Invalid GitHub Token. Please check settings.';
        iconColor = 'text-destructive';
        break;
    case 'NOT_FOUND':
        Icon = AlertTriangle;
        tooltipContent = 'Pull Request not found.';
        iconColor = 'text-muted-foreground';
        break;
    default:
      Icon = AlertTriangle;
      tooltipContent = 'Error fetching PR status';
      iconColor = 'text-red-500';
      break;
  }
  
  const checkRuns = status.checks.runs;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a href={prUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" aria-label={tooltipContent as string}>
              <div className="relative">
                <Icon className={`h-5 w-5 ${iconColor}`} />
                {subIcon}
              </div>
            </Button>
          </a>
        </TooltipTrigger>
        <TooltipContent>
            <div className="space-y-2">
                <p className="font-semibold">{tooltipContent as string}</p>
                {checkRuns && checkRuns.length > 0 && (
                    <div className="space-y-1">
                        {checkRuns.map(run => {
                             let RunIcon;
                             let runColor;
                             if (run.status !== 'completed') {
                                RunIcon = CircleDotDashed;
                                runColor = "text-yellow-500";
                             } else if (run.conclusion === 'success') {
                                RunIcon = CheckCircle;
                                runColor = "text-green-500";
                             } else {
                                RunIcon = XCircle;
                                runColor = "text-red-500";
                             }
                            return (
                                <div key={run.name} className="flex items-center gap-2 text-xs">
                                    <RunIcon className={`h-3 w-3 ${runColor}`} />
                                    <span>{run.name}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
