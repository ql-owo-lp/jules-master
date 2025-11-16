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
import { Settings } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export function SettingsSheet() {
  const [apiKey, setApiKey] = useLocalStorage<string>("jules-api-key", "");
  const [inputValue, setInputValue] = useState(apiKey);
  const { toast } = useToast();

  useEffect(() => {
    setInputValue(apiKey);
  }, [apiKey]);

  const handleSave = () => {
    setApiKey(inputValue);
    toast({
      title: "Settings Saved",
      description: "Your API key has been updated.",
    });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open settings">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader className="mb-6">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure your Jules API settings here. Your key is saved securely
            in your browser's local storage.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="api-key">Jules API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter your API key"
            />
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
