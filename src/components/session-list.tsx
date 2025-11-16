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
import type { Session, Job } from "@/lib/types";
import { JobStatusBadge } from "./job-status-badge";
import { format, formatDistanceToNow } from "date-fns";
import { ClipboardList, RefreshCw, Hand, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";


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
}: SessionListProps) {
  const router = useRouter();

  const sessionToJobMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs) {
      for (const sessionId of job.sessionIds) {
        map.set(sessionId, job.name);
      }
    }
    return map;
  }, [jobs]);

  const handleRowClick = (e: React.MouseEvent, sessionId: string) => {
    // Prevent navigation if a button inside the row was clicked
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    router.push(`/sessions/${sessionId}`);
  };

  const truncateTitle = (title: string, maxLength: number) => {
    if (title.length <= maxLength) {
      return title;
    }
    return title.substring(0, maxLength) + "...";
  };

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
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
            <ClipboardList className="h-12 w-12 mb-4" />
            <p className="font-semibold text-lg">No sessions yet</p>
            <p className="text-sm">
              Use the form above to create a new session or click refresh to fetch existing ones.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Job Name</TableHead>
                  <TableHead className="w-[180px]">Status</TableHead>
                  <TableHead className="w-[150px]">Created</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer"
                    onClick={(e) => handleRowClick(e, session.id)}
                  >
                    <TableCell className="font-medium" title={session.title}>{truncateTitle(session.title, titleTruncateLength)}</TableCell>
                    <TableCell>{sessionToJobMap.get(session.id) || "N/A"}</TableCell>
                    <TableCell>
                      <JobStatusBadge status={session.state || session.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(session.createTime || session.createdAt), {
                        addSuffix: true,
                      })}
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
                ))}
              </TableBody>
            </Table>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
