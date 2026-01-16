
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CronJobForm } from "@/components/cron-job-form";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { CronJob } from "@/lib/types";

type CronJobDialogProps = {
    children?: React.ReactNode;
    initialValues?: CronJob;
    onSuccess?: () => void;
    mode: 'create' | 'edit';
}

export function CronJobDialog({ children, initialValues, onSuccess, mode }: CronJobDialogProps) {
    const [open, setOpen] = useState(false);

    const handleSuccess = () => {
        setOpen(false);
        if (onSuccess) onSuccess();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                 {children || (
                     <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add New Cron Job
                     </Button>
                 )}
            </DialogTrigger>
            <DialogContent className="w-3/4 max-w-4xl max-h-[90vh] flex flex-col overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? "Create New Cron Job" : "Edit Cron Job"}</DialogTitle>
                    <DialogDescription>
                        {mode === 'create' ? "Schedule a new job to run automatically." : "Update the schedule or details of the cron job."}
                    </DialogDescription>
                </DialogHeader>
                <div className="p-1">
                    <CronJobForm onCronJobCreated={handleSuccess} onCancel={() => setOpen(false)} initialValues={initialValues} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
