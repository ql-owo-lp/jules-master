
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarInset,
  SidebarHeader,
  SidebarGroup,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Bot, MessageSquare, PlusCircle, BookText, ExternalLink, PanelLeft } from 'lucide-react';
import { Header } from '@/components/header';
import { NewJobDialog } from '@/components/new-job-dialog';
import { EnvProvider } from '@/components/env-provider';

export const metadata = {
  title: 'Jules Master',
  description: 'A hub to manage your Jules API jobs.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased h-full">
        <EnvProvider
          julesApiKey={process.env.JULES_API_KEY}
          githubToken={process.env.GITHUB_TOKEN}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SidebarProvider>
              <Sidebar>
                <SidebarContent>
                  <SidebarHeader className='justify-between'>
                  <Link
                    href="/"
                    className="flex items-center gap-2 font-bold text-xl"
                  >
                    <Bot className="h-7 w-7 text-primary" />
                    <span className='group-data-[collapsible=icon]:hidden'>Jules Master</span>
                  </Link>
                   <SidebarTrigger>
                      <PanelLeft className="h-5 w-5" />
                      <span className="sr-only">Toggle Sidebar</span>
                   </SidebarTrigger>
                </SidebarHeader>
                <SidebarGroup>
                  <SidebarMenu>
                    <SidebarMenuItem>
                       <NewJobDialog>
                          <SidebarMenuButton>
                              <PlusCircle />
                              <span>New Job</span>
                          </SidebarMenuButton>
                       </NewJobDialog>
                       <SidebarMenuAction asChild>
                          <Link href="/jobs/new" target="_blank">
                            <ExternalLink />
                          </Link>
                       </SidebarMenuAction>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <Link href="/">
                          <MessageSquare />
                          <span>Jobs & Sessions</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <Link href="/prompts">
                          <BookText />
                          <span>Messages</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroup>
              </SidebarContent>
              </Sidebar>
              <SidebarInset className="min-w-[1024px]">
                <Header />
                {children}
              </SidebarInset>
            </SidebarProvider>
            <Toaster />
          </ThemeProvider>
        </EnvProvider>
      </body>
    </html>
  );
}
