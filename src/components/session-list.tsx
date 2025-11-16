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
import type { Session } from "@/lib/types";
import { JobStatusBadge } from "./job-status-badge";
import { formatDistanceToNow } from "date-fns";
import { ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type SessionListProps = {
  sessions: Session[];
  lastUpdatedAt: Date | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
};

export function SessionList({ sessions, lastUpdatedAt, onRefresh, isRefreshing }: SessionListProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            <CardTitle>Session List</CardTitle>
            <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh session list" disabled={isRefreshing}>
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
          {lastUpdatedAt && (
            <div className="text-sm text-muted-foreground">
              Last updated:{" "}
              {formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[150px] text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.title}</TableCell>
                    <TableCell>
                      <JobStatusBadge status={session.status} />
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(session.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
