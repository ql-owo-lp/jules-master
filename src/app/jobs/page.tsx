
"use client";

import { useState, useEffect, useMemo, useTransition, useCallback } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Job, Session, PredefinedPrompt } from "@/lib/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList, CheckCircle2, Loader2, Hand, RefreshCw, MessageSquare, MessageSquareReply, X, Wand2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { listSessions } from "@/app/sessions/actions";
import { approvePlan, sendMessage } from "@/app/sessions/[id]/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageDialog } from "@/components/message-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { NewJobDialog } from "@/components/new-job-dialog";

function JobsTable({
  jobs,
  sessions,
  quickReplies,
  isFetching,
  isActionPending,
  isBulkApproving,
  onJobClick,
  onBulkApprove,
  onBulkSendMessage
}: {
  jobs: Job[],
  sessions: Session[],
  quickReplies: PredefinedPrompt[],
  isFetching: boolean,
  isActionPending: boolean,
  isBulkApproving: string | null,
  onJobClick: (e: React.MouseEvent, jobId: string) => void,
  onBulkApprove: (e: React.MouseEvent, jobId: string) => void,
  onBulkSendMessage: (jobIds: string[], message: string) => void
}) {
  const [itemsPerPage] = useLocalStorage<number>("jules-job-items-per-page", 10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  const jobDetailsMap = useMemo(() => {
    const map = new Map<string, { completed: number; working: number; pending: number; repo: string | null; branch: string | null }>();
    const sessionMap = new Map(sessions.map(s => [s.id, s]));

    for (const job of jobs) {
      let completed = 0;
      let working = 0;
      let pending = 0;
      let repo: string | null = null;
      let branch: string | null = null;

      if (job.sessionIds.length > 0) {
        const firstSession = sessionMap.get(job.sessionIds[0]);
        if (firstSession?.sourceContext) {
           const sourceParts = firstSession.sourceContext.source.split('/');
           if (sourceParts.length >= 4 && sourceParts[1] === 'github') {
              repo = sourceParts.slice(2).join('/');
           }
           branch = firstSession.sourceContext.githubRepoContext?.startingBranch || null;
        }
      }

      for (const sessionId of job.sessionIds) {
        const session = sessionMap.get(sessionId);
        if (session) {
          switch (session.state) {
            case 'COMPLETED':
              completed++;
              break;
            case 'AWAITING_PLAN_APPROVAL':
            case 'AWAITING_USER_FEEDBACK':
              pending++;
              break;
            case 'FAILED':
              break;
            default:
              working++;
              break;
          }
        }
      }
      map.set(job.id, { completed, working, pending, repo, branch });
    }
    return map;
  }, [jobs, sessions]);

  const sortedJobs = useMemo(() => [...jobs].reverse(), [jobs]);
  const totalPages = Math.ceil(sortedJobs.length / itemsPerPage);
  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedJobs.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedJobs, currentPage, itemsPerPage]);
  
  const quickReplyOptions = quickReplies.map(r => ({ value: r.id, label: r.title, content: r.prompt }));

  const paginatedJobIds = useMemo(() => paginatedJobs.map(j => j.id), [paginatedJobs]);

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked) {
      setSelectedJobIds(ids => [...new Set([...ids, ...paginatedJobIds])]);
    } else {
      setSelectedJobIds(ids => ids.filter(id => !paginatedJobIds.includes(id)));
    }
  };

  const handleSelectRow = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobIds(ids => [...ids, jobId]);
    } else {
      setSelectedJobIds(ids => ids.filter(id => id !== jobId));
    }
  }

  const isAllOnPageSelected = paginatedJobIds.length > 0 && paginatedJobIds.every(id => selectedJobIds.includes(id));
  const isSomeOnPageSelected = paginatedJobIds.some(id => selectedJobIds.includes(id));
  const selectAllState = isAllOnPageSelected ? true : (isSomeOnPageSelected ? 'indeterminate' : false);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Clear selection when jobs list changes
  useEffect(() => {
    setSelectedJobIds([]);
  }, [jobs]);


  return (
     <>
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
            <p className="font-semibold text-lg">No Jobs Yet</p>
            <p className="text-sm">
              Click "New Job" to create your first job.
            </p>
          </div>
        ) : (
          <>
            <div className="border-t border-x rounded-t-lg z-10 sticky top-0 bg-background">
              <Table>
                <colgroup>
                    <col style={{ width: '40px' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                        <Checkbox 
                          checked={selectAllState}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all jobs on this page"
                        />
                    </TableHead>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Repository / Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              </Table>
            </div>
            <ScrollArea className="h-[60vh]">
              <div className="border-x border-b rounded-b-lg">
                <TooltipProvider>
                  <Table>
                    <colgroup>
                        <col style={{ width: '40px' }} />
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '20%' }} />
                      </colgroup>
                    <TableBody>
                      {paginatedJobs.map((job) => {
                        const details = jobDetailsMap.get(job.id) || { completed: 0, working: 0, pending: 0, repo: null, branch: null };
                        const isApprovingCurrent = isBulkApproving === job.id;
                        return (
                          <TableRow 
                            key={job.id} 
                            data-state={selectedJobIds.includes(job.id) ? "selected" : undefined}
                            onClick={(e) => onJobClick(e, job.id)} 
                            className="cursor-pointer"
                          >
                            <TableCell onClick={(e) => e.stopPropagation()} className="p-2">
                                <Checkbox
                                  checked={selectedJobIds.includes(job.id)}
                                  onCheckedChange={(checked) => handleSelectRow(job.id, !!checked)}
                                  aria-label={`Select job ${job.name}`}
                                />
                            </TableCell>
                            <TableCell className="font-medium">
                              {job.name}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-mono text-sm">{details.repo || 'N/A'}</span>
                                    <span className="font-mono text-xs text-muted-foreground">{details.branch || 'N/A'}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1" title={`${details.completed} Completed`}>
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  <span>{details.completed}</span>
                                </div>
                                <div className="flex items-center gap-1" title={`${details.working} Working`}>
                                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                                  <span>{details.working}</span>
                                </div>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="flex items-center gap-1 p-1 h-auto text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                                            onClick={(e) => onBulkApprove(e, job.id)}
                                            disabled={isApprovingCurrent || details.pending === 0 || isBulkApproving !== null || isActionPending}
                                            aria-label="Approve all pending sessions"
                                        >
                                            {isApprovingCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                                            <span>{details.pending}</span>
                                        </Button>
                                    </TooltipTrigger>
                                    {details.pending > 0 && (
                                        <TooltipContent>
                                            <p>Approve all {details.pending} pending session(s)</p>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                <Popover>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={isActionPending}>
                                          <MessageSquareReply className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Send a Quick Reply</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <PopoverContent className="p-0 w-64" align="end">
                                      <Command>
                                          <CommandInput placeholder="Search replies..." />
                                          <CommandList>
                                              <CommandEmpty>No replies found.</CommandEmpty>
                                              <CommandGroup>
                                                  {quickReplyOptions.map((option) => (
                                                      <CommandItem
                                                          key={option.value}
                                                          value={`${option.label} ${option.content}`}
                                                          onSelect={() => {
                                                              onBulkSendMessage([job.id], option.content);
                                                          }}
                                                      >
                                                          {option.label}
                                                      </CommandItem>
                                                  ))}
                                              </CommandGroup>
                                          </CommandList>
                                      </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TooltipProvider>
              </div>
            </ScrollArea>
             {totalPages > 1 && (
                  <CardFooter className="flex items-center justify-between">
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
          </>
        )}
        {selectedJobIds.length > 0 && (
            <div className="fixed bottom-4 inset-x-4 flex justify-center z-20">
                <Card className="flex items-center gap-4 p-3 shadow-2xl animate-in fade-in-0 slide-in-from-bottom-5">
                    <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">{selectedJobIds.length} job(s) selected</div>
                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedJobIds([])}>
                            <X className="h-4 w-4"/>
                            <span className="sr-only">Clear selection</span>
                        </Button>
                    </div>
                     <MessageDialog
                        triggerButton={
                            <Button size="sm">
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Send Bulk Message
                            </Button>
                        }
                        storageKey="jules-bulk-job-message"
                        onSendMessage={(message) => onBulkSendMessage(selectedJobIds, message)}
                        dialogTitle="Send Bulk Message"
                        dialogDescription={`This message will be sent to all sessions in the ${selectedJobIds.length} selected job(s).`}
                        isActionPending={isActionPending}
                    />
                </Card>
            </div>
        )}
    </>
  );
}


export default function JobsPage() {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [jobs] = useLocalStorage<Job[]>("jules-jobs", []);
  const [sessions, setSessions] = useLocalStorage<Session[]>("jules-sessions", []);
  
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const [pollInterval] = useLocalStorage<number>("jules-poll-interval", 120);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isFetching, startFetching] = useTransition();
  const [isActionPending, startActionTransition] = useTransition();
  const [countdown, setCountdown] = useState(pollInterval);
  const [isBulkApproving, setIsBulkApproving] = useState<string | null>(null);
  

  const fetchJobSessions = useCallback(() => {
    if (!apiKey) {
        setIsLoading(false);
        return
    };

    startFetching(async () => {
      const fetchedSessions = await listSessions(apiKey);
      setSessions(fetchedSessions);
      setLastUpdatedAt(new Date());
      setCountdown(pollInterval);
      if (isLoading) {
        setIsLoading(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, pollInterval, setSessions, isLoading]);


  useEffect(() => {
    setIsClient(true);
    if (apiKey) {
       if (!lastUpdatedAt) {
          setLastUpdatedAt(new Date());
       }
       fetchJobSessions();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, apiKey]);

  // Set up polling
  useEffect(() => {
    if (!isClient || !apiKey || pollInterval <= 0) return;

    const intervalId = setInterval(fetchJobSessions, pollInterval * 1000);
    return () => clearInterval(intervalId);
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, apiKey, pollInterval]);


  // Countdown timer
  useEffect(() => {
    if (!isClient || !apiKey || pollInterval <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isClient, apiKey, pollInterval, lastUpdatedAt]);


  const handleJobClick = (e: React.MouseEvent, jobId: string) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('[role="checkbox"]') || (e.target as HTMLElement).closest('[role="combobox"]')) {
      return;
    }
    router.push(`/?jobId=${jobId}`);
  };

  const handleRefresh = () => {
    fetchJobSessions();
  }

  const handleBulkApprove = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation(); // Prevent row click
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    setIsBulkApproving(jobId);

    const pendingSessionIds = job.sessionIds.filter(sessionId => {
      const session = sessions.find(s => s.id === sessionId);
      return session?.state === 'AWAITING_PLAN_APPROVAL';
    });

    if (pendingSessionIds.length === 0) {
      toast({ title: "No sessions to approve."});
      setIsBulkApproving(null);
      return;
    }

    startActionTransition(async () => {
        const approvalPromises = pendingSessionIds.map(id => approvePlan(apiKey, id));
        
        try {
            const results = await Promise.all(approvalPromises);
            const successfulApprovals = results.filter(r => r).length;

            toast({
                title: "Bulk Approval Complete",
                description: `Successfully approved ${successfulApprovals} of ${pendingSessionIds.length} pending sessions.`,
            });

            // Refresh data to reflect new states
            fetchJobSessions();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Bulk Approval Failed",
                description: "An error occurred while approving sessions.",
            });
        } finally {
            setIsBulkApproving(null);
        }
    });
  };

  const handleBulkSendMessage = (jobIds: string[], message: string) => {
    const sessionIdsToSend = jobs.filter(j => jobIds.includes(j.id)).flatMap(j => j.sessionIds);
    if (sessionIdsToSend.length === 0) {
      toast({ title: "No sessions to message." });
      return;
    }
    
    startActionTransition(async () => {
        const messagePromises = sessionIdsToSend.map(id => sendMessage(apiKey, id, message));
        try {
            const results = await Promise.all(messagePromises);
            const successfulMessages = results.filter(r => r).length;
            toast({
                title: "Bulk Message Sent",
                description: `Successfully sent message to ${successfulMessages} of ${sessionIdsToSend.length} sessions.`,
            });
            fetchJobSessions();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Bulk Message Failed",
                description: "An error occurred while sending messages.",
            });
        }
    });
  };

  const [quickReplies] = useLocalStorage<PredefinedPrompt[]>("jules-quick-replies", []);


  if (!isClient || isLoading) {
    return (
       <div className="flex flex-col flex-1 bg-background">
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="space-y-4 px-4 sm:px-6 lg:px-8">
             <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 bg-background">
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="space-y-8 px-4 sm:px-6 lg:px-8">
            <Card>
              <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2">
                          <ClipboardList className="h-6 w-6" />
                          <CardTitle>Job List</CardTitle>
                          {apiKey && (
                              <Button variant="ghost" size="icon" onClick={handleRefresh} aria-label="Refresh job list" disabled={isFetching}>
                                  <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                              </Button>
                          )}
                      </div>
                      {isClient && apiKey && lastUpdatedAt && (
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
                    A list of all the jobs you have created.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                <JobsTable
                  jobs={jobs}
                  sessions={sessions}
                  quickReplies={quickReplies}
                  isFetching={isFetching}
                  isActionPending={isActionPending}
                  isBulkApproving={isBulkApproving}
                  onJobClick={handleJobClick}
                  onBulkApprove={handleBulkApprove}
                  onBulkSendMessage={handleBulkSendMessage}
                />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
       <div className="fixed bottom-8 right-8 z-20">
        <NewJobDialog>
          <Button size="lg" className="rounded-full shadow-lg w-16 h-16 bg-accent text-accent-foreground hover:bg-accent/90">
            <Wand2 className="h-8 w-8" />
            <span className="sr-only">New Job</span>
          </Button>
        </NewJobDialog>
      </div>
    </>
  );
}

    