
"use client";

import { useEffect, useState } from "react";
import { getPullRequestStatus } from "@/app/github/actions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Button } from "./ui/button";
import { GitPullRequest, GitMerge, CheckCircle2, XCircle, Clock, AlertTriangle, Github, GitPullRequestClosed } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import type { PullRequestStatus } from "@/lib/types";


type PrStatusProps = {
  prUrl: string | null;
  githubToken: string;
};

export function PrStatus({ prUrl, githubToken }: PrStatusProps) {
  const [status, setStatus] = useState<PullRequestStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (prUrl && githubToken) {
      setIsLoading(true);
      const fetchStatus = async () => {
        const result = await getPullRequestStatus(prUrl, githubToken);
        setStatus(result);
        setIsLoading(false);
      };
      fetchStatus();
    } else {
        setStatus(null);
        setIsLoading(false);
    }
  }, [prUrl, githubToken]);

  if (!prUrl) {
    return <div className="w-10 h-10" />;
  }

  if (isLoading) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }
  
  if (!status) {
     return <div className="w-10 h-10" />;
  }

  let Icon;
  let tooltipContent;
  let iconColor;

  switch (status.state) {
    case 'MERGED':
      Icon = GitMerge;
      tooltipContent = 'Pull Request Merged';
      iconColor = 'text-purple-500';
      break;
    case 'OPEN':
      Icon = GitPullRequest;
      tooltipContent = `PR Open: Checks ${status.checks}`;
      if (status.checks === 'success') iconColor = 'text-green-500';
      else if (status.checks === 'failure') iconColor = 'text-red-500';
      else if (status.checks === 'pending') iconColor = 'text-yellow-500';
      else iconColor = 'text-muted-foreground';
      break;
    case 'CLOSED':
        Icon = GitPullRequestClosed;
        tooltipContent = 'Pull Request Closed (Not Merged)';
        iconColor = 'text-red-500';
        break;
    case 'NO_TOKEN':
      Icon = AlertTriangle;
      tooltipContent = 'GitHub token not set';
      iconColor = 'text-yellow-500';
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
  
  const ciIcon = status.checks === 'success' ? <CheckCircle2 className="h-3 w-3 absolute -bottom-1 -right-1 bg-background rounded-full text-green-500" />
               : status.checks === 'failure' ? <XCircle className="h-3 w-3 absolute -bottom-1 -right-1 bg-background rounded-full text-red-500" />
               : status.checks === 'pending' ? <Clock className="h-3 w-3 absolute -bottom-1 -right-1 bg-background rounded-full text-yellow-500" />
               : null;


  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a href={prUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" aria-label={tooltipContent}>
              <div className="relative">
                <Icon className={`h-5 w-5 ${iconColor}`} />
                {ciIcon}
              </div>
            </Button>
          </a>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
