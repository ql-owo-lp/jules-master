"use client";

import React, { useState, ReactNode } from "react";
import { useRouter } from 'next/navigation';
import { JobCreationForm } from "@/components/job-creation-form";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Session, Source, AutomationMode, Job, Settings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { createSession } from "@/app/sessions/new/actions";
import { revalidateSessions } from "@/app/sessions/actions";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useEnv } from "@/components/env-provider";

type NewJobDialogProps = {
    isPage?: boolean;
    children?: ReactNode;
    initialValues?: {
        prompt?: string;
        repo?: string;
        branch?: string;
        jobName?: string;
    };
}

export function NewJobDialog({ isPage = false, children, initialValues }: NewJobDialogProps) {
    const { julesApiKey } = useEnv();
    const [apiKey] = useLocalStorage<string | null>("jules-api-key", null);
    const [jobs, setJobs] = useLocalStorage<Job[]>("jules-jobs", []);
    const router = useRouter();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);

    const handleCreateSession = async (
        title: string, 
        prompt: string, 
        source: Source | null, 
        branch: string | undefined,
        requirePlanApproval: boolean,
        automationMode: AutomationMode,
        settings: Settings | null
    ): Promise<Session | null> => {
        if (!source || !branch) {
            toast({
                variant: "destructive",
                title: "Repository and branch must be selected.",
            });
            return null;
        }

        const effectiveApiKey = apiKey || julesApiKey;

        const newSession = await createSession({
            title: title,
            prompt: prompt,
            sourceContext: {
                source: source.name,
                githubRepoContext: {
                    startingBranch: branch,
                }
            },
            requirePlanApproval,
            automationMode,
            autoContinueEnabled: settings?.autoContinueEnabled,
            autoRetryEnabled: settings?.autoRetryEnabled
        }, effectiveApiKey);

        if (!newSession) {
            // The error toast is handled inside the creation form's retry loop
            return null;
        }
        return newSession;
    }

    const handleJobsCreated = (newSessions: Session[], newJob: Job) => {
        if (!newJob.background) {
            toast({
                title: "Job submitted!",
                description: `${newSessions.length} new session(s) have been created.`,
            });
        }
        
        // Update job cache immediately
        setJobs([...jobs, newJob]);

        // Revalidate server data in the background
        revalidateSessions();
        
        const targetPath = `/?jobId=${newJob.id}`;
        if (isPage) {
            router.push(targetPath);
        } else {
            setOpen(false); // Close dialog if it's not a page
            router.push(targetPath); // Still navigate to jobs page
        }
    };
    
    // Function to clear local storage cache for the form
    const handleReset = () => {
        // Since we are moving away from local storage for form state, this might be less relevant
        // but we can keep it for clearing UI state if needed.
    };

    const hasApiKey = !!(julesApiKey || apiKey);

    const form = (
        <JobCreationForm
            onJobsCreated={handleJobsCreated}
            onCreateJob={handleCreateSession}
            disabled={!hasApiKey}
            onReset={isPage ? undefined : handleReset}
            initialValues={initialValues}
        />
    );

    if (isPage) {
        return form;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                 {children}
            </DialogTrigger>
            <DialogContent className="w-3/4 max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Create a New Job</DialogTitle>
                    <DialogDescription>
                        Fill out the details below to start a new job with one or more sessions.
                    </DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto p-1">
                    {form}
                </div>
            </DialogContent>
        </Dialog>
    );
}
