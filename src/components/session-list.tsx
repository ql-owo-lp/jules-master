
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Session, Job, State } from "@/lib/types";
import { JobStatusBadge } from "./job-status-badge";
import { format, formatDistanceToNow } from "date-fns";
import { ClipboardList, RefreshCw, Hand, Loader2, X, Github } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";


type SessionListProps = {
  sessions: Session[];
  jobs: Job[];
  lastUpdatedAt: Date | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
  isActionPending?: boolean;
  onApprovePlan: (sessionId: string) => void;
  countdown: number;
  pollInterval: number;
  titleTruncateLength: number;
  filteredJobName?: string;
  jobFilter: string | null;
  repoFilter: string;
  statusFilter: string;
  onJobFilterChange: (value: string | null) => void;
  onRepoFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  uniqueRepos: string[];
  uniqueJobNames: string[];
  uniqueStatuses: string[];
  jobMap: Map<string, string>;
};

export function SessionList({
  sessions,
  jobs,
  lastUpdatedAt,
  onRefresh,
  isRefreshing,
  isActionPending,
  onApprovePlan,
  countdown,
  pollInterval,
  titleTruncateLength,
  filteredJobName,
  jobFilter,
  repoFilter,
  statusFilter,
  onJobFilterChange,
  onRepoFilterChange,
  onStatusFilterChange,
  uniqueRepos,
  uniqueJobNames,
  uniqueStatuses,
  jobMap,
}: SessionListProps) {
  const router = useRouter();

  const sessionToJobMap = useMemo(() => {
    const map = new Map<string, Job>();
    for (const job of jobs) {
      for (const sessionId of job.sessionIds) {
        map.set(sessionId, job);
      }
    }
    return map;
  }, [jobs]);

  const handleRowClick = (e: React.MouseEvent, sessionId: string) => {
    // Prevent navigation if a button or link inside the row was clicked
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
      return;
    }
    const path = jobFilter ? `/sessions/${sessionId}?jobId=${jobFilter}` : `/sessions/${sessionId}`;
    router.push(path);
  };

  const truncateTitle = (title: string, maxLength: number) => {
    if (title.length <= maxLength) {
      return title;
    }
    return title.substring(0, maxLength) + "...";
  };

  const handleClearFilters = () => {
    onJobFilterChange(null);
    onRepoFilterChange('all');
    onStatusFilterChange('all');
    router.push('/');
  }

  const isAnyFilterActive = jobFilter || repoFilter !== 'all' || statusFilter !== 'all';

  const getPullRequestUrl = (session: Session): string | null => {
    if (session.outputs && session.outputs.length > 0) {
      for (const output of session.outputs) {
        if (output.pullRequest?.url) {
          return output.pullRequest.url;
        }
      }
    }
    return null;
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            <CardTitle>Session List</CardTitle>
            <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh session list" disabled={isRefreshing}>
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
          {lastUpdatedAt && (
            <div className="text-sm text-muted-foreground text-right flex-shrink-0">
              <div>
                Last updated:{" "}
                {format(lastUpdatedAt, "h:mm:ss a")}
              </div>
              {pollInterval > 0 && (
                 <div>
                   Next poll in: {countdown}s
                 </div>
              )}
            </div>
          )}
        </div>
        <CardDescription>
          {sessions.length > 0 ? "A list of your most recent sessions." : "Your created sessions will appear here."}
        </CardDescription>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="filter-repo">Repository</Label>
            <Select value={repoFilter} onValueChange={onRepoFilterChange}>
              <SelectTrigger id="filter-repo">
                <SelectValue placeholder="Filter by repository..." />
              </SelectTrigger>
              <SelectContent>
                {uniqueRepos.map(repo => (
                  <SelectItem key={repo} value={repo}>{repo === 'all' ? 'All Repositories' : repo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-status">Session Status</Label>
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger id="filter-status">
                <SelectValue placeholder="Filter by status..." />
              </SelectTrigger>
              <SelectContent>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status === 'all' ? 'All Statuses' : status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-job">Job Name</Label>
            <Select value={jobFilter || 'all'} onValueChange={(value) => onJobFilterChange(value === 'all' ? null : value)}>
              <SelectTrigger id="filter-job">
                <SelectValue placeholder="Filter by job..." />
              </SelectTrigger>
              <SelectContent>
                {uniqueJobNames.map(jobId => (
                  <SelectItem key={jobId} value={jobId}>{jobId === 'all' ? 'All Jobs' : jobMap.get(jobId) || jobId}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isAnyFilterActive && (
          <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-4">
              <X className="mr-2 h-4 w-4" />
              Clear All Filters
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
            <ClipboardList className="h-12 w-12 mb-4" />
            <p className="font-semibold text-lg">No sessions found</p>
            <p className="text-sm">
              {isAnyFilterActive ? "No sessions match the current filters." : "Create a new job to see sessions here."}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[180px]">Session Status</TableHead>
                  <TableHead className="w-[150px]">Created</TableHead>
                  <TableHead className="w-[80px] text-center">GitHub</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const job = sessionToJobMap.get(session.id);
                  const prUrl = getPullRequestUrl(session);
                  return (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer"
                    onClick={(e) => handleRowClick(e, session.id)}
                  >
                    <TableCell>{job?.name || "N/A"}</TableCell>
                    <TableCell>{job?.repo || "N/A"}</TableCell>
                    <TableCell>{job?.branch || "N/A"}</TableCell>
                    <TableCell className="font-medium" title={session.title}>{truncateTitle(session.title, titleTruncateLength)}</TableCell>
                    <TableCell>
                      <JobStatusBadge status={session.state || session.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(session.createTime || session.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                     <TableCell className="text-center">
                      {prUrl ? (
                         <Tooltip>
                            <TooltipTrigger asChild>
                              <a href={prUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" aria-label="View Pull Request">
                                  <Github className="h-4 w-4" />
                                </Button>
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View Pull Request on GitHub</p>
                            </TooltipContent>
                          </Tooltip>
                      ): (
                         <div className="w-10 h-10" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                       {session.state === 'AWAITING_PLAN_APPROVAL' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onApprovePlan(session.id)}
                                disabled={isActionPending}
                                aria-label="Approve Plan"
                              >
                                {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Approve Plan</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <div className="w-10 h-10" />
                        )}
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
