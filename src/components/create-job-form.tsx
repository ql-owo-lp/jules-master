
"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createJob } from "@/app/jobs/actions";
import { useToast } from "@/hooks/use-toast";

type CreateJobFormProps = {
  onJobCreated: () => void;
};

export function CreateJobForm({ onJobCreated }: CreateJobFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") as string;
    const repo = formData.get("repo") as string;
    const branch = formData.get("branch") as string;
    const prompts = (formData.get("prompts") as string)
      .split("\n")
      .filter(p => p.trim() !== "");

    if (!name || !repo || !branch || prompts.length === 0) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill out all fields.",
      });
      return;
    }

    startTransition(async () => {
      try {
        await createJob(name, repo, branch, prompts);
        toast({
          title: "Job created",
          description: "Your new job has been created successfully.",
        });
        onJobCreated();
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error creating job",
          description: (error as Error).message,
        });
      }
    });
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Create New Job</CardTitle>
        <CardDescription>
          Enter the details for your new batch job.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Job Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Refactor legacy code"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repo">Repository</Label>
              <Input
                id="repo"
                name="repo"
                placeholder="e.g., my-org/my-repo"
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                name="branch"
                placeholder="e.g., main"
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompts">Prompts</Label>
            <Textarea
              id="prompts"
              name="prompts"
              placeholder="Enter one prompt per line"
              className="min-h-[150px]"
              disabled={isPending}
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create Job"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
