
import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "./ui/button";
import { GitMerge, CheckCircle, XCircle, GitPullRequest } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { PullRequestStatus } from "@/lib/types";
import { useEnv } from "@/components/env-provider";

type PrStatusProps = {
    prUrl: string | null;
}

const statusInfo: Record<PullRequestStatus, { icon: React.ReactNode; label: string }> = {
    OPEN: {
        icon: <GitPullRequest className="h-5 w-5 text-blue-500" />,
        label: "Pull request is open."
    },
    MERGED: {
        icon: <GitMerge className="h-5 w-5 text-purple-500" />,
        label: "Pull request has been merged."
    },
    CLOSED: {
        icon: <XCircle className="h-5 w-5 text-red-500" />,
        label: "Pull request has been closed without merging."
    },
    UNKNOWN: {
        icon: <CheckCircle className="h-5 w-5 text-gray-500" />,
        label: "Pull request status is unknown."
    }
};

export function PrStatus({prUrl}: PrStatusProps) {
    const { githubToken: envGithubToken } = useEnv();
    const [githubToken] = useLocalStorage<string | null>("jules-github-token", null);
    const hasGithubToken = !!(envGithubToken || githubToken);

    const [prStatus, setPrStatus] = React.useState<PullRequestStatus>('UNKNOWN');
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        if (prUrl && hasGithubToken) {
            const fetchPrStatus = async () => {
                setIsLoading(true);
                try {
                    const response = await fetch('/api/github/pr-status', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ url: prUrl }),
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setPrStatus(data.status);
                    } else {
                        setPrStatus('UNKNOWN');
                    }
                } catch (error) {
                    setPrStatus('UNKNOWN');
                } finally {
                    setIsLoading(false);
                }
            };

            fetchPrStatus();
        }
    }, [prUrl, hasGithubToken]);

    if (!prUrl) {
        return null;
    }

    if (!hasGithubToken) {
         return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <a href={prUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" aria-label="View Pull Request on GitHub">
                                <GitPullRequest className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </a>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>View Pull Request. Status checks require GitHub token.</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    const { icon, label } = statusInfo[prStatus] || statusInfo.UNKNOWN;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <a href={prUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" aria-label="View Pull Request on GitHub" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
                        </Button>
                    </a>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{label}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
