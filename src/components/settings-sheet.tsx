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
import type { AutomationMode } from "@/lib/types";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";


export function SettingsSheet() {
  const [apiKey, setApiKey] = useLocalStorage<string>("jules-api-key", "");
  const [pollInterval, setPollInterval] = useLocalStorage<number>("jules-poll-interval", 120);
  const [titleTruncateLength, setTitleTruncateLength] = useLocalStorage<number>("jules-title-truncate-length", 50);
  const [defaultRequirePlanApproval, setDefaultRequirePlanApproval] = useLocalStorage<boolean>("jules-default-require-plan-approval", false);
  const [defaultAutomationMode, setDefaultAutomationMode] = useLocalStorage<AutomationMode>("jules-default-automation-mode", "AUTO_CREATE_PR");


  const [apiKeyValue, setApiKeyValue] = useState(apiKey);
  const [pollIntervalValue, setPollIntervalValue] = useState(pollInterval);
  const [titleTruncateLengthValue, setTitleTruncateLengthValue] = useState(titleTruncateLength);
  const [requirePlanApprovalValue, setRequirePlanApprovalValue] = useState(defaultRequirePlanApproval);
  const [automationModeValue, setAutomationModeValue] = useState<AutomationMode>(defaultAutomationMode);
  
  const [showApiKey, setShowApiKey] = useState(false);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setApiKeyValue(apiKey);
  }, [apiKey]);
  
  useEffect(() => {
    setPollIntervalValue(pollInterval);
  }, [pollInterval]);

  useEffect(() => {
    setTitleTruncateLengthValue(titleTruncateLength);
  }, [titleTruncateLength]);
  
  useEffect(() => {
    setRequirePlanApprovalValue(defaultRequirePlanApproval);
  }, [defaultRequirePlanApproval]);

  useEffect(() => {
    setAutomationModeValue(defaultAutomationMode);
  }, [defaultAutomationMode]);

  const handleSave = () => {
    setApiKey(apiKeyValue);
    setPollInterval(pollIntervalValue);
    setTitleTruncateLength(titleTruncateLengthValue);
    setDefaultRequirePlanApproval(requirePlanApprovalValue);
    setDefaultAutomationMode(automationModeValue);
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
            <Label htmlFor="poll-interval">Session Poll Interval (seconds)</Label>
            <Input
              id="poll-interval"
              type="number"
              value={pollIntervalValue}
              onChange={(e) => setPollIntervalValue(Number(e.target.value))}
              placeholder="e.g., 60"
              min="0"
            />
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

           <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
             <div className="space-y-0.5">
                <Label htmlFor="default-require-plan-approval">Default to Require Plan Approval</Label>
                 <SheetDescription className="text-xs">
                    Sets the default for the 'Require Plan Approval' checkbox on the new job form.
                </SheetDescription>
             </div>
             <Switch 
                id="default-require-plan-approval" 
                checked={requirePlanApprovalValue} 
                onCheckedChange={setRequirePlanApprovalValue}
              />
          </div>

           <div className="grid gap-2">
                <Label htmlFor="default-automation-mode">Default Automation Mode</Label>
                 <Select 
                    value={automationModeValue}
                    onValueChange={(value: AutomationMode) => setAutomationModeValue(value)}
                >
                    <SelectTrigger id="default-automation-mode">
                        <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="AUTO_CREATE_PR">Auto-create Pull Request</SelectItem>
                        <SelectItem value="AUTOMATION_MODE_UNSPECIFIED">Unspecified</SelectItem>
                    </SelectContent>
                </Select>
                 <SheetDescription className="text-xs">
                    Sets the default automation mode for new jobs.
                </SheetDescription>
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
