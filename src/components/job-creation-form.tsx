
"use client";

import React, { useState, useTransition, useCallback, useEffect, useMemo } from "react";
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
import { refreshSources, listSources } from "@/app/sessions/actions";
import { getPredefinedPrompts, getGlobalPrompt, getRepoPrompt, addJob, getHistoryPrompts, saveHistoryPrompt, getSettings } from "@/app/config/actions";
import type { Session, Source, Branch, PredefinedPrompt, Job, AutomationMode, HistoryPrompt, Settings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Loader2, RefreshCw, X, Trash2, BookText, HelpCircle } from "lucide-react";
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
    automationMode: AutomationMode,
    settings: Settings | null
  ) => Promise<Session | null>;
  disabled?: boolean;
  onReset?: () => void;
  initialValues?: {
    prompt?: string;
    repo?: string;
    branch?: string;
    jobName?: string;
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function JobCreationForm({
  onJobsCreated,
  onCreateJob,
  disabled,
  onReset,
  initialValues
}: JobCreationFormProps) {
  const [prompt, setPrompt] = useState("");
  const [jobName, setJobName] = useState("");
  const [defaultSessionCount] = useLocalStorage<number>("jules-default-session-count", 10);
  const [sessionCount, setSessionCount] = useState(defaultSessionCount);
  const [currentProfileId] = useLocalStorage<string>("jules-current-profile-id", "default");
  
  const [requirePlanApproval, setRequirePlanApproval] = useState(false);
  const [automationMode, setAutomationMode] = useState<AutomationMode>("AUTO_CREATE_PR");
  const [backgroundJob, setBackgroundJob] = useState(true);
  const [applyGlobalPrompt, setApplyGlobalPrompt] = useState(true);

  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const { toast } = useToast();
  
  const [selectedSource, setSelectedSource] = useLocalStorage<Source | null>("jules-last-source", null);
  const [selectedBranch, setSelectedBranch] = useLocalStorage<string | undefined>("jules-last-branch", undefined);
  const [sources, setSources] = useLocalStorage<Source[]>("jules-sources-cache", []);
  const [lastSourcesFetch, setLastSourcesFetch] = useLocalStorage<number>("jules-sources-last-fetch", 0);
  const [apiKey] = useLocalStorage<string | null>("jules-api-key", null);

  const [sourceSelectionKey, setSourceSelectionKey] = useState(Date.now());
  const [predefinedPrompts, setPredefinedPrompts] = useState<PredefinedPrompt[]>([]);
  const [historyPrompts, setHistoryPrompts] = useState<HistoryPrompt[]>([]);
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [repoPrompt, setRepoPrompt] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);

  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  // Track selected prompt ID to make the combobox display the selected item correctly
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    async function fetchData() {
        const [prompts, gPrompt, hPrompts, settings] = await Promise.all([
            getPredefinedPrompts(currentProfileId),
            getGlobalPrompt(currentProfileId),
            getHistoryPrompts(currentProfileId),
            getSettings(currentProfileId)
        ]);
        setPredefinedPrompts(prompts);
        setGlobalPrompt(gPrompt);
        setHistoryPrompts(hPrompts);
        setHistoryPrompts(hPrompts);
        setSettings(settings || null);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (initialValues) {
      if (initialValues.prompt) setPrompt(initialValues.prompt);
      if (initialValues.jobName) setJobName(initialValues.jobName);
      if (initialValues.repo) {
        // We need to wait for sources to be loaded to select the correct object
        // This is handled in the effect below that watches 'sources'
      }
      // Branch is handled similarly
    }
  }, [initialValues]);

  // Handle initial values selection once sources are loaded
  useEffect(() => {
    if (initialValues?.repo && sources.length > 0) {
        // format: owner/repo
        const [owner, repo] = initialValues.repo.split('/');
        const source = sources.find(s => s.githubRepo.owner === owner && s.githubRepo.repo === repo);
        if (source) {
            setSelectedSource(source);
            if (initialValues.branch) {
                // We set this immediately, but it might be overridden by the branch validation logic
                // if the branches aren't loaded yet. However, since branches are part of the Source object,
                // this should be fine.
                const branchExists = source.githubRepo.branches.some(b => b.displayName === initialValues.branch);
                if (branchExists) {
                    setSelectedBranch(initialValues.branch);
                }
            }
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues, sources]);

  // Update sessionCount if the default value from storage changes
  useEffect(() => {
    if (!initialValues) {
       setSessionCount(defaultSessionCount);
    } else {
        setSessionCount(1);
    }
  }, [defaultSessionCount, initialValues]);

  const handleRefresh = useCallback(async () => {
    startRefreshTransition(async () => {
      try {
        await refreshSources();
        const fetchedSources = await listSources(apiKey);
        setSources(fetchedSources);
        setLastSourcesFetch(Date.now());
        toast({
          title: "Refreshed",
          description: "The list of repositories has been updated.",
        });
      } catch (error) {
        console.error("Failed to refresh sources:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to refresh repositories.",
        });
      }
    });
  }, [toast, setSources, setLastSourcesFetch, apiKey]);

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

  const finalPrompt = useMemo(() => {
    let result = "";
    if (applyGlobalPrompt && globalPrompt) {
      result += `${globalPrompt}\n\n`;
    }
    if (repoPrompt) {
      result += `${repoPrompt}\n\n`;
    }
    result += prompt;
    return result;
  }, [prompt, applyGlobalPrompt, globalPrompt, repoPrompt]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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
      await saveHistoryPrompt(prompt, currentProfileId);
      // Refresh history prompts in UI
      const hPrompts = await getHistoryPrompts(currentProfileId);
      setHistoryPrompts(hPrompts);

      const createdSessions: Session[] = [];
      const sessionIds: string[] = [];
      const title = jobName.trim() || new Date().toLocaleString();

      if (backgroundJob) {
        const newJob: Job = {
            id: crypto.randomUUID(),
            name: title,
            sessionIds: [],
            createdAt: new Date().toISOString(),
            repo: `${selectedSource.githubRepo.owner}/${selectedSource.githubRepo.repo}`,
            branch: selectedBranch,
            autoApproval: !requirePlanApproval,
            background: true,
            prompt: finalPrompt,
            sessionCount: sessionCount,
            status: 'PENDING',
            automationMode: automationMode,
            requirePlanApproval: requirePlanApproval,
            profileId: currentProfileId
        };
        await addJob(newJob);
        toast({
            title: "Background Job Scheduled",
            description: "The job has been scheduled to run in the background.",
        });

        onJobsCreated([], newJob); // Pass empty sessions as they will be created later
        setPrompt("");
        setSelectedPromptId(null);
        setJobName("");
        setSessionCount(defaultSessionCount);
        return;
      }

      if (sessionCount > 1) {
        setProgressTotal(sessionCount);
        setProgressCurrent(0);
      }

      for (let i = 0; i < sessionCount; i++) {
        const sessionIndex = i;
        if (sessionCount > 1) {
             setProgressCurrent(sessionIndex + 1);
        }

        let retries = 3;
        let newSession: Session | null = null;
        while (retries > 0 && !newSession) {
            newSession = await onCreateJob(title, finalPrompt, selectedSource, selectedBranch, requirePlanApproval, automationMode, settings);
            if (!newSession) {
                console.error(`Failed to create session ${sessionIndex + 1}. Retries remaining: ${retries - 1}`);
                retries--;
                toast({
                    variant: "destructive",
                    title: `Failed to create session ${sessionIndex + 1}`,
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
                title: `Failed to create session ${sessionIndex + 1} after multiple retries.`,
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
        background: false,
        prompt: finalPrompt,
        sessionCount: createdSessions.length,
        status: 'COMPLETED',
        automationMode: automationMode,
        requirePlanApproval: requirePlanApproval,
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJobName(e.target.value)}
                disabled={isPending || disabled}
                aria-describedby="job-name-help"
              />
              <p id="job-name-help" className="text-xs text-muted-foreground">
                If left blank, a title will be generated automatically.
              </p>
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
                aria-describedby="session-count-help"
              />
              <p id="session-count-help" className="text-xs text-muted-foreground">
                Run multiple parallel sessions for this job.
              </p>
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
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleRefresh} className="h-6 w-6" disabled={isRefreshing} aria-label="Refresh Repositories">
                            <RefreshCw className={cn("h-4 w-4", isRefreshing ? "animate-spin" : "")} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Refresh Repositories</p>
                      </TooltipContent>
                    </Tooltip>
                </div>
                <SourceSelection 
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
                    id="background-job"
                    checked={backgroundJob}
                    onCheckedChange={setBackgroundJob}
                    disabled={isPending || disabled}
                />
                <div className="flex items-center gap-1">
                  <Label htmlFor="background-job">Background Job</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Job will run in the background. You can check the status later.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="require-plan-approval" 
                checked={requirePlanApproval} 
                onCheckedChange={setRequirePlanApproval}
                disabled={isPending || disabled}
              />
              <div className="flex items-center gap-1">
                <Label htmlFor="require-plan-approval">Require Plan Approval</Label>
                <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>If enabled, you must manually approve the plan before changes are applied.</p>
                    </TooltipContent>
                  </Tooltip>
              </div>
            </div>
             <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="automation-mode">Automation Mode</Label>
                   <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Determines how the job interacts with the repository (e.g., auto-creating PRs).</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
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
            disabled={isPending || disabled || !finalPrompt.trim()}
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
