
"use client"

import React, { useState, ReactElement, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, MessageSquare, BookText, MessageSquareReply, X, RotateCcw } from "lucide-react";
import type { PredefinedPrompt } from "@/lib/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getPredefinedPrompts, getQuickReplies } from "@/app/config/actions";
import { Combobox } from "./ui/combobox";
import { ScrollArea } from "./ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type MessageDialogProps = {
    trigger: ReactElement;
    storageKey: string;
    onSendMessage: (message: string) => void;
    dialogTitle?: string;
    dialogDescription?: string;
    isActionPending?: boolean;
    predefinedPrompts?: PredefinedPrompt[];
    quickReplies?: PredefinedPrompt[];
    tooltip?: string;
}

export function MessageDialog({ 
    trigger,
    storageKey,
    onSendMessage,
    dialogTitle = "Send Message",
    dialogDescription = "Compose and send a message.",
    isActionPending,
    predefinedPrompts: initialPrompts = [],
    quickReplies: initialReplies = [],
    tooltip
}: MessageDialogProps) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useLocalStorage(storageKey, "");
    const [predefinedPrompts, setPredefinedPrompts] = useState<PredefinedPrompt[]>(initialPrompts);
    const [quickReplies, setQuickReplies] = useState<PredefinedPrompt[]>(initialReplies);
    const { toast } = useToast();
    const [debugMode] = useLocalStorage<boolean>("jules-debug-mode", false);

    // When the dialog opens, re-read from local storage, in case another dialog updated it.
    useEffect(() => {
        if (open) {
            const storedMessage = localStorage.getItem(storageKey);
            if (storedMessage) {
                try {
                    setMessage(JSON.parse(storedMessage));
                } catch {
                    // ignore if parsing fails
                }
            }
             // Also fetch latest prompts/replies if not provided
            if (initialPrompts.length === 0) {
                getPredefinedPrompts().then(setPredefinedPrompts);
            }
            if (initialReplies.length === 0) {
                getQuickReplies().then(setQuickReplies);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, storageKey, setMessage]);

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            setMessage("");
        }
    };

    const handleSend = () => {
        if (!message.trim()) return;
        if (debugMode) {
            console.log("Sending message:", message);
        }
        onSendMessage(message);
        setOpen(false);
    };

    const handleReset = () => {
        setMessage("");
        toast({ title: "Message Cleared", description: "The message has been cleared."});
    }
    
    const promptOptions = predefinedPrompts.map(p => ({ value: p.id, label: p.title, content: p.prompt }));
    const replyOptions = quickReplies.map(r => ({ value: r.id, label: r.title, content: r.prompt }));

    const dialogTrigger = (
         <DialogTrigger asChild onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
             {trigger}
         </DialogTrigger>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {tooltip ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        {dialogTrigger}
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            ) : (
                dialogTrigger
            )}
            <DialogContent className="md:w-1/2 md:h-3/5 max-w-4xl flex flex-col">
                <DialogHeader className="relative pr-10">
                    <DialogTitle>{dialogTitle}</DialogTitle>
                    <DialogDescription>{dialogDescription}</DialogDescription>
                    <Button variant="ghost" size="icon" onClick={handleReset} className="absolute top-0 right-0">
                        <RotateCcw className="h-4 w-4"/>
                        <span className="sr-only">Reset Message</span>
                    </Button>
                </DialogHeader>
                <ScrollArea className="flex-1 pr-6 -mr-6">
                    <div className="grid gap-4 py-4 pr-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="message-suggestions">Message Suggestions</Label>
                                <Combobox
                                    options={promptOptions}
                                    onValueChange={(val) => {
                                        const selected = predefinedPrompts.find(p => p.id === val);
                                        if (selected) setMessage(selected.prompt);
                                    }}
                                    selectedValue={null}
                                    placeholder="Select a predefined message..."
                                    searchPlaceholder="Search messages..."
                                    icon={<BookText className="h-4 w-4 text-muted-foreground" />}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="quick-replies">Quick Replies</Label>
                                <Combobox
                                    options={replyOptions}
                                    onValueChange={(val) => {
                                        const selected = quickReplies.find(r => r.id === val);
                                        if (selected) setMessage(selected.prompt);
                                    }}
                                    selectedValue={null}
                                    placeholder="Select a quick reply..."
                                    searchPlaceholder="Search replies..."
                                    icon={<MessageSquareReply className="h-4 w-4 text-muted-foreground" />}
                                />
                            </div>
                        </div>
                        <div className="grid w-full gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="message-text">Message</Label>
                                {message && (
                                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMessage("")}>
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Clear message</span>
                                    </Button>
                                )}
                            </div>
                            <Textarea
                                id="message-text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Type your message here..."
                                rows={10}
                                disabled={isActionPending}
                                className="min-h-[200px]"
                            />
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSend} disabled={isActionPending || !message.trim()}>
                        {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                        Send Message
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
