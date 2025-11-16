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
import type { Session, Source } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Loader2 } from "lucide-react";
import { SourceSelection } from "./source-selection";
import { BranchSelection } from "./branch-selection";

type JobCreationFormProps = {
  onJobsCreated: (sessions: Session[]) => void;
  disabled?: boolean;
  apiKey: string;
};

const preCannedPrompts = [
  {
    title: "Create React Component",
    prompt:
      "Create a new React component for a user profile card. It should display the user's name, avatar, and a short bio.",
  },
  {
    title: "Fix Login Bug",
    prompt:
      "There's a bug in the login flow where the redirect after a successful login is not working. Please investigate and fix the issue.",
  },
  {
    title: "Refactor DB Schema",
    prompt:
      "Refactor the database schema to normalize the 'user_addresses' table. Create a separate 'addresses' table and a join table.",
  },
  {
    title: "Add User Profile Feature",
    prompt:
      "Add a new feature that allows users to upload a profile picture. This should include the frontend UI and the backend API endpoint.",
  },
];

export function JobCreationForm({
  onJobsCreated,
  disabled,
  apiKey,
}: JobCreationFormProps) {
  const [prompts, setPrompts] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

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
        description: "Please enter at least one session prompt.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const newSessions: Session[] = await Promise.all(
          promptLines.map(async (prompt) => {
            const title = await createTitleForJob(prompt);
            const id = crypto.randomUUID();
            return {
              id: id,
              name: `sessions/${id}`,
              title,
              prompt,
              status: "Pending",
              createdAt: new Date().toISOString(),
            };
          })
        );

        onJobsCreated(newSessions);
        setPrompts("");
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Failed to create sessions",
          description:
            "An error occurred while generating session titles. Please try again.",
        });
      }
    });
  };

  const handlePreCannedPromptClick = (prompt: string) => {
    setPrompts(prompt);
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>New Sessions</CardTitle>
        <CardDescription>
          Enter your session prompts below, one per line, or use one of the suggestions. We'll use AI to generate a
          suitable title for each session.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Prompt Suggestions</Label>
            <div className="flex flex-wrap gap-2">
              {preCannedPrompts.map((p) => (
                <Button
                  key={p.title}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreCannedPromptClick(p.prompt)}
                  disabled={isPending || disabled}
                >
                  {p.title}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid w-full gap-2">
            <Label htmlFor="prompts">Session Prompts</Label>
            <Textarea
              id="prompts"
              placeholder="e.g., Create a boba app!"
              rows={5}
              value={prompts}
              onChange={(e) => setPrompts(e.target.value)}
              disabled={isPending || disabled}
              aria-label="Session Prompts"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SourceSelection apiKey={apiKey} onSourceSelected={setSelectedSource} disabled={disabled || isPending} />
            <BranchSelection apiKey={apiKey} source={selectedSource} disabled={disabled || isPending || !selectedSource}/>
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
                Create Sessions
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
