
"use client";

import { SettingsSheet } from "./settings-sheet";
import { Bot, PanelLeft } from "lucide-react";
import Link from "next/link";
import { SidebarTrigger } from "./ui/sidebar";

export function Header() {
  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
             <SidebarTrigger>
                <PanelLeft className="h-6 w-6" />
                 <span className="sr-only">Toggle Sidebar</span>
            </SidebarTrigger>
             <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                <Bot className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold text-foreground font-headline hidden md:block">
                    Jules Master
                </h1>
            </Link>
          </div>
          <SettingsSheet />
        </div>
      </div>
    </header>
  );
}
