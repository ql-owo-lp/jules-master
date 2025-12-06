
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, PlayCircle, PauseCircle, Clock } from "lucide-react";
import { CronJobDialog } from "@/components/cron-job-dialog";
import type { CronJob } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function CronJobsList() {
    const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const fetchCronJobs = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/cron-jobs', {
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            });
            if (response.ok) {
                const data = await response.json();
                setCronJobs(data);
            }
        } catch (error) {
            console.error("Failed to fetch cron jobs", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCronJobs();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this cron job?")) return;
        try {
            const response = await fetch(`/api/cron-jobs/${id}`, { method: 'DELETE' });
            if (response.ok) {
                toast({ title: "Cron Job Deleted" });
                fetchCronJobs();
            } else {
                toast({ variant: "destructive", title: "Failed to delete cron job" });
            }
        } catch (error) {
            console.error("Failed to delete cron job", error);
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean) => {
        try {
            const response = await fetch(`/api/cron-jobs/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !currentStatus })
            });
            if (response.ok) {
                 toast({ title: `Cron Job ${!currentStatus ? 'Enabled' : 'Disabled'}` });
                 fetchCronJobs();
            }
        } catch (error) {
             console.error("Failed to toggle cron job", error);
        }
    }

    const handleExecuteNow = async (id: string) => {
        try {
            const response = await fetch(`/api/cron-jobs/${id}/execute`, {
                method: 'POST'
            });
            if (response.ok) {
                toast({ title: "Cron Job Executed" });
            } else {
                toast({ variant: "destructive", title: "Failed to execute cron job" });
            }
        } catch (error) {
            console.error("Failed to execute cron job", error);
            toast({ variant: "destructive", title: "Failed to execute cron job" });
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Clock className="h-6 w-6" />
                        <CardTitle>Cron Jobs</CardTitle>
                    </div>
                    <CardDescription>Manage your scheduled jobs.</CardDescription>
                </div>
                <CronJobDialog mode="create" onSuccess={fetchCronJobs} />
            </CardHeader>
            <CardContent>
                {cronJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
                        <p className="font-semibold text-lg">No cron jobs yet</p>
                        <p className="text-sm">Click "Add New Cron Job" to create your first scheduled job.</p>
                    </div>
                ) : (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Schedule</TableHead>
                                    <TableHead>Repository</TableHead>
                                    <TableHead>Last Run</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cronJobs.map((job) => (
                                    <TableRow key={job.id}>
                                        <TableCell className="font-medium">{job.name}</TableCell>
                                        <TableCell>{job.schedule}</TableCell>
                                        <TableCell>{job.repo} ({job.branch})</TableCell>
                                        <TableCell>{job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : 'Never'}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${job.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {job.enabled ? 'Active' : 'Paused'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={() => handleExecuteNow(job.id)}>
                                                        <PlayCircle className="mr-2 h-4 w-4" /> Execute Now
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                        <CronJobDialog mode="edit" initialValues={job} onSuccess={fetchCronJobs}>
                                                             <div className="flex items-center w-full cursor-pointer">
                                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                                             </div>
                                                        </CronJobDialog>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleToggle(job.id, job.enabled)}>
                                                        {job.enabled ? <><PauseCircle className="mr-2 h-4 w-4" /> Disable</> : <><PlayCircle className="mr-2 h-4 w-4" /> Enable</>}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDelete(job.id)} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
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
