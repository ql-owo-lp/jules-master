
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { JobCreationForm } from "@/components/job-creation-form";

export function NewJobDialog({
  onCreateJob,
  isCreatingJob,
}: {
  onCreateJob: (prompts: string[], jobName: string) => void;
  isCreatingJob: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>New Job</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a New Job</DialogTitle>
        </DialogHeader>
        <JobCreationForm
          onSubmit={({ prompts, jobName }) => {
            onCreateJob(prompts, jobName);
            setIsOpen(false);
          }}
          isSubmitting={isCreatingJob}
        />
      </DialogContent>
    </Dialog>
  );
}
