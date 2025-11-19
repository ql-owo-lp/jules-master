
"use client";

import { useState, useEffect, useTransition } from "react";
import type { PredefinedPrompt } from "@/lib/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BookText, Plus, Edit, Trash2, MoreHorizontal, MessageSquareReply, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { 
    getPredefinedPrompts, 
    savePredefinedPrompts, 
    getQuickReplies, 
    saveQuickReplies, 
    getGlobalPrompt,
    saveGlobalPrompt
} from "@/app/config/actions";

type DialogState = {
  isOpen: boolean;
  type: 'prompt' | 'reply';
  data: PredefinedPrompt | null;
}

export default function PredefinedPromptsPage() {
  const [prompts, setPrompts] = useState<PredefinedPrompt[]>([]);
  const [quickReplies, setQuickReplies] = useState<PredefinedPrompt[]>([]);
  const [globalPrompt, setGlobalPrompt] = useState<string>("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  
  const [dialogState, setDialogState] = useState<DialogState>({ isOpen: false, type: 'prompt', data: null });
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const fetchData = async () => {
        setIsLoading(true);
        const [fetchedPrompts, fetchedReplies, fetchedGlobalPrompt] = await Promise.all([
            getPredefinedPrompts(),
            getQuickReplies(),
            getGlobalPrompt()
        ]);
        setPrompts(fetchedPrompts);
        setQuickReplies(fetchedReplies);
        setGlobalPrompt(fetchedGlobalPrompt);
        setIsLoading(false);
    };
    fetchData();
  }, []);

  const openDialog = (type: 'prompt' | 'reply', data: PredefinedPrompt | null = null) => {
    setDialogState({ isOpen: true, type, data });
    setTitle(data?.title || "");
    setPromptText(data?.prompt || "");
  };

  const closeDialog = () => {
    setDialogState({ isOpen: false, type: 'prompt', data: null });
  }

  const handleDelete = (type: 'prompt' | 'reply', id: string) => {
     startSaving(async () => {
        if (type === 'prompt') {
            const updatedPrompts = prompts.filter((p) => p.id !== id);
            await savePredefinedPrompts(updatedPrompts);
            setPrompts(updatedPrompts);
            toast({
                title: "Message deleted",
                description: "The predefined message has been removed.",
            });
        } else {
            const updatedReplies = quickReplies.filter((r) => r.id !== id);
            await saveQuickReplies(updatedReplies);
            setQuickReplies(updatedReplies);
            toast({
                title: "Quick Reply deleted",
                description: "The quick reply has been removed.",
            });
        }
     });
  };

  const handleSave = () => {
    if (!title.trim() || !promptText.trim()) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Both title and content are required.",
      });
      return;
    }

    startSaving(async () => {
        const { type, data } = dialogState;
        
        if (type === 'prompt') {
            let updatedPrompts: PredefinedPrompt[];
            if (data?.id) { // Editing existing prompt
                updatedPrompts = prompts.map((p) => p.id === data.id ? { ...p, title, prompt: promptText } : p);
                toast({ title: "Message updated" });
            } else { // Adding new prompt
                updatedPrompts = [...prompts, { id: crypto.randomUUID(), title, prompt: promptText }];
                toast({ title: "Message added" });
            }
            await savePredefinedPrompts(updatedPrompts);
            setPrompts(updatedPrompts);
        } else { // 'reply'
            let updatedReplies: PredefinedPrompt[];
            if (data?.id) { // Editing existing reply
                updatedReplies = quickReplies.map((r) => r.id === data.id ? { ...r, title, prompt: promptText } : r);
                toast({ title: "Quick Reply updated" });
            } else { // Adding new reply
                updatedReplies = [...quickReplies, { id: crypto.randomUUID(), title, prompt: promptText }];
                toast({ title: "Quick Reply added" });
            }
            await saveQuickReplies(updatedReplies);
            setQuickReplies(updatedReplies);
        }
        
        closeDialog();
    });
  };

  const handleSaveGlobalPrompt = () => {
    startSaving(async () => {
        await saveGlobalPrompt(globalPrompt);
        toast({
            title: "Global Prompt Saved",
            description: "Your global prompt has been updated.",
        });
    });
  }

  const renderTable = (type: 'prompt' | 'reply') => {
    const items = type === 'prompt' ? prompts : quickReplies;
    const singular = type === 'prompt' ? 'message' : 'reply';
    const plural = type === 'prompt' ? 'messages' : 'replies';

    if (isLoading) {
       return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
          <p className="font-semibold text-lg">No {plural} yet</p>
          <p className="text-sm">
            Click "Add New" to create your first {singular}.
          </p>
        </div>
      );
    }
    
    return (
       <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Content (Excerpt)</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell className="text-muted-foreground max-w-sm truncate">{item.prompt}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isSaving}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => openDialog(type, item)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(type, item.id!)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (!isClient) {
    return (
       <div className="flex flex-col flex-1 bg-background">
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="space-y-8 px-4 sm:px-6 lg:px-8">
             <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 bg-background">
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="space-y-8 px-4 sm:px-6 lg:px-8">
            <Card>
              <CardHeader>
                  <div className="flex items-center gap-2">
                    <Globe className="h-6 w-6" />
                    <CardTitle>Global Prompt</CardTitle>
                  </div>
                  <CardDescription>
                    This prompt will be automatically prepended to every new job you create.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid w-full gap-2">
                    <Label htmlFor="global-prompt">Global Prompt Text</Label>
                    <Textarea
                        id="global-prompt"
                        placeholder="e.g., Always follow the existing coding style..."
                        rows={5}
                        value={globalPrompt}
                        onChange={(e) => setGlobalPrompt(e.target.value)}
                        disabled={isSaving || isLoading}
                    />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                 <Button onClick={handleSaveGlobalPrompt} disabled={isSaving || isLoading}>Save Global Prompt</Button>
              </CardFooter>
            </Card>


            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <BookText className="h-6 w-6" />
                    <CardTitle>Predefined Messages</CardTitle>
                  </div>
                  <CardDescription>
                    Manage your reusable messages for new job creation.
                  </CardDescription>
                </div>
                <Button onClick={() => openDialog('prompt')} disabled={isSaving || isLoading}>
                  <Plus className="mr-2 h-4 w-4" /> Add New
                </Button>
              </CardHeader>
              <CardContent>
                {renderTable('prompt')}
              </CardContent>
            </Card>

             <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MessageSquareReply className="h-6 w-6" />
                    <CardTitle>Quick Replies</CardTitle>
                  </div>
                  <CardDescription>
                    Manage your reusable replies for providing session feedback.
                  </CardDescription>
                </div>
                <Button onClick={() => openDialog('reply')} disabled={isSaving || isLoading}>
                  <Plus className="mr-2 h-4 w-4" /> Add New
                </Button>
              </CardHeader>
              <CardContent>
                {renderTable('reply')}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={dialogState.isOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {dialogState.data ? "Edit" : "Add New"} {dialogState.type === 'prompt' ? 'Message' : 'Quick Reply'}
            </DialogTitle>
            <DialogDescription>
               Create a new reusable {dialogState.type === 'prompt' ? 'message for faster job creation.' : 'reply for session feedback.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-3"
                placeholder="A short, descriptive title"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="prompt-text" className="text-right pt-2">
                Content
              </Label>
              <Textarea
                id="prompt-text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="col-span-3"
                rows={6}
                placeholder="Enter the full text here..."
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSaving}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={isSaving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
