

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
import { refreshSources } from "@/app/sessions/actions";
import { getPredefinedPrompts, getGlobalPrompt, addJob } from "@/app/config/actions";
import type { Session, Source, Branch, PredefinedPrompt, Job, AutomationMode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Loader2, RefreshCw, X, Trash2, BookText } from "lucide-react";
import { SourceSelection } from "./source-selection";
import { BranchSelection } from "./branch-selection";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Combobox } from "@/components/ui/combobox";

type JobCreationFormProps = {
  onJobsCreated: (sessions: Session[], newJob: Job) => void;
  onCreateJob: (
    title: string,
    prompt: string,
    source: Source | null,
    branch: string | undefined,
    requirePlanApproval: boolean,
    automationMode: AutomationMode
  ) => Promise<Session | null>;
  disabled?: boolean;
  onReset?: () => void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function JobCreationForm({
  onJobsCreated,
  onCreateJob,
  disabled,
  onReset
}: JobCreationFormProps) {
  const [prompt, setPrompt] = useState("");
  const [jobName, setJobName] = useState("");
  const [defaultSessionCount] = useLocalStorage<number>("jules-default-session-count", 3);
  const [sessionCount, setSessionCount] = useState(defaultSessionCount);
  
  const [requirePlanApproval, setRequirePlanApproval] = useLocalStorage<boolean>("jules-new-job-require-plan-approval", false);
  const [automationMode, setAutomationMode] = useLocalStorage<AutomationMode>("jules-new-job-automation-mode", "AUTO_CREATE_PR");

  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const { toast } = useToast();
  
  const [selectedSource, setSelectedSource] = useLocalStorage<Source | null>("jules-last-source", null);
  const [selectedBranch, setSelectedBranch] = useLocalStorage<string | undefined>("jules-last-branch", undefined);
  const [sources, setSources] = useLocalStorage<Source[]>("jules-sources-cache", []);

  const [sourceSelectionKey, setSourceSelectionKey] = useState(Date.now());
  const [predefinedPrompts, setPredefinedPrompts] = useState<PredefinedPrompt[]>([]);
  const [globalPrompt, setGlobalPrompt] = useState('');

  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    async function fetchData() {
        const [prompts, gPrompt] = await Promise.all([
            getPredefinedPrompts(),
            getGlobalPrompt()
        ]);
        setPredefinedPrompts(prompts);
        setGlobalPrompt(gPrompt);
    }
    fetchData();
  }, []);

  // Update sessionCount if the default value from storage changes
  useEffect(() => {
    setSessionCount(defaultSessionCount);
  }, [defaultSessionCount]);

  const handleRefresh = useCallback(async () => {
    startRefreshTransition(async () => {
      await refreshSources();
      setSourceSelectionKey(Date.now());
      setSources([]); // Clear cache to force re-fetch in SourceSelection
      toast({
        title: "Refreshed",
        description: "The list of repositories has been updated.",
      });
    });
  }, [toast, setSources]);

  const handleReset = () => {
    setJobName("");
    setPrompt("");
    setSessionCount(defaultSessionCount);
    if (onReset) onReset();
    toast({ title: "Form Reset", description: "The new job form has been cleared."});
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const finalPrompt = (globalPrompt ? `${globalPrompt}\n\n---\n\n` : "") + prompt;

    if (!finalPrompt.trim()) {
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
      const title = jobName.trim() || new Date().toLocaleString();

      for (let i = 0; i < sessionCount; i++) {
        let retries = 3;
        let newSession: Session | null = null;
        while (retries > 0 && !newSession) {
            newSession = await onCreateJob(title, finalPrompt, selectedSource, selectedBranch, requirePlanApproval, automationMode);
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
        createdAt: new Date().toISOString(),
        repo: `${selectedSource.githubRepo.owner}/${selectedSource.githubRepo.repo}`,
        branch: selectedBranch,
      };
      
      await addJob(newJob);

      if (createdSessions.length > 0) {
        onJobsCreated(createdSessions, newJob);
        setPrompt("");
        setJobName("");
        setSessionCount(defaultSessionCount);
      }
    });
  };

  const handlePreCannedPromptSelect = (promptId: string | null) => {
    if (!promptId) return;
    const selectedPrompt = predefinedPrompts.find(p => p.id === promptId);
    if (selectedPrompt) {
        setPrompt(selectedPrompt.prompt);
        setJobName(selectedPrompt.title);
    }
  };
  
  const branches = selectedSource?.githubRepo?.branches || [];
  const defaultBranch = selectedSource?.githubRepo?.defaultBranch?.displayName;

  // Effect to auto-select default branch ONLY if there isn't a branch already selected from local storage
  useEffect(() => {
    if (!selectedBranch && defaultBranch) {
      setSelectedBranch(defaultBranch);
    }
  }, [defaultBranch, selectedBranch, setSelectedBranch]);


  // When selectedSource changes, if the previously selected branch is not in the new list of branches,
  // then select the default branch for the new source.
  useEffect(() => {
    if (selectedSource) {
      const currentBranchIsValid = branches.some(b => b.displayName === selectedBranch);
      if (!currentBranchIsValid) {
        setSelectedBranch(defaultBranch);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSource, branches, defaultBranch]);

  const promptOptions = predefinedPrompts.map(p => ({
    value: p.id,
    label: p.title,
    content: p.prompt
  }));

  return (
    <Card className="shadow-md">
      <TooltipProvider>
      <CardHeader className="relative">
        <div>
            <CardTitle>New Job</CardTitle>
            <CardDescription>
            Create a new job by providing a prompt. You can create multiple sessions for the same job.
            </CardDescription>
        </div>
         {onReset && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleReset} className="absolute top-4 right-4">
                    <Trash2 className="h-4 w-4"/>
                    <span className="sr-only">Reset Form</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset Form</p>
              </TooltipContent>
            </Tooltip>
        )}
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
           {isClient && predefinedPrompts.length > 0 && (
            <div className="space-y-2">
              <Label>Message Suggestions</Label>
              <Combobox
                options={promptOptions}
                selectedValue={null}
                onValueChange={handlePreCannedPromptSelect}
                placeholder="Select a predefined message..."
                searchPlaceholder="Search messages..."
                disabled={isPending || disabled}
                icon={<BookText className="h-4 w-4 text-muted-foreground" />}
              />
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
                value={sessionCount}
                onChange={(e) => setSessionCount(parseInt(e.target.value, 10))}
                disabled={isPending || disabled}
              />
            </div>
          </div>

          <div className="grid w-full gap-2">
            <div className="flex items-center justify-between">
                <Label htmlFor="prompts">Prompt</Label>
                {prompt && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPrompt("")}>
                          <X className="h-4 w-4" />
                          <span className="sr-only">Clear prompt</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear prompt</p>
                    </TooltipContent>
                  </Tooltip>
                )}
            </div>
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
                        <RefreshCw className={cn("h-4 w-4", isRefreshing ? "animate-spin" : "")} />
                    </Button>
                </div>
                <SourceSelection 
                    key={sourceSelectionKey}
                    onSourceSelected={setSelectedSource} 
                    disabled={disabled || isPending}
                    selectedValue={selectedSource}
                    sources={sources}
                    onSourcesLoaded={setSources}
                />
            </div>
            <BranchSelection 
              branches={branches} 
              onBranchSelected={setSelectedBranch}
              disabled={disabled || isPending || !selectedSource}
              selectedValue={selectedBranch}
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
        <CardFooter className="flex justify-end">
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
      </TooltipProvider>
    </Card>
  );
}
