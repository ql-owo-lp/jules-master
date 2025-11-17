
"use client"

import { useState, ReactElement } from "react";
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
import { Loader2, MessageSquare, BookText, MessageSquareReply } from "lucide-react";
import type { PredefinedPrompt } from "@/lib/types";
import { Combobox } from "./ui/combobox";
import { ScrollArea } from "./ui/scroll-area";

type MessageDialogProps = {
    triggerButton: ReactElement;
    predefinedPrompts: PredefinedPrompt[];
    quickReplies: PredefinedPrompt[];
    onSendMessage: (message: string) => void;
    dialogTitle?: string;
    dialogDescription?: string;
    isActionPending?: boolean;
}

export function MessageDialog({ 
    triggerButton,
    predefinedPrompts, 
    quickReplies, 
    onSendMessage,
    dialogTitle = "Send Message",
    dialogDescription = "Compose and send a message.",
    isActionPending
}: MessageDialogProps) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");

    const handleSend = () => {
        if (!message.trim()) return;
        onSendMessage(message);
        setOpen(false);
        setMessage("");
    };
    
    const promptOptions = predefinedPrompts.map(p => ({ value: p.id, label: p.title, content: p.prompt }));
    const replyOptions = quickReplies.map(r => ({ value: r.id, label: r.title, content: r.prompt }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerButton}
            </DialogTrigger>
            <DialogContent className="md:w-1/2 md:h-3/5 max-w-4xl flex flex-col">
                <DialogHeader>
                    <DialogTitle>{dialogTitle}</DialogTitle>
                    <DialogDescription>{dialogDescription}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 pr-6">
                    <div className="grid gap-4 py-4">
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
                            <Label htmlFor="message-text">Message</Label>
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
