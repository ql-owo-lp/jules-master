'use client';

import { useEffect, useState, useRef } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LogEntry {
  timestamp: string;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
}

export default function SystemLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/logs');

    eventSource.onmessage = (event) => {
      try {
        const newLog: LogEntry = JSON.parse(event.data);
        setLogs((prevLogs) => [...prevLogs, newLog]);
      } catch (error) {
        console.error('Failed to parse log entry:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);


  const clearLogs = () => {
    setLogs([]);
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-foreground';
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card className="h-[calc(100vh-100px)] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            System Log
          </CardTitle>
          <Button variant="outline" size="sm" onClick={clearLogs}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full w-full p-4 font-mono text-sm bg-muted/50">
             <div ref={scrollRef}>
                {logs.length === 0 ? (
                  <div className="text-muted-foreground text-center py-10">
                    Waiting for logs...
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1 flex gap-2 break-all">
                      <span className="text-muted-foreground shrink-0 select-none">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>
                      <span className={getLogColor(log.type)}>{log.message}</span>
                    </div>
                  ))
                )}
                 <div ref={bottomRef} />
             </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
