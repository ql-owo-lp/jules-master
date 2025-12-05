
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
import { Label } from "@/components/ui/label";
import { Settings, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useProfile } from "@/components/profile-provider";


export function SettingsSheet() {
  const { theme, setTheme } = useTheme();
  const { currentProfile, refreshProfiles } = useProfile();
  
  // Sync theme from profile on load or profile change
  useEffect(() => {
    if (currentProfile?.theme) {
        // Only override if not manually set in this session?
        // Or just let user preference take precedence?
        // For now, let's just respect profile setting if available and different.
        // But checking `theme` from useTheme against profile theme might cause loop if we are not careful.
        // If we want profile to drive theme:
        setTheme(currentProfile.theme);
    }
  }, [currentProfile, setTheme]);

  const handleSave = async () => {
      if (!currentProfile) return;

      try {
        // Update profile with new theme
        const response = await fetch(`/api/profiles/${currentProfile.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                theme: theme
            }),
        });

        if (response.ok) {
            await refreshProfiles();
        }

      } catch (error) {
          console.error("Failed to save theme to DB", error);
      }
  };


  return (
    <Sheet>
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
        <div className="space-y-8">
            <div className="space-y-6">
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
          <SheetClose asChild>
            <Button
              onClick={handleSave}
              type="submit"
              className="bg-accent text-accent-foreground hover:bg-accent/90 w-full"
            >
              Save Preference
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
