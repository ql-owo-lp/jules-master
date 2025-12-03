
"use client";

import { SettingsSheet } from "./settings-sheet";
import { Bot, PanelLeft, Plus } from "lucide-react";
import Link from "next/link";
import { NewJobDialog } from "./new-job-dialog";
import { Button } from "./ui/button";
import { SidebarTrigger, useSidebar } from "./ui/sidebar";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export function Header() {
  const { open } = useSidebar();
  const [isClient, setIsClient] = useState(false);

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
            <NewJobDialog>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create New Job
              </Button>
            </NewJobDialog>
            <SettingsSheet />
          </div>
        </div>
      </div>
    </header>
  );
}
