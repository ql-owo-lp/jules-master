
"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Eye, EyeOff, Moon, Sun } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "./ui/separator";


export function SettingsSheet() {
  const [apiKey, setApiKey] = useLocalStorage<string>("jules-api-key", "");
  const [githubToken, setGithubToken] = useLocalStorage<string>("jules-github-token", "");
  
  const [idlePollInterval, setIdlePollInterval] = useLocalStorage<number>("jules-idle-poll-interval", 120);
  const [activePollInterval, setActivePollInterval] = useLocalStorage<number>("jules-active-poll-interval", 30);
  const [titleTruncateLength, setTitleTruncateLength] = useLocalStorage<number>("jules-title-truncate-length", 50);
  const [lineClamp, setLineClamp] = useLocalStorage<number>("jules-line-clamp", 1);
  const [sessionItemsPerPage, setSessionItemsPerPage] = useLocalStorage<number>("jules-session-items-per-page", 10);
  const [jobsPerPage, setJobsPerPage] = useLocalStorage<number>("jules-jobs-per-page", 5);
  const [defaultSessionCount, setDefaultSessionCount] = useLocalStorage<number>("jules-default-session-count", 3);
  const [prStatusPollInterval, setPrStatusPollInterval] = useLocalStorage<number>("jules-pr-status-poll-interval", 60);


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
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const isJulesKeyFromEnv = !!process.env.JULES_API_KEY;
  const isGithubTokenFromEnv = !!process.env.GITHUB_TOKEN;

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
  
  const handleSave = () => {
    if (!isJulesKeyFromEnv) setApiKey(apiKeyValue);
    if (!isGithubTokenFromEnv) setGithubToken(githubTokenValue);
    setIdlePollInterval(idlePollIntervalValue);
    setActivePollInterval(activePollIntervalValue);
    setTitleTruncateLength(titleTruncateLengthValue);
    setLineClamp(lineClampValue);
    setSessionItemsPerPage(sessionItemsPerPageValue);
    setJobsPerPage(jobsPerPageValue);
    setDefaultSessionCount(defaultSessionCountValue);
    setPrStatusPollInterval(prStatusPollIntervalValue);
    toast({
      title: "Settings Saved",
      description: "Your settings have been updated.",
    });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open settings">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure your Jules API settings here. Your settings are saved securely
            in your browser's local storage.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-8">
            {/* General Settings */}
            <div className="space-y-6">
                 <div>
                    <h3 className="text-lg font-medium">General</h3>
                    <p className="text-sm text-muted-foreground">API keys and theme preferences.</p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="api-key">Jules API Key</Label>
                    <div className="relative">
                    <Input
                        id="api-key"
                        type={showApiKey ? "text" : "password"}
                        value={isJulesKeyFromEnv ? "******" : apiKeyValue}
                        onChange={(e) => setApiKeyValue(e.target.value)}
                        placeholder="Enter your API key"
                        className="pr-10"
                        disabled={isJulesKeyFromEnv}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full px-3"
                        onClick={() => setShowApiKey(!showApiKey)}
                        aria-label={showApiKey ? "Hide API key" : "Show API key"}
                        disabled={isJulesKeyFromEnv}
                    >
                        {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                        ) : (
                        <Eye className="h-4 w-4" />
                        )}
                    </Button>
                    </div>
                     {isJulesKeyFromEnv && (
                        <p className="text-xs text-muted-foreground">
                            Set via JULES_API_KEY environment variable.
                        </p>
                    )}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="github-token">GitHub Personal Access Token</Label>
                    <div className="relative">
                    <Input
                        id="github-token"
                        type={showGithubToken ? "text" : "password"}
                        value={isGithubTokenFromEnv ? "******" : githubTokenValue}
                        onChange={(e) => setGithubTokenValue(e.target.value)}
                        placeholder="Enter your GitHub PAT"
                        className="pr-10"
                        disabled={isGithubTokenFromEnv}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full px-3"
                        onClick={() => setShowGithubToken(!showGithubToken)}
                        aria-label={showGithubToken ? "Hide GitHub token" : "Show GitHub token"}
                        disabled={isGithubTokenFromEnv}
                    >
                        {showGithubToken ? (
                        <EyeOff className="h-4 w-4" />
                        ) : (
                        <Eye className="h-4 w-4" />
                        )}
                    </Button>
                    </div>
                     {isGithubTokenFromEnv ? (
                         <p className="text-xs text-muted-foreground">
                           Set via GITHUB_TOKEN environment variable.
                         </p>
                     ) : (
                        <p className="text-xs text-muted-foreground">
                            Required for fetching PR status. Use a classic token with &apos;repo&apos; scope.
                        </p>
                     )}
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="pr-status-poll-interval">PR Status Cache Refresh Interval (seconds)</Label>
                    <Input
                        id="pr-status-poll-interval"
                        type="number"
                        value={prStatusPollIntervalValue}
                        onChange={(e) => setPrStatusPollIntervalValue(Number(e.target.value))}
                        placeholder="e.g., 60"
                        min="10"
                    />
                    <p className="text-xs text-muted-foreground">
                        How often to check GitHub for pull request updates in the background.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label>Theme</Label>
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="justify-start">
                        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="ml-2">
                            {theme ? theme.charAt(0).toUpperCase() + theme.slice(1) : "System"}
                        </span>
                        <span className="sr-only">Toggle theme</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => setTheme("light")}>
                        Light
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("dark")}>
                        Dark
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("system")}>
                        System
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <Separator />
            
             {/* Job Settings */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium">Job & Session List</h3>
                    <p className="text-sm text-muted-foreground">Configuration for job and session lists.</p>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="jobs-per-page">Jobs Per Page</Label>
                    <Input
                    id="jobs-per-page"
                    type="number"
                    value={jobsPerPageValue}
                    onChange={(e) => setJobsPerPageValue(Number(e.target.value))}
                    placeholder="e.g., 5"
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
                    placeholder="e.g., 10"
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
                    placeholder="e.g., 50"
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
                    placeholder="e.g., 3"
                    min="1"
                    />
                </div>
            </div>

            <Separator />

            {/* Session Detail Settings */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium">Session Detail Page</h3>
                    <p className="text-sm text-muted-foreground">Polling and display settings for an individual session.</p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="idle-poll-interval">Idle Poll Interval (seconds)</Label>
                    <Input
                        id="idle-poll-interval"
                        type="number"
                        value={idlePollIntervalValue}
                        onChange={(e) => setIdlePollIntervalValue(Number(e.target.value))}
                        placeholder="e.g., 120"
                        min="0"
                    />
                    <p className="text-xs text-muted-foreground">
                    Poll interval for completed or failed sessions. Set to 0 to disable.
                    </p>
                </div>
                
                <div className="grid gap-2">
                    <Label htmlFor="active-poll-interval">Active Poll Interval (seconds)</Label>
                    <Input
                    id="active-poll-interval"
                    type="number"
                    value={activePollIntervalValue}
                    onChange={(e) => setActivePollIntervalValue(Number(e.target.value))}
                    placeholder="e.g., 30"
                    min="1"
                    />
                    <p className="text-xs text-muted-foreground">
                    Shorter interval used after sending a message to a session.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="line-clamp">Activity Feed Line Clamp</Label>
                    <Input
                    id="line-clamp"
                    type="number"
                    value={lineClampValue}
                    onChange={(e) => setLineClampValue(Number(e.target.value))}
                    placeholder="e.g., 1"
                    min="1"
                    max="10"
                    />
                    <p className="text-xs text-muted-foreground">
                        Number of lines to show for progress descriptions before truncating.
                    </p>
                </div>
            </div>
        </div>
        <SheetFooter className="mt-8">
          <SheetClose asChild>
            <Button
              onClick={handleSave}
              type="submit"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Save Changes
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

    