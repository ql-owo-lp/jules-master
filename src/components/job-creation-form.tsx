"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createTitleForJob } from "@/app/actions";
import type { Job } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Loader2 } from "lucide-react";

type JobCreationFormProps = {
  onJobsCreated: (jobs: Job[]) => void;
  disabled?: boolean;
};

export function JobCreationForm({
  onJobsCreated,
  disabled,
}: JobCreationFormProps) {
  const [prompts, setPrompts] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const promptLines = prompts
      .trim()
      .split("\n")
      .filter((line) => line.trim() !== "");

    if (promptLines.length === 0) {
      toast({
        variant: "destructive",
        title: "No prompts entered",
        description: "Please enter at least one job prompt.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const newJobs: Job[] = await Promise.all(
          promptLines.map(async (prompt) => {
            const title = await createTitleForJob(prompt);
            return {
              id: crypto.randomUUID(),
              title,
              prompt,
              status: "Pending",
              createdAt: new Date().toISOString(),
            };
          })
        );

        onJobsCreated(newJobs);
        setPrompts("");
        toast({
          title: "Jobs submitted!",
          description: `${newJobs.length} new job(s) have been created.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Failed to create jobs",
          description:
            "An error occurred while generating job titles. Please try again.",
        });
      }
    });
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Create Batch Jobs</CardTitle>
        <CardDescription>
          Enter your job prompts below, one per line. We'll use AI to generate a
          suitable title for each job.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="grid w-full gap-2">
            <Label htmlFor="prompts" className="sr-only">Job Prompts</Label>
            <Textarea
              id="prompts"
              placeholder="e.g., Process all user-uploaded videos from the last 24 hours and generate thumbnails."
              rows={5}
              value={prompts}
              onChange={(e) => setPrompts(e.target.value)}
              disabled={isPending || disabled}
              aria-label="Job Prompts"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            disabled={isPending || disabled || !prompts.trim()}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Create Jobs
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
