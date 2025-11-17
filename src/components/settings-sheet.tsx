
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


export function SettingsSheet() {
  const [apiKey, setApiKey] = useLocalStorage<string>("jules-api-key", "");
  const [githubToken, setGithubToken] = useLocalStorage<string>("jules-github-token", "");
  const [idlePollInterval, setIdlePollInterval] = useLocalStorage<number>("jules-idle-poll-interval", 120);
  const [activePollInterval, setActivePollInterval] = useLocalStorage<number>("jules-active-poll-interval", 30);
  const [titleTruncateLength, setTitleTruncateLength] = useLocalStorage<number>("jules-title-truncate-length", 50);

  const [apiKeyValue, setApiKeyValue] = useState(apiKey);
  const [githubTokenValue, setGithubTokenValue] = useState(githubToken);
  const [idlePollIntervalValue, setIdlePollIntervalValue] = useState(idlePollInterval);
  const [activePollIntervalValue, setActivePollIntervalValue] = useState(activePollInterval);
  const [titleTruncateLengthValue, setTitleTruncateLengthValue] = useState(titleTruncateLength);
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setApiKeyValue(apiKey);
  }, [apiKey]);

  useEffect(() => {
    setGithubTokenValue(githubToken);
  }, [githubToken]);
  
  useEffect(() => {
    setIdlePollIntervalValue(idlePollInterval);
  }, [idlePollInterval]);

  useEffect(() => {
    setActivePollIntervalValue(activePollInterval);
  }, [activePollInterval]);

  useEffect(() => {
    setTitleTruncateLengthValue(titleTruncateLength);
  }, [titleTruncateLength]);
  
  const handleSave = () => {
    setApiKey(apiKeyValue);
    setGithubToken(githubTokenValue);
    setIdlePollInterval(idlePollIntervalValue);
    setActivePollInterval(activePollIntervalValue);
    setTitleTruncateLength(titleTruncateLengthValue);
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
      <SheetContent className="overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure your Jules API settings here. Your settings are saved securely
            in your browser's local storage.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6">
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
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 h-full px-3"
                onClick={() => setShowApiKey(!showApiKey)}
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
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
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 right-0 h-full px-3"
                onClick={() => setShowGithubToken(!showGithubToken)}
                aria-label={showGithubToken ? "Hide GitHub token" : "Show GitHub token"}
              >
                {showGithubToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Required for fetching PR status. Use a classic token with `repo` scope.
            </p>
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
              How often to check for updates in the background. Set to 0 to disable.
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
              A shorter interval used after sending a message to a session.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="title-truncate-length">Title Truncation Length</Label>
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
