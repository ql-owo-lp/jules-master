
"use client";

import { useState, useEffect, useMemo, useTransition, useCallback } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Job, Session } from "@/lib/types";
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
import { ClipboardList, CheckCircle2, Loader2, Hand, RefreshCw } from "lucide-react";
import { useRouter } from 'next/navigation';
import { listSessions, revalidateSessions } from "@/app/sessions/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function JobsPage() {
  const [jobs] = useLocalStorage<Job[]>("jules-jobs", []);
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const [pollInterval] = useLocalStorage<number>("jules-poll-interval", 120);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isFetching, startFetching] = useTransition();
  const [countdown, setCountdown] = useState(pollInterval);


  const fetchJobSessions = useCallback(() => {
    if (!apiKey) {
        setIsLoading(false);
        return
    };

    startFetching(async () => {
      // Don't need to revalidate here as the main session list will do it.
      // This is just for calculating stats.
      const fetchedSessions = await listSessions(apiKey);
      setSessions(fetchedSessions);
      setLastUpdatedAt(new Date());
      setCountdown(pollInterval);
      if (isLoading) {
        setIsLoading(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, pollInterval]);


  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initial fetch and set up polling
  useEffect(() => {
    if (isClient && apiKey) {
        fetchJobSessions(); // Initial fetch
        if (pollInterval > 0) {
            const intervalId = setInterval(fetchJobSessions, pollInterval * 1000);
            return () => clearInterval(intervalId);
        }
    } else if (isClient) {
        setIsLoading(false);
    }
  }, [isClient, apiKey, pollInterval, fetchJobSessions]);


  // Countdown timer
  useEffect(() => {
    if (!isClient || !apiKey || pollInterval <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isClient, apiKey, pollInterval, lastUpdatedAt]);


  const handleJobClick = (jobId: string) => {
    router.push(`/?jobId=${jobId}`);
  };

  const handleRefresh = () => {
    fetchJobSessions();
  }

  const jobStatusMap = useMemo(() => {
    const map = new Map<string, { completed: number; working: number; pending: number }>();
    const sessionMap = new Map(sessions.map(s => [s.id, s]));

    for (const job of jobs) {
      let completed = 0;
      let working = 0;
      let pending = 0;

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
      map.set(job.id, { completed, working, pending });
    }
    return map;
  }, [jobs, sessions]);

  if (!isClient || isLoading) {
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
                    </div>
                    {apiKey && lastUpdatedAt && (
                        <div className="text-sm text-muted-foreground text-right flex-shrink-0 flex items-center gap-4">
                           <Button variant="ghost" size="icon" onClick={handleRefresh} aria-label="Refresh job list" disabled={isFetching}>
                                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                            </Button>
                            <div>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job Name</TableHead>
                        <TableHead>Repository</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...jobs].reverse().map((job) => {
                        const status = jobStatusMap.get(job.id) || { completed: 0, working: 0, pending: 0 };
                        return (
                          <TableRow key={job.id} onClick={() => handleJobClick(job.id)} className="cursor-pointer">
                            <TableCell className="font-medium">
                              {job.name}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-mono text-sm">{job.repo}</span>
                                <span className="font-mono text-xs text-muted-foreground">{job.branch}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                               <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1" title={`${status.completed} Completed`}>
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  <span>{status.completed}</span>
                                </div>
                                <div className="flex items-center gap-1" title={`${status.working} Working`}>
                                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                                  <span>{status.working}</span>
                                </div>
                                <div className="flex items-center gap-1" title={`${status.pending} Pending Approval`}>
                                  <Hand className="h-4 w-4 text-yellow-500" />
                                  <span>{status.pending}</span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
