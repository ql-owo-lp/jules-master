
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


export function SettingsSheet() {
  const { theme, setTheme } = useTheme();
  // We still need to respect if theme is in DB, but this sheet now mainly controls local runtime config
  // or simple quick toggles.
  // Actually, the user said "only leave the run-time config like Theme in the side-panel settings menu".

  // We should still fetch settings on mount to sync theme if it was saved in DB?
  // Or just rely on next-themes and local storage?
  // The original code fetched settings and set theme.
  
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const dbSettings = await response.json();
           const isSetInLocalStorage = (key: string) => {
             return window.localStorage.getItem(key) !== null;
          }
          if (dbSettings.theme && !isSetInLocalStorage("theme")) setTheme(dbSettings.theme);
        }
      } catch (error) {
        console.error("Failed to fetch settings from DB", error);
      }
    };
    fetchSettings();
  }, [setTheme]);

  // When theme changes, we might want to save it to DB so it persists across devices?
  // The original code only saved on "Save Changes".
  // Let's add a "Save" button or auto-save?
  // The user interaction for theme is usually instant.
  // We can add a save button or just leave it as run-time only (local storage).
  // But since we support DB persistence for settings, maybe we should save it.
  // However, `next-themes` persists to localStorage automatically.
  // If we want to persist to DB, we need to do it explicitly.

  // Given the instruction "only leave the run-time config like Theme",
  // I will keep the Sheet simple.

  // I will assume we don't need a Save button for Theme if we just rely on `next-themes`
  // but if we want to sync with DB we might need it.
  // The previous implementation had a Save button.
  // I'll keep a Save button just in case the user expects it to be saved to server.

  const handleSave = async () => {
      try {
        // We only update theme here, but we need to preserve other settings?
        // The API implementation in `route.ts` reconstructs the object from body.
        // If we send only theme, other fields will be undefined in `newSettings` object in `route.ts`.
        // Wait, let's look at `route.ts` again.

        /*
        const newSettings = {
            id: 1,
            idlePollInterval: body.idlePollInterval,
            ...
        }
        await db.update(settings).set(newSettings)...
        */

        // This means if we send only `theme`, `idlePollInterval` etc will be undefined, and might be set to NULL in DB or default if not nullable?
        // Drizzle `values` or `set` with undefined might behave differently depending on config, but usually it tries to set it.
        // If the columns are not nullable, it might fail or set default.
        // We MUST fetch existing settings first and merge if we want to update only one field using that API endpoint,
        // OR update the API endpoint to use `patch` semantics.

        // Since I cannot easily change the API endpoint logic without risking breaking other things (though I can check schema),
        // I will do the safe thing: Fetch first, then Save.

        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error("Failed to fetch current settings");
        const currentSettings = await response.json();

        await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...currentSettings,
                theme: theme,
            }),
        });

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
