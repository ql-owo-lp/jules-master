"use client";

import { SettingsSheet } from "./settings-sheet";
import { Bot } from "lucide-react";
import Link from "next/link";
import { SidebarTrigger } from "./ui/sidebar";
import { Button } from "./ui/button";

export function Header() {
  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <Button asChild variant="ghost" className="p-0 h-auto">
              <SidebarTrigger>
                <div className="flex items-center space-x-3">
                  <Bot className="h-8 w-8 text-primary" />
                  <h1 className="text-2xl font-bold text-foreground font-headline hidden md:block">
                    Jules Master
                  </h1>
                </div>
              </SidebarTrigger>
            </Button>
          </div>
          <SettingsSheet />
        </div>
      </div>
    </header>
  );
}
