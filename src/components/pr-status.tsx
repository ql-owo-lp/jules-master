
"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Button } from "./ui/button";
import { GitPullRequest, GitMerge, CheckCircle, XCircle, Clock, AlertTriangle, GitPullRequestClosed, CircleDotDashed } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import type { PullRequestStatus } from "@/lib/types";
import { getPullRequestStatus } from "@/app/github/actions";
import { useEffect, useState } from "react";


type PrStatusProps = {
  prUrl: string | null;
};

export function PrStatus({ prUrl }: PrStatusProps) {
  const [status, setStatus] = useState<PullRequestStatus | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    async function fetchStatus() {
      if (!prUrl) return;

      setIsLoading(true);
      const prStatus = await getPullRequestStatus(prUrl);
      setStatus(prStatus);
      setIsLoading(false);
    }
    fetchStatus();
  }, [prUrl]);

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

  if (isLoading || status === undefined) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }
  
  if (!status) {
    // This can happen if the fetch completes but returns null.
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
