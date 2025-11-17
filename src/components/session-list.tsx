
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import type { Session, Job, PredefinedPrompt, PullRequestStatus } from "@/lib/types";
import { JobStatusBadge } from "./job-status-badge";
import { format, formatDistanceToNow } from "date-fns";
import { ClipboardList, RefreshCw, Hand, Loader2, MessageSquare, Briefcase, MessageSquareReply } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { PrStatus } from "./pr-status";
import { MessageDialog } from "./message-dialog";
import { ScrollArea } from "./ui/scroll-area";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";


type SessionListProps = {
  sessions: Session[];
  jobs: Job[];
  quickReplies: PredefinedPrompt[];
  predefinedPrompts: PredefinedPrompt[];
  lastUpdatedAt: Date | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
  isActionPending?: boolean;
  onApprovePlan: (sessionId: string) => void;
  onSendMessage: (sessionId: string, message: string) => void;
  countdown: number;
  pollInterval: number;
  jobFilter: string | null;
  githubToken: string;
  prStatuses: Record<string, PullRequestStatus | null>;
  isFetchingPrStatus: boolean;
  children: React.ReactNode;
  titleTruncateLength: number;
};

export function SessionList({
  sessions,
  jobs,
  quickReplies,
  predefinedPrompts,
  lastUpdatedAt,
  onRefresh,
  isRefreshing,
  isActionPending,
  onApprovePlan,
  onSendMessage,
  countdown,
  pollInterval,
  jobFilter,
  githubToken,
  prStatuses,
  isFetchingPrStatus,
  children,
  titleTruncateLength
}: SessionListProps) {
  const router = useRouter();
  const [itemsPerPage] = useLocalStorage<number>("jules-session-items-per-page", 10);
  const [currentPage, setCurrentPage] = useState(1);

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
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('[role="menu"]')) {
      return;
    }
    const path = jobFilter ? `/sessions/${sessionId}?jobId=${jobFilter}` : `/sessions/${sessionId}`;
    router.push(path);
  };

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
  
  const getRepoNameFromSource = (source?: string): string | null => {
    if (!source) return null;
    const parts = source.split('/');
    if (parts.length >= 4 && parts[1] === 'github') {
        return parts.slice(2).join('/');
    }
    return null;
  }
  
  const truncate = (str: string, length: number) => {
    return str.length > length ? str.substring(0, length) + "..." : str;
  }

  const totalPages = Math.ceil(sessions.length / itemsPerPage);
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sessions.slice(startIndex, startIndex + itemsPerPage);
  }, [sessions, currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, sessions]);


  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
                <ClipboardList className="h-6 w-6" />
                <CardTitle>Session List</CardTitle>
                <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh session list" disabled={isRefreshing}>
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>
            </div>
            <CardDescription className="mt-2">
                {sessions.length > 0 ? "A list of your most recent sessions." : "Your created sessions will appear here."}
            </CardDescription>
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

        {children}

      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
            <ClipboardList className="h-12 w-12 mb-4" />
            <p className="font-semibold text-lg">No sessions found</p>
            <p className="text-sm">
             Create a new job to see sessions here.
            </p>
          </div>
        ) : (
          <>
            <div className="border-t border-x rounded-t-lg z-10 sticky top-0 bg-background">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Job / Session Name</TableHead>
                            <TableHead>Repository / Branch</TableHead>
                            <TableHead className="w-[180px]">Session Status</TableHead>
                            <TableHead className="w-[150px]">Created</TableHead>
                            <TableHead className="w-[80px] text-center">GitHub</TableHead>
                            <TableHead className="w-[120px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                </Table>
            </div>
            <ScrollArea className="h-[60vh]">
              <div className="border-x border-b rounded-b-lg">
                <TooltipProvider>
                  <Table>
                    <TableBody>
                      {paginatedSessions.map((session) => {
                        const job = sessionToJobMap.get(session.id);
                        const prUrl = getPullRequestUrl(session);
                        const repoName = getRepoNameFromSource(session.sourceContext?.source);
                        const branchName = session.sourceContext?.githubRepoContext?.startingBranch;
                        const isLoadingPrStatus = isFetchingPrStatus && prUrl ? prStatuses[prUrl] === undefined : false;

                        return (
                        <TableRow
                          key={session.id}
                          className="cursor-pointer"
                          onClick={(e) => handleRowClick(e, session.id)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {job && <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />}
                              <span className="truncate" title={job?.name || session.title}>
                                {job?.name || truncate(session.title, titleTruncateLength)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                              <div className="flex flex-col">
                                  <span className="font-mono text-sm">{repoName || 'N/A'}</span>
                                  <span className="font-mono text-xs text-muted-foreground">{branchName || 'N/A'}</span>
                              </div>
                          </TableCell>
                          <TableCell>
                            <JobStatusBadge status={session.state || session.status} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(session.createTime || session.createdAt), {
                              addSuffix: true,
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                              <PrStatus 
                                  prUrl={prUrl} 
                                  githubToken={githubToken} 
                                  status={prUrl ? prStatuses[prUrl] : null}
                                  isLoading={isLoadingPrStatus}
                              />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
                              ) : null}

                              <DropdownMenu>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" disabled={isActionPending}>
                                        <MessageSquareReply className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Send a Quick Reply</p>
                                  </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent>
                                  {quickReplies.length > 0 ? (
                                    quickReplies.map((reply) => (
                                      <DropdownMenuItem key={reply.id} onClick={() => onSendMessage(session.id, reply.prompt)}>
                                        {reply.title}
                                      </DropdownMenuItem>
                                    ))
                                  ) : (
                                    <DropdownMenuItem disabled>No quick replies</DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <MessageDialog
                                triggerButton={
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" aria-label="Send Message to Session" disabled={isActionPending}>
                                                <MessageSquare className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Send Message</TooltipContent>
                                    </Tooltip>
                                }
                                predefinedPrompts={predefinedPrompts}
                                quickReplies={quickReplies}
                                onSendMessage={(message) => onSendMessage(session.id, message)}
                                dialogTitle="Send Message to Session"
                                dialogDescription={`This message will be sent to the session: "${truncate(session.title, 50) || session.id}"`}
                                isActionPending={isActionPending}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </TooltipProvider>
              </div>
            </ScrollArea>
        </>
        )}
      </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </Button>
                </div>
            </CardFooter>
        )}
    </Card>
  );
}
