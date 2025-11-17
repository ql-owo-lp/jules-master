
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
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList, CheckCircle2, Loader2, Hand, RefreshCw, MessageSquare } from "lucide-react";
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


export default function JobsPage() {
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [jobs] = useLocalStorage<Job[]>("jules-jobs", []);
  const [sessions, setSessions] = useLocalStorage<Session[]>("jules-sessions", []);
  const [predefinedPrompts] = useLocalStorage<PredefinedPrompt[]>("predefined-prompts", []);
  const [quickReplies] = useLocalStorage<PredefinedPrompt[]>("jules-quick-replies", []);
  
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
    if (!isLoading && !lastUpdatedAt) {
        setLastUpdatedAt(new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, isLoading]);

  // Initial fetch and set up polling
  useEffect(() => {
    if (isClient && apiKey) {
        if (sessions.length === 0) {
            fetchJobSessions();
        } else {
            setIsLoading(false);
            if (!lastUpdatedAt) {
                setLastUpdatedAt(new Date());
            }
        }

        if (pollInterval > 0) {
            const intervalId = setInterval(fetchJobSessions, pollInterval * 1000);
            return () => clearInterval(intervalId);
        }
    } else if (isClient) {
        setIsLoading(false);
    }
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
    if ((e.target as HTMLElement).closest('button')) {
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

  const handleBulkSendMessage = (jobId: string, message: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    startActionTransition(async () => {
        const messagePromises = job.sessionIds.map(id => sendMessage(apiKey, id, message));
        try {
            const results = await Promise.all(messagePromises);
            const successfulMessages = results.filter(r => r).length;
            toast({
                title: "Bulk Message Sent",
                description: `Successfully sent message to ${successfulMessages} of ${job.sessionIds.length} sessions.`,
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

  const jobDetailsMap = useMemo(() => {
    const map = new Map<string, { completed: number; working: number; pending: number; repo: string | null; branch: string | null }>();
    const sessionMap = new Map(sessions.map(s => [s.id, s]));

    for (const job of jobs) {
      let completed = 0;
      let working = 0;
      let pending = 0;
      let repo: string | null = null;
      let branch: string | null = null;

      // Get repo/branch from the first session in the job
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
              // Not counted for now, can be added later
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

  if (!isClient || (isLoading && sessions.length === 0)) {
    return (
       <div className="flex flex-col flex-1 bg-background">
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="container mx-auto max-w-4xl space-y-8">
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
    <div className="flex flex-col flex-1 bg-background">
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="container mx-auto max-w-4xl space-y-8">
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
                    {apiKey && lastUpdatedAt && (
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
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
                  <p className="font-semibold text-lg">No Jobs Yet</p>
                  <p className="text-sm">
                    Click "New Job" to create your first job.
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
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...jobs].reverse().map((job) => {
                        const details = jobDetailsMap.get(job.id) || { completed: 0, working: 0, pending: 0, repo: null, branch: null };
                        const isApprovingCurrent = isBulkApproving === job.id;
                        return (
                          <TableRow key={job.id} onClick={(e) => handleJobClick(e, job.id)} className="cursor-pointer">
                            <TableCell className="font-medium">
                              {job.name}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm">{details.repo || 'N/A'}</span>
                            </TableCell>
                             <TableCell>
                              <span className="font-mono text-sm text-muted-foreground">{details.branch || 'N/A'}</span>
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
                                            onClick={(e) => handleBulkApprove(e, job.id)}
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
                                <div className="flex items-center justify-end gap-1">
                                    <MessageDialog
                                        triggerButton={
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" aria-label="Send Message to Job">
                                                        <MessageSquare className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Send Message to all sessions</TooltipContent>
                                            </Tooltip>
                                        }
                                        predefinedPrompts={predefinedPrompts}
                                        quickReplies={quickReplies}
                                        onSendMessage={(message) => handleBulkSendMessage(job.id, message)}
                                        dialogTitle="Send Message to Job"
                                        dialogDescription={`This message will be sent to all ${job.sessionIds.length} sessions in the "${job.name}" job.`}
                                        isActionPending={isActionPending}
                                    />
                                </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  </TooltipProvider>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
