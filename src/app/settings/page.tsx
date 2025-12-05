
"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Save, Globe, GitMerge, BookText, MessageSquareReply, Plus, Edit, Trash2, MoreHorizontal, RefreshCw } from "lucide-react";
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
    saveRepoPrompt,
    getProfiles,
    saveProfile,
    deleteProfile,
} from "@/app/config/actions";
import { SourceSelection } from "@/components/source-selection";
import { CronJobsList } from "@/components/cron-jobs-list";
import { listSources, refreshSources } from "@/app/sessions/actions";
import { cn } from "@/lib/utils";
import type { PredefinedPrompt, Source, Profile } from "@/lib/types";

type DialogState = {
  isOpen: boolean;
  type: 'prompt' | 'reply' | 'profile';
  data: PredefinedPrompt | Profile | null;
}

export default function SettingsPage() {
  const { julesApiKey, githubToken: envGithubToken } = useEnv();
  const { toast } = useToast();
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
  const { activeProfileSettings } = useEnv();
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [githubTokenValue, setGithubTokenValue] = useState("");
  const [idlePollIntervalValue, setIdlePollIntervalValue] = useState(120);
  const [activePollIntervalValue, setActivePollIntervalValue] = useState(30);
  const [titleTruncateLengthValue, setTitleTruncateLengthValue] = useState(50);
  const [lineClampValue, setLineClampValue] = useState(1);
  const [sessionItemsPerPageValue, setSessionItemsPerPageValue] = useState(10);
  const [jobsPerPageValue, setJobsPerPageValue] = useState(5);
  const [defaultSessionCountValue, setDefaultSessionCountValue] = useState(10);
  const [prStatusPollIntervalValue, setPrStatusPollIntervalValue] = useState(60);
  const [historyPromptsCountValue, setHistoryPromptsCountValue] = useState(10);
  const [autoApprovalIntervalValue, setAutoApprovalIntervalValue] = useState(60);
  const [autoRetryEnabledValue, setAutoRetryEnabledValue] = useState(true);
  const [autoRetryMessageValue, setAutoRetryMessageValue] = useState("You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution");
  const [autoContinueEnabledValue, setAutoContinueEnabledValue] = useState(true);
  const [autoContinueMessageValue, setAutoContinueMessageValue] = useState("Sounds good. Now go ahead finish the work");
  const [debugModeValue, setDebugModeValue] = useState(false);

  // New Settings State
  const [sessionCacheInProgressIntervalValue, setSessionCacheInProgressIntervalValue] = useState(60);
  const [sessionCacheCompletedNoPrIntervalValue, setSessionCacheCompletedNoPrIntervalValue] = useState(1800);
  const [sessionCachePendingApprovalIntervalValue, setSessionCachePendingApprovalIntervalValue] = useState(300);
  const [sessionCacheMaxAgeDaysValue, setSessionCacheMaxAgeDaysValue] = useState(3);

  const [autoDeleteStaleBranchesValue, setAutoDeleteStaleBranchesValue] = useState(false);
  const [autoDeleteStaleBranchesAfterDaysValue, setAutoDeleteStaleBranchesAfterDaysValue] = useState(3);


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
  const [sources, setSources] = useState<Source[]>([]);

  const [isRefreshingSources, startRefreshSources] = useTransition();
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSavingMessage, startSavingMessage] = useTransition();
  const [isFetchingRepoPrompt, startFetchingRepoPrompt] = useTransition();
  const [dialogState, setDialogState] = useState<DialogState>({ isOpen: false, type: 'prompt', data: null });
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");

  // --- Profiles State ---
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [isSavingProfile, startSavingProfile] = useTransition();
  const [profileName, setProfileName] = useState("");

  // --- Effects for Profiles ---
  useEffect(() => {
    const fetchProfiles = async () => {
      const fetchedProfiles = await getProfiles();
      setProfiles(fetchedProfiles);
      setIsLoadingProfiles(false);
    };
    if (isClient) fetchProfiles();
  }, [isClient]);

  const openProfileDialog = (data: Profile | null = null) => {
    setDialogState({ isOpen: true, type: 'profile', data });
    setProfileName(data?.name || "");
  };


  // --- Effects for Settings ---
  useEffect(() => {
    if (activeProfileSettings) {
      setApiKeyValue(activeProfileSettings.julesApiKey || "");
      setGithubTokenValue(activeProfileSettings.githubToken || "");
      setIdlePollIntervalValue(activeProfileSettings.idlePollInterval || 120);
      setActivePollIntervalValue(activeProfileSettings.activePollInterval || 30);
      setTitleTruncateLengthValue(activeProfileSettings.titleTruncateLength || 50);
      setLineClampValue(activeProfileSettings.lineClamp || 1);
      setSessionItemsPerPageValue(activeProfileSettings.sessionItemsPerPage || 10);
      setJobsPerPageValue(activeProfileSettings.jobsPerPage || 5);
      setDefaultSessionCountValue(activeProfileSettings.defaultSessionCount || 10);
      setPrStatusPollIntervalValue(activeProfileSettings.prStatusPollInterval || 60);
      setHistoryPromptsCountValue(activeProfileSettings.historyPromptsCount || 10);
      setAutoApprovalIntervalValue(activeProfileSettings.autoApprovalInterval || 60);
      setAutoRetryEnabledValue(activeProfileSettings.autoRetryEnabled || true);
      setAutoRetryMessageValue(activeProfileSettings.autoRetryMessage || "You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution");
      setAutoContinueEnabledValue(activeProfileSettings.autoContinueEnabled || true);
      setAutoContinueMessageValue(activeProfileSettings.autoContinueMessage || "Sounds good. Now go ahead finish the work");
      setDebugModeValue(activeProfileSettings.debugMode || false);
      setSessionCacheInProgressIntervalValue(activeProfileSettings.sessionCacheInProgressInterval || 60);
      setSessionCacheCompletedNoPrIntervalValue(activeProfileSettings.sessionCacheCompletedNoPrInterval || 1800);
      setSessionCachePendingApprovalIntervalValue(activeProfileSettings.sessionCachePendingApprovalInterval || 300);
      setSessionCacheMaxAgeDaysValue(activeProfileSettings.sessionCacheMaxAgeDays || 3);
      setAutoDeleteStaleBranchesValue(activeProfileSettings.autoDeleteStaleBranches || false);
      setAutoDeleteStaleBranchesAfterDaysValue(activeProfileSettings.autoDeleteStaleBranchesAfterDays || 3);
    }
  }, [activeProfileSettings]);

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
    startSavingProfile(async () => {
      const activeProfile = profiles.find(p => p.isActive);
      if (activeProfile) {
        const updatedSettings = {
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
          autoRetryEnabled: autoRetryEnabledValue,
          autoRetryMessage: autoRetryMessageValue,
          autoContinueEnabled: autoContinueEnabledValue,
          autoContinueMessage: autoContinueMessageValue,
          sessionCacheInProgressInterval: sessionCacheInProgressIntervalValue,
          sessionCacheCompletedNoPrInterval: sessionCacheCompletedNoPrIntervalValue,
          sessionCachePendingApprovalInterval: sessionCachePendingApprovalIntervalValue,
          sessionCacheMaxAgeDays: sessionCacheMaxAgeDaysValue,
          autoDeleteStaleBranches: autoDeleteStaleBranchesValue,
          autoDeleteStaleBranchesAfterDays: autoDeleteStaleBranchesAfterDaysValue,
        };

        const updatedProfile = {
          ...activeProfile,
          settings: updatedSettings,
        };

        await saveProfile(updatedProfile);
        const updatedProfiles = await getProfiles();
        setProfiles(updatedProfiles);

        toast({
          title: "Settings Saved",
          description: "Your settings have been updated.",
        });
      } else {
        toast({
          title: "Error",
          description: "No active profile found.",
          variant: "destructive",
        });
      }
    });
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
    setProfileName("");
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

  const renderProfilesTable = () => {
    if (isLoadingProfiles) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }

    if (profiles.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
          <p className="font-semibold text-lg">No profiles yet</p>
          <p className="text-sm">Click "Add New Profile" to create your first one.</p>
        </div>
      );
    }

    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px]">Active</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">{profile.name}</TableCell>
                <TableCell>
                  <Switch
                    checked={profile.isActive}
                    onCheckedChange={() => handleToggleActiveProfile(profile.id)}
                    disabled={isSavingProfile}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isSavingProfile}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => openProfileDialog(profile)}>
                        <Edit className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteProfile(profile.id)}
                        className="text-destructive"
                        disabled={profiles.length === 1}
                      >
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
    );
  };

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

  const handleSaveProfile = () => {
    if (!profileName.trim()) {
      toast({ variant: "destructive", title: "Missing fields", description: "Profile name is required." });
      return;
    }

    startSavingProfile(async () => {
      const { data } = dialogState;
      let profileToSave: Profile;

      if (data) {
        // Editing existing profile
        profileToSave = { ...(data as Profile), name: profileName };
      } else {
        // Creating new profile
        profileToSave = {
          id: crypto.randomUUID(),
          name: profileName,
          settings: {}, // TODO: Add default settings
          isActive: profiles.length === 0, // Make first profile active
        };
      }

      await saveProfile(profileToSave);
      const updatedProfiles = await getProfiles();
      setProfiles(updatedProfiles);
      toast({ title: data ? "Profile updated" : "Profile added" });
      closeDialog();
    });
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length === 1) {
      toast({
        title: "Cannot delete profile",
        description: "You must have at least one profile.",
        variant: "destructive",
      });
      return;
    }

    startSavingProfile(async () => {
      const profileToDelete = profiles.find(p => p.id === id);
      if (profileToDelete?.isActive) {
        const nextProfile = profiles.find(p => p.id !== id);
        if (nextProfile) {
          await handleToggleActiveProfile(nextProfile.id);
        }
      }

      await deleteProfile(id);
      const updatedProfiles = await getProfiles();
      setProfiles(updatedProfiles);
      toast({ title: "Profile deleted" });
    });
  };

  const handleToggleActiveProfile = (id: string) => {
    startSavingProfile(async () => {
      const updatedProfiles = profiles.map(p => ({
        ...p,
        isActive: p.id === id,
      }));

      for (const profile of updatedProfiles) {
        await saveProfile(profile);
      }

      setProfiles(updatedProfiles);
      toast({ title: "Active profile changed" });
    });
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
        </TabsList>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Profiles</CardTitle>
                <CardDescription>Manage your settings profiles.</CardDescription>
              </div>
              <Button onClick={() => openProfileDialog()} disabled={isSavingProfile}>
                <Plus className="mr-2 h-4 w-4" /> Add New Profile
              </Button>
            </CardHeader>
            <CardContent>
              {renderProfilesTable()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>API keys, debug settings, and other internal configurations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Debug Mode */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="debug-mode">Debug Mode</Label>
                            <p className="text-xs text-muted-foreground">Enable detailed logging.</p>
                        </div>
                        <Switch id="debug-mode" checked={debugModeValue} onCheckedChange={setDebugModeValue} />
                    </div>

                    {/* API Keys */}
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
                        {isJulesKeyFromEnv && !apiKeyValue && (
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
                         {isGithubTokenFromEnv && !githubTokenValue && (
                            <p className="text-xs text-muted-foreground">Using GITHUB_TOKEN environment variable.</p>
                        )}
                    </div>

                    {/* Moved from Configuration */}
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

      {/* Dialogs for Messages and Profiles */}
      <Dialog open={dialogState.isOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          {dialogState.type === 'profile' ? (
            <>
              <DialogHeader>
                <DialogTitle>{dialogState.data ? "Rename Profile" : "Create New Profile"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="profile-name" className="text-right">Name</Label>
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., Personal, Work"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isSavingProfile}>Cancel</Button></DialogClose>
                <Button onClick={handleSaveProfile} disabled={isSavingProfile}>Save</Button>
              </DialogFooter>
            </>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
