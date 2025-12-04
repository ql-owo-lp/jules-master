
"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { History, Trash2, RefreshCcw, ExternalLink } from "lucide-react";
import type { CronJob, Job, State } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";

type CronJobHistoryDialogProps = {
    cronJob: CronJob;
}

export function CronJobHistoryDialog({ cronJob }: CronJobHistoryDialogProps) {
    const [open, setOpen] = useState(false);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<State | "all">("all");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const router = useRouter();

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/cron-jobs/${cronJob.id}/history?page=${page}&limit=10&status=${statusFilter}`);
            if (response.ok) {
                const data = await response.json();
                setJobs(data.jobs);
                setTotalPages(data.totalPages);
            }
        } catch (error) {
            console.error("Failed to fetch cron job history", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchHistory();
        }
    }, [open, page, statusFilter]);

    const handleClearHistory = async () => {
        if (!confirm("Are you sure you want to clear the history for this cron job?")) return;
        try {
            const response = await fetch(`/api/cron-jobs/${cronJob.id}/history/clear`, { method: 'DELETE' });
            if (response.ok) {
                fetchHistory();
            }
        } catch (error) {
            console.error("Failed to clear cron job history", error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div className="flex items-center w-full cursor-pointer">
                    <History className="mr-2 h-4 w-4" /> View History
                </div>
            </DialogTrigger>
            <DialogContent className="w-3/4 max-w-4xl max-h-[90vh] flex flex-col overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>History for {cronJob.name}</DialogTitle>
                    <DialogDescription>
                        Here you can see the history of jobs that have been run by this cron job.
                    </DialogDescription>
                </DialogHeader>
                <div className="p-1">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as State | "all")}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                    <SelectItem value="running">Running</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" onClick={fetchHistory} disabled={isLoading}>
                                <RefreshCcw className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button variant="destructive" onClick={handleClearHistory}>
                            <Trash2 className="mr-2 h-4 w-4" /> Clear History
                        </Button>
                    </div>
                    {isLoading ? (
                        <p>Loading...</p>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Job ID</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created At</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {jobs.map((job) => (
                                        <TableRow key={job.id}>
                                            <TableCell>{job.name}</TableCell>
                                            <TableCell>{job.status}</TableCell>
                                            <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Button variant="outline" size="sm" onClick={() => router.push(`/?jobId=${job.id}`)}>
                                                    <ExternalLink className="mr-2 h-4 w-4" /> View Job
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="flex justify-between items-center mt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setPage(page - 1)}
                                    disabled={page === 1}
                                >
                                    Previous
                                </Button>
                                <span>Page {page} of {totalPages}</span>
                                <Button
                                    variant="outline"
                                    onClick={() => setPage(page + 1)}
                                    disabled={page === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
