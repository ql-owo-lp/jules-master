
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
import { useProfiles } from "@/hooks/use-profiles";
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

type RenameDialogState = {
  isOpen: boolean;
  profile: { id: string; name: string } | null;
};

type DeleteDialogState = {
  isOpen: boolean;
  profile: { id: string; name: string } | null;
};

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentTab = searchParams.get("tab") || "general";

  const onTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`${pathname}?${params.toString()}`);
  };

    // --- Profiles State ---
  const { profiles, activeProfile, createProfile, updateProfile, deleteProfile, switchProfile, isInitialized } = useProfiles();
  const [currentSettings, setCurrentSettings] = useState(activeProfile?.settings);

  const { julesApiKey, githubToken: envGithubToken } = useEnv();
  const { toast } = useToast();

  useEffect(() => {
    if (activeProfile) {
      setCurrentSettings(activeProfile.settings);
    }
  }, [activeProfile]);


  // --- Handlers for Settings ---
  const handleSaveSettings = async () => {
    if (!activeProfile || !currentSettings) return;

    updateProfile(activeProfile.id, { settings: currentSettings });

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
                ...currentSettings,
                theme: currentTheme,
            }),
        });

        toast({
            title: "Settings Saved",
            description: "Your settings have been updated.",
        });
    } catch (e) {
        console.error("Failed to save settings to DB", e);
         toast({
            title: "Error",
            description: "Failed to save settings to database. Local storage updated.",
            variant: "destructive"
        });
    }
  };

    const handleSettingChange = <K extends keyof NonNullable<typeof currentSettings>>(
        key: K,
        value: NonNullable<typeof currentSettings>[K]
    ) => {
        if (currentSettings) {
            setCurrentSettings({ ...currentSettings, [key]: value });
        }
    };

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
  const [renameDialogState, setRenameDialogState] = useState<RenameDialogState>({ isOpen: false, profile: null });
  const [deleteDialogState, setDeleteDialogState] = useState<DeleteDialogState>({ isOpen: false, profile: null });
  const [newProfileName, setNewProfileName] = useState("");
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");

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
    fetchMessages();
  }, []);

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


  // --- Handlers for Messages ---
  const handleRefreshSources = () => {
    startRefreshSources(async () => {
        try {
            await refreshSources();
            const fetchedSources = await listSources(julesApiKey || "");
            setSources(fetchedSources);
             toast({
                title: "Refreshed",
                description: "The list of repositories has been updated.",
            });
        } catch {
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

  const openRenameDialog = (profile: { id: string; name: string }) => {
    setRenameDialogState({ isOpen: true, profile });
    setNewProfileName(profile.name);
  };

  const handleRenameProfile = () => {
    if (renameDialogState.profile && newProfileName) {
      updateProfile(renameDialogState.profile.id, { name: newProfileName });
      setRenameDialogState({ isOpen: false, profile: null });
    }
  };

  const openDeleteDialog = (profile: { id: string; name: string }) => {
    setDeleteDialogState({ isOpen: true, profile });
  };

  const handleDeleteProfile = () => {
    if (deleteDialogState.profile) {
      deleteProfile(deleteDialogState.profile.id);
      setDeleteDialogState({ isOpen: false, profile: null });
    }
  };

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
          <p className="text-sm">Click &quot;Add New&quot; to create your first {singular}.</p>
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

  if (!isInitialized || !currentSettings) {
      return (
        <div className="p-8 space-y-4">
             <Skeleton className="h-10 w-48" />
             <Skeleton className="h-[400px] w-full" />
        </div>
      )
  }

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

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>API keys, polling intervals, and other general settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="debug-mode">Debug Mode</Label>
                            <p className="text-xs text-muted-foreground">Enable detailed logging.</p>
                        </div>
                        <Switch id="debug-mode" checked={currentSettings.debugMode} onCheckedChange={(value) => handleSettingChange('debugMode', value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="api-key">Jules API Key</Label>
                        <div className="relative">
                            <Input
                                id="api-key"
                                type={showApiKey ? "text" : "password"}
                                value={currentSettings.apiKey}
                                onChange={(e) => handleSettingChange('apiKey', e.target.value)}
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
                        {isJulesKeyFromEnv && !currentSettings.apiKey && (
                            <p className="text-xs text-muted-foreground">Using JULES_API_KEY environment variable.</p>
                        )}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="github-token">GitHub Personal Access Token</Label>
                        <div className="relative">
                            <Input
                                id="github-token"
                                type={showGithubToken ? "text" : "password"}
                                value={currentSettings.githubToken}
                                onChange={(e) => handleSettingChange('githubToken', e.target.value)}
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
                         {isGithubTokenFromEnv && !currentSettings.githubToken && (
                            <p className="text-xs text-muted-foreground">Using GITHUB_TOKEN environment variable.</p>
                        )}
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="idle-poll-interval">Idle Poll Interval (seconds)</Label>
                        <Input
                            id="idle-poll-interval"
                            type="number"
                            value={currentSettings.idlePollInterval}
                            onChange={(e) => handleSettingChange('idlePollInterval', Number(e.target.value))}
                            min="0"
                        />
                        <p className="text-xs text-muted-foreground">Poll interval for completed/failed sessions.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="active-poll-interval">Active Poll Interval (seconds)</Label>
                        <Input
                            id="active-poll-interval"
                            type="number"
                            value={currentSettings.activePollInterval}
                            onChange={(e) => handleSettingChange('activePollInterval', Number(e.target.value))}
                            min="1"
                        />
                         <p className="text-xs text-muted-foreground">Poll interval for active sessions.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="pr-status-poll-interval">PR Status Cache Refresh Interval (seconds)</Label>
                        <Input
                            id="pr-status-poll-interval"
                            type="number"
                            value={currentSettings.prStatusPollInterval}
                            onChange={(e) => handleSettingChange('prStatusPollInterval', Number(e.target.value))}
                            min="10"
                        />
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="default-session-count">Default Session Count for New Jobs</Label>
                        <Input
                            id="default-session-count"
                            type="number"
                            value={currentSettings.defaultSessionCount}
                            onChange={(e) => handleSettingChange('defaultSessionCount', Number(e.target.value))}
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
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Profiles</CardTitle>
                    <CardDescription>Manage your settings profiles.</CardDescription>
                </div>
                <Button onClick={() => createProfile('New Profile')}>
                    <Plus className="mr-2 h-4 w-4" /> Add New Profile
                </Button>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="w-[120px] text-center">Status</TableHead>
                                <TableHead className="w-[180px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {profiles.map((profile) => (
                                <TableRow key={profile.id}>
                                    <TableCell className="font-medium">{profile.name}</TableCell>
                                    <TableCell className="text-center">
                                        {activeProfile?.id === profile.id ? (
                                            <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">Active</span>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => switchProfile(profile.id)}
                                            disabled={activeProfile?.id === profile.id}
                                            className="mr-2"
                                        >
                                            Switch to
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => openRenameDialog(profile)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    <span>Rename</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => openDeleteDialog(profile)}
                                                    disabled={profiles.length <= 1 || activeProfile?.id === profile.id}
                                                    className="text-destructive"
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
                        <Switch id="auto-retry-enabled" checked={currentSettings.autoRetryEnabled} onCheckedChange={(value) => handleSettingChange('autoRetryEnabled', value)} />
                    </div>
                    {currentSettings.autoRetryEnabled && (
                        <div className="grid gap-2">
                            <Label htmlFor="auto-retry-message">Auto Retry Message</Label>
                            <Textarea
                                id="auto-retry-message"
                                value={currentSettings.autoRetryMessage}
                                onChange={(e) => handleSettingChange('autoRetryMessage', e.target.value)}
                            />
                        </div>
                    )}
                     <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-continue-enabled">Auto Continue Completed Sessions</Label>
                            <p className="text-xs text-muted-foreground">Automatically send a continue message when a session completes without a PR.</p>
                        </div>
                        <Switch id="auto-continue-enabled" checked={currentSettings.autoContinueEnabled} onCheckedChange={(value) => handleSettingChange('autoContinueEnabled', value)} />
                    </div>
                    {currentSettings.autoContinueEnabled && (
                        <div className="grid gap-2">
                            <Label htmlFor="auto-continue-message">Auto Continue Message</Label>
                            <Textarea
                                id="auto-continue-message"
                                value={currentSettings.autoContinueMessage}
                                onChange={(e) => handleSettingChange('autoContinueMessage', e.target.value)}
                            />
                        </div>
                    )}
                    <div className="grid gap-2">
                        <Label htmlFor="auto-approval-interval">Auto Approval Check Interval (seconds)</Label>
                        <Input
                            id="auto-approval-interval"
                            type="number"
                            value={currentSettings.autoApprovalInterval}
                            onChange={(e) => handleSettingChange('autoApprovalInterval', Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="auto-delete-stale-branches">Auto Delete Stale Branches</Label>
                            <p className="text-xs text-muted-foreground">Automatically delete branches after their PRs are merged.</p>
                        </div>
                        <Switch id="auto-delete-stale-branches" checked={currentSettings.autoDeleteStaleBranches} onCheckedChange={(value) => handleSettingChange('autoDeleteStaleBranches', value)} />
                    </div>
                    {currentSettings.autoDeleteStaleBranches && (
                        <div className="grid gap-2">
                            <Label htmlFor="auto-delete-stale-branches-after-days">Auto Delete Stale Branches After (days)</Label>
                            <Input
                                id="auto-delete-stale-branches-after-days"
                                type="number"
                                value={currentSettings.autoDeleteStaleBranchesAfterDays}
                                onChange={(e) => handleSettingChange('autoDeleteStaleBranchesAfterDays', Number(e.target.value))}
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
                            value={currentSettings.sessionCacheInProgressInterval}
                            onChange={(e) => handleSettingChange('sessionCacheInProgressInterval', Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cache-pending">Pending Approval Update Interval (seconds)</Label>
                        <Input
                            id="cache-pending"
                            type="number"
                            value={currentSettings.sessionCachePendingApprovalInterval}
                            onChange={(e) => handleSettingChange('sessionCachePendingApprovalInterval', Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cache-completed-nopr">Completed (No PR) Update Interval (seconds)</Label>
                        <Input
                            id="cache-completed-nopr"
                            type="number"
                            value={currentSettings.sessionCacheCompletedNoPrInterval}
                            onChange={(e) => handleSettingChange('sessionCacheCompletedNoPrInterval', Number(e.target.value))}
                            min="60"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cache-max-age">Max Session Age to Update (days)</Label>
                        <Input
                            id="cache-max-age"
                            type="number"
                            value={currentSettings.sessionCacheMaxAgeDays}
                            onChange={(e) => handleSettingChange('sessionCacheMaxAgeDays', Number(e.target.value))}
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
                            value={currentSettings.jobsPerPage}
                            onChange={(e) => handleSettingChange('jobsPerPage', Number(e.target.value))}
                            min="1"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="session-items-per-page">Sessions Per Page (within a job)</Label>
                        <Input
                            id="session-items-per-page"
                            type="number"
                            value={currentSettings.sessionItemsPerPage}
                            onChange={(e) => handleSettingChange('sessionItemsPerPage', Number(e.target.value))}
                            min="1"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="title-truncate-length">Session Title Truncation Length</Label>
                        <Input
                            id="title-truncate-length"
                            type="number"
                            value={currentSettings.titleTruncateLength}
                            onChange={(e) => handleSettingChange('titleTruncateLength', Number(e.target.value))}
                            min="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="line-clamp">Activity Feed Line Clamp</Label>
                        <Input
                            id="line-clamp"
                            type="number"
                            value={currentSettings.lineClamp}
                            onChange={(e) => handleSettingChange('lineClamp', Number(e.target.value))}
                            min="1"
                            max="10"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="history-prompts-count">History Prompts Count</Label>
                        <Input
                            id="history-prompts-count"
                            type="number"
                            value={currentSettings.historyPromptsCount}
                            onChange={(e) => handleSettingChange('historyPromptsCount', Number(e.target.value))}
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
      {/* Dialog for Renaming Profile */}
    <Dialog open={renameDialogState.isOpen} onOpenChange={() => setRenameDialogState({ isOpen: false, profile: null })}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Rename Profile</DialogTitle>
                <DialogDescription>
                    Enter a new name for the profile &quot;{renameDialogState.profile?.name}&quot;.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-profile-name" className="text-right">Name</Label>
                    <Input
                        id="new-profile-name"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        className="col-span-3"
                        placeholder="Enter new profile name"
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleRenameProfile}>Save</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    {/* Dialog for Deleting Profile */}
    <Dialog open={deleteDialogState.isOpen} onOpenChange={() => setDeleteDialogState({ isOpen: false, profile: null })}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Delete Profile</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete the profile &quot;{deleteDialogState.profile?.name}&quot;? This action cannot be undone.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleDeleteProfile} variant="destructive">Delete</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </div>
  );
}
