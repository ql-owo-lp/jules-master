
"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Settings, Moon, Sun, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { Settings as SettingsType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export function SettingsSheet() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<SettingsType>({});
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // We still need to respect if theme is in DB, but this sheet now mainly controls local runtime config
  // or simple quick toggles.
  // Actually, the user said "only leave the run-time config like Theme in the side-panel settings menu".

  // We should still fetch settings on mount to sync theme if it was saved in DB?
  // Or just rely on next-themes and local storage?
  // The original code fetched settings and set theme.
  
  useEffect(() => {
    if (!isOpen) return;
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const dbSettings = await response.json();
           const isSetInLocalStorage = (key: string) => {
             return window.localStorage.getItem(key) !== null;
          }
          if (!isSetInLocalStorage("theme") && dbSettings.theme) setTheme(dbSettings.theme);
          setSettings(dbSettings);
        }
      } catch (error) {
        console.error("Failed to fetch settings from DB", error);
      }
    };
    fetchSettings();
  }, [setTheme, isOpen]);

  const handleSave = async () => {
      setIsSaving(true);
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error("Failed to fetch current settings");
        const currentSettings = await response.json();

        const saveResponse = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...currentSettings,
                ...settings,
                theme: theme,
            }),
        });

        if (!saveResponse.ok) throw new Error("Failed to save settings");
        
        // Update local settings with merged result in case server modified it?
        // For now just keep local state.
        toast({
            title: "Settings saved",
            description: "Your preferences have been updated.",
        });
        setIsOpen(false);

      } catch (error) {
          console.error("Failed to save settings to DB", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to save settings.",
          });
      } finally {
        setIsSaving(false);
      }
  };


  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open settings">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[300px]">
        <SheetHeader className="mb-6">
          <SheetTitle>Quick Settings</SheetTitle>
          <SheetDescription>
             Run-time configuration.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4">
            <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <Label htmlFor="auto-merge">Auto Merge</Label>
                    <Switch
                        id="auto-merge"
                        checked={settings.autoMergeEnabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, autoMergeEnabled: checked })}
                    />
                </div>

                {settings.autoMergeEnabled && (
                    <div className="grid gap-2">
                         <Label>Merge Method</Label>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="justify-start w-full">
                                    {settings.autoMergeMethod === 'rebase' ? 'Rebase and Merge' : 'Squash and Merge'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => setSettings({ ...settings, autoMergeMethod: 'squash' })}>
                                    Squash and Merge
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSettings({ ...settings, autoMergeMethod: 'rebase' })}>
                                    Rebase and Merge
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}

                {settings.autoMergeEnabled && (
                    <div className="grid gap-2">
                         <Label>Auto Merge Message</Label>
                         <Input 
                            value={settings.autoMergeMessage || ""} 
                            onChange={(e) => setSettings({ ...settings, autoMergeMessage: e.target.value })}
                            placeholder="Automatically merged by bot as all checks passed"
                         />
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <Label htmlFor="close-conflict">Auto Close Stale/Conflicted PRs</Label>
                    <Switch
                        id="close-conflict"
                        checked={settings.closePrOnConflictEnabled}
                        onCheckedChange={(checked) => setSettings({ ...settings, closePrOnConflictEnabled: checked })}
                    />
                </div>

                {settings.closePrOnConflictEnabled && (
                    <div className="grid gap-2">
                         <Label>Conflict Message</Label>
                         <Input 
                            value={settings.autoCloseOnConflictMessage || ""} 
                            onChange={(e) => setSettings({ ...settings, autoCloseOnConflictMessage: e.target.value })}
                            placeholder="Closed due to merge conflict"
                         />
                    </div>
                )}

                <div className="grid gap-2">
                    <Label>Theme</Label>
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="justify-start w-full">
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
        </div>
         <SheetFooter className="mt-8">
            <Button
              onClick={handleSave}
              type="submit"
              className="bg-accent text-accent-foreground hover:bg-accent/90 w-full"
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Preference
            </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
