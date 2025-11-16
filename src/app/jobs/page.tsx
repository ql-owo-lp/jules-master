
"use client";

import { useState, useEffect, useMemo } from "react";
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
import { ClipboardList, CheckCircle2, Loader2, Hand } from "lucide-react";
import { useRouter } from 'next/navigation';
import { listSessions } from "@/app/sessions/actions";
import { Skeleton } from "@/components/ui/skeleton";

export default function JobsPage() {
  const [jobs] = useLocalStorage<Job[]>("jules-jobs", []);
  const [apiKey] = useLocalStorage<string>("jules-api-key", "");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    if (apiKey) {
      listSessions(apiKey).then(fetchedSessions => {
        setSessions(fetchedSessions);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [apiKey]);

  const handleJobClick = (jobId: string) => {
    router.push(`/?jobId=${jobId}`);
  };

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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-6 w-6" />
                  <CardTitle>Job List</CardTitle>
                </div>
                <CardDescription>
                  A list of all the jobs you have created.
                </CardDescription>
              </div>
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
