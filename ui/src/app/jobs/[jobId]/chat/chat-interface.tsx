"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChatMessage } from "@/lib/types";
import { listChatMessages, sendChatMessage } from "@/app/chat/actions";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, User, Bot, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTransition } from "react";

interface ChatInterfaceProps {
    jobId: string;
}

export function ChatInterface({ jobId }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, startSendingTransition] = useTransition();
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    // const [lastPoll, setLastPoll] = useState(Date.now());

    // Poll for messages
    useEffect(() => {
        let isMounted = true;
        const fetchMessages = async () => {
            try {
                // We could optimize by passing 'since' timestamp of last message
                // But for now let's just fetch all (or limit to last 50)
                const msgs = await listChatMessages(jobId, undefined, 50);
                if (isMounted) {
                    // Bolt ⚡: Prevent re-renders if fetched messages haven't changed
                    setMessages(prev => JSON.stringify(prev) !== JSON.stringify(msgs) ? msgs : prev);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to fetch messages:", error);
                // Don't toast on every poll failure to avoid spam
            }
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [jobId]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const [recipient, setRecipient] = useState("");

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const content = inputValue;
        setInputValue(""); // Clear immediately for better UX via optimistic update?
        
        startSendingTransition(async () => {
            try {
                await sendChatMessage(jobId, content, true, "User", recipient || undefined);
                // The poll will pick it up, or we can fetch immediately
                const msgs = await listChatMessages(jobId, undefined, 50);
                setMessages(msgs);
            } catch (error) {
                console.error("Failed to send message:", error);
                toast({
                    variant: "destructive",
                    title: "Failed to send message",
                    description: "Please try again.",
                });
                setInputValue(content); // Restore content on failure
            }
        });
    };

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="pb-3 border-b">
                <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    Agent Chat
                </CardTitle>
                <div className="flex gap-2 items-center mt-2">
                    <Input
                        placeholder="Recipient (Optional: Agent Name)"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        className="text-sm h-8 w-64"
                    />
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                    <div className="flex flex-col gap-4">
                        {isLoading && messages.length === 0 ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                No messages yet. Start the conversation!
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-3 ${
                                        msg.role === "user" ? "flex-row-reverse" : "flex-row"
                                    }`}
                                >
                                    <Avatar className="w-8 h-8">
                                        <AvatarFallback className={msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}>
                                            {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div
                                        className={`flex flex-col max-w-[80%] ${
                                            msg.role === "user" ? "items-end" : "items-start"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-semibold">
                                                {msg.sender}
                                                {msg.recipient ? ` -> ${msg.recipient}` : ""}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(msg.createdAt).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div
                                            className={`rounded-lg p-3 text-sm ${
                                                msg.role === "user"
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted"
                                            }`}
                                        >
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className="p-4 border-t">
                <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type a message..."
                        disabled={isSending}
                        className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={isSending || !inputValue.trim()}>
                        {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}
