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
import type { Job } from "@/lib/types";
import { JobStatusBadge } from "./job-status-badge";
import { formatDistanceToNow } from "date-fns";
import { ClipboardList } from "lucide-react";

type JobListProps = {
  jobs: Job[];
};

export function JobList({ jobs }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Job Queue</CardTitle>
          <CardDescription>Your created jobs will appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
            <ClipboardList className="h-12 w-12 mb-4" />
            <p className="font-semibold text-lg">No jobs yet</p>
            <p className="text-sm">
              Use the form above to create a new job to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Job Queue</CardTitle>
        <CardDescription>A list of your most recent jobs.</CardDescription>
      </CardHeader>
      <CardContent>
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
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell>
                    <JobStatusBadge status={job.status} />
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(job.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
