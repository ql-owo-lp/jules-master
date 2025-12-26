
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
import { refreshSources, listSources } from "@/app/sessions/actions";
import { getPredefinedPrompts, getGlobalPrompt, getRepoPrompt, getHistoryPrompts } from "@/app/config/actions";
import type { Source, PredefinedPrompt, AutomationMode, HistoryPrompt, CronJob } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, X, BookText } from "lucide-react";
import { SourceSelection } from "./source-selection";
import { BranchSelection } from "./branch-selection";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Combobox, ComboboxGroup } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import cronParser from "cron-parser";

type CronJobFormProps = {
  onCronJobCreated: () => void;
  onCancel: () => void;
  initialValues?: CronJob;
};

export function CronJobForm({
  onCronJobCreated,
  onCancel,
  initialValues
}: CronJobFormProps) {
  const [prompt, setPrompt] = useState(initialValues?.prompt || "");
  const [jobName, setJobName] = useState(initialValues?.name || "");
  const [schedule, setSchedule] = useState(initialValues?.schedule || "0 * * * *");
  const [sessionCount, setSessionCount] = useState(initialValues?.sessionCount || 1);
  const [requirePlanApproval, setRequirePlanApproval] = useState(initialValues?.requirePlanApproval || false);
  const [automationMode, setAutomationMode] = useState<AutomationMode>(initialValues?.automationMode || "AUTO_CREATE_PR");
  const [applyGlobalPrompt, setApplyGlobalPrompt] = useState(true);

  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const { toast } = useToast();

  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>(undefined);
  const [sources, setSources] = useLocalStorage<Source[]>("jules-sources-cache", []);
  const [lastSourcesFetch, setLastSourcesFetch] = useLocalStorage<number>("jules-sources-last-fetch", 0);
  const [apiKey] = useLocalStorage<string | null>("jules-api-key", null);

  const [predefinedPrompts, setPredefinedPrompts] = useState<PredefinedPrompt[]>([]);
  const [historyPrompts, setHistoryPrompts] = useState<HistoryPrompt[]>([]);
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [repoPrompt, setRepoPrompt] = useState('');

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

  // Handle initial values selection once sources are loaded
  useEffect(() => {
    if (initialValues?.repo && sources.length > 0) {
        // format: owner/repo
        const [owner, repo] = initialValues.repo.split('/');
        const source = sources.find(s => s.githubRepo.owner === owner && s.githubRepo.repo === repo);
        if (source) {
            setSelectedSource(source);
            if (initialValues.branch) {
                const branchExists = source.githubRepo.branches.some(b => b.displayName === initialValues.branch);
                if (branchExists) {
                    setSelectedBranch(initialValues.branch);
                }
            }
        }
    }
  }, [initialValues, sources]);

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

  const handleSourcesLoaded = (newSources: Source[]) => {
    setSources(newSources);
    setLastSourcesFetch(Date.now());
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!jobName.trim()) {
        toast({
            variant: "destructive",
            title: "Missing fields",
            description: "Job Name is required.",
        });
        return;
    }

    if (!schedule.trim()) {
         toast({
            variant: "destructive",
            title: "Missing fields",
            description: "Schedule is required.",
        });
        return;
    }

    try {
        cronParser.parse(schedule);
    } catch (err) {
        toast({
            variant: "destructive",
            title: "Invalid Schedule",
            description: "Please enter a valid cron expression.",
        });
        return;
    }

    // The appending order is, “global prompt”, “pre-repo prompt”, “job prompt “. All of them are separated with two new lines
    let finalPrompt = "";
    if (applyGlobalPrompt && globalPrompt && !initialValues) {
        // Only apply global prompt for new jobs, otherwise it might double up if we edit
         finalPrompt += `${globalPrompt}\n\n`;
    } else if (applyGlobalPrompt && globalPrompt && initialValues) {
        // If editing, assume the prompt already contains what it needs or the user edited it.
        // Or we can just append if it's not present.
        // For simplicity, let's just use the prompt as is if it's an edit, but still prepend if user selected the checkbox.
        // Actually, for edit, we might want to just save whatever is in the text area.
        // But for consistency with JobCreationForm, we usually prepend on submit.
        // However, if we edit, we probably see the raw prompt.
        // Let's assume for edit, the prompt in the textarea is the FINAL prompt.
        // But the JobCreationForm applies it on submit.
        // Let's stick to JobCreationForm logic:
        if (!prompt.includes(globalPrompt)) {
             finalPrompt += `${globalPrompt}\n\n`;
        }
    }

    if (repoPrompt && (!initialValues || !prompt.includes(repoPrompt))) {
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
        const payload = {
            name: jobName,
            schedule,
            prompt: initialValues ? prompt : finalPrompt, // If editing, we trust the prompt box. If new, we construct it.
            repo: `${selectedSource.githubRepo.owner}/${selectedSource.githubRepo.repo}`,
            branch: selectedBranch,
            sessionCount,
            requirePlanApproval,
            automationMode,
            autoApproval: !requirePlanApproval,
        };

        try {
            if (initialValues) {
                 await fetch(`/api/cron-jobs/${initialValues.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                toast({ title: "Cron Job Updated" });
            } else {
                await fetch('/api/cron-jobs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                toast({ title: "Cron Job Created" });
            }
            onCronJobCreated();
        } catch (error) {
            console.error(error);
             toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to save cron job.",
            });
        }
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
        // Only set job name if it's empty
        if (!jobName) setJobName(selectedPrompt.title);
    } else {
      const selectedHistory = historyPrompts.find(p => p.id === promptId);
      if (selectedHistory) {
        setPrompt(selectedHistory.prompt);
      }
    }
  };

  const branches = selectedSource?.githubRepo?.branches || [];
  const defaultBranch = selectedSource?.githubRepo?.defaultBranch?.displayName;

  useEffect(() => {
    if (!selectedBranch && defaultBranch) {
      setSelectedBranch(defaultBranch);
    }
  }, [defaultBranch, selectedBranch, setSelectedBranch]);


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
            label: truncate(p.prompt, 50),
            content: p.prompt
        }))
        });
    }
    return options;
  }, [predefinedPrompts, historyPrompts]);

  return (
    <Card className="shadow-none border-0">
      <TooltipProvider>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job-name">Job Name</Label>
              <Input
                id="job-name"
                placeholder="e.g., Weekly Maintenance"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule (Cron Expression)</Label>
              <Input
                id="schedule"
                placeholder="e.g., 0 0 * * 0 (Weekly)"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                disabled={isPending}
              />
               <p className="text-xs text-muted-foreground">
                Format: Minute Hour Day Month DayOfWeek
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
              placeholder="e.g., Update dependencies"
              rows={5}
              value={prompt}
              onChange={(e) => {
                  setPrompt(e.target.value);
                  if (selectedPromptId) setSelectedPromptId(null);
              }}
              disabled={isPending}
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
                    disabled={isPending}
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
              {!initialValues && (
                   <div className="flex items-center space-x-2">
                    <Checkbox
                    id="apply-global-prompt"
                    checked={applyGlobalPrompt}
                    onCheckedChange={(checked) => setApplyGlobalPrompt(Boolean(checked))}
                    disabled={isPending || !globalPrompt}
                    />
                    <Label htmlFor="apply-global-prompt" className="text-sm font-normal">Apply Global Prompt</Label>
                </div>
              )}
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
                    id="repository"
                    onSourceSelected={setSelectedSource}
                    disabled={isPending}
                    selectedValue={selectedSource}
                    sources={sources}
                    onSourcesLoaded={handleSourcesLoaded}
                />
            </div>
            <BranchSelection
              id="branch"
              branches={branches}
              onBranchSelected={setSelectedBranch}
              disabled={isPending || !selectedSource}
              selectedValue={selectedBranch}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
             <div className="space-y-2">
              <Label htmlFor="session-count">Session Count</Label>
              <Input
                id="session-count"
                type="number"
                min="1"
                value={sessionCount}
                onChange={(e) => setSessionCount(parseInt(e.target.value, 10))}
                disabled={isPending}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="require-plan-approval"
                checked={requirePlanApproval}
                onCheckedChange={setRequirePlanApproval}
                disabled={isPending}
              />
              <Label htmlFor="require-plan-approval">Require Plan Approval</Label>
            </div>
             <div className="space-y-2">
                <Label htmlFor="automation-mode">Automation Mode</Label>
                 <Select
                    value={automationMode}
                    onValueChange={(value: AutomationMode) => setAutomationMode(value)}
                    disabled={isPending}
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
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialValues ? "Update" : "Create"} Cron Job
          </Button>
        </CardFooter>
      </form>
      </TooltipProvider>
    </Card>
  );
}
