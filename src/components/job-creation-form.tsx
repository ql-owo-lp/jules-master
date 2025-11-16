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
import { Input } from "@/components/ui/input";
import { createTitleForJob } from "@/app/actions";
import { refreshSources } from "@/app/sessions/actions";
import type { Session, Source, Branch, PredefinedPrompt, Job, AutomationMode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Loader2, RefreshCw } from "lucide-react";
import { SourceSelection } from "./source-selection";
import { BranchSelection } from "./branch-selection";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type JobCreationFormProps = {
  onJobsCreated: (sessions: Session[]) => void;
  onCreateJob: (
    title: string,
    prompt: string,
    source: Source | null,
    branch: string | undefined,
    requirePlanApproval: boolean,
    automationMode: AutomationMode
  ) => Promise<Session | null>;
  disabled?: boolean;
  apiKey: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function JobCreationForm({
  onJobsCreated,
  onCreateJob,
  disabled,
  apiKey,
}: JobCreationFormProps) {
  const [prompt, setPrompt] = useState("");
  const [jobName, setJobName] = useState("");
  const [sessionCount, setSessionCount] = useState(1);
  
  const [defaultRequirePlanApproval] = useLocalStorage<boolean>("jules-default-require-plan-approval", false);
  const [defaultAutomationMode] = useLocalStorage<AutomationMode>("jules-default-automation-mode", "AUTO_CREATE_PR");

  const [requirePlanApproval, setRequirePlanApproval] = useState(defaultRequirePlanApproval);
  const [automationMode, setAutomationMode] = useState<AutomationMode>(defaultAutomationMode);

  useEffect(() => {
    setRequirePlanApproval(defaultRequirePlanApproval);
  }, [defaultRequirePlanApproval]);

  useEffect(() => {
    setAutomationMode(defaultAutomationMode);
  }, [defaultAutomationMode]);


  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const { toast } = useToast();
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>();
  const [sourceSelectionKey, setSourceSelectionKey] = useState(Date.now());
  const [predefinedPrompts] = useLocalStorage<PredefinedPrompt[]>("predefined-prompts", []);
  const [isClient, setIsClient] = useState(false);
  const [jobs, setJobs] = useLocalStorage<Job[]>("jules-jobs", []);

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

    if (!prompt.trim()) {
      toast({
        variant: "destructive",
        title: "No prompt entered",
        description: "Please enter a session prompt.",
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
      const sessionIds: string[] = [];
      const title = jobName.trim() || await createTitleForJob(prompt);

      for (let i = 0; i < sessionCount; i++) {
        let retries = 3;
        let newSession: Session | null = null;
        while (retries > 0 && !newSession) {
            newSession = await onCreateJob(title, prompt, selectedSource, selectedBranch, requirePlanApproval, automationMode);
            if (!newSession) {
                retries--;
                toast({
                    variant: "destructive",
                    title: `Failed to create session ${i + 1}`,
                    description: `Retrying... (${3 - retries}/3)`,
                });
                await sleep(1000); // wait before retrying
            }
        }

        if (newSession) {
           createdSessions.push({ ...newSession, title });
           sessionIds.push(newSession.id);
        } else {
             toast({
                variant: "destructive",
                title: `Failed to create session ${i + 1} after multiple retries.`,
             });
        }
        await sleep(500); // 500ms interval
      }
      
      const newJob: Job = {
        id: crypto.randomUUID(),
        name: title,
        sessionIds,
        createdAt: new Date().toISOString()
      };
      setJobs([...jobs, newJob]);

      if (createdSessions.length > 0) {
        onJobsCreated(createdSessions);
        setPrompt("");
        setJobName("");
        setSessionCount(1);
      }
    });
  };

  const handlePreCannedPromptClick = (p: PredefinedPrompt) => {
    setPrompt(p.prompt);
    setJobName(p.title);
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
        <CardTitle>New Job</CardTitle>
        <CardDescription>
          Create a new job by providing a prompt. You can create multiple sessions for the same job.
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
                    onClick={() => handlePreCannedPromptClick(p)}
                    disabled={isPending || disabled}
                  >
                    {p.title}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job-name">Job Name (Optional)</Label>
              <Input
                id="job-name"
                placeholder="e.g., My Awesome Job"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                disabled={isPending || disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-count">Number of sessions</Label>
              <Input
                id="session-count"
                type="number"
                min="1"
                max="10"
                value={sessionCount}
                onChange={(e) => setSessionCount(parseInt(e.target.value, 10))}
                disabled={isPending || disabled}
              />
            </div>
          </div>

          <div className="grid w-full gap-2">
            <Label htmlFor="prompts">Prompt</Label>
            <Textarea
              id="prompts"
              placeholder="e.g., Create a boba app!"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex items-center space-x-2">
              <Switch 
                id="require-plan-approval" 
                checked={requirePlanApproval} 
                onCheckedChange={setRequirePlanApproval}
                disabled={isPending || disabled}
              />
              <Label htmlFor="require-plan-approval">Require Plan Approval</Label>
            </div>
             <div className="space-y-2">
                <Label htmlFor="automation-mode">Automation Mode</Label>
                 <Select 
                    value={automationMode}
                    onValueChange={(value: AutomationMode) => setAutomationMode(value)}
                    disabled={isPending || disabled}
                >
                    <SelectTrigger id="automation-mode">
                        <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="AUTO_CREATE_PR">Auto-create Pull Request</SelectItem>
                        <SelectItem value="AUTOMATION_MODE_UNSPECIFIED">Unspecified</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            disabled={isPending || disabled || !prompt.trim()}
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
                Create Job
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
