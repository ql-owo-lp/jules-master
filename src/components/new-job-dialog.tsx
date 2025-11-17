
"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { JobCreationForm } from "@/components/job-creation-form";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Session, Source, AutomationMode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { createSession } from "@/app/sessions/new/actions";
import { revalidateSessions } from "@/app/sessions/actions";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

type NewJobDialogProps = {
    isPage?: boolean;
}

export function NewJobDialog({ isPage = false }: NewJobDialogProps) {
    const [apiKey] = useLocalStorage<string>("jules-api-key", "");
    const router = useRouter();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);

    const handleCreateSession = async (
        title: string, 
        prompt: string, 
        source: Source | null, 
        branch: string | undefined,
        requirePlanApproval: boolean,
        automationMode: AutomationMode
    ): Promise<Session | null> => {
        if (!source || !branch) {
            toast({
                variant: "destructive",
                title: "Repository and branch must be selected.",
            });
            return null;
        }
        const newSession = await createSession(apiKey, {
            title: title,
            prompt: prompt,
            sourceContext: {
                source: source.name,
                githubRepoContext: {
                    startingBranch: branch,
                }
            },
            requirePlanApproval,
            automationMode
        });

        if (!newSession) {
            // The error toast is handled inside the creation form's retry loop
            return null;
        }
        return newSession;
    }

    const handleJobsCreated = (newSessions: Session[]) => {
        toast({
            title: "Job submitted!",
            description: `${newSessions.length} new session(s) have been created.`,
        });
        // Revalidate in the background, don't need to await
        revalidateSessions();
        
        if (isPage) {
            router.push('/jobs');
        } else {
            setOpen(false); // Close dialog if it's not a page
            router.push('/jobs'); // Still navigate to jobs page
        }
    };
    
    // Function to clear local storage cache for the form
    const handleReset = () => {
        localStorage.removeItem("jules-new-job-prompt");
        localStorage.removeItem("jules-new-job-name");
    };

    const form = (
        <JobCreationForm
            onJobsCreated={handleJobsCreated}
            onCreateJob={handleCreateSession}
            disabled={!apiKey}
            apiKey={apiKey}
            onReset={isPage ? undefined : handleReset}
        />
    );

    if (isPage) {
        return form;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                 <Button size="lg" className="rounded-full shadow-lg w-16 h-16 bg-primary hover:bg-primary/90">
                    <Plus className="h-8 w-8 text-white" />
                    <span className="sr-only">New Job</span>
                </Button>
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
