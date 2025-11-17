
"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { JobCreationForm } from "@/components/job-creation-form";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Session, Source, AutomationMode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { createSession } from "@/app/sessions/new/actions";
import { revalidateSessions } from "@/app/sessions/actions";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

type NewJobDialogProps = {
    trigger?: React.ReactNode;
    isPage?: boolean;
}

export function NewJobDialog({ trigger, isPage = false }: NewJobDialogProps) {
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
    
    const form = (
        <JobCreationForm
            onJobsCreated={handleJobsCreated}
            onCreateJob={handleCreateSession}
            disabled={!apiKey}
            apiKey={apiKey}
        />
    );

    if (isPage) {
        return form;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] md:max-w-4xl lg:max-w-[75vw] max-h-[90vh] overflow-y-auto">
                {form}
            </DialogContent>
        </Dialog>
    );
}

    