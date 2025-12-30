
"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Save, Globe, GitMerge, BookText, MessageSquareReply, Plus, Edit, Trash2, MoreHorizontal, RefreshCw } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";
import { useEnv } from "@/components/env-provider";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
    getPredefinedPrompts,
    savePredefinedPrompts,
    getQuickReplies,
    saveQuickReplies,
    getGlobalPrompt,
    saveGlobalPrompt,
    getRepoPrompt,
    saveRepoPrompt
} from "@/app/config/actions";
import { SourceSelection } from "@/components/source-selection";
import { CronJobsList } from "@/components/cron-jobs-list";
import { ProfilesSettings } from "@/components/profiles-settings";
import { listSources, refreshSources } from "@/app/sessions/actions";
import { cn } from "@/lib/utils";
import type { PredefinedPrompt, Source } from "@/lib/types";

type DialogState = {
  isOpen: boolean;
  type: 'prompt' | 'reply';
  data: PredefinedPrompt | null;
}

export default function SettingsPage() {
  const { hasJulesApiKey, hasGithubToken: hasEnvGithubToken } = useEnv();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const [isClient, setIsClient] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentTab = searchParams.get("tab") || "general";

  const onTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`${pathname}?${params.toString()}`);
  };

  // --- Settings State (from SettingsSheet) ---
  const [apiKey, setApiKey] = useLocalStorage<string>("jules-api-key", "");
  const [githubToken, setGithubToken] = useLocalStorage<string>("jules-github-token", "");

  const [idlePollInterval, setIdlePollInterval] = useLocalStorage<number>("jules-idle-poll-interval", 120);
  const [activePollInterval, setActivePollInterval] = useLocalStorage<number>("jules-active-poll-interval", 30);
  const [titleTruncateLength, setTitleTruncateLength] = useLocalStorage<number>("jules-title-truncate-length", 50);
  const [lineClamp, setLineClamp] = useLocalStorage<number>("jules-line-clamp", 1);
  const [sessionItemsPerPage, setSessionItemsPerPage] = useLocalStorage<number>("jules-session-items-per-page", 10);
  const [jobsPerPage, setJobsPerPage] = useLocalStorage<number>("jules-jobs-per-page", 5);
  const [defaultSessionCount, setDefaultSessionCount] = useLocalStorage<number>("jules-default-session-count", 10);
  const [prStatusPollInterval, setPrStatusPollInterval] = useLocalStorage<number>("jules-pr-status-poll-interval", 60);
  const [historyPromptsCount, setHistoryPromptsCount] = useLocalStorage<number>("jules-history-prompts-count", 10);
  const [autoApprovalInterval, setAutoApprovalInterval] = useLocalStorage<number>("jules-auto-approval-interval", 60);
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useLocalStorage<boolean>("jules-auto-approval-enabled", false);
  const [autoRetryEnabled, setAutoRetryEnabled] = useLocalStorage<boolean>("jules-auto-retry-enabled", true);
  const [autoRetryMessage, setAutoRetryMessage] = useLocalStorage<string>("jules-auto-retry-message", "You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution");
  const [autoContinueEnabled, setAutoContinueEnabled] = useLocalStorage<boolean>("jules-auto-continue-enabled", true);
  const [autoContinueMessage, setAutoContinueMessage] = useLocalStorage<string>("jules-auto-continue-message", "Sounds good. Now go ahead finish the work");
  const [debugMode, setDebugMode] = useLocalStorage<boolean>("jules-debug-mode", false);
  const [currentProfileId, setCurrentProfileId] = useLocalStorage<string>("jules-current-profile-id", "default");

  // New Settings for Session Cache
  const [sessionCacheInProgressInterval, setSessionCacheInProgressInterval] = useLocalStorage<number>("jules-session-cache-in-progress-interval", 60);
  const [sessionCacheCompletedNoPrInterval, setSessionCacheCompletedNoPrInterval] = useLocalStorage<number>("jules-session-cache-completed-no-pr-interval", 1800);
  const [sessionCachePendingApprovalInterval, setSessionCachePendingApprovalInterval] = useLocalStorage<number>("jules-session-cache-pending-approval-interval", 300);
  const [sessionCacheMaxAgeDays, setSessionCacheMaxAgeDays] = useLocalStorage<number>("jules-session-cache-max-age-days", 3);

  const [autoDeleteStaleBranches, setAutoDeleteStaleBranches] = useLocalStorage<boolean>("jules-auto-delete-stale-branches", false);
  const [autoDeleteStaleBranchesAfterDays, setAutoDeleteStaleBranchesAfterDays] = useLocalStorage<number>("jules-auto-delete-stale-branches-after-days", 3);

  // Throttling Settings
  const [minSessionInteractionInterval, setMinSessionInteractionInterval] = useLocalStorage<number>("jules-min-session-interaction-interval", 60);
  const [retryTimeout, setRetryTimeout] = useLocalStorage<number>("jules-retry-timeout", 1200);

  const [apiKeyValue, setApiKeyValue] = useState(apiKey);
  const [githubTokenValue, setGithubTokenValue] = useState(githubToken);
  const [idlePollIntervalValue, setIdlePollIntervalValue] = useState(idlePollInterval);
  const [activePollIntervalValue, setActivePollIntervalValue] = useState(activePollInterval);
  const [titleTruncateLengthValue, setTitleTruncateLengthValue] = useState(titleTruncateLength);
  const [lineClampValue, setLineClampValue] = useState(lineClamp);
  const [sessionItemsPerPageValue, setSessionItemsPerPageValue] = useState(sessionItemsPerPage);
  const [jobsPerPageValue, setJobsPerPageValue] = useState(jobsPerPage);
  const [defaultSessionCountValue, setDefaultSessionCountValue] = useState(defaultSessionCount);
  const [prStatusPollIntervalValue, setPrStatusPollIntervalValue] = useState(prStatusPollInterval);
  const [historyPromptsCountValue, setHistoryPromptsCountValue] = useState(historyPromptsCount);
  const [autoApprovalIntervalValue, setAutoApprovalIntervalValue] = useState(autoApprovalInterval);
  const [autoApprovalEnabledValue, setAutoApprovalEnabledValue] = useState(autoApprovalEnabled);
  const [autoRetryEnabledValue, setAutoRetryEnabledValue] = useState(autoRetryEnabled);
  const [autoRetryMessageValue, setAutoRetryMessageValue] = useState(autoRetryMessage);
  const [autoContinueEnabledValue, setAutoContinueEnabledValue] = useState(autoContinueEnabled);
  const [autoContinueMessageValue, setAutoContinueMessageValue] = useState(autoContinueMessage);
  const [debugModeValue, setDebugModeValue] = useState(debugMode);

  // New Settings State
  const [sessionCacheInProgressIntervalValue, setSessionCacheInProgressIntervalValue] = useState(sessionCacheInProgressInterval);
  const [sessionCacheCompletedNoPrIntervalValue, setSessionCacheCompletedNoPrIntervalValue] = useState(sessionCacheCompletedNoPrInterval);
  const [sessionCachePendingApprovalIntervalValue, setSessionCachePendingApprovalIntervalValue] = useState(sessionCachePendingApprovalInterval);
  const [sessionCacheMaxAgeDaysValue, setSessionCacheMaxAgeDaysValue] = useState(sessionCacheMaxAgeDays);

  const [autoDeleteStaleBranchesValue, setAutoDeleteStaleBranchesValue] = useState(autoDeleteStaleBranches);
  const [autoDeleteStaleBranchesAfterDaysValue, setAutoDeleteStaleBranchesAfterDaysValue] = useState(autoDeleteStaleBranchesAfterDays);

  const [minSessionInteractionIntervalValue, setMinSessionInteractionIntervalValue] = useState(minSessionInteractionInterval);
  const [retryTimeoutValue, setRetryTimeoutValue] = useState(retryTimeout);


  const [showApiKey, setShowApiKey] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);

  // --- Messages State (from PromptsPage) ---
  const [prompts, setPrompts] = useState<PredefinedPrompt[]>([]);
  const [quickReplies, setQuickReplies] = useState<PredefinedPrompt[]>([]);
  const [globalPrompt, setGlobalPrompt] = useState<string>("");
  const [repoPrompt, setRepoPrompt] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [sources, setSources] = useLocalStorage<Source[]>("jules-sources-cache", []);

  const [isRefreshingSources, startRefreshSources] = useTransition();
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSavingMessage, startSavingMessage] = useTransition();
  const [isFetchingRepoPrompt, startFetchingRepoPrompt] = useTransition();
  const [dialogState, setDialogState] = useState<DialogState>({ isOpen: false, type: 'prompt', data: null });
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");


  // --- Effects for Settings ---
  useEffect(() => { setApiKeyValue(apiKey); }, [apiKey]);
  useEffect(() => { setGithubTokenValue(githubToken); }, [githubToken]);
  useEffect(() => { setIdlePollIntervalValue(idlePollInterval); }, [idlePollInterval]);
  useEffect(() => { setActivePollIntervalValue(activePollInterval); }, [activePollInterval]);
  useEffect(() => { setTitleTruncateLengthValue(titleTruncateLength); }, [titleTruncateLength]);
  useEffect(() => { setLineClampValue(lineClamp); }, [lineClamp]);
  useEffect(() => { setSessionItemsPerPageValue(sessionItemsPerPage); }, [sessionItemsPerPage]);
  useEffect(() => { setJobsPerPageValue(jobsPerPage); }, [jobsPerPage]);
  useEffect(() => { setDefaultSessionCountValue(defaultSessionCount); }, [defaultSessionCount]);
  useEffect(() => { setPrStatusPollIntervalValue(prStatusPollInterval); }, [prStatusPollInterval]);
  useEffect(() => { setHistoryPromptsCountValue(historyPromptsCount); }, [historyPromptsCount]);
  useEffect(() => { setAutoApprovalIntervalValue(autoApprovalInterval); }, [autoApprovalInterval]);
  useEffect(() => { setAutoApprovalEnabledValue(autoApprovalEnabled); }, [autoApprovalEnabled]);
  useEffect(() => { setAutoRetryEnabledValue(autoRetryEnabled); }, [autoRetryEnabled]);
  useEffect(() => { setAutoRetryMessageValue(autoRetryMessage); }, [autoRetryMessage]);
  useEffect(() => { setAutoContinueEnabledValue(autoContinueEnabled); }, [autoContinueEnabled]);
  useEffect(() => { setAutoContinueMessageValue(autoContinueMessage); }, [autoContinueMessage]);
  useEffect(() => { setDebugModeValue(debugMode); }, [debugMode]);

  useEffect(() => { setSessionCacheInProgressIntervalValue(sessionCacheInProgressInterval); }, [sessionCacheInProgressInterval]);
  useEffect(() => { setSessionCacheCompletedNoPrIntervalValue(sessionCacheCompletedNoPrInterval); }, [sessionCacheCompletedNoPrInterval]);
  useEffect(() => { setSessionCachePendingApprovalIntervalValue(sessionCachePendingApprovalInterval); }, [sessionCachePendingApprovalInterval]);
  useEffect(() => { setSessionCacheMaxAgeDaysValue(sessionCacheMaxAgeDays); }, [sessionCacheMaxAgeDays]);

  useEffect(() => { setAutoDeleteStaleBranchesValue(autoDeleteStaleBranches); }, [autoDeleteStaleBranches]);
  useEffect(() => { setAutoDeleteStaleBranchesAfterDaysValue(autoDeleteStaleBranchesAfterDays); }, [autoDeleteStaleBranchesAfterDays]);
  useEffect(() => { setMinSessionInteractionIntervalValue(minSessionInteractionInterval); }, [minSessionInteractionInterval]);
  useEffect(() => { setRetryTimeoutValue(retryTimeout); }, [retryTimeout]);


  useEffect(() => {
    setIsClient(true);
    const fetchSettings = async () => {
      try {
        const response = await fetch(`/api/settings?profileId=${currentProfileId}`);
        if (response.ok) {
          const dbSettings = await response.json();
          // Update state with values from DB (Source of Truth)
          // valid DB values will overwrite local storage via the hooks
          setIdlePollInterval(dbSettings.idlePollInterval);
          setActivePollInterval(dbSettings.activePollInterval);
          setTitleTruncateLength(dbSettings.titleTruncateLength);
          setLineClamp(dbSettings.lineClamp);
          setSessionItemsPerPage(dbSettings.sessionItemsPerPage);
          setJobsPerPage(dbSettings.jobsPerPage);
          setDefaultSessionCount(dbSettings.defaultSessionCount);
          setPrStatusPollInterval(dbSettings.prStatusPollInterval);
          setHistoryPromptsCount(dbSettings.historyPromptsCount);
          setAutoApprovalInterval(dbSettings.autoApprovalInterval);
          setAutoApprovalEnabled(dbSettings.autoApprovalEnabled);
          setAutoRetryEnabled(dbSettings.autoRetryEnabled);
          setAutoRetryMessage(dbSettings.autoRetryMessage);
          setAutoContinueEnabled(dbSettings.autoContinueEnabled);
          setAutoContinueMessage(dbSettings.autoContinueMessage);

          setSessionCacheInProgressInterval(dbSettings.sessionCacheInProgressInterval);
          setSessionCacheCompletedNoPrInterval(dbSettings.sessionCacheCompletedNoPrInterval);
          setSessionCachePendingApprovalInterval(dbSettings.sessionCachePendingApprovalInterval);
          setSessionCacheMaxAgeDays(dbSettings.sessionCacheMaxAgeDays);
          setAutoDeleteStaleBranches(dbSettings.autoDeleteStaleBranches);
          setAutoDeleteStaleBranchesAfterDays(dbSettings.autoDeleteStaleBranchesAfterDays);
          setMinSessionInteractionInterval(dbSettings.minSessionInteractionInterval);
          setRetryTimeout(dbSettings.retryTimeout);

          if (dbSettings.theme) {
            setTheme(dbSettings.theme);
          }
        }
      } catch (error) {
        console.error("Failed to fetch settings from DB", error);
      }
    };
    fetchSettings();
  }, [
      setIdlePollInterval, setActivePollInterval, setTitleTruncateLength, setLineClamp,
      setSessionItemsPerPage, setJobsPerPage, setDefaultSessionCount, setPrStatusPollInterval,
      setHistoryPromptsCount, setAutoApprovalInterval, setAutoApprovalEnabled, setAutoRetryEnabled, setAutoRetryMessage,
      setAutoContinueEnabled, setAutoContinueMessage,
      setSessionCacheInProgressInterval, setSessionCacheCompletedNoPrInterval, setSessionCachePendingApprovalInterval, setSessionCacheMaxAgeDays,
      setAutoDeleteStaleBranches, setAutoDeleteStaleBranchesAfterDays,
      setMinSessionInteractionInterval, setRetryTimeout,
      setTheme,
      currentProfileId // Re-fetch when profile changes
  ]);

  // --- Effects for Messages ---
  useEffect(() => {
    const fetchMessages = async () => {
        setIsLoadingMessages(true);
        const [fetchedPrompts, fetchedReplies, fetchedGlobalPrompt] = await Promise.all([
            getPredefinedPrompts(),
            getQuickReplies(),
            getGlobalPrompt()
        ]);
        setPrompts(fetchedPrompts);
        setQuickReplies(fetchedReplies);
        setGlobalPrompt(fetchedGlobalPrompt);
        setIsLoadingMessages(false);
    };
    if (isClient) fetchMessages();
  }, [isClient]);

  useEffect(() => {
    if (selectedSource) {
        startFetchingRepoPrompt(async () => {
            const repoName = `${selectedSource.githubRepo.owner}/${selectedSource.githubRepo.repo}`;
            const prompt = await getRepoPrompt(repoName);
            setRepoPrompt(prompt);
        });
    } else {
        setRepoPrompt("");
    }
  }, [selectedSource]);


  // --- Handlers for Settings ---
  const handleSaveSettings = async () => {
    setApiKey(apiKeyValue);
    setGithubToken(githubTokenValue);
    setIdlePollInterval(idlePollIntervalValue);
    setActivePollInterval(activePollIntervalValue);
    setTitleTruncateLength(titleTruncateLengthValue);
    setLineClamp(lineClampValue);
    setSessionItemsPerPage(sessionItemsPerPageValue);
    setJobsPerPage(jobsPerPageValue);
    setDefaultSessionCount(defaultSessionCountValue);
    setPrStatusPollInterval(prStatusPollIntervalValue);
    setHistoryPromptsCount(historyPromptsCountValue);
    setAutoApprovalInterval(autoApprovalIntervalValue);
    setAutoApprovalEnabled(autoApprovalEnabledValue);
    setAutoRetryEnabled(autoRetryEnabledValue);
    setAutoRetryMessage(autoRetryMessageValue);
    setAutoContinueEnabled(autoContinueEnabledValue);
    setAutoContinueMessage(autoContinueMessageValue);
    setDebugMode(debugModeValue);

    setSessionCacheInProgressInterval(sessionCacheInProgressIntervalValue);
    setSessionCacheCompletedNoPrInterval(sessionCacheCompletedNoPrIntervalValue);
    setSessionCachePendingApprovalInterval(sessionCachePendingApprovalIntervalValue);
    setSessionCacheMaxAgeDays(sessionCacheMaxAgeDaysValue);

    setAutoDeleteStaleBranches(autoDeleteStaleBranchesValue);
    setAutoDeleteStaleBranchesAfterDays(autoDeleteStaleBranchesAfterDaysValue);
    setMinSessionInteractionInterval(minSessionInteractionIntervalValue);
    setRetryTimeout(retryTimeoutValue);

    try {
        const response = await fetch('/api/settings');
        let currentTheme = 'system';
        if (response.ok) {
            const data = await response.json();
            currentTheme = data.theme;
        }

        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idlePollInterval: idlePollIntervalValue,
                activePollInterval: activePollIntervalValue,
                titleTruncateLength: titleTruncateLengthValue,
                lineClamp: lineClampValue,
                sessionItemsPerPage: sessionItemsPerPageValue,
                jobsPerPage: jobsPerPageValue,
                defaultSessionCount: defaultSessionCountValue,
                prStatusPollInterval: prStatusPollIntervalValue,
                historyPromptsCount: historyPromptsCountValue,
                autoApprovalInterval: autoApprovalIntervalValue,
                autoApprovalEnabled: autoApprovalEnabledValue,
                autoRetryEnabled: autoRetryEnabledValue,
                autoRetryMessage: autoRetryMessageValue,
                autoContinueEnabled: autoContinueEnabledValue,
                autoContinueMessage: autoContinueMessageValue,
                theme: currentTheme,

                // New Settings
                sessionCacheInProgressInterval: sessionCacheInProgressIntervalValue,
                sessionCacheCompletedNoPrInterval: sessionCacheCompletedNoPrIntervalValue,
                sessionCachePendingApprovalInterval: sessionCachePendingApprovalIntervalValue,
                sessionCacheMaxAgeDays: sessionCacheMaxAgeDaysValue,

                autoDeleteStaleBranches: autoDeleteStaleBranchesValue,
                autoDeleteStaleBranchesAfterDays: autoDeleteStaleBranchesAfterDaysValue,
                minSessionInteractionInterval: minSessionInteractionIntervalValue,
                retryTimeout: retryTimeoutValue,
                profileId: currentProfileId,
            }),
        });

        toast({
            title: "Settings Saved",
            description: "Your settings have been updated.",
        });
    } catch (error) {
        console.error("Failed to save settings to DB", error);
         toast({
            title: "Error",
            description: "Failed to save settings to database. Local storage updated.",
            variant: "destructive"
        });
    }
  };

  // --- Handlers for Messages ---
  const handleRefreshSources = () => {
    startRefreshSources(async () => {
        try {
            await refreshSources();
            const fetchedSources = await listSources(apiKey);
            setSources(fetchedSources);
             toast({
                title: "Refreshed",
                description: "The list of repositories has been updated.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to refresh repositories.",
            });
        }
    });
  };

  const openDialog = (type: 'prompt' | 'reply', data: PredefinedPrompt | null = null) => {
    setDialogState({ isOpen: true, type, data });
    setTitle(data?.title || "");
    setPromptText(data?.prompt || "");
  };

  const closeDialog = () => {
    setDialogState({ isOpen: false, type: 'prompt', data: null });
  }

  const handleDelete = (type: 'prompt' | 'reply', id: string) => {
     startSavingMessage(async () => {
        if (type === 'prompt') {
            const updatedPrompts = prompts.filter((p) => p.id !== id);
            await savePredefinedPrompts(updatedPrompts);
            setPrompts(updatedPrompts);
            toast({ title: "Message deleted" });
        } else {
            const updatedReplies = quickReplies.filter((r) => r.id !== id);
            await saveQuickReplies(updatedReplies);
            setQuickReplies(updatedReplies);
            toast({ title: "Quick Reply deleted" });
        }
     });
  };

  const handleSaveMessage = () => {
    if (!title.trim() || !promptText.trim()) {
      toast({ variant: "destructive", title: "Missing fields", description: "Both title and content are required." });
      return;
    }

    startSavingMessage(async () => {
        const { type, data } = dialogState;

        if (type === 'prompt') {
            let updatedPrompts: PredefinedPrompt[];
            if (data?.id) {
                updatedPrompts = prompts.map((p) => p.id === data.id ? { ...p, title, prompt: promptText } : p);
            } else {
                updatedPrompts = [...prompts, { id: crypto.randomUUID(), title, prompt: promptText }];
            }
            await savePredefinedPrompts(updatedPrompts);
            setPrompts(updatedPrompts);
            toast({ title: data?.id ? "Message updated" : "Message added" });
        } else {
            let updatedReplies: PredefinedPrompt[];
            if (data?.id) {
                updatedReplies = quickReplies.map((r) => r.id === data.id ? { ...r, title, prompt: promptText } : r);
            } else {
                updatedReplies = [...quickReplies, { id: crypto.randomUUID(), title, prompt: promptText }];
            }
            await saveQuickReplies(updatedReplies);
            setQuickReplies(updatedReplies);
            toast({ title: data?.id ? "Quick Reply updated" : "Quick Reply added" });
        }
        closeDialog();
    });
  };

  const handleSaveGlobalPrompt = () => {
    startSavingMessage(async () => {
        await saveGlobalPrompt(globalPrompt);
        toast({ title: "Global Prompt Saved" });
    });
  }

  const handleSaveRepoPrompt = () => {
    if (!selectedSource) return;
    startSavingMessage(async () => {
        const repoName = `${selectedSource.githubRepo.owner}/${selectedSource.githubRepo.repo}`;
        await saveRepoPrompt(repoName, repoPrompt);
         toast({ title: "Repository Prompt Saved" });
    });
  }

  const renderTable = (type: 'prompt' | 'reply') => {
    const items = type === 'prompt' ? prompts : quickReplies;
    const singular = type === 'prompt' ? 'message' : 'reply';
    const plural = type === 'prompt' ? 'messages' : 'replies';

    if (isLoadingMessages) return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
    );

    if (items.length === 0) return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
          <p className="font-semibold text-lg">No {plural} yet</p>
          <p className="text-sm">Click "Add New" to create your first {singular}.</p>
        </div>
    );

    return (
       <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Content (Excerpt)</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell className="text-muted-foreground max-w-sm truncate">{item.prompt}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isSavingMessage}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => openDialog(type, item)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(type, item.id!)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (!isClient) {
      return (
        <div className="p-8 space-y-4">
             <Skeleton className="h-10 w-48" />
             <Skeleton className="h-[400px] w-full" />
        </div>
      )
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <div className="bg-muted p-2 rounded-md border text-sm flex items-center gap-2">
            <span className="font-semibold">Current Profile:</span> 
            <code className="bg-background px-1 py-0.5 rounded border">{currentProfileId}</code>
        </div>
      </div>
      <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>API keys and debug settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="debug-mode">Debug Mode</Label>
                            <p className="text-xs text-muted-foreground">Enable detailed logging.</p>
                        </div>
                        <Switch id="debug-mode" checked={debugModeValue} onCheckedChange={setDebugModeValue} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="api-key">Jules API Key</Label>
                        <div className="relative">
                            <Input
                                id="api-key"
                                type={showApiKey ? "text" : "password"}
                                value={apiKeyValue}
                                onChange={(e) => setApiKeyValue(e.target.value)}
                                placeholder="Enter your API key"
                                className="pr-10"
                            />
                            <Button
                                type="button" variant="ghost" size="icon"
                                className="absolute inset-y-0 right-0 h-full px-3"
                                onClick={() => setShowApiKey(!showApiKey)}
                            >
                                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        {hasJulesApiKey && !apiKeyValue && (
                            <p className="text-xs text-muted-foreground">Using JULES_API_KEY environment variable.</p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="github-token">GitHub Personal Access Token</Label>
                        <div className="relative">
                            <Input
                                id="github-token"
                                type={showGithubToken ? "text" : "password"}
                                value={githubTokenValue}
                                onChange={(e) => setGithubTokenValue(e.target.value)}
                                placeholder="Enter your GitHub PAT"
                                className="pr-10"
                            />
                            <Button
                                type="button" variant="ghost" size="icon"
                                className="absolute inset-y-0 right-0 h-full px-3"
                                onClick={() => setShowGithubToken(!showGithubToken)}
                            >
                                {showGithubToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                         {hasEnvGithubToken && !githubTokenValue && (
                            <p className="text-xs text-muted-foreground">Using GITHUB_TOKEN environment variable.</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Advanced</CardTitle>
                    <CardDescription>Fine-tune polling and other internal settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid gap-2">
                        <Label htmlFor="idle-poll-interval">Idle Poll Interval (seconds)</Label>
                        <Input
                            id="idle-poll-interval"
                            type="number"
                            value={idlePollIntervalValue}
                            onChange={(e) => setIdlePollIntervalValue(Number(e.target.value))}
                            min="0"
                        />
                        <p className="text-xs text-muted-foreground">Poll interval for completed/failed sessions.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="active-poll-interval">Active Poll Interval (seconds)</Label>
                        <Input
                            id="active-poll-interval"
                            type="number"
                            value={activePollIntervalValue}
                            onChange={(e) => setActivePollIntervalValue(Number(e.target.value))}
                            min="1"
                        />
                         <p className="text-xs text-muted-foreground">Poll interval for active sessions.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="pr-status-poll-interval">PR Status Cache Refresh Interval (seconds)</Label>
                        <Input
                            id="pr-status-poll-interval"
                            type="number"
                            value={prStatusPollIntervalValue}
                            onChange={(e) => setPrStatusPollIntervalValue(Number(e.target.value))}
                            min="10"
                        />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="default-session-count">Default Session Count for New Jobs</Label>
                        <Input
                            id="default-session-count"
                            type="number"
                            value={defaultSessionCountValue}
                            onChange={(e) => setDefaultSessionCountValue(Number(e.target.value))}
                            min="1"
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSaveSettings}><Save className="w-4 h-4 mr-2"/> Save General Settings</Button>
            </div>
        </TabsContent>

        {/* Cron Jobs Tab */}
        <TabsContent value="cron" className="space-y-6">
             <CronJobsList />
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
            <Card>
              <CardHeader>
                  <div className="flex items-center gap-2">
                    <Globe className="h-6 w-6" />
                    <CardTitle>Global Prompt</CardTitle>
                  </div>
                  <CardDescription>Automatically prepended to every new job.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                    placeholder="e.g., Always follow the existing coding style..."
                    rows={5}
                    value={globalPrompt}
                    onChange={(e) => setGlobalPrompt(e.target.value)}
                    disabled={isSavingMessage || isLoadingMessages}
                />
              </CardContent>
              <CardFooter className="flex justify-end">
                 <Button onClick={handleSaveGlobalPrompt} disabled={isSavingMessage || isLoadingMessages}>Save Global Prompt</Button>
              </CardFooter>
            </Card>

             <Card>
              <CardHeader>
                  <div className="flex items-center gap-2">
                    <GitMerge className="h-6 w-6" />
                    <CardTitle>Per-Repository Prompt</CardTitle>
                  </div>
                  <CardDescription>Global prompt for a specific repository.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="space-y-4">
                    <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="repository-select">Repository</Label>
                             <SourceSelection
                                onSourceSelected={setSelectedSource}
                                disabled={isSavingMessage || isLoadingMessages}
                                selectedValue={selectedSource}
                                sources={sources}
                                onSourcesLoaded={setSources}
                             />
                        </div>
                         <Button variant="ghost" size="icon" onClick={handleRefreshSources} className="h-10 w-10 mb-[2px]" disabled={isRefreshingSources} aria-label="Refresh Repositories">
                            <RefreshCw className={cn("h-4 w-4", isRefreshingSources ? "animate-spin" : "")} />
                        </Button>
                    </div>

                    <div className="grid w-full gap-2">
                        <Label htmlFor="repo-prompt">Repository Prompt Text</Label>
                        <Textarea
                            id="repo-prompt"
                            placeholder={selectedSource ? `Enter prompt for ${selectedSource.githubRepo.owner}/${selectedSource.githubRepo.repo}...` : "Select a repository to edit its prompt"}
                            rows={5}
                            value={repoPrompt}
                            onChange={(e) => setRepoPrompt(e.target.value)}
                            disabled={isSavingMessage || isLoadingMessages || !selectedSource || isFetchingRepoPrompt}
                        />
                         {isFetchingRepoPrompt && <p className="text-xs text-muted-foreground">Loading prompt...</p>}
                    </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                 <Button onClick={handleSaveRepoPrompt} disabled={isSavingMessage || isLoadingMessages || !selectedSource || isFetchingRepoPrompt}>Save Repository Prompt</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <BookText className="h-6 w-6" />
                    <CardTitle>Predefined Messages</CardTitle>
                  </div>
                  <CardDescription>Reusable messages for new job creation.</CardDescription>
                </div>
                <Button onClick={() => openDialog('prompt')} disabled={isSavingMessage || isLoadingMessages}>
                  <Plus className="mr-2 h-4 w-4" /> Add New
                </Button>
              </CardHeader>
              <CardContent>{renderTable('prompt')}</CardContent>
            </Card>

             <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MessageSquareReply className="h-6 w-6" />
                    <CardTitle>Quick Replies</CardTitle>
                  </div>
                  <CardDescription>Reusable replies for session feedback.</CardDescription>
                </div>
                <Button onClick={() => openDialog('reply')} disabled={isSavingMessage || isLoadingMessages}>
                  <Plus className="mr-2 h-4 w-4" /> Add New
                </Button>
              </CardHeader>
              <CardContent>{renderTable('reply')}</CardContent>
            </Card>
        </TabsContent>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-6">
            <ProfilesSettings
                currentProfileId={currentProfileId}
                onProfileSelect={setCurrentProfileId}
            />
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Automation Settings</CardTitle>
                    <CardDescription>Configure automated behaviors.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-retry-enabled">Auto Retry Failed Sessions</Label>
                            <p className="text-xs text-muted-foreground">Automatically send a retry message when a session fails.</p>
                        </div>
                        <Switch id="auto-retry-enabled" checked={autoRetryEnabledValue} onCheckedChange={setAutoRetryEnabledValue} />
                    </div>
                    {autoRetryEnabledValue && (
                        <div className="grid gap-2">
                            <Label htmlFor="auto-retry-message">Auto Retry Message</Label>
                            <Textarea
                                id="auto-retry-message"
                                value={autoRetryMessageValue}
                                onChange={(e) => setAutoRetryMessageValue(e.target.value)}
                            />
                        </div>
                    )}
                     <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-continue-enabled">Auto Continue Completed Sessions</Label>
                            <p className="text-xs text-muted-foreground">Automatically send a continue message when a session completes without a PR.</p>
                        </div>
                        <Switch id="auto-continue-enabled" checked={autoContinueEnabledValue} onCheckedChange={setAutoContinueEnabledValue} />
                    </div>
                    {autoContinueEnabledValue && (
                        <div className="grid gap-2">
                            <Label htmlFor="auto-continue-message">Auto Continue Message</Label>
                            <Textarea
                                id="auto-continue-message"
                                value={autoContinueMessageValue}
                                onChange={(e) => setAutoContinueMessageValue(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="grid gap-2 pt-4 border-t">
                        <Label htmlFor="min-session-interaction">Minimum Interaction Interval (seconds)</Label>
                        <Input
                            id="min-session-interaction"
                            type="number"
                            value={minSessionInteractionIntervalValue}
                            onChange={(e) => setMinSessionInteractionIntervalValue(Number(e.target.value))}
                            min="1"
                        />
                        <p className="text-xs text-muted-foreground">Wait at least this long before sending another automated message to the same session.</p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="retry-timeout">Retry Timeout (seconds)</Label>
                         <Input
                            id="retry-timeout"
                            type="number"
                            value={retryTimeoutValue}
                            onChange={(e) => setRetryTimeoutValue(Number(e.target.value))}
                            min="60"
                        />
                        <p className="text-xs text-muted-foreground">If a session is inactive for this long, retry even without new updates.</p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="auto-approval-interval">Auto Approval Check Interval (seconds)</Label>
                        <Input
                            id="auto-approval-interval"
                            type="number"
                            value={autoApprovalIntervalValue}
                            onChange={(e) => setAutoApprovalIntervalValue(Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-approval-enabled">Auto Approval</Label>
                            <p className="text-xs text-muted-foreground">Automatically approve execution if confidence is high.</p>
                        </div>
                        <Switch id="auto-approval-enabled" checked={autoApprovalEnabledValue} onCheckedChange={setAutoApprovalEnabledValue} />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-delete-stale-branches">Auto Delete Stale Branches</Label>
                            <p className="text-xs text-muted-foreground">Automatically delete branches after their PRs are merged.</p>
                        </div>
                        <Switch id="auto-delete-stale-branches" checked={autoDeleteStaleBranchesValue} onCheckedChange={setAutoDeleteStaleBranchesValue} />
                    </div>
                    {autoDeleteStaleBranchesValue && (
                        <div className="grid gap-2">
                            <Label htmlFor="auto-delete-stale-branches-after-days">Auto Delete Stale Branches After (days)</Label>
                            <Input
                                id="auto-delete-stale-branches-after-days"
                                type="number"
                                value={autoDeleteStaleBranchesAfterDaysValue}
                                onChange={(e) => setAutoDeleteStaleBranchesAfterDaysValue(Number(e.target.value))}
                                min="1"
                            />
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveSettings}><Save className="w-4 h-4 mr-2"/> Save Automation Settings</Button>
                </CardFooter>
             </Card>
        </TabsContent>

        {/* Cache Tab (New) */}
        <TabsContent value="cache" className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Cache & Polling Settings</CardTitle>
                    <CardDescription>Configure how session status is updated.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid gap-2">
                        <Label htmlFor="cache-in-progress">In Progress Update Interval (seconds)</Label>
                        <Input
                            id="cache-in-progress"
                            type="number"
                            value={sessionCacheInProgressIntervalValue}
                            onChange={(e) => setSessionCacheInProgressIntervalValue(Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cache-pending">Pending Approval Update Interval (seconds)</Label>
                        <Input
                            id="cache-pending"
                            type="number"
                            value={sessionCachePendingApprovalIntervalValue}
                            onChange={(e) => setSessionCachePendingApprovalIntervalValue(Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cache-completed-nopr">Completed (No PR) Update Interval (seconds)</Label>
                        <Input
                            id="cache-completed-nopr"
                            type="number"
                            value={sessionCacheCompletedNoPrIntervalValue}
                            onChange={(e) => setSessionCacheCompletedNoPrIntervalValue(Number(e.target.value))}
                            min="60"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cache-max-age">Max Session Age to Update (days)</Label>
                        <Input
                            id="cache-max-age"
                            type="number"
                            value={sessionCacheMaxAgeDaysValue}
                            onChange={(e) => setSessionCacheMaxAgeDaysValue(Number(e.target.value))}
                            min="1"
                        />
                         <p className="text-xs text-muted-foreground">Sessions older than this will only update manually.</p>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveSettings}><Save className="w-4 h-4 mr-2"/> Save Cache Settings</Button>
                </CardFooter>
            </Card>
        </TabsContent>


        {/* Display Tab */}
        <TabsContent value="display" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Display Settings</CardTitle>
                    <CardDescription>Customize the interface appearance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid gap-2">
                        <Label htmlFor="jobs-per-page">Jobs Per Page</Label>
                        <Input
                            id="jobs-per-page"
                            type="number"
                            value={jobsPerPageValue}
                            onChange={(e) => setJobsPerPageValue(Number(e.target.value))}
                            min="1"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="session-items-per-page">Sessions Per Page (within a job)</Label>
                        <Input
                            id="session-items-per-page"
                            type="number"
                            value={sessionItemsPerPageValue}
                            onChange={(e) => setSessionItemsPerPageValue(Number(e.target.value))}
                            min="1"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="title-truncate-length">Session Title Truncation Length</Label>
                        <Input
                            id="title-truncate-length"
                            type="number"
                            value={titleTruncateLengthValue}
                            onChange={(e) => setTitleTruncateLengthValue(Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="line-clamp">Activity Feed Line Clamp</Label>
                        <Input
                            id="line-clamp"
                            type="number"
                            value={lineClampValue}
                            onChange={(e) => setLineClampValue(Number(e.target.value))}
                            min="1"
                            max="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="history-prompts-count">History Prompts Count</Label>
                        <Input
                            id="history-prompts-count"
                            type="number"
                            value={historyPromptsCountValue}
                            onChange={(e) => setHistoryPromptsCountValue(Number(e.target.value))}
                            min="0"
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveSettings}><Save className="w-4 h-4 mr-2"/> Save Display Settings</Button>
                </CardFooter>
            </Card>
        </TabsContent>


      </Tabs>

      {/* Dialogs for Messages */}
      <Dialog open={dialogState.isOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {dialogState.data ? "Edit" : "Add New"} {dialogState.type === 'prompt' ? 'Message' : 'Quick Reply'}
            </DialogTitle>
            <DialogDescription>
               Create a new reusable {dialogState.type === 'prompt' ? 'message for faster job creation.' : 'reply for session feedback.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-3"
                placeholder="A short, descriptive title"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="prompt-text" className="text-right pt-2">Content</Label>
              <Textarea
                id="prompt-text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="col-span-3"
                rows={6}
                placeholder="Enter the full text here..."
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSavingMessage}>Cancel</Button></DialogClose>
            <Button onClick={handleSaveMessage} disabled={isSavingMessage}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
