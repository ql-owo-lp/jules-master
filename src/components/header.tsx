
"use client";

import { SettingsSheet } from "./settings-sheet";
import { Bot, PanelLeft, User } from "lucide-react";
import Link from "next/link";
import { SidebarTrigger, useSidebar } from "./ui/sidebar";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useEnv } from "@/components/env-provider";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const { open } = useSidebar();
  const [isClient, setIsClient] = useState(false);
  const { activeProfile } = useEnv();

  useEffect(() => {
    setIsClient(true);
  }, []);


  return (
    <header className="bg-card border-b sticky top-0 z-10">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
             {isClient && !open && (
                <SidebarTrigger>
                    <PanelLeft className="h-5 w-5" />
                    <span className="sr-only">Toggle Sidebar</span>
                </SidebarTrigger>
             )}
             <div className={cn("flex items-center gap-2 transition-opacity", isClient && !open ? "opacity-100" : "opacity-0")}>
                <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                    <Bot className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground font-headline hidden md:block">
                        Jules Master
                    </h1>
                </Link>
             </div>
          </div>
          <div className="flex items-center gap-4">
             {activeProfile && (
                <Badge variant="outline" className="gap-2 px-3 py-1">
                    <User className="h-3.5 w-3.5" />
                    {activeProfile.name}
                </Badge>
             )}
             <SettingsSheet />
          </div>
        </div>
      </div>
    </header>
  );
}
