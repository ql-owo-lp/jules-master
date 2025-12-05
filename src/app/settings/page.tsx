
"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Save, Globe, GitMerge, BookText, MessageSquareReply, Plus, Edit, Trash2, MoreHorizontal, RefreshCw, User, Check } from "lucide-react";
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
    DropdownMenuSeparator,
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
  type: 'prompt' | 'reply' | 'profile';
  data: any;
}

export default function SettingsPage() {
  const { julesApiKey: envApiKey, githubToken: envGithubToken } = useEnv();
  const { toast } = useToast();
  const { currentProfile, currentProfileId, setCurrentProfileId, profiles, refreshProfiles, isLoading: isProfilesLoading } = useProfile();
  const [isClient, setIsClient] = useState(false);

  // --- Settings State ---
  // We initialize state with defaults, but will populate from currentProfile
  const [apiKey, setApiKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [profileName, setProfileName] = useState("");

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

  // Profile Dialog State
  const [newProfileName, setNewProfileName] = useState("");


  // --- Load Settings from Current Profile ---
  useEffect(() => {
    if (currentProfile) {
        setProfileName(currentProfile.name || "Default");
        setApiKey(currentProfile.julesApiKey || "");
        setGithubToken(currentProfile.githubToken || "");

        setIdlePollInterval(currentProfile.idlePollInterval);
        setActivePollInterval(currentProfile.activePollInterval);
        setTitleTruncateLength(currentProfile.titleTruncateLength);
        setLineClamp(currentProfile.lineClamp);
        setSessionItemsPerPage(currentProfile.sessionItemsPerPage);
        setJobsPerPage(currentProfile.jobsPerPage);
        setDefaultSessionCount(currentProfile.defaultSessionCount);
        setPrStatusPollInterval(currentProfile.prStatusPollInterval);
        setHistoryPromptsCount(currentProfile.historyPromptsCount);
        setAutoApprovalInterval(currentProfile.autoApprovalInterval);
        setAutoRetryEnabled(currentProfile.autoRetryEnabled);
        setAutoRetryMessage(currentProfile.autoRetryMessage);
        setAutoContinueEnabled(currentProfile.autoContinueEnabled);
        setAutoContinueMessage(currentProfile.autoContinueMessage);

        setSessionCacheInProgressInterval(currentProfile.sessionCacheInProgressInterval);
        setSessionCacheCompletedNoPrInterval(currentProfile.sessionCacheCompletedNoPrInterval);
        setSessionCachePendingApprovalInterval(currentProfile.sessionCachePendingApprovalInterval);
        setSessionCacheMaxAgeDays(currentProfile.sessionCacheMaxAgeDays);

        setAutoDeleteStaleBranches(currentProfile.autoDeleteStaleBranches);
        setAutoDeleteStaleBranchesAfterDays(currentProfile.autoDeleteStaleBranchesAfterDays);
    }
  }, [currentProfile]);


  // --- Effects for Messages ---
  useEffect(() => {
    setIsClient(true);
    const fetchMessages = async () => {
        setIsLoadingMessages(true);
        try {
            const [fetchedPrompts, fetchedReplies, fetchedGlobalPrompt] = await Promise.all([
                getPredefinedPrompts(),
                getQuickReplies(),
                getGlobalPrompt()
            ]);
            setPrompts(fetchedPrompts);
            setQuickReplies(fetchedReplies);
            setGlobalPrompt(fetchedGlobalPrompt);
        } catch(e) {
            console.error("Failed to fetch messages", e);
        } finally {
            setIsLoadingMessages(false);
        }
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
    if (!currentProfileId) return;

    try {
        const response = await fetch(`/api/profiles/${currentProfileId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: profileName,
                julesApiKey: apiKey,
                githubToken: githubToken,

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

                sessionCacheInProgressInterval,
                sessionCacheCompletedNoPrInterval,
                sessionCachePendingApprovalInterval,
                sessionCacheMaxAgeDays,

                autoDeleteStaleBranches,
                autoDeleteStaleBranchesAfterDays,
            }),
        });

        if (response.ok) {
            await refreshProfiles();
            toast({
                title: "Settings Saved",
                description: "Your settings have been updated.",
            });
        } else {
            throw new Error("Failed to save settings");
        }

    } catch (error) {
        console.error("Failed to save settings to DB", error);
         toast({
            title: "Error",
            description: "Failed to save settings.",
            variant: "destructive"
        });
    }
  };

  // --- Handlers for Profiles ---
  const handleCreateProfile = async () => {
      if (!newProfileName.trim()) {
           toast({ title: "Profile name required", variant: "destructive" });
           return;
      }
      try {
          // Clone current settings or use defaults?
          // For now, let's create with defaults (or clone current if we implement clone logic)
          // The API will create with defaults if we don't provide all fields, or we can spread currentProfile
          const newProfileData = {
              ...currentProfile,
              id: undefined, // remove ID to create new
              createdAt: undefined,
              name: newProfileName,
          };

          const res = await fetch("/api/profiles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newProfileData)
          });

          if (res.ok) {
              await refreshProfiles();
              const newProfile = await res.json();
              setCurrentProfileId(newProfile.id);
              toast({ title: "Profile created" });
              closeDialog();
          } else {
              throw new Error("Failed to create profile");
          }
      } catch (error) {
          toast({ title: "Error creating profile", variant: "destructive" });
      }
  };

  const handleDeleteProfile = async (id: string) => {
      if (profiles.length <= 1) {
          toast({ title: "Cannot delete the last profile", variant: "destructive" });
          return;
      }
      try {
          const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
          if (res.ok) {
               await refreshProfiles();
               if (currentProfileId === id) {
                   // Switch to another profile
                   const remaining = profiles.filter(p => p.id !== id);
                   if (remaining.length > 0) setCurrentProfileId(remaining[0].id);
               }
               toast({ title: "Profile deleted" });
          } else {
               throw new Error("Failed to delete profile");
          }
      } catch (error) {
          toast({ title: "Error deleting profile", variant: "destructive" });
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

  const openDialog = (type: 'prompt' | 'reply' | 'profile', data: any = null) => {
    setDialogState({ isOpen: true, type, data });
    if (type === 'profile') {
        setNewProfileName("");
    } else {
        setTitle(data?.title || "");
        setPromptText(data?.prompt || "");
    }
  };

  const closeDialog = () => {
    setDialogState({ isOpen: false, type: 'prompt', data: null });
  }

  const handleDeleteMessage = (type: 'prompt' | 'reply', id: string) => {
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
        } else if (type === 'reply') {
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
                      <DropdownMenuItem onClick={() => handleDeleteMessage(type, item.id!)} className="text-destructive">
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

  if (!isClient || isProfilesLoading) {
      return (
        <div className="p-8 space-y-4">
             <Skeleton className="h-10 w-48" />
             <Skeleton className="h-[400px] w-full" />
        </div>
      )
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Settings</h1>

          {/* Profile Switcher */}
          <div className="flex items-center gap-2">
            <Label className="text-muted-foreground">Profile:</Label>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-between">
                        <div className="flex items-center gap-2 truncate">
                            <User className="h-4 w-4" />
                            <span className="truncate">{currentProfile?.name || "Select Profile"}</span>
                        </div>
                         <MoreHorizontal className="h-4 w-4 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[200px]" align="end">
                    {profiles.map(p => (
                         <DropdownMenuItem key={p.id} onClick={() => setCurrentProfileId(p.id)} className="justify-between">
                             <span className="truncate">{p.name}</span>
                             {p.id === currentProfileId && <Check className="h-4 w-4 ml-2" />}
                         </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openDialog('profile')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={profiles.length <= 1}
                        onClick={() => currentProfileId && handleDeleteProfile(currentProfileId)}
                        className="text-destructive focus:text-destructive"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Current Profile
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
          {/* Merged Config into General, but kept Display separate for now, or merge? User asked to merge "configuration" to "general" */}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>Profile details and API keys.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid gap-2">
                        <Label htmlFor="profile-name">Profile Name</Label>
                        <Input
                            id="profile-name"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            placeholder="e.g. Work, Personal"
                        />
                    </div>

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
                        {!apiKey && envApiKey && (
                            <p className="text-xs text-muted-foreground">Using JULES_API_KEY environment variable if not set here.</p>
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
                         {!githubToken && envGithubToken && (
                            <p className="text-xs text-muted-foreground">Using GITHUB_TOKEN environment variable if not set here.</p>
                        )}
                    </div>

                    {/* Merged Configuration items */}
                    <div className="pt-4 border-t">
                        <h3 className="text-lg font-medium mb-4">Advanced Configuration</h3>
                        <div className="space-y-4">
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
                        </div>
                    </div>

                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveSettings}><Save className="w-4 h-4 mr-2"/> Save General Settings</Button>
                </CardFooter>
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

      {/* Dialogs for Messages & Profiles */}
      <Dialog open={dialogState.isOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
                {dialogState.type === 'profile'
                    ? "Create New Profile"
                    : `${dialogState.data ? "Edit" : "Add New"} ${dialogState.type === 'prompt' ? 'Message' : 'Quick Reply'}`
                }
            </DialogTitle>
            <DialogDescription>
               {dialogState.type === 'profile'
                   ? "Create a new profile to manage separate settings and credentials."
                   : `Create a new reusable ${dialogState.type === 'prompt' ? 'message for faster job creation.' : 'reply for session feedback.'}`
               }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {dialogState.type === 'profile' ? (
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="new-profile-name" className="text-right">Name</Label>
                  <Input
                    id="new-profile-name"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="col-span-3"
                    placeholder="Profile Name"
                  />
                </div>
            ) : (
                <>
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
                </>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSavingMessage}>Cancel</Button></DialogClose>
            {dialogState.type === 'profile' ? (
                 <Button onClick={handleCreateProfile}>Create</Button>
            ) : (
                 <Button onClick={handleSaveMessage} disabled={isSavingMessage}>Save</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
