"use client";

import React, { useState, useEffect } from "react";
import { JobCreationForm } from "@/components/job-creation-form";
import { createJob } from "@/app/jobs/actions";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function NewJobPage() {
  const [isActionPending, startActionTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const handleCreateJob = (prompts: string[], jobName: string) => {
    startActionTransition(async () => {
      try {
        await createJob(prompts, jobName);
        toast({
          title: "Job Created",
          description: "Your new job has been successfully created.",
        });
        router.push("/");
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Failed to create job",
          description:
            error instanceof Error
              ? error.message
              : "An unknown error occurred.",
        });
      }
    });
  };

  return (
    <div className="flex flex-col flex-1 bg-background">
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="space-y-8 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold">Create a New Job</h1>
          <JobCreationForm
            onSubmit={({ prompts, jobName }) => handleCreateJob(prompts, jobName)}
            isSubmitting={isActionPending}
          />
        </div>
      </main>
    </div>
  );
}

    