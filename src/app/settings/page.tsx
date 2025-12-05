
"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Save, Globe, GitMerge, BookText, MessageSquareReply, Plus, Edit, Trash2, MoreHorizontal, RefreshCw, UserCircle, Check } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";
import { useEnv } from "@/components/env-provider";
import { useProfile } from "@/components/profile-provider";
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
import { listSources, refreshSources } from "@/app/sessions/actions";
import { cn } from "@/lib/utils";
import type { PredefinedPrompt, Source } from "@/lib/types";

type DialogState = {
  isOpen: boolean;
  type: 'prompt' | 'reply';
  data: PredefinedPrompt | null;
}

export default function SettingsPage() {
  const { julesApiKey, githubToken: envGithubToken } = useEnv();
  const { toast } = useToast();
  const { currentProfileId, setCurrentProfileId, profiles, refreshProfiles, isLoading: isProfileLoading } = useProfile();
  const [isClient, setIsClient] = useState(false);

  // --- Settings State ---
  // Note: We're not using useLocalStorage for values anymore as we fetch from DB based on profile
  // But for better UX we might still want local state for the form
  const [apiKey, setApiKey] = useState("");
  const [githubToken, setGithubToken] = useState("");

  const [idlePollInterval, setIdlePollInterval] = useState(120);
  const [activePollInterval, setActivePollInterval] = useState(30);
  const [titleTruncateLength, setTitleTruncateLength] = useState(50);
  const [lineClamp, setLineClamp] = useState(1);
  const [sessionItemsPerPage, setSessionItemsPerPage] = useState(10);
  const [jobsPerPage, setJobsPerPage] = useState(5);
  const [defaultSessionCount, setDefaultSessionCount] = useState(10);
  const [prStatusPollInterval, setPrStatusPollInterval] = useState(60);
  const [historyPromptsCount, setHistoryPromptsCount] = useState(10);
  const [autoApprovalInterval, setAutoApprovalInterval] = useState(60);
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true);
  const [autoRetryMessage, setAutoRetryMessage] = useState("You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution");
  const [autoContinueEnabled, setAutoContinueEnabled] = useState(true);
  const [autoContinueMessage, setAutoContinueMessage] = useState("Sounds good. Now go ahead finish the work");
  const [debugMode, setDebugMode] = useState(false);

  // New Settings for Session Cache
  const [sessionCacheInProgressInterval, setSessionCacheInProgressInterval] = useState(60);
  const [sessionCacheCompletedNoPrInterval, setSessionCacheCompletedNoPrInterval] = useState(1800);
  const [sessionCachePendingApprovalInterval, setSessionCachePendingApprovalInterval] = useState(300);
  const [sessionCacheMaxAgeDays, setSessionCacheMaxAgeDays] = useState(3);

  const [autoDeleteStaleBranches, setAutoDeleteStaleBranches] = useState(false);
  const [autoDeleteStaleBranchesAfterDays, setAutoDeleteStaleBranchesAfterDays] = useState(3);

  const [showApiKey, setShowApiKey] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);

  const isJulesKeyFromEnv = !!julesApiKey;
  const isGithubTokenFromEnv = !!envGithubToken;

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

  // Profile Management State
  const [newProfileName, setNewProfileName] = useState("");
  const [isCreatingProfile, startCreatingProfile] = useTransition();
  const [isDeletingProfile, startDeletingProfile] = useTransition();
  const [renamingProfileId, setRenamingProfileId] = useState<string | null>(null);
  const [renamingProfileName, setRenamingProfileName] = useState("");


  // --- Effects for Settings ---
  useEffect(() => {
    setIsClient(true);
    const fetchSettings = async () => {
      if (!currentProfileId) return;

      try {
        const response = await fetch(`/api/settings?profileId=${currentProfileId}`);
        if (response.ok) {
          const dbSettings = await response.json();
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
          setAutoRetryEnabled(dbSettings.autoRetryEnabled);
          setAutoRetryMessage(dbSettings.autoRetryMessage);
          setAutoContinueEnabled(dbSettings.autoContinueEnabled);
          setAutoContinueMessage(dbSettings.autoContinueMessage);
          // Assuming API Key and Github Token are stored locally per profile?
          // Or we can store them in DB if encrypted?
          // For now let's use localStorage but keyed by profileId.
          const storedApiKey = window.localStorage.getItem(`jules-api-key-${currentProfileId}`);
          const storedGithubToken = window.localStorage.getItem(`jules-github-token-${currentProfileId}`);
          setApiKey(storedApiKey || "");
          setGithubToken(storedGithubToken || "");

          setSessionCacheInProgressInterval(dbSettings.sessionCacheInProgressInterval);
          setSessionCacheCompletedNoPrInterval(dbSettings.sessionCacheCompletedNoPrInterval);
          setSessionCachePendingApprovalInterval(dbSettings.sessionCachePendingApprovalInterval);
          setSessionCacheMaxAgeDays(dbSettings.sessionCacheMaxAgeDays);
          setAutoDeleteStaleBranches(dbSettings.autoDeleteStaleBranches);
          setAutoDeleteStaleBranchesAfterDays(dbSettings.autoDeleteStaleBranchesAfterDays);
        }
      } catch (error) {
        console.error("Failed to fetch settings from DB", error);
      }
    };
    fetchSettings();
  }, [currentProfileId]);

  // --- Effects for Messages ---
  useEffect(() => {
    const fetchMessages = async () => {
        if (!currentProfileId) return;
        setIsLoadingMessages(true);
        // Need to update these actions to accept profileId
        // Currently they read from DB directly assuming default or something.
        // I need to update actions.ts to accept profileId.
        // Wait, actions.ts are server actions? Or just fetch wrappers?
        // They are defined in src/app/config/actions.ts and use 'use server' presumably or API calls.
        // Let's assume for now I need to fix them later or pass profileId context.
        // For now, let's just use what we have, but be aware they might be fetching default profile data
        // until I update them.

        // Actually, since I'm modifying UI first, I'll update actions later.
        // But to make it work, I should probably update actions.ts too.

        // Let's skip updating actions for now in this plan step and focus on UI structure.
        // The previous plan said "Update other App Components" later.

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
    if (isClient && currentProfileId) fetchMessages();
  }, [isClient, currentProfileId]);

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
    if (!currentProfileId) return;

    // Save sensitive data to localStorage keyed by profile
    window.localStorage.setItem(`jules-api-key-${currentProfileId}`, apiKey);
    window.localStorage.setItem(`jules-github-token-${currentProfileId}`, githubToken);

    try {
        const response = await fetch(`/api/settings?profileId=${currentProfileId}`);
        let currentTheme = 'system';
        if (response.ok) {
            const data = await response.json();
            currentTheme = data.theme;
        }

        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profileId: currentProfileId,
                idlePollInterval,
                activePollInterval,
                titleTruncateLength,
                lineClamp,
                sessionItemsPerPage,
                jobsPerPage,
                defaultSessionCount,
                prStatusPollInterval,
                historyPromptsCount,
                autoApprovalInterval,
                autoRetryEnabled,
                autoRetryMessage,
                autoContinueEnabled,
                autoContinueMessage,
                theme: currentTheme,

                // New Settings
                sessionCacheInProgressInterval,
                sessionCacheCompletedNoPrInterval,
                sessionCachePendingApprovalInterval,
                sessionCacheMaxAgeDays,

                autoDeleteStaleBranches,
                autoDeleteStaleBranchesAfterDays,
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
            description: "Failed to save settings to database.",
            variant: "destructive"
        });
    }
  };

  // --- Profile Handlers ---
  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return;
    startCreatingProfile(async () => {
        try {
            const res = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProfileName }),
            });
            if (res.ok) {
                await refreshProfiles();
                setNewProfileName("");
                toast({ title: "Profile created" });
            } else {
                throw new Error("Failed to create profile");
            }
        } catch (e) {
            toast({ title: "Error creating profile", variant: "destructive" });
        }
    });
  };

  const handleDeleteProfile = (id: string) => {
      if (profiles.length <= 1) {
          toast({ title: "Cannot delete the last profile", variant: "destructive" });
          return;
      }
      if (id === currentProfileId) {
          toast({ title: "Cannot delete the active profile. Switch to another profile first.", variant: "destructive" });
          return;
      }

      startDeletingProfile(async () => {
        try {
            const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
            if (res.ok) {
                await refreshProfiles();
                toast({ title: "Profile deleted" });
            } else {
                 const err = await res.json();
                 toast({ title: err.error || "Failed to delete profile", variant: "destructive" });
            }
        } catch (e) {
             toast({ title: "Error deleting profile", variant: "destructive" });
        }
      });
  };

  const handleRenameProfile = async (id: string) => {
      try {
          const res = await fetch(`/api/profiles/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: renamingProfileName }),
          });
          if (res.ok) {
              await refreshProfiles();
              setRenamingProfileId(null);
              setRenamingProfileName("");
              toast({ title: "Profile renamed" });
          } else {
              throw new Error("Failed to rename profile");
          }
      } catch (e) {
          toast({ title: "Error renaming profile", variant: "destructive" });
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

  if (!isClient || isProfileLoading) {
      return (
        <div className="p-8 space-y-4">
             <Skeleton className="h-10 w-48" />
             <Skeleton className="h-[400px] w-full" />
        </div>
      )
  }

  const currentProfileName = profiles.find(p => p.id === currentProfileId)?.name || "Unknown Profile";

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Settings</h1>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <UserCircle className="h-4 w-4" />
              <span>Current Profile: <span className="font-medium text-foreground">{currentProfileName}</span></span>
          </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
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
                        <Switch id="debug-mode" checked={debugMode} onCheckedChange={setDebugMode} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="api-key">Jules API Key</Label>
                        <div className="relative">
                            <Input
                                id="api-key"
                                type={showApiKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
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
                        {isJulesKeyFromEnv && !apiKey && (
                            <p className="text-xs text-muted-foreground">Using JULES_API_KEY environment variable.</p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="github-token">GitHub Personal Access Token</Label>
                        <div className="relative">
                            <Input
                                id="github-token"
                                type={showGithubToken ? "text" : "password"}
                                value={githubToken}
                                onChange={(e) => setGithubToken(e.target.value)}
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
                         {isGithubTokenFromEnv && !githubToken && (
                            <p className="text-xs text-muted-foreground">Using GITHUB_TOKEN environment variable.</p>
                        )}
                    </div>

                    {/* Merged Configuration Tab Content */}
                     <div className="grid gap-2 pt-4 border-t">
                        <Label className="text-base font-semibold">Advanced Configuration</Label>
                    </div>

                     <div className="grid gap-2">
                        <Label htmlFor="idle-poll-interval">Idle Poll Interval (seconds)</Label>
                        <Input
                            id="idle-poll-interval"
                            type="number"
                            value={idlePollInterval}
                            onChange={(e) => setIdlePollInterval(Number(e.target.value))}
                            min="0"
                        />
                        <p className="text-xs text-muted-foreground">Poll interval for completed/failed sessions.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="active-poll-interval">Active Poll Interval (seconds)</Label>
                        <Input
                            id="active-poll-interval"
                            type="number"
                            value={activePollInterval}
                            onChange={(e) => setActivePollInterval(Number(e.target.value))}
                            min="1"
                        />
                         <p className="text-xs text-muted-foreground">Poll interval for active sessions.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="pr-status-poll-interval">PR Status Cache Refresh Interval (seconds)</Label>
                        <Input
                            id="pr-status-poll-interval"
                            type="number"
                            value={prStatusPollInterval}
                            onChange={(e) => setPrStatusPollInterval(Number(e.target.value))}
                            min="10"
                        />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="default-session-count">Default Session Count for New Jobs</Label>
                        <Input
                            id="default-session-count"
                            type="number"
                            value={defaultSessionCount}
                            onChange={(e) => setDefaultSessionCount(Number(e.target.value))}
                            min="1"
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveSettings}><Save className="w-4 h-4 mr-2"/> Save General Settings</Button>
                </CardFooter>
            </Card>
        </TabsContent>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Profiles</CardTitle>
                    <CardDescription>Manage your settings profiles.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="flex items-center gap-4">
                        <Input
                            placeholder="New profile name"
                            value={newProfileName}
                            onChange={(e) => setNewProfileName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
                        />
                        <Button onClick={handleCreateProfile} disabled={isCreatingProfile || !newProfileName.trim()}>
                            <Plus className="w-4 h-4 mr-2" /> Create Profile
                        </Button>
                     </div>
                     <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Profile Name</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead className="w-[100px] text-center">Active</TableHead>
                                    <TableHead className="w-[150px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {profiles.map((profile) => (
                                    <TableRow key={profile.id}>
                                        <TableCell>
                                            {renamingProfileId === profile.id ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        value={renamingProfileName}
                                                        onChange={(e) => setRenamingProfileName(e.target.value)}
                                                        className="h-8"
                                                        autoFocus
                                                    />
                                                    <Button size="sm" onClick={() => handleRenameProfile(profile.id)}>Save</Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setRenamingProfileId(null)}>Cancel</Button>
                                                </div>
                                            ) : (
                                                <span className="font-medium">{profile.name}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {new Date(profile.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {currentProfileId === profile.id && (
                                                <Check className="w-5 h-5 text-green-500 mx-auto" />
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {currentProfileId !== profile.id && (
                                                    <Button size="sm" variant="secondary" onClick={() => setCurrentProfileId(profile.id)}>
                                                        Select
                                                    </Button>
                                                )}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => {
                                                            setRenamingProfileId(profile.id);
                                                            setRenamingProfileName(profile.name);
                                                        }}>
                                                            <Edit className="mr-2 h-4 w-4" /> Rename
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleDeleteProfile(profile.id)}
                                                            className="text-destructive"
                                                            disabled={currentProfileId === profile.id || profiles.length <= 1}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                     </div>
                </CardContent>
            </Card>
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
                        <Switch id="auto-retry-enabled" checked={autoRetryEnabled} onCheckedChange={setAutoRetryEnabled} />
                    </div>
                    {autoRetryEnabled && (
                        <div className="grid gap-2">
                            <Label htmlFor="auto-retry-message">Auto Retry Message</Label>
                            <Textarea
                                id="auto-retry-message"
                                value={autoRetryMessage}
                                onChange={(e) => setAutoRetryMessage(e.target.value)}
                            />
                        </div>
                    )}
                     <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-continue-enabled">Auto Continue Completed Sessions</Label>
                            <p className="text-xs text-muted-foreground">Automatically send a continue message when a session completes without a PR.</p>
                        </div>
                        <Switch id="auto-continue-enabled" checked={autoContinueEnabled} onCheckedChange={setAutoContinueEnabled} />
                    </div>
                    {autoContinueEnabled && (
                        <div className="grid gap-2">
                            <Label htmlFor="auto-continue-message">Auto Continue Message</Label>
                            <Textarea
                                id="auto-continue-message"
                                value={autoContinueMessage}
                                onChange={(e) => setAutoContinueMessage(e.target.value)}
                            />
                        </div>
                    )}
                    <div className="grid gap-2">
                        <Label htmlFor="auto-approval-interval">Auto Approval Check Interval (seconds)</Label>
                        <Input
                            id="auto-approval-interval"
                            type="number"
                            value={autoApprovalInterval}
                            onChange={(e) => setAutoApprovalInterval(Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-delete-stale-branches">Auto Delete Stale Branches</Label>
                            <p className="text-xs text-muted-foreground">Automatically delete branches after their PRs are merged.</p>
                        </div>
                        <Switch id="auto-delete-stale-branches" checked={autoDeleteStaleBranches} onCheckedChange={setAutoDeleteStaleBranches} />
                    </div>
                    {autoDeleteStaleBranches && (
                        <div className="grid gap-2">
                            <Label htmlFor="auto-delete-stale-branches-after-days">Auto Delete Stale Branches After (days)</Label>
                            <Input
                                id="auto-delete-stale-branches-after-days"
                                type="number"
                                value={autoDeleteStaleBranchesAfterDays}
                                onChange={(e) => setAutoDeleteStaleBranchesAfterDays(Number(e.target.value))}
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
                            value={sessionCacheInProgressInterval}
                            onChange={(e) => setSessionCacheInProgressInterval(Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cache-pending">Pending Approval Update Interval (seconds)</Label>
                        <Input
                            id="cache-pending"
                            type="number"
                            value={sessionCachePendingApprovalInterval}
                            onChange={(e) => setSessionCachePendingApprovalInterval(Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cache-completed-nopr">Completed (No PR) Update Interval (seconds)</Label>
                        <Input
                            id="cache-completed-nopr"
                            type="number"
                            value={sessionCacheCompletedNoPrInterval}
                            onChange={(e) => setSessionCacheCompletedNoPrInterval(Number(e.target.value))}
                            min="60"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cache-max-age">Max Session Age to Update (days)</Label>
                        <Input
                            id="cache-max-age"
                            type="number"
                            value={sessionCacheMaxAgeDays}
                            onChange={(e) => setSessionCacheMaxAgeDays(Number(e.target.value))}
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
                            value={jobsPerPage}
                            onChange={(e) => setJobsPerPage(Number(e.target.value))}
                            min="1"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="session-items-per-page">Sessions Per Page (within a job)</Label>
                        <Input
                            id="session-items-per-page"
                            type="number"
                            value={sessionItemsPerPage}
                            onChange={(e) => setSessionItemsPerPage(Number(e.target.value))}
                            min="1"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="title-truncate-length">Session Title Truncation Length</Label>
                        <Input
                            id="title-truncate-length"
                            type="number"
                            value={titleTruncateLength}
                            onChange={(e) => setTitleTruncateLength(Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="line-clamp">Activity Feed Line Clamp</Label>
                        <Input
                            id="line-clamp"
                            type="number"
                            value={lineClamp}
                            onChange={(e) => setLineClamp(Number(e.target.value))}
                            min="1"
                            max="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="history-prompts-count">History Prompts Count</Label>
                        <Input
                            id="history-prompts-count"
                            type="number"
                            value={historyPromptsCount}
                            onChange={(e) => setHistoryPromptsCount(Number(e.target.value))}
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
