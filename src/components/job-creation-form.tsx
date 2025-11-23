
"use client";

import { useState, useTransition, useCallback, useEffect, useMemo } from "react";
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
import { getPredefinedPrompts, getGlobalPrompt, getRepoPrompt, addJob, getHistoryPrompts, saveHistoryPrompt } from "@/app/config/actions";
import type { Session, Source, Branch, PredefinedPrompt, Job, AutomationMode, HistoryPrompt } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Loader2, RefreshCw, X, Trash2, BookText } from "lucide-react";
import { SourceSelection } from "./source-selection";
import { BranchSelection } from "./branch-selection";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Combobox, ComboboxGroup } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { FloatingProgressBar } from "@/components/floating-progress-bar";

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
  const [defaultSessionCount] = useLocalStorage<number>("jules-default-session-count", 10);
  const [sessionCount, setSessionCount] = useState(defaultSessionCount);
  
  const [requirePlanApproval, setRequirePlanApproval] = useLocalStorage<boolean>("jules-new-job-require-plan-approval", false);
  const [automationMode, setAutomationMode] = useLocalStorage<AutomationMode>("jules-new-job-automation-mode", "AUTO_CREATE_PR");
  const [applyGlobalPrompt, setApplyGlobalPrompt] = useState(true);

  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const { toast } = useToast();
  
  const [selectedSource, setSelectedSource] = useLocalStorage<Source | null>("jules-last-source", null);
  const [selectedBranch, setSelectedBranch] = useLocalStorage<string | undefined>("jules-last-branch", undefined);
  const [sources, setSources] = useLocalStorage<Source[]>("jules-sources-cache", []);
  const [lastSourcesFetch, setLastSourcesFetch] = useLocalStorage<number>("jules-sources-last-fetch", 0);

  const [sourceSelectionKey, setSourceSelectionKey] = useState(Date.now());
  const [predefinedPrompts, setPredefinedPrompts] = useState<PredefinedPrompt[]>([]);
  const [historyPrompts, setHistoryPrompts] = useState<HistoryPrompt[]>([]);
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [repoPrompt, setRepoPrompt] = useState('');

  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  // Track selected prompt ID to make the combobox display the selected item correctly
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    async function fetchData() {
        const [prompts, gPrompt, hPrompts] = await Promise.all([
            getPredefinedPrompts(),
            getGlobalPrompt(),
            getHistoryPrompts()
        ]);
        setPredefinedPrompts(prompts);
        setGlobalPrompt(gPrompt);
        setHistoryPrompts(hPrompts);
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

  useEffect(() => {
    const checkCache = async () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        // Refresh if older than 5 minutes
        if (now - lastSourcesFetch > 5 * 60 * 1000 && !isRefreshing) {
           await handleRefresh();
        }
      }
    };

    document.addEventListener('visibilitychange', checkCache);
    window.addEventListener('focus', checkCache);

    // Initial check
    checkCache();

    return () => {
      document.removeEventListener('visibilitychange', checkCache);
      window.removeEventListener('focus', checkCache);
    };
  }, [lastSourcesFetch, handleRefresh, isRefreshing]);

  const handleSourcesLoaded = (newSources: Source[]) => {
    setSources(newSources);
    setLastSourcesFetch(Date.now());
  };

  const handleReset = () => {
    setJobName("");
    setPrompt("");
    setSelectedPromptId(null);
    setSessionCount(defaultSessionCount);
    if (onReset) onReset();
    toast({ title: "Form Reset", description: "The new job form has been cleared."});
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // The appending order is, “global prompt”, “pre-repo prompt”, “job prompt “. All of them are separated with two new lines
    let finalPrompt = "";
    if (applyGlobalPrompt && globalPrompt) {
        finalPrompt += `${globalPrompt}\n\n`;
    }
    if (repoPrompt) {
        finalPrompt += `${repoPrompt}\n\n`;
    }
    finalPrompt += prompt;

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
      // Save to history prompts
      await saveHistoryPrompt(prompt);
      // Refresh history prompts in UI
      const hPrompts = await getHistoryPrompts();
      setHistoryPrompts(hPrompts);

      const createdSessions: Session[] = [];
      const sessionIds: string[] = [];
      const title = jobName.trim() || new Date().toLocaleString();

      if (sessionCount > 1) {
        setProgressTotal(sessionCount);
        setProgressCurrent(0);
      }

      for (let i = 0; i < sessionCount; i++) {
        if (sessionCount > 1) {
             setProgressCurrent(i + 1);
        }

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
        autoApproval: !requirePlanApproval,
      };
      
      await addJob(newJob);

      if (createdSessions.length > 0) {
        onJobsCreated(createdSessions, newJob);
        setPrompt("");
        setSelectedPromptId(null);
        setJobName("");
        setSessionCount(defaultSessionCount);
      }

      setProgressCurrent(0);
      setProgressTotal(0);
    });
  };

  const handlePreCannedPromptSelect = (promptId: string | null) => {
    if (!promptId) {
        setSelectedPromptId(null);
        return;
    }
    setSelectedPromptId(promptId);

    const selectedPrompt = predefinedPrompts.find(p => p.id === promptId);
    if (selectedPrompt) {
        setPrompt(selectedPrompt.prompt);
        setJobName(selectedPrompt.title);
    } else {
      const selectedHistory = historyPrompts.find(p => p.id === promptId);
      if (selectedHistory) {
        setPrompt(selectedHistory.prompt);
        // We keep the current job name as is, or the user can manually update it.
      }
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

      const fetchRepoPrompt = async () => {
         const repoName = `${selectedSource.githubRepo.owner}/${selectedSource.githubRepo.repo}`;
         const prompt = await getRepoPrompt(repoName);
         setRepoPrompt(prompt);
      };
      fetchRepoPrompt();
    } else {
        setRepoPrompt("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSource, branches, defaultBranch]);

  const truncate = (str: string, length: number) => {
    return str.length > length ? str.substring(0, length) + "..." : str;
  }

  const promptOptions: ComboboxGroup[] = useMemo(() => {
    const options: ComboboxGroup[] = [];

    if (predefinedPrompts.length > 0) {
        options.push({
        label: "Predefined Prompts",
        options: predefinedPrompts.map(p => ({
            value: p.id,
            label: p.title,
            content: p.prompt
        }))
        });
    }

    if (historyPrompts.length > 0) {
        options.push({
        label: "History Prompts",
        options: historyPrompts.map(p => ({
            value: p.id,
            label: truncate(p.prompt, 50), // Use truncated prompt as label
            content: p.prompt
        }))
        });
    }
    return options;
  }, [predefinedPrompts, historyPrompts]);

  return (
    <Card className="shadow-md">
       <FloatingProgressBar
        current={progressCurrent}
        total={progressTotal}
        label="Creating sessions..."
        isVisible={isPending && sessionCount > 1}
      />
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
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setPrompt(""); setSelectedPromptId(null); }}>
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
              onChange={(e) => {
                  setPrompt(e.target.value);
                  // If user types, we deselect any suggestion because it might differ now
                  if (selectedPromptId) setSelectedPromptId(null);
              }}
              disabled={isPending || disabled}
              aria-label="Session Prompts"
            />
             <div className="grid grid-cols-2 items-center gap-4 pt-2">
              {isClient && (predefinedPrompts.length > 0 || historyPrompts.length > 0) && (
                <div className="space-y-2">
                  <Combobox
                    options={promptOptions}
                    selectedValue={selectedPromptId}
                    onValueChange={handlePreCannedPromptSelect}
                    placeholder="Select a message suggestion..."
                    searchPlaceholder="Search messages..."
                    disabled={isPending || disabled}
                    icon={<BookText className="h-4 w-4 text-muted-foreground" />}
                    renderOption={(option) => (
                      <span className="truncate">
                        {option.label}
                        <span className="ml-2 text-muted-foreground font-light">
                          [{truncate(option.content, 30)}]
                        </span>
                      </span>
                    )}
                  />
                </div>
              )}
               <div className="flex items-center space-x-2">
                <Checkbox 
                  id="apply-global-prompt" 
                  checked={applyGlobalPrompt} 
                  onCheckedChange={(checked) => setApplyGlobalPrompt(Boolean(checked))}
                  disabled={isPending || disabled || !globalPrompt}
                />
                <Label htmlFor="apply-global-prompt" className="text-sm font-normal">Apply Global Prompt</Label>
              </div>
            </div>
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
                    onSourcesLoaded={handleSourcesLoaded}
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
