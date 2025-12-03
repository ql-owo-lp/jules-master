
"use client";

import React, { useMemo } from 'react';
import type { Job } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface JobListProps {
  jobs: Job[];
}

export function JobList({ jobs }: JobListProps) {
  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [jobs]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Repository</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Session Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedJobs.length > 0 ? (
            sortedJobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.name}</TableCell>
                <TableCell>{job.repo}</TableCell>
                <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline">{job.sessionIds.length}</Badge>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                No jobs found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
