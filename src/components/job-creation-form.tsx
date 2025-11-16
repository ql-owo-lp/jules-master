"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
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
import { refreshSources } from "@/app/sessions/actions";
import type { Session, Source, Branch, PredefinedPrompt } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Loader2, RefreshCw } from "lucide-react";
import { SourceSelection } from "./source-selection";
import { BranchSelection } from "./branch-selection";
import { useLocalStorage } from "@/hooks/use-local-storage";

type JobCreationFormProps = {
  onJobsCreated: (sessions: Session[]) => void;
  onCreateJob: (prompt: string, source: Source | null, branch: string | undefined) => Promise<Session | null>;
  disabled?: boolean;
  apiKey: string;
};

export function JobCreationForm({
  onJobsCreated,
  onCreateJob,
  disabled,
  apiKey,
}: JobCreationFormProps) {
  const [prompts, setPrompts] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const { toast } = useToast();
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>();
  const [sourceSelectionKey, setSourceSelectionKey] = useState(Date.now());
  const [predefinedPrompts] = useLocalStorage<PredefinedPrompt[]>("predefined-prompts", []);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    startRefreshTransition(async () => {
      await refreshSources();
      setSourceSelectionKey(Date.now());
      toast({
        title: "Refreshed",
        description: "The list of repositories has been updated.",
      });
    });
  }, [toast]);

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
     if (!selectedSource || !selectedBranch) {
      toast({
        variant: "destructive",
        title: "Repository and branch must be selected.",
      });
      return;
    }

    startTransition(async () => {
      const createdSessions: Session[] = [];
      for (const prompt of promptLines) {
        const title = await createTitleForJob(prompt);
        const newSession = await onCreateJob(prompt, selectedSource, selectedBranch);
        if (newSession) {
           createdSessions.push({ ...newSession, title });
        }
      }

      if (createdSessions.length > 0) {
        onJobsCreated(createdSessions);
        setPrompts("");
      } else if (promptLines.length > 0) {
         toast({
          variant: "destructive",
          title: "Failed to create sessions",
          description:
            "An error occurred while creating the sessions. Please try again.",
        });
      }
    });
  };

  const handlePreCannedPromptClick = (prompt: string) => {
    setPrompts(prompt);
  };
  
  const branches = selectedSource?.githubRepo?.branches || [];
  const defaultBranch = selectedSource?.githubRepo?.defaultBranch?.displayName;

  useEffect(() => {
    if (defaultBranch) {
      setSelectedBranch(defaultBranch);
    }
  }, [defaultBranch]);

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
           {isClient && predefinedPrompts.length > 0 && (
            <div className="space-y-2">
              <Label>Prompt Suggestions</Label>
              <div className="flex flex-wrap gap-2">
                {predefinedPrompts.map((p) => (
                  <Button
                    key={p.id}
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
          )}

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
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Label htmlFor="repository">Repository</Label>
                     <Button variant="ghost" size="icon" onClick={handleRefresh} className="h-6 w-6" disabled={isRefreshing} aria-label="Refresh Repositories">
                        <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
                    </Button>
                </div>
                <SourceSelection 
                    key={sourceSelectionKey}
                    apiKey={apiKey} 
                    onSourceSelected={setSelectedSource} 
                    disabled={disabled || isPending} 
                />
            </div>
            <BranchSelection 
              branches={branches} 
              defaultBranchName={defaultBranch} 
              onBranchSelected={setSelectedBranch}
              disabled={disabled || isPending || !selectedSource}
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
                Create Sessions
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
