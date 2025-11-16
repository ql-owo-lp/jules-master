"use client";

import { SettingsSheet } from "./settings-sheet";
import { Bot } from "lucide-react";

export function Header() {
  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <Bot className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground font-headline">
              Jules Hub
            </h1>
          </div>
          <SettingsSheet />
        </div>
      </div>
    </header>
  );
}
